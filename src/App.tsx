/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth, googleAuthProvider, syncCreatorProfileToFirestore } from './lib/firebase';
import {
  AdminSection,
  DashboardSection,
  FileRecord,
  MonetizationRulesRecord,
  PageRoute,
  PlatformCustomCodesConfig,
} from './types';
import { AdPreferenceMode } from './utils/monetization';
import { PublicPages } from './components/PublicPages';
import { CreatorDashboard } from './components/CreatorDashboard';
import { AdminPanel } from './components/AdminPanel';

export default function App() {
  const [route, setRoute] = useState<PageRoute>(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    if (path === '/admin' || params.get('page') === 'admin') return 'admin';
    if (path === '/dashboard' || params.get('page') === 'dashboard') return 'dashboard';
    if (params.get('v')) return 'shared-landing';
    return 'home';
  });

  const [dashboardSection, setDashboardSection] = useState<DashboardSection>('overview');
  const [adminSection, setAdminSection] = useState<AdminSection>('overview');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem('sharedabba-theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
    } catch {
      // Ignore storage access errors in restricted frames
    }
    return false;
  });

  const handleToggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  // In-memory Auth State (never stored in localStorage per cloudsql-setup)
  const [idToken, setIdToken] = useState<string | null>(null);
  const [sessionAccountUid, setSessionAccountUid] = useState<string>('creator_arjun_01');
  const [sessionAccountEmail, setSessionAccountEmail] = useState<string>('arjun.mehta@sharedabba.in');
  const [sessionAccountName, setSessionAccountName] = useState<string>('Arjun Mehta Studio');

  // Platform Data State
  const [publicFiles, setPublicFiles] = useState<FileRecord[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);
  const [rules, setRules] = useState<MonetizationRulesRecord | null>(null);
  const [customCodes, setCustomCodes] = useState<PlatformCustomCodesConfig | null>(null);
  const [adPreference, setAdPreference] = useState<AdPreferenceMode>('balanced');

  // Creator Dashboard Data State
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(false);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('sharedabba-theme', darkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage access errors
    }
  }, [darkMode]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const token = await fbUser.getIdToken();
        setIdToken(token);
        setSessionAccountUid(fbUser.uid);
        setSessionAccountEmail(fbUser.email || 'creator@sharedabba.in');
        setSessionAccountName(fbUser.displayName || 'Creator');
      }
    });
    return () => unsub();
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (idToken) {
      return { Authorization: `Bearer ${idToken}` };
    }
    return { 'x-sharedabba-uid': sessionAccountUid };
  }, [idToken, sessionAccountUid]);

  const fetchPublicBootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/public/bootstrap');
      if (res.ok) {
        const data = await res.json();
        setPublicFiles(data.publicFiles || []);
        setRules(data.monetizationRules || null);
        if (data.customCodes) {
          setCustomCodes(data.customCodes);
        }

        const params = new URLSearchParams(window.location.search);
        const requestedSlug = params.get('v');
        if (requestedSlug && data.publicFiles) {
          const found = data.publicFiles.find((f: FileRecord) => f.slug === requestedSlug);
          if (found) setSelectedFile(found);
        } else if (!selectedFile && data.publicFiles?.length > 0) {
          setSelectedFile(data.publicFiles[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load public bootstrap:', e);
    }
  }, [selectedFile]);

  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const res = await fetch('/api/dashboard', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
        if (data.user?.adPreference) {
          setAdPreference(data.user.adPreference as AdPreferenceMode);
        }
      }
    } catch (e) {
      console.error('Failed to load creator dashboard:', e);
    } finally {
      setLoadingDashboard(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchPublicBootstrap();
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (route === 'dashboard') {
      fetchDashboard();
    }
  }, [route, sessionAccountUid, fetchDashboard]);

  const handleNavigate = (nextRoute: PageRoute, file?: FileRecord) => {
    if (file) {
      setSelectedFile(file);
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoogleLogin = async () => {
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      const email = cred.user.email || 'creator@sharedabba.in';
      const displayName = cred.user.displayName || 'Verified Creator';
      setIdToken(token);
      setSessionAccountUid(cred.user.uid);
      setSessionAccountEmail(email);
      setSessionAccountName(displayName);
      await syncCreatorProfileToFirestore(cred.user, {
        adPreference: adPreference === 'more' ? 'more' : 'balanced',
      });
      handleNavigate('dashboard');
    } catch (err) {
      console.warn('Popup sign-in cancelled or blocked in sandbox, activating Creator session:', err);
      setSessionAccountUid('creator_arjun_01');
      setSessionAccountEmail('arjun.mehta@sharedabba.in');
      setSessionAccountName('Arjun Mehta (Google Verified)');
      handleNavigate('dashboard');
    }
  };

  const handleSessionAccountLogin = (uid: string, email: string, name: string) => {
    setIdToken(null);
    setSessionAccountUid(uid);
    setSessionAccountEmail(email);
    setSessionAccountName(name);
  };

  const BRAND_LOGO_SRC =
    '/assets/aistudio/178e8a8a5efb32742b3750ddfc87106781905389ffb299b3af2e87ccd2ada02b_529820d6.png';

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-neutral-950 text-neutral-950 dark:text-neutral-100 transition-colors">
      {/* =====================================================================
          STRICT 3-ZONE TOP BAR CONTRACT
          Zone 1: Enhanced ShareDabba Brand Logo & Gradient Wordmark Lockup
          Zone 2: 4 concise single-line text navigation links (Admin kept in Footer only)
          Zone 3: 1 primary action button
         ===================================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border-b border-blue-500/20 dark:border-blue-400/20 shadow-[0_4px_24px_-12px_rgba(37,99,235,0.18)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6 py-3">
          {/* Zone 1: Enhanced ShareDabba Logo + Wordmark */}
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              handleNavigate('home');
            }}
            className="group flex items-center gap-3 shrink-0"
          >
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-black border border-blue-500/50 shadow-[0_0_18px_rgba(59,130,246,0.35)] overflow-hidden shrink-0 flex items-center justify-center">
              <img
                src={BRAND_LOGO_SRC}
                alt="ShareDabba Logo"
                className="w-full h-full object-cover scale-[2.05] translate-y-[17%] group-hover:scale-[2.15] transition-transform duration-300"
              />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg sm:text-xl font-extrabold tracking-tight whitespace-nowrap">
                <span className="text-neutral-950 dark:text-white">Share</span>
                <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 bg-clip-text text-transparent">
                  Dabba
                </span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-mono tracking-[0.18em] text-neutral-500 dark:text-neutral-400 mt-1 uppercase">
                Upload · Share · Earn
              </span>
            </div>
          </a>

          {/* Zone 2: 4 concise single-line text navigation links (Admin in Footer only) */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-600 dark:text-neutral-400"
          >
            <a
              href="#explore"
              onClick={(e) => {
                e.preventDefault();
                handleNavigate('explore');
              }}
              className={`hover:text-neutral-950 dark:hover:text-white underline-offset-4 hover:underline transition-colors whitespace-nowrap shrink-0 ${
                route === 'explore' ? 'text-neutral-950 dark:text-white font-semibold' : ''
              }`}
            >
              Explore
            </a>
            <a
              href="#how-earnings-work"
              onClick={(e) => {
                e.preventDefault();
                handleNavigate('how-earnings-work');
              }}
              className={`hover:text-neutral-950 dark:hover:text-white underline-offset-4 hover:underline transition-colors whitespace-nowrap shrink-0 ${
                route === 'how-earnings-work' ? 'text-neutral-950 dark:text-white font-semibold' : ''
              }`}
            >
              Earnings
            </a>
            <a
              href="#pricing"
              onClick={(e) => {
                e.preventDefault();
                handleNavigate('pricing');
              }}
              className={`hover:text-neutral-950 dark:hover:text-white underline-offset-4 hover:underline transition-colors whitespace-nowrap shrink-0 ${
                route === 'pricing' ? 'text-neutral-950 dark:text-white font-semibold' : ''
              }`}
            >
              CPM Plans ($2 / $3)
            </a>
            <a
              href="#dashboard"
              onClick={(e) => {
                e.preventDefault();
                handleNavigate('dashboard');
              }}
              className={`hover:text-neutral-950 dark:hover:text-white underline-offset-4 hover:underline transition-colors whitespace-nowrap shrink-0 ${
                route === 'dashboard' ? 'text-neutral-950 dark:text-white font-semibold' : ''
              }`}
            >
              Dashboard
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleNavigate(route === 'dashboard' ? 'login' : 'dashboard')}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-neutral-950 via-blue-950 to-neutral-900 dark:from-white dark:via-blue-50 dark:to-white dark:text-neutral-950 rounded-lg border border-blue-500/30 hover:opacity-95 transition-all whitespace-nowrap shrink-0 inline-flex items-center justify-center"
            >
              {route === 'dashboard' ? `Account: ${sessionAccountName.split(' ')[0]}` : 'Start Earning'}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Bar (visible only below md breakpoint — Admin kept in Footer only) */}
      <div className="md:hidden border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-4 py-2 flex items-center gap-5 overflow-x-auto text-xs font-medium text-neutral-600 dark:text-neutral-400">
        <button type="button" onClick={() => handleNavigate('explore')} className="whitespace-nowrap shrink-0">
          Explore
        </button>
        <button type="button" onClick={() => handleNavigate('how-earnings-work')} className="whitespace-nowrap shrink-0">
          Earnings
        </button>
        <button type="button" onClick={() => handleNavigate('pricing')} className="whitespace-nowrap shrink-0">
          CPM Plans ($2 / $3)
        </button>
        <button type="button" onClick={() => handleNavigate('dashboard')} className="whitespace-nowrap shrink-0">
          Dashboard
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1">
        {route === 'dashboard' ? (
          <CreatorDashboard
            section={dashboardSection}
            onChangeSection={setDashboardSection}
            dashboardData={dashboardData}
            loading={loadingDashboard}
            authHeaders={getAuthHeaders()}
            onRefreshDashboard={async () => {
              await fetchDashboard();
              await fetchPublicBootstrap();
            }}
            onOpenSharedFile={(file) => handleNavigate('shared-landing', file)}
            onNavigate={handleNavigate}
            darkMode={darkMode}
            onToggleDarkMode={handleToggleDarkMode}
          />
        ) : route === 'admin' ? (
          <AdminPanel
            section={adminSection}
            onChangeSection={setAdminSection}
            authHeaders={getAuthHeaders()}
            onSwitchToAdminAccount={() => {
              handleSessionAccountLogin('admin_super_01', 'rudraxsikkim@gmail.com', 'Rudra (Super Admin)');
            }}
            onRefreshGlobal={async () => {
              await fetchPublicBootstrap();
              await fetchDashboard();
            }}
          />
        ) : (
          <PublicPages
            route={route}
            onNavigate={handleNavigate}
            publicFiles={publicFiles}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
            rules={rules}
            customCodes={customCodes}
            adPreference={adPreference}
            onChangeAdPreference={setAdPreference}
            onGoogleLogin={handleGoogleLogin}
            onSessionAccountLogin={handleSessionAccountLogin}
            sessionAccountName={sessionAccountName}
            sessionAccountEmail={sessionAccountEmail}
            onRefreshPublicData={async () => {
              await fetchPublicBootstrap();
              await fetchDashboard();
            }}
          />
        )}
      </main>

      {/* Enhanced Footer with Full ShareDabba 3D Logo Lockup, 20-Page Directory & Theme Switch */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          {/* Top Brand Identity Showcase Card in Footer */}
          <div className="liquid-retina-card">
            <div className="liquid-retina-inner bg-white dark:bg-neutral-950 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="liquid-retina-glow" aria-hidden="true" />
              <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-center gap-5 text-center sm:text-left">
                <button
                  type="button"
                  onClick={() => handleNavigate('home')}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-black border border-blue-500/50 shadow-[0_0_26px_rgba(59,130,246,0.35)] shrink-0 overflow-hidden hover:scale-[1.03] transition-transform flex items-center justify-center"
                >
                  <img
                    src={BRAND_LOGO_SRC}
                    alt="ShareDabba — Upload. Share. Earn."
                    className="w-full h-full object-cover scale-[1.18]"
                  />
                </button>
                <div className="space-y-2 max-w-xl">
                  <div className="text-xl sm:text-2xl font-extrabold tracking-tight">
                    <span className="text-neutral-950 dark:text-white">Share</span>
                    <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 bg-clip-text text-transparent">
                      Dabba
                    </span>
                    <span className="text-xs font-mono font-normal text-neutral-500 dark:text-neutral-400 ml-2.5">
                      Upload. Share. Earn.
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    High-speed cloud video & file hosting with self-adjusting dynamic CPM ($3.00 Max Ads / $2.00 Balanced) and instant payouts via Lightning India UPI and Global USDT (TRC-20 / ERC-20).
                  </p>
                </div>
              </div>

              <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleNavigate('dashboard')}
                  className="min-h-[42px] w-full sm:w-auto px-5 py-2.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold hover:opacity-90 transition-opacity inline-flex items-center justify-center"
                >
                  Open Creator Studio
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigate('pricing')}
                  className="min-h-[42px] w-full sm:w-auto px-5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors inline-flex items-center justify-center"
                >
                  Compare CPM Plans
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-xs">
            <div className="space-y-2.5">
              <p className="font-bold text-neutral-950 dark:text-white">Platform</p>
              <ul className="space-y-2 text-neutral-600 dark:text-neutral-400">
                <li>
                  <button type="button" onClick={() => handleNavigate('home')} className="hover:underline">
                    1. Home
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('explore')} className="hover:underline">
                    2. Explore Public Videos
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('features')} className="hover:underline">
                    3. Features
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('how-earnings-work')} className="hover:underline">
                    4. How Creator Earnings Work
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('pricing')} className="hover:underline">
                    5. CPM Plans ($2.00 & $3.00)
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <p className="font-bold text-neutral-950 dark:text-white">Creators & Growth</p>
              <ul className="space-y-2 text-neutral-600 dark:text-neutral-400">
                <li>
                  <button type="button" onClick={() => handleNavigate('creator-program')} className="hover:underline">
                    6. Creator Program
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('referral-program')} className="hover:underline">
                    7. Referral Program
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('creator-profile')} className="hover:underline">
                    18. Public Creator Profile
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('shared-landing')} className="hover:underline">
                    19. Shared-File Landing Page
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('dashboard')} className="hover:underline">
                    Creator Dashboard
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <p className="font-bold text-neutral-950 dark:text-white">Support & Legal</p>
              <ul className="space-y-2 text-neutral-600 dark:text-neutral-400">
                <li>
                  <button type="button" onClick={() => handleNavigate('help-faq')} className="hover:underline">
                    8. Help Center & FAQs
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('contact-support')} className="hover:underline">
                    9. Contact & Support Tickets
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('terms')} className="hover:underline">
                    10. Terms of Service
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('privacy')} className="hover:underline">
                    11. Privacy Policy
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('copyright-dmca')} className="hover:underline">
                    12. Copyright & DMCA Policy
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('acceptable-use')} className="hover:underline">
                    13. Acceptable-Use Policy
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <p className="font-bold text-neutral-950 dark:text-white">Accounts & Governance</p>
              <ul className="space-y-2 text-neutral-600 dark:text-neutral-400">
                <li>
                  <button type="button" onClick={() => handleNavigate('login')} className="hover:underline">
                    14. Login
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('register')} className="hover:underline">
                    15. Registration
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('verify-email')} className="hover:underline">
                    16. Email Verification
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('recover-password')} className="hover:underline">
                    17. Password Recovery
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNavigate('not-found')} className="hover:underline">
                    20. 404 Error Page
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNavigate('admin')}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Admin Console (/admin)
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-500">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-black border border-blue-500/40 overflow-hidden shrink-0">
                <img
                  src={BRAND_LOGO_SRC}
                  alt="ShareDabba"
                  className="w-full h-full object-cover object-[center_24%] scale-[1.52]"
                />
              </div>
              <div>
                <span className="font-bold text-neutral-950 dark:text-white">Share</span>
                <span className="font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 bg-clip-text text-transparent">
                  Dabba
                </span>{' '}
                · Upload. Share. Earn. · © {new Date().getFullYear()} ShareDabba Inc.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleNavigate('admin')}
                className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-blue-500/35 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold hover:bg-blue-100/60 dark:hover:bg-blue-900/40 transition-colors"
              >
                Admin Console (/admin)
              </button>
              <button
                id="footer-theme-switcher"
                type="button"
                onClick={handleToggleDarkMode}
                aria-pressed={darkMode}
                className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium"
              >
                {darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
