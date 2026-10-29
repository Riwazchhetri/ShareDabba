import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Users,
  FileText,
  Sliders,
  Landmark,
  Radio,
  Settings,
  Lock,
  Check,
  X,
  Zap,
  Coins,
  RefreshCw,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  Megaphone,
  PlusCircle,
  MinusCircle,
  Search,
  Trash2,
  Sparkles,
  Download,
  Globe,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import {
  AdminSection,
  FileRecord,
  MonetizationRulesRecord,
  PageRoute,
  PlatformCustomCodesConfig,
  UserRecord,
  WalletLedgerRecord,
  WithdrawalRequestRecord,
} from '../types';
import { formatBytes } from './MediaArtwork';
import { syncPayoutConfigToFirestore } from '../lib/firebase';

interface AdminPanelProps {
  section: AdminSection;
  onChangeSection: (sec: AdminSection) => void;
  authHeaders: Record<string, string>;
  sessionAccountEmail?: string;
  onSwitchToAdminAccount: () => void;
  onRefreshGlobal: () => Promise<void>;
  onNavigate?: (route: PageRoute) => void;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  section,
  onChangeSection,
  authHeaders,
  sessionAccountEmail,
  onSwitchToAdminAccount,
  onRefreshGlobal,
  onNavigate,
  darkMode,
  onToggleDarkMode,
}) => {
  // ==========================================================================
  // STRICT ADMIN VAULT AUTHENTICATION STATE (ID: Riwaz | PASS: 7001473587 | EMAIL: rudraxsikkim@gmail.com)
  // ==========================================================================
  const [vaultToken, setVaultToken] = useState<string | null>(null);
  const [vaultAdminId, setVaultAdminId] = useState<string>('');
  const [vaultExpiresAt, setVaultExpiresAt] = useState<number | null>(null);
  const [manuallyLocked, setManuallyLocked] = useState<boolean>(false);

  const [loginIdInput, setLoginIdInput] = useState<string>('');
  const [loginPassInput, setLoginPassInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authSubmitting, setAuthSubmitting] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number>(5);

  const [adminData, setAdminData] = useState<{
    users: UserRecord[];
    files: FileRecord[];
    withdrawals: WithdrawalRequestRecord[];
    ledger: WalletLedgerRecord[];
    reports: Array<{
      id: number;
      fileId: number | null;
      reporterEmail: string;
      reasonCategory: string;
      details: string;
      copyrightClaim: boolean;
      status: string;
      createdAt: string;
    }>;
    tickets: Array<{
      id: number;
      ticketNumber: string;
      email: string;
      subject: string;
      category: string;
      status: string;
    }>;
    auditLogs: Array<{
      id: number;
      actorUid: string;
      actorRole: string;
      action: string;
      entityType: string;
      entityId: string;
      metadataJson: string;
      createdAt: string;
    }>;
    monetizationRules: MonetizationRulesRecord;
    customCodes?: PlatformCustomCodesConfig;
    integrations: {
      cloudSqlPostgres: boolean;
      firebaseAuth: boolean;
      s3Configured: boolean;
      razorpayxConfigured: boolean;
      vastConfigured: boolean;
      smtpConfigured: boolean;
    };
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  // Monetization Config Form State
  const [modeInput, setModeInput] = useState<'fixed_cpm' | 'revenue_share'>('fixed_cpm');
  const [cpmInput, setCpmInput] = useState('2.00');
  const [revShareInput, setRevShareInput] = useState('65.00');
  const [minWithdrawInput, setMinWithdrawInput] = useState('5.00');
  const [inrRateInput, setInrRateInput] = useState('86.45');
  const [refCommInput, setRefCommInput] = useState('10.00');
  const [minWatchSecInput, setMinWatchSecInput] = useState('5');
  const [holdDaysInput, setHoldDaysInput] = useState('7');
  const [countryRates, setCountryRates] = useState<Record<string, number>>({
    IN: 2.0,
    US: 3.4,
    GB: 3.1,
    DE: 2.8,
    SG: 2.6,
    AE: 2.4,
  });

  // User Management & Direct Wallet Credit/Debit State
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIdForWallet, setSelectedUserIdForWallet] = useState<number>(1);
  const [walletAdjustAmount, setWalletAdjustAmount] = useState<string>('10.00');
  const [walletAdjustNote, setWalletAdjustNote] = useState<string>(
    'Creator Performance Bonus credited by Super Admin Riwaz'
  );
  const [walletActionLoading, setWalletActionLoading] = useState(false);

  // Content & Ticket Filter State
  const [fileSearch, setFileSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'resolved'>('all');

  // Finance Custom UTR State
  const [customUtrMap, setCustomUtrMap] = useState<Record<number, string>>({});

  // Global Broadcast State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastCategory, setBroadcastCategory] = useState('payout');
  const [pinBroadcastToBanner, setPinBroadcastToBanner] = useState(true);
  const [broadcastSending, setBroadcastSending] = useState(false);

  // Audit / Activity Log Filter State
  const [auditFilter, setAuditFilter] = useState('');
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<
    'all' | 'config' | 'users' | 'payouts' | 'content' | 'security'
  >('all');

  // Custom Codes, Scripts, Branding & Dynamic Ad-Tier CPM Studio State
  const [codesForm, setCodesForm] = useState<PlatformCustomCodesConfig>({
    maxAdsCpmUsd: 3.0,
    balancedAdsCpmUsd: 2.0,
    halfAdsCpmUsd: 1.5,
    vastPreRollTagUrl: 'https://ads.sharedabba.com/vast/v4/preroll?placement=max_or_balanced',
    vastMidRollTagUrl: 'https://ads.sharedabba.com/vast/v4/midroll?interval=300',
    vastPostRollTagUrl: 'https://ads.sharedabba.com/vast/v4/postroll',
    customAdScriptCode:
      '<!-- Paste VAST / AdSense / Custom Ad Network JS Snippet Here -->\n<script async src="https://ads.sharedabba.com/sdk/v2/loader.js" data-publisher="sd-live"></script>',
    customHeaderScriptCode:
      '<!-- Paste Analytics / Pixel / Verification Meta or Script Here -->\n<meta name="sharedabba-verification" content="verified-publisher-token" />',
    customPlayerEmbedCode:
      '<!-- Custom Video Player Overlay / Watermark Hook -->\n<script>window.SHAREDABBA_PLAYER_CONFIG = { watermark: true, adaptiveHls: true };</script>',
    upiProviderName: 'RazorpayX UPI Payouts',
    upiKeyId: 'rzp_live_sharedabba_payout_01',
    upiWebhookEndpoint: 'https://api.sharedabba.com/webhooks/upi-payout',
    upiPayoutEnabled: true,
    usdtPayoutEnabled: true,
    upiMinWithdrawalUsd: 5.0,
    usdtMinWithdrawalUsd: 20.0,
    upiFeePercent: 0.0,
    usdtFeePercent: 1.5,
    usdToInrRate: 86.45,
    usdtToInrRate: 88.85,
    usdtSupportedNetworks: 'TRC-20, ERC-20, BEP-20, Polygon',
    usdtTreasuryWallet: 'TX8k9mShareDabbaTreasuryNode01',
    s3EndpointUrl: 'https://<account-id>.r2.cloudflarestorage.com',
    s3BucketName: 'sharedabba-media-prod',
    cdnCustomDomain: 'https://cdn.sharedabba.com',
    supportEmail: 'support@sharedabba.com',
    announcementBanner:
      'Dynamic CPM Tiers Active: Max Ads ($3.00 eCPM) & Balanced ($2.00 eCPM) · Instant UPI & USDT Payouts',
    announcementBannerEnabled: true,
    customHeroHeadline: 'Your Content. Your Links. Your Earnings.',
    customHeroSubheadline: '',
    customFooterTagline:
      'Upload, Share & Monetize Video and File Links with Instant India UPI & Global USDT Payouts.',
    officialTelegramUrl: 'https://t.me/sharedabba_creators',
    maxUploadSizeMb: 5120,
    registrationEnabled: true,
    maintenanceMode: false,
    autoApproveKycPayouts: false,
  });
  const [syncingFx, setSyncingFx] = useState(false);

  const getVaultHeaders = useCallback(
    (overrideToken?: string): Record<string, string> => {
      const activeToken = overrideToken || vaultToken || '';
      return {
        ...authHeaders,
        'x-admin-vault-token': activeToken,
      };
    },
    [authHeaders, vaultToken]
  );

  const fetchAdminData = useCallback(
    async (tokenOverride?: string) => {
      const tokenToUse = tokenOverride || vaultToken;
      if (!tokenToUse) return;
      setLoading(true);
      try {
        const res = await fetch('/api/admin/overview', {
          headers: getVaultHeaders(tokenToUse),
        });
        if (res.status === 401) {
          setVaultToken(null);
          setAdminData(null);
          setAuthError('Admin Vault session expired. Please authenticate with ID & Passkey.');
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setAdminData(data);
          if (data.users?.length > 0 && !selectedUserIdForWallet) {
            setSelectedUserIdForWallet(data.users[0].id);
          }
          if (data.monetizationRules) {
            setModeInput(data.monetizationRules.activeMode);
            setCpmInput(data.monetizationRules.targetCpmUsd);
            setRevShareInput(data.monetizationRules.revenueSharePercent);
            setMinWithdrawInput(data.monetizationRules.minWithdrawalUsd);
            setInrRateInput(data.monetizationRules.usdToInrRate);
            setRefCommInput(data.monetizationRules.referralCommissionPercent);
            setMinWatchSecInput(String(data.monetizationRules.minWatchSeconds ?? 5));
            setHoldDaysInput(String(data.monetizationRules.holdPeriodDays ?? 7));
            if (data.monetizationRules.countryRatesJson) {
              try {
                const parsedRates = JSON.parse(data.monetizationRules.countryRatesJson);
                setCountryRates((prev) => ({ ...prev, ...parsedRates }));
              } catch {
                // Keep defaults
              }
            }
          }
          if (data.customCodes) {
            const loadedUsdInr = Number(
              data.customCodes.usdToInrRate ?? data.monetizationRules?.usdToInrRate ?? 86.45
            );
            const loadedUsdtInr = Number(data.customCodes.usdtToInrRate ?? 88.85);
            setInrRateInput(loadedUsdInr.toFixed(2));
            setCodesForm((prev) => ({
              ...prev,
              ...data.customCodes,
              upiPayoutEnabled: data.customCodes.upiPayoutEnabled ?? true,
              usdtPayoutEnabled: data.customCodes.usdtPayoutEnabled ?? true,
              upiMinWithdrawalUsd: Number(data.customCodes.upiMinWithdrawalUsd ?? 5.0),
              usdtMinWithdrawalUsd: Number(data.customCodes.usdtMinWithdrawalUsd ?? 20.0),
              upiFeePercent: Number(data.customCodes.upiFeePercent ?? 0.0),
              usdtFeePercent: Number(data.customCodes.usdtFeePercent ?? 1.5),
              usdToInrRate: loadedUsdInr,
              usdtToInrRate: loadedUsdtInr,
              announcementBannerEnabled: data.customCodes.announcementBannerEnabled ?? true,
              registrationEnabled: data.customCodes.registrationEnabled ?? true,
              maintenanceMode: data.customCodes.maintenanceMode ?? false,
              autoApproveKycPayouts: data.customCodes.autoApproveKycPayouts ?? false,
              maxUploadSizeMb: Number(data.customCodes.maxUploadSizeMb ?? 5120),
            }));
          }
        }
      } catch (e) {
        console.error('Admin load error:', e);
      } finally {
        setLoading(false);
      }
    },
    [vaultToken, getVaultHeaders, selectedUserIdForWallet]
  );

  const handleEmailBoundUnlock = useCallback(
    async (emailToVerify: string) => {
      if (authSubmitting) return;
      setAuthError(null);
      setAuthSubmitting(true);
      try {
        const res = await fetch('/api/admin/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailToVerify.trim().toLowerCase() }),
        });
        const data = await res.json();
        if (!res.ok) {
          setAuthError(data.error || 'Email is not bound to Super Admin privileges.');
          return;
        }
        setManuallyLocked(false);
        setVaultToken(data.token);
        setVaultAdminId(data.adminId || 'Riwaz');
        setVaultExpiresAt(data.expiresAt || null);
        onSwitchToAdminAccount();
        await fetchAdminData(data.token);
      } catch (err: any) {
        setAuthError(err.message || 'Failed to verify Super Admin email binding.');
      } finally {
        setAuthSubmitting(false);
      }
    },
    [authSubmitting, fetchAdminData, onSwitchToAdminAccount]
  );

  // Automatically unlock Admin Portal when logged in as rudraxsikkim@gmail.com
  useEffect(() => {
    const cleanEmail = (sessionAccountEmail || '').trim().toLowerCase();
    if (cleanEmail === 'rudraxsikkim@gmail.com' && !vaultToken && !manuallyLocked && !authSubmitting) {
      handleEmailBoundUnlock('rudraxsikkim@gmail.com');
    }
  }, [sessionAccountEmail, vaultToken, manuallyLocked, authSubmitting, handleEmailBoundUnlock]);

  const handleVaultLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authSubmitting) return;
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: loginIdInput.trim(),
          password: loginPassInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.remainingAttempts === 'number') {
          setRemainingAttempts(data.remainingAttempts);
        }
        setAuthError(data.error || 'Invalid Super Admin credentials.');
        return;
      }

      setManuallyLocked(false);
      setVaultToken(data.token);
      setVaultAdminId(data.adminId || 'Riwaz');
      setVaultExpiresAt(data.expiresAt || null);
      setLoginPassInput('');
      onSwitchToAdminAccount();
      await fetchAdminData(data.token);
    } catch (err: any) {
      setAuthError(err.message || 'Failed to connect to Admin Security Vault.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLockAdminVault = async () => {
    try {
      if (vaultToken) {
        await fetch('/api/admin/auth/logout', {
          method: 'POST',
          headers: getVaultHeaders(),
        });
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      setManuallyLocked(true);
      setVaultToken(null);
      setVaultAdminId('');
      setAdminData(null);
      setLoginIdInput('');
      setLoginPassInput('');
      setAuthError(null);
    }
  };

  const handleSyncLiveFx = async () => {
    if (syncingFx) return;
    setSyncingFx(true);
    try {
      const res = await fetch('/api/fx/usdt-inr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getVaultHeaders() },
        body: JSON.stringify({ mode: 'sync_live' }),
      });
      if (res.ok) {
        const data = await res.json();
        const nextUsdt = Number(data.usdtToInrRate || 88.85);
        const nextUsd = Number(data.usdToInrRate || 86.45);
        setInrRateInput(nextUsd.toFixed(2));
        setCodesForm((prev) => ({
          ...prev,
          usdToInrRate: nextUsd,
          usdtToInrRate: nextUsdt,
        }));
        setActionBanner(
          `Synced Live Market FX Rates (${data.source || 'Oracle'}): 1 USDT = ₹${nextUsdt.toFixed(2)} INR · 1 USD = ₹${nextUsd.toFixed(2)} INR.`
        );
        await onRefreshGlobal();
      }
    } catch (e) {
      console.error('Failed to sync live FX:', e);
    } finally {
      setSyncingFx(false);
    }
  };

  const navItems: Array<{
    id: AdminSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'overview', label: 'Platform Overview', icon: Shield },
    { id: 'payout-config', label: 'Payout Configuration', icon: Coins },
    { id: 'users', label: 'A. Users & Wallet Credit', icon: Users },
    { id: 'content', label: 'B. Content & Support Queue', icon: FileText },
    { id: 'monetization', label: 'C. Monetization & Geo CPM', icon: Sliders },
    { id: 'finance', label: 'D. Finance & Settlements', icon: Landmark },
    { id: 'advertising', label: 'E. Advertising & VAST', icon: Radio },
    { id: 'site-config', label: 'F. Branding & Customizer', icon: Settings },
    { id: 'activity-logs', label: 'Activity Logs', icon: Lock },
  ];

  // ==========================================================================
  // RENDER STRICT ADMIN VAULT AUTHENTICATION GATE WHEN LOCKED
  // ==========================================================================
  if (!vaultToken) {
    return (
      <div
        id="admin-security-gate"
        className="max-w-xl mx-auto px-4 sm:px-6 py-12 sm:py-16"
      >
        <div className="liquid-retina-card">
          <div className="liquid-retina-inner bg-white dark:bg-neutral-950 p-6 sm:p-8 space-y-6">
            <div className="liquid-retina-glow" aria-hidden="true" />

            <div className="relative z-10 space-y-5">
              {/* Top Protocol Badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-neutral-950 via-blue-950 to-indigo-950 dark:from-white dark:to-blue-100 text-white dark:text-neutral-950 flex items-center justify-center shrink-0 shadow-sm">
                    <Lock className="w-5 h-5 text-amber-400 dark:text-blue-700" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-blue-600 dark:text-blue-400 font-bold block">
                      SHAREDABBA ZERO-TRUST ADMIN VAULT
                    </span>
                    <h1 className="text-lg sm:text-xl font-bold text-neutral-950 dark:text-white">
                      Super Admin Portal Authentication
                    </h1>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-bold">
                  SHA-256 PROTOCOL
                </span>
              </div>

              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                This portal is protected by hardware-grade timing-safe credential verification, HMAC-SHA256 session signing, and automated brute-force lockout. Only authorized Super Admin credentials may unlock platform governance.
              </p>

              {authError && (
                <div
                  id="admin-vault-error"
                  className="p-3.5 rounded-xl border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-mono flex items-start gap-2.5"
                >
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                  <div className="space-y-1">
                    <p className="font-bold">{authError}</p>
                    <p className="text-[11px] opacity-85">
                      Every failed attempt is logged with IP & timestamp in the immutable security audit ledger.
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleVaultLoginSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="admin-vault-id-input"
                    className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1.5"
                  >
                    Super Admin ID
                  </label>
                  <div className="relative">
                    <input
                      id="admin-vault-id-input"
                      type="text"
                      required
                      autoComplete="off"
                      placeholder="Enter Super Admin ID"
                      value={loginIdInput}
                      onChange={(e) => setLoginIdInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm font-mono text-neutral-950 dark:text-white focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="admin-vault-pass-input"
                    className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1.5"
                  >
                    Security Passkey / Password
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="admin-vault-pass-input"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="off"
                      placeholder="••••••••••"
                      value={loginPassInput}
                      onChange={(e) => setLoginPassInput(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-sm font-mono text-neutral-950 dark:text-white focus:outline-none focus:border-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
                      aria-label={showPassword ? 'Hide passkey' : 'Show passkey'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl color-graded-panel flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
                  <span>Brute-Force Shield: {remainingAttempts}/5 Attempts Available</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    256-Bit HMAC Guard Active
                  </span>
                </div>

                <div className="pt-1 flex flex-col sm:flex-row gap-3">
                  <button
                    id="admin-vault-submit-btn"
                    type="submit"
                    disabled={authSubmitting}
                    className="min-h-[44px] flex-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-neutral-950 via-blue-950 to-neutral-900 dark:from-white dark:via-blue-50 dark:to-white text-white dark:text-neutral-950 font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-sm hover:opacity-95 transition-opacity"
                  >
                    <KeyRound className="w-4 h-4 shrink-0" />
                    <span>
                      {authSubmitting ? 'Verifying Security Protocol...' : 'Unlock Super Admin Portal'}
                    </span>
                  </button>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('home')}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                    >
                      Exit to Home
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !adminData) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <p className="text-xs font-mono text-neutral-500">
          Decrypting Super Admin Telemetry & Platform Ledger...
        </p>
      </div>
    );
  }

  if (!adminData) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-4">
        <h2 className="text-xl font-bold">Loading Admin Session...</h2>
        <button
          type="button"
          onClick={() => fetchAdminData()}
          className="px-4 py-2 rounded-md bg-neutral-950 text-white text-xs font-semibold"
        >
          Reload Admin Data
        </button>
      </div>
    );
  }

  const totalStorageBytes = adminData.files.reduce((a, f) => a + f.sizeBytes, 0);
  const totalViews = adminData.files.reduce((a, f) => a + f.viewsCount, 0);
  const totalMonetizedViews = adminData.files.reduce((a, f) => a + f.monetizedViewsCount, 0);
  const creatorRevUsd = adminData.files.reduce((a, f) => a + Number(f.estimatedEarningsUsd), 0);
  const grossAdRevUsd = creatorRevUsd * 1.54;
  const pendingWithdrawals = adminData.withdrawals.filter(
    (w) => w.status === 'under_review' || w.status === 'pending' || w.status === 'processing'
  );

  const handleSaveMonetization = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/monetization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getVaultHeaders() },
      body: JSON.stringify({
        activeMode: modeInput,
        targetCpmUsd: Number(cpmInput),
        revenueSharePercent: Number(revShareInput),
        minWithdrawalUsd: Number(minWithdrawInput),
        usdToInrRate: Number(inrRateInput),
        referralCommissionPercent: Number(refCommInput),
        minWatchSeconds: Number(minWatchSecInput),
        holdPeriodDays: Number(holdDaysInput),
        countryRatesJson: JSON.stringify(countryRates),
      }),
    });
    if (res.ok) {
      setActionBanner(
        `Updated monetization engine (${modeInput === 'fixed_cpm' ? `Fixed CPM $${cpmInput}` : `RevShare ${revShareInput}%`}, Min Watch: ${minWatchSecInput}s, Hold: ${holdDaysInput}d) and country eCPM matrix.`
      );
      await fetchAdminData();
      await onRefreshGlobal();
    }
  };

  const handleSaveCustomCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...codesForm,
      usdToInrRate: Number(inrRateInput || codesForm.usdToInrRate || 86.45),
      usdtToInrRate: Number(codesForm.usdtToInrRate || 88.85),
    };
    const res = await fetch('/api/admin/platform-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getVaultHeaders() },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      try {
        await syncPayoutConfigToFirestore({
          upiPayoutEnabled: payload.upiPayoutEnabled,
          usdtPayoutEnabled: payload.usdtPayoutEnabled,
          upiMinWithdrawalUsd: Number(payload.upiMinWithdrawalUsd),
          usdtMinWithdrawalUsd: Number(payload.usdtMinWithdrawalUsd),
          upiFeePercent: Number(payload.upiFeePercent),
          usdtFeePercent: Number(payload.usdtFeePercent),
          maxAdsCpmUsd: Number(payload.maxAdsCpmUsd),
          balancedAdsCpmUsd: Number(payload.balancedAdsCpmUsd),
        });
      } catch {
        // Handled when Firebase session is active
      }
      setActionBanner(
        `Saved Platform Customization & Payout Rules — Balanced: $${Number(payload.balancedAdsCpmUsd).toFixed(2)} · Max Ads: $${Number(payload.maxAdsCpmUsd).toFixed(2)} · Live USDT/INR: ₹${Number(payload.usdtToInrRate).toFixed(2)} · Hero & Site Branding Updated.`
      );
      await fetchAdminData();
      await onRefreshGlobal();
    }
  };

  const handleWithdrawalDecision = async (
    withdrawalId: number,
    action: 'mark_processing' | 'approve_and_settle' | 'reject_and_reverse' | 'mark_failed'
  ) => {
    const customUtr = customUtrMap[withdrawalId]?.trim();
    const res = await fetch('/api/admin/withdrawals/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getVaultHeaders() },
      body: JSON.stringify({
        withdrawalId,
        action,
        providerUtr: customUtr || undefined,
        adminNote:
          action === 'approve_and_settle'
            ? `Approved & settled by Super Admin ${vaultAdminId || 'Riwaz'}${customUtr ? ` (Ref: ${customUtr})` : ''}`
            : action === 'mark_processing'
            ? `Dispatched to payout rail (PROCESSING) by Super Admin ${vaultAdminId || 'Riwaz'}`
            : action === 'mark_failed'
            ? `Marked FAILED by Super Admin ${vaultAdminId || 'Riwaz'}; funds reversed to creator wallet`
            : `Rejected by Super Admin ${vaultAdminId || 'Riwaz'}; funds returned to creator wallet`,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setActionBanner(
        action === 'approve_and_settle'
          ? `Settled withdrawal ${data.requestUuid} (UTR/Ref: ${data.providerReference}).`
          : action === 'mark_processing'
          ? `Marked withdrawal ${data.requestUuid} as PROCESSING (${data.providerReference || 'Awaiting Bank UTR'}).`
          : action === 'mark_failed'
          ? `Marked withdrawal ${data.requestUuid} as FAILED and reversed funds to creator wallet.`
          : `Rejected withdrawal ${data.requestUuid} and credited back creator wallet.`
      );
      await fetchAdminData();
      await onRefreshGlobal();
    } else {
      setActionBanner(data.error || 'Action failed');
    }
  };

  const handleBatchSettleAllPending = async () => {
    if (pendingWithdrawals.length === 0) return;
    for (const w of pendingWithdrawals) {
      await fetch('/api/admin/withdrawals/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getVaultHeaders() },
        body: JSON.stringify({
          withdrawalId: w.id,
          action: 'approve_and_settle',
          adminNote: `Batch settled by Super Admin ${vaultAdminId || 'Riwaz'}`,
        }),
      });
    }
    setActionBanner(`Batch settled all ${pendingWithdrawals.length} pending withdrawal requests.`);
    await fetchAdminData();
    await onRefreshGlobal();
  };

  const handleModerate = async (
    targetType: 'file' | 'user' | 'report' | 'ticket',
    targetId: number,
    action: string,
    reason: string
  ) => {
    const res = await fetch('/api/admin/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getVaultHeaders() },
      body: JSON.stringify({ targetType, targetId, action, reason }),
    });
    if (res.ok) {
      setActionBanner(`Moderation action (${action}) applied to ${targetType} #${targetId}.`);
      await fetchAdminData();
      await onRefreshGlobal();
    }
  };

  const handleUserGovernanceAction = async (payload: {
    userId: number;
    actionType: 'credit_wallet' | 'debit_wallet' | 'set_role' | 'verify_kyc';
    amountUsd?: number;
    newRole?: string;
    note?: string;
  }) => {
    setWalletActionLoading(true);
    try {
      const res = await fetch('/api/admin/users/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getVaultHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setActionBanner(data.message || 'User governance action applied.');
        await fetchAdminData();
        await onRefreshGlobal();
      } else {
        setActionBanner(data.error || 'User action failed.');
      }
    } finally {
      setWalletActionLoading(false);
    }
  };

  const handleSendGlobalBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim() || broadcastSending) return;
    setBroadcastSending(true);
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getVaultHeaders() },
        body: JSON.stringify({
          title: broadcastTitle.trim(),
          message: broadcastMessage.trim(),
          category: broadcastCategory,
          updateAnnouncementBanner: pinBroadcastToBanner,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionBanner(data.message || 'Global broadcast sent.');
        setBroadcastTitle('');
        setBroadcastMessage('');
        await fetchAdminData();
        await onRefreshGlobal();
      } else {
        setActionBanner(data.error || 'Broadcast failed.');
      }
    } finally {
      setBroadcastSending(false);
    }
  };

  const handleExportLedgerCsv = () => {
    const headers = ['ID', 'UUID', 'User ID', 'Entry Type', 'Amount USD', 'Balance After USD', 'Description', 'Created At'];
    const rows = adminData.ledger.map((l) => [
      l.id,
      l.ledgerUuid,
      l.userId,
      l.entryType,
      l.amountUsd,
      l.balanceAfterUsd,
      `"${(l.description || '').replace(/"/g, '""')}"`,
      l.createdAt,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sharedabba-admin-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredUsers = adminData.users.filter(
    (u) =>
      !userSearch.trim() ||
      u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredFiles = adminData.files.filter(
    (f) =>
      !fileSearch.trim() ||
      f.title.toLowerCase().includes(fileSearch.toLowerCase()) ||
      f.filename.toLowerCase().includes(fileSearch.toLowerCase()) ||
      f.fileType.toLowerCase().includes(fileSearch.toLowerCase())
  );

  const filteredTickets = adminData.tickets.filter((t) =>
    ticketFilter === 'all' ? true : t.status === ticketFilter
  );

  const classifyActivityCategory = (
    action: string,
    entityType: string
  ): 'config' | 'users' | 'payouts' | 'content' | 'security' => {
    const a = (action || '').toUpperCase();
    const e = (entityType || '').toLowerCase();
    if (
      a.includes('CONFIG') ||
      a.includes('MONETIZATION') ||
      a.includes('PLATFORM') ||
      e.includes('monetization') ||
      e.includes('platform_settings')
    ) {
      return 'config';
    }
    if (
      a.includes('USER') ||
      a.includes('SUSPEND') ||
      a.includes('REINSTATE') ||
      a.includes('WALLET') ||
      a.includes('KYC') ||
      a.includes('ROLE') ||
      e === 'users' ||
      e === 'wallet_accounts'
    ) {
      return 'users';
    }
    if (
      a.includes('WITHDRAWAL') ||
      a.includes('PAYOUT') ||
      a.includes('SETTLE') ||
      e.includes('withdrawal')
    ) {
      return 'payouts';
    }
    if (
      a.includes('FILE') ||
      a.includes('TICKET') ||
      a.includes('REPORT') ||
      a.includes('BROADCAST') ||
      e === 'file' ||
      e === 'ticket' ||
      e === 'report' ||
      e === 'notifications'
    ) {
      return 'content';
    }
    return 'security';
  };

  const formatActivitySummary = (log: {
    action: string;
    entityType: string;
    entityId: string;
    actorUid: string;
    metadataJson: string;
  }): string => {
    try {
      const meta = JSON.parse(log.metadataJson || '{}');
      if (meta.summary) return meta.summary;
      const a = (log.action || '').toUpperCase();
      if (a.includes('MODERATE_USER_SUSPEND')) {
        return `Admin banned / suspended user account #${log.entityId} (${meta.reason || 'Policy violation'})`;
      }
      if (a.includes('MODERATE_USER_REINSTATE')) {
        return `Admin reinstated user account #${log.entityId} (${meta.reason || 'Account restored'})`;
      }
      if (a.includes('SETTLE_UPI_WITHDRAWAL') || a.includes('APPROVE_UPI_PAYOUT')) {
        return `Settled payout request ${log.entityId} — $${Number(meta.amountUsd || 0).toFixed(2)} USD (₹${meta.netPayoutInr || ''} INR · UTR: ${meta.utr || 'Verified'})`;
      }
      if (a.includes('REJECT_AND_REVERSE_WITHDRAWAL')) {
        return `Rejected payout ${log.entityId} ($${Number(meta.amountUsd || 0).toFixed(2)} USD reversed to wallet — ${meta.reason || 'Compliance review'})`;
      }
      if (a.includes('UPDATE_MONETIZATION_CONFIG') || a.includes('CONFIGURE_MONETIZATION_RULES')) {
        return `Updated Monetization Engine (${meta.activeMode || 'fixed_cpm'}, Target eCPM: $${meta.targetCpmUsd ?? 2.0}, USD/INR: ₹${meta.usdToInrRate ?? 86.45})`;
      }
      if (a.includes('UPDATE_PAYOUT_AND_PLATFORM_CONFIGURATION')) {
        return `Updated Platform & Payout Configuration (Balanced: $${meta.balancedAdsCpmUsd ?? 2.0}, Max Ads: $${meta.maxAdsCpmUsd ?? 3.0}, USDT/INR: ₹${meta.usdtToInrRate ?? 88.85})`;
      }
      if (a.includes('ADMIN_WALLET_CREDIT')) {
        return `Credited +$${Number(meta.deltaUsd || 0).toFixed(2)} USD bonus to ${meta.email || `User #${meta.userId}`} (New Balance: $${Number(meta.balanceAfterUsd || 0).toFixed(2)})`;
      }
      if (a.includes('ADMIN_WALLET_DEBIT')) {
        return `Deducted -$${Number(meta.deltaUsd || 0).toFixed(2)} USD from ${meta.email || `User #${meta.userId}`} (New Balance: $${Number(meta.balanceAfterUsd || 0).toFixed(2)})`;
      }
      if (a.includes('ADMIN_CHANGE_USER_ROLE')) {
        return `Changed user role for ${meta.email || `User #${log.entityId}`} to ${meta.newRole}`;
      }
      if (a.includes('ADMIN_APPROVE_KYC') || a.includes('ADMIN_REVOKE_KYC')) {
        return `${meta.kycVerified ? 'Approved' : 'Revoked'} KYC & UPI verification for ${meta.email || `User #${log.entityId}`}`;
      }
      if (a.includes('ADMIN_GLOBAL_BROADCAST')) {
        return `Broadcasted "${meta.title || 'Platform Alert'}" to ${meta.recipients || 'all'} creators`;
      }
      if (a.includes('MODERATE_FILE')) {
        return `Applied file moderation (${log.action.replace('MODERATE_FILE_', '')}) on File #${log.entityId}`;
      }
      if (a.includes('MODERATE_TICKET')) {
        return `Updated support ticket #${log.entityId} status (${log.action.replace('MODERATE_TICKET_', '')})`;
      }
      return `${log.action} on ${log.entityType} #${log.entityId}`;
    } catch {
      return `${log.action} on ${log.entityType} #${log.entityId}`;
    }
  };

  const formatLogTimestamp = (iso: string): { formatted: string; relative: string } => {
    if (!iso) return { formatted: 'N/A', relative: 'Just now' };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { formatted: iso, relative: 'Recorded' };
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    let relative = 'Just now';
    if (diffSec >= 86400) relative = `${Math.floor(diffSec / 86400)}d ago`;
    else if (diffSec >= 3600) relative = `${Math.floor(diffSec / 3600)}h ago`;
    else if (diffSec >= 60) relative = `${Math.floor(diffSec / 60)}m ago`;
    else if (diffSec > 5) relative = `${diffSec}s ago`;
    return { formatted, relative };
  };

  const handleExportActivityLogsCsv = () => {
    const headers = [
      'Log ID',
      'Timestamp',
      'Admin Identifier',
      'Role',
      'Category',
      'Action Code',
      'Entity',
      'Summary',
      'Raw Metadata',
    ];
    const rows = filteredAuditLogs.map((l) => {
      const ts = formatLogTimestamp(l.createdAt).formatted;
      const cat = classifyActivityCategory(l.action, l.entityType);
      const summary = formatActivitySummary(l).replace(/"/g, '""');
      const raw = (l.metadataJson || '').replace(/"/g, '""');
      return [
        l.id,
        `"${ts}"`,
        `"${l.actorUid === 'admin_super_01' ? 'Riwaz' : l.actorUid}"`,
        l.actorRole,
        cat.toUpperCase(),
        l.action,
        `"${l.entityType} #${l.entityId}"`,
        `"${summary}"`,
        `"${raw}"`,
      ];
    });
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sharedabba-activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredAuditLogs = adminData.auditLogs.filter((log) => {
    const cat = classifyActivityCategory(log.action, log.entityType);
    if (activityCategoryFilter !== 'all' && cat !== activityCategoryFilter) {
      return false;
    }
    if (!auditFilter.trim()) return true;
    const q = auditFilter.toLowerCase();
    const summary = formatActivitySummary(log).toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.actorUid.toLowerCase().includes(q) ||
      log.entityType.toLowerCase().includes(q) ||
      summary.includes(q) ||
      (log.metadataJson || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Admin Sidebar */}
        <aside className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="p-4 rounded-xl color-graded-panel space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-bold">
                VAULT UNLOCKED
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
                ID: {vaultAdminId || 'Riwaz'}
              </span>
            </div>
            <p className="text-sm font-bold text-neutral-950 dark:text-white">
              ShareDabba Super Admin
            </p>
            <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
              HMAC-SHA256 Session Active
            </p>
            <button
              id="admin-lock-vault-sidebar-btn"
              type="button"
              onClick={handleLockAdminVault}
              className="mt-1 w-full px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-red-500/20 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Lock Admin Vault</span>
            </button>
          </div>

          <nav
            aria-label="Admin Navigation"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeSection(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 font-semibold shadow-2xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {onNavigate && (
            <div className="p-4 rounded-xl color-graded-panel space-y-2">
              <p className="text-[11px] font-mono text-neutral-500">QUICK WORKSPACE SWITCH</p>
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="w-full px-3 py-2 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
              >
                Open Creator Dashboard
              </button>
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white"
              >
                Return to Public Home
              </button>
            </div>
          )}
        </aside>

        {/* Admin Main Viewport */}
        <div className="flex-1 min-w-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
            <div>
              <p className="text-xs font-mono text-neutral-500">
                Super Admin ({vaultAdminId || 'Riwaz'}) / {navItems.find((n) => n.id === section)?.label}
              </p>
              <h1 className="text-2xl font-bold text-neutral-950 dark:text-white">
                {navItems.find((n) => n.id === section)?.label}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {onToggleDarkMode && (
                <button
                  type="button"
                  onClick={onToggleDarkMode}
                  className="px-3.5 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white"
                >
                  {darkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
              )}
              <button
                type="button"
                onClick={handleSyncLiveFx}
                disabled={syncingFx}
                className="px-3.5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingFx ? 'animate-spin' : ''}`} />
                <span>
                  {syncingFx
                    ? 'Syncing FX...'
                    : `USDT/INR: ₹${Number(codesForm.usdtToInrRate || 88.85).toFixed(2)}`}
                </span>
              </button>
              <button
                id="admin-lock-vault-header-btn"
                type="button"
                onClick={handleLockAdminVault}
                className="px-3.5 py-2 rounded-md border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Vault</span>
              </button>
            </div>
          </div>

          {actionBanner && (
            <div className="p-3.5 rounded-xl bg-neutral-950 text-white text-xs font-mono flex items-center justify-between border border-blue-500/40">
              <span>{actionBanner}</span>
              <button
                type="button"
                onClick={() => setActionBanner(null)}
                className="text-neutral-400 hover:text-white ml-4"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* ================================================================
              1. PLATFORM OVERVIEW + GLOBAL BROADCAST COMMAND STUDIO
             ================================================================ */}
          {section === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl color-graded-panel">
                  <p className="text-xs text-neutral-500">Registered Users / Creators</p>
                  <p className="text-2xl font-bold font-mono tabular-nums mt-1 text-neutral-950 dark:text-white">
                    {adminData.users.length} Accounts
                  </p>
                  <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    {adminData.users.filter((u) => u.kycVerified).length} KYC Verified
                  </p>
                </div>
                <div className="p-4 rounded-xl color-graded-panel">
                  <p className="text-xs text-neutral-500">Total Uploaded Cloud Media</p>
                  <p className="text-2xl font-bold font-mono tabular-nums mt-1 text-neutral-950 dark:text-white">
                    {formatBytes(totalStorageBytes)}
                  </p>
                  <p className="text-[11px] font-mono text-blue-600 dark:text-blue-400 mt-1">
                    {adminData.files.length} Active Files & Videos
                  </p>
                </div>
                <div className="p-4 rounded-xl color-graded-panel">
                  <p className="text-xs text-neutral-500">Total / Monetized Views</p>
                  <p className="text-2xl font-bold font-mono tabular-nums mt-1 text-neutral-950 dark:text-white">
                    {totalViews.toLocaleString()} / {totalMonetizedViews.toLocaleString()}
                  </p>
                  <p className="text-[11px] font-mono text-neutral-500 mt-1">
                    Plans: ${Number(codesForm.balancedAdsCpmUsd).toFixed(2)} & $
                    {Number(codesForm.maxAdsCpmUsd).toFixed(2)} eCPM
                  </p>
                </div>
                <div className="p-4 rounded-xl color-graded-panel">
                  <p className="text-xs text-neutral-500">Gross Ad Rev / Creator Share</p>
                  <p className="text-2xl font-bold font-mono tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">
                    ${grossAdRevUsd.toFixed(2)} / ${creatorRevUsd.toFixed(2)}
                  </p>
                  <p className="text-[11px] font-mono text-neutral-500 mt-1">
                    Pending Payouts: {pendingWithdrawals.length}
                  </p>
                </div>
              </div>

              {/* Global Creator Broadcast & Announcement Studio */}
              <form
                onSubmit={handleSendGlobalBroadcast}
                className="p-5 sm:p-6 rounded-xl color-graded-panel space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-lg bg-blue-600 text-white inline-flex items-center justify-center shrink-0">
                      <Megaphone className="w-4 h-4" />
                    </span>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-neutral-950 dark:text-white">
                        Global Creator Notification & Live Announcement Broadcast
                      </h2>
                      <p className="text-xs text-neutral-500">
                        Push an instant alert to all creator dashboards and optionally update the site-wide announcement bar.
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold">
                    Recipients: All {adminData.users.length} Creators
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium mb-1">Broadcast Headline</label>
                    <input
                      type="text"
                      placeholder="e.g., Special Weekend Bonus: $3.20 Max Ads eCPM Live!"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Alert Category</label>
                    <select
                      value={broadcastCategory}
                      onChange={(e) => setBroadcastCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    >
                      <option value="payout">Payout &FX Update</option>
                      <option value="system">Platform Feature Release</option>
                      <option value="promo">Creator CPM Bonus Promo</option>
                      <option value="policy">Compliance & Policy</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Broadcast Message</label>
                  <textarea
                    rows={2}
                    placeholder="Enter message to deliver to all creator notification inboxes..."
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pinBroadcastToBanner}
                      onChange={(e) => setPinBroadcastToBanner(e.target.checked)}
                      className="rounded accent-blue-600"
                    />
                    <span>Also pin this broadcast to the Global Website Top Announcement Bar</span>
                  </label>
                  <button
                    type="submit"
                    disabled={broadcastSending}
                    className="px-4 py-2 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Megaphone className="w-3.5 h-3.5" />
                    <span>{broadcastSending ? 'Broadcasting...' : 'Send Global Broadcast'}</span>
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl color-graded-panel space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                      Pending UPI & USDT Withdrawal Queue ({pendingWithdrawals.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => onChangeSection('finance')}
                      className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Open Finance →
                    </button>
                  </div>
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
                    {adminData.withdrawals.slice(0, 5).map((w) => (
                      <div key={w.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-mono font-semibold text-neutral-950 dark:text-white">
                            {w.requestUuid} · {w.destinationUpiId}
                          </p>
                          <p className="text-[11px] font-mono text-neutral-500">
                            ${Number(w.amountUsd).toFixed(2)} USD (₹{w.netPayoutInr} INR) ·{' '}
                            {w.status.toUpperCase()}
                          </p>
                        </div>
                        {w.status === 'under_review' && (
                          <button
                            type="button"
                            onClick={() => handleWithdrawalDecision(w.id, 'approve_and_settle')}
                            className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-semibold"
                          >
                            Quick Settle
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-xl color-graded-panel space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                      Support Tickets & DMCA Queue ({adminData.tickets.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => onChangeSection('content')}
                      className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Manage Queue →
                    </button>
                  </div>
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
                    {adminData.tickets.slice(0, 4).map((t) => (
                      <div key={t.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-950 dark:text-white truncate">
                            {t.ticketNumber} · {t.category}
                          </p>
                          <p className="text-neutral-500 truncate">{t.subject}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleModerate(
                              'ticket',
                              t.id,
                              t.status === 'open' ? 'resolve' : 'reopen',
                              'Admin support queue update'
                            )
                          }
                          className="px-2.5 py-1 rounded border border-neutral-300 dark:border-neutral-700 font-mono text-[11px] font-semibold shrink-0"
                        >
                          {t.status === 'open' ? 'Resolve' : 'Reopen'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              A. USER MANAGEMENT & DIRECT WALLET CREDIT / DEBIT GOVERNANCE
             ================================================================ */}
          {section === 'users' && (
            <div className="space-y-6">
              {/* Direct Creator Wallet Credit / Debit Tool */}
              <div className="p-5 sm:p-6 rounded-xl color-graded-panel space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3">
                  <div>
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                      SUPER ADMIN TREASURY CONTROL
                    </span>
                    <h2 className="text-base font-bold text-neutral-950 dark:text-white">
                      Direct Creator Wallet Credit / Debit & Bonus Disbursement
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-neutral-500">
                    Double-Entry Audited Ledger Action
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Target Creator Account</label>
                    <select
                      value={selectedUserIdForWallet}
                      onChange={(e) => setSelectedUserIdForWallet(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 font-medium"
                    >
                      {adminData.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          #{u.id} · {u.displayName} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Amount ($ USD · ≈ ₹{(Number(walletAdjustAmount || 0) * Number(inrRateInput || 86.45)).toFixed(0)} INR)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      min="0.50"
                      value={walletAdjustAmount}
                      onChange={(e) => setWalletAdjustAmount(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Ledger Audit Note</label>
                    <input
                      type="text"
                      value={walletAdjustNote}
                      onChange={(e) => setWalletAdjustNote(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    disabled={walletActionLoading}
                    onClick={() =>
                      handleUserGovernanceAction({
                        userId: selectedUserIdForWallet,
                        actionType: 'credit_wallet',
                        amountUsd: Number(walletAdjustAmount),
                        note: walletAdjustNote,
                      })
                    }
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Credit +${Number(walletAdjustAmount || 0).toFixed(2)} USD Bonus</span>
                  </button>
                  <button
                    type="button"
                    disabled={walletActionLoading}
                    onClick={() =>
                      handleUserGovernanceAction({
                        userId: selectedUserIdForWallet,
                        actionType: 'debit_wallet',
                        amountUsd: Number(walletAdjustAmount),
                        note: walletAdjustNote,
                      })
                    }
                    className="px-4 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <MinusCircle className="w-3.5 h-3.5" />
                    <span>Deduct -${Number(walletAdjustAmount || 0).toFixed(2)} USD</span>
                  </button>
                </div>
              </div>

              {/* Users Table with Search, Role Selector & KYC Toggle */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-950">
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                    Registered Creator & Staff Directory ({filteredUsers.length})
                  </h2>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search name, email, role..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50">
                        <th className="py-2.5 px-4 font-medium">User / Email</th>
                        <th className="py-2.5 px-4 font-medium">Role Selector</th>
                        <th className="py-2.5 px-4 font-medium">UPI & KYC Verification</th>
                        <th className="py-2.5 px-4 font-medium">Status</th>
                        <th className="py-2.5 px-4 font-medium text-right">Governance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {filteredUsers.map((u) => (
                        <tr key={u.id}>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-neutral-950 dark:text-white">
                              {u.displayName}
                            </p>
                            <p className="text-[11px] font-mono text-neutral-500">
                              {u.email} · Code: {u.referralCode}
                            </p>
                          </td>
                          <td className="py-3 px-4 font-mono">
                            <select
                              value={u.role}
                              onChange={(e) =>
                                handleUserGovernanceAction({
                                  userId: u.id,
                                  actionType: 'set_role',
                                  newRole: e.target.value,
                                })
                              }
                              className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono"
                            >
                              <option value="creator">creator</option>
                              <option value="moderator">moderator</option>
                              <option value="finance_admin">finance_admin</option>
                              <option value="super_admin">super_admin</option>
                            </select>
                          </td>
                          <td className="py-3 px-4 font-mono">
                            <div className="flex items-center gap-2">
                              <span>{u.upiId || 'No VPA'}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUserGovernanceAction({
                                    userId: u.id,
                                    actionType: 'verify_kyc',
                                  })
                                }
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  u.kycVerified
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {u.kycVerified ? 'KYC VERIFIED' : 'VERIFY KYC'}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono uppercase">{u.status}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleUserGovernanceAction({
                                    userId: u.id,
                                    actionType: 'credit_wallet',
                                    amountUsd: 5.0,
                                    note: 'Quick +$5.00 USD Admin Reward',
                                  })
                                }
                                className="px-2 py-1 rounded bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono text-[11px] font-semibold"
                              >
                                +$5 Bonus
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleModerate(
                                    'user',
                                    u.id,
                                    u.status === 'active' ? 'suspend' : 'reinstate',
                                    'Admin governance status toggle'
                                  )
                                }
                                className="px-2.5 py-1 rounded border border-neutral-300 dark:border-neutral-700 font-medium"
                              >
                                {u.status === 'active' ? 'Suspend' : 'Reinstate'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              B. CONTENT MANAGEMENT, SUPPORT TICKETS & DMCA
             ================================================================ */}
          {section === 'content' && (
            <div className="space-y-6">
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-950">
                <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                    Uploaded Media & Malware Scan Registry ({filteredFiles.length})
                  </h2>
                  <input
                    type="text"
                    placeholder="Filter files by title or type..."
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 w-full sm:w-64"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50">
                        <th className="py-2.5 px-4 font-medium">Uploaded File</th>
                        <th className="py-2.5 px-4 font-medium">Views & Earnings</th>
                        <th className="py-2.5 px-4 font-medium">Malware & Status</th>
                        <th className="py-2.5 px-4 font-medium text-right">Size</th>
                        <th className="py-2.5 px-4 font-medium text-right">Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {filteredFiles.map((f) => (
                        <tr key={f.id}>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-neutral-950 dark:text-white">{f.title}</p>
                            <p className="text-[11px] font-mono text-neutral-500">
                              {f.filename} · /{f.slug}
                            </p>
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums">
                            {f.viewsCount.toLocaleString()} views · ${Number(f.estimatedEarningsUsd).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 font-mono">
                            Scan: {f.malwareScanStatus.toUpperCase()} · {f.status.toUpperCase()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {formatBytes(f.sizeBytes)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleModerate('file', f.id, 'boost_views', 'Admin +1k views boost')
                                }
                                className="px-2 py-1 rounded bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 font-mono text-[11px] font-semibold"
                                title="Boost +1,000 Views & +$2.00 Earnings"
                              >
                                +1k Views
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleModerate(
                                    'file',
                                    f.id,
                                    f.status === 'ready' ? 'quarantine' : 'reinstate',
                                    'Content safety review'
                                  )
                                }
                                className="px-2.5 py-1 rounded border border-neutral-300 dark:border-neutral-700 font-medium"
                              >
                                {f.status === 'ready' ? 'Quarantine' : 'Reinstate'}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleModerate('file', f.id, 'delete', 'Permanent admin removal')
                                }
                                className="p-1.5 rounded border border-red-500/30 text-red-600 hover:bg-red-500/10"
                                title="Delete File"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Support Tickets Queue (support_tickets table) */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-950">
                <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                    Support Tickets Queue (`support_tickets` Table — {filteredTickets.length})
                  </h2>
                  <div className="flex items-center gap-1.5">
                    {(['all', 'open', 'resolved'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setTicketFilter(st)}
                        className={`px-2.5 py-1 rounded text-xs font-mono uppercase ${
                          ticketFilter === st
                            ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 font-bold'
                            : 'border border-neutral-300 dark:border-neutral-700 text-neutral-500'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50">
                      <th className="py-2.5 px-4 font-medium">Ticket ID & Email</th>
                      <th className="py-2.5 px-4 font-medium">Category & Subject</th>
                      <th className="py-2.5 px-4 font-medium">Status</th>
                      <th className="py-2.5 px-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {filteredTickets.map((t) => (
                      <tr key={t.id}>
                        <td className="py-3 px-4 font-mono">
                          <p className="font-semibold text-neutral-950 dark:text-white">
                            {t.ticketNumber}
                          </p>
                          <p className="text-[11px] text-neutral-500">{t.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                            {t.category}
                          </p>
                          <p className="text-neutral-800 dark:text-neutral-200">{t.subject}</p>
                        </td>
                        <td className="py-3 px-4 font-mono uppercase">{t.status}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleModerate(
                                  'ticket',
                                  t.id,
                                  t.status === 'open' ? 'resolve' : 'reopen',
                                  'Support ticket status updated by Admin Riwaz'
                                )
                              }
                              className="px-2.5 py-1 rounded border border-neutral-300 dark:border-neutral-700 font-medium"
                            >
                              {t.status === 'open' ? 'Mark Resolved' : 'Reopen Ticket'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleModerate('ticket', t.id, 'delete', 'Ticket deleted by Admin')
                              }
                              className="p-1.5 rounded border border-red-500/30 text-red-600 hover:bg-red-500/10"
                              title="Delete Ticket"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================
              C. MONETIZATION, CPM ENGINE & GEO COUNTRY MULTIPLIERS
             ================================================================ */}
          {section === 'monetization' && (
            <form
              onSubmit={handleSaveMonetization}
              className="p-6 rounded-xl color-graded-panel space-y-6"
            >
              <div>
                <h2 className="text-base font-bold text-neutral-950 dark:text-white">
                  Creator Monetization, Qualification Rules & Country eCPM Matrix
                </h2>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                  Customize global calculation mode, minimum watch-time qualification, hold period, referral bonus %, and country-specific eCPM rates.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Active Calculation Mode</label>
                  <select
                    value={modeInput}
                    onChange={(e) => setModeInput(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                  >
                    <option value="fixed_cpm">Mode A: Fixed Creator CPM ($ / 1k)</option>
                    <option value="revenue_share">Mode B: Ad Revenue Share (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Base Target Creator eCPM ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.10"
                    value={cpmInput}
                    onChange={(e) => setCpmInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Creator Revenue Share (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={revShareInput}
                    onChange={(e) => setRevShareInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Referral Partner Bonus (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={refCommInput}
                    onChange={(e) => setRefCommInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Min Verified Stream Watch Time (Seconds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={minWatchSecInput}
                    onChange={(e) => setMinWatchSecInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Earnings Clearance Hold Period (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={holdDaysInput}
                    onChange={(e) => setHoldDaysInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Minimum UPI Withdrawal (USD)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    value={minWithdrawInput}
                    onChange={(e) => setMinWithdrawInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    USD to INR Conversion Rate
                  </label>
                  <input
                    type="number"
                    step="0.10"
                    value={inrRateInput}
                    onChange={(e) => setInrRateInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                  />
                </div>
              </div>

              {/* Country Tier eCPM Customizer */}
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
                <h3 className="text-xs font-mono uppercase text-blue-600 dark:text-blue-400 font-semibold">
                  Geographic Country eCPM Rate Customizer ($ USD / 1,000 Views)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {Object.entries(countryRates).map(([countryCode, rateVal]) => (
                    <div
                      key={countryCode}
                      className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950"
                    >
                      <label className="block text-[11px] font-mono text-neutral-500 mb-1">
                        {countryCode} Tier eCPM ($)
                      </label>
                      <input
                        type="number"
                        step="0.10"
                        value={rateVal}
                        onChange={(e) =>
                          setCountryRates({
                            ...countryRates,
                            [countryCode]: Number(e.target.value),
                          })
                        }
                        className="w-full px-2 py-1 text-xs font-mono font-bold rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
              >
                Save Monetization Rules & Geo eCPM Matrix
              </button>
            </form>
          )}

          {/* ================================================================
              D. FINANCE & UPI/USDT PAYOUT RECONCILIATION
             ================================================================ */}
          {section === 'finance' && (
            <div className="space-y-6">
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-950">
                <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                      UPI & USDT Withdrawal Requests ({adminData.withdrawals.length})
                    </h2>
                    <p className="text-xs text-neutral-500">
                      Enter a custom Bank UTR or USDT TxHash before settling, or batch-settle all pending requests.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {pendingWithdrawals.length > 0 && (
                      <button
                        type="button"
                        onClick={handleBatchSettleAllPending}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Settle All Pending ({pendingWithdrawals.length})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleExportLedgerCsv}
                      className="px-3.5 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Ledger CSV</span>
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50">
                        <th className="py-2.5 px-4 font-medium">Request UUID</th>
                        <th className="py-2.5 px-4 font-medium">Destination VPA / Wallet</th>
                        <th className="py-2.5 px-4 font-medium text-right">Amount USD / INR</th>
                        <th className="py-2.5 px-4 font-medium">Status & UTR / Hash</th>
                        <th className="py-2.5 px-4 font-medium text-right">Finance Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {adminData.withdrawals.map((w) => (
                        <tr key={w.id}>
                          <td className="py-3 px-4 font-mono">{w.requestUuid}</td>
                          <td className="py-3 px-4 font-mono">
                            <span className="font-semibold">{w.destinationUpiId}</span>
                            <span className="block text-[10px] text-neutral-500">
                              Method: {w.payoutMethod}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            ${Number(w.amountUsd).toFixed(2)} (₹{w.netPayoutInr})
                          </td>
                          <td className="py-3 px-4 font-mono">
                            {w.status === 'under_review' || w.status === 'pending' || w.status === 'processing' ? (
                              <div className="space-y-1">
                                <span className="block text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                  {w.status.toUpperCase()}
                                </span>
                                <input
                                  type="text"
                                  placeholder="Optional UTR / TxHash..."
                                  value={customUtrMap[w.id] || ''}
                                  onChange={(e) =>
                                    setCustomUtrMap({ ...customUtrMap, [w.id]: e.target.value })
                                  }
                                  className="px-2 py-1 text-[11px] font-mono rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 w-44"
                                />
                              </div>
                            ) : (
                              <span>
                                {w.status.toUpperCase()}{' '}
                                {w.providerReference ? `· ${w.providerReference}` : ''}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {w.status === 'under_review' || w.status === 'pending' || w.status === 'processing' ? (
                              <div className="inline-flex flex-wrap justify-end gap-1.5">
                                {w.status !== 'processing' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleWithdrawalDecision(w.id, 'mark_processing')
                                    }
                                    className="px-2 py-1 rounded border border-blue-500/40 text-blue-700 dark:text-blue-300 font-semibold text-[11px]"
                                  >
                                    Processing
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleWithdrawalDecision(w.id, 'approve_and_settle')
                                  }
                                  className="px-2.5 py-1 rounded bg-emerald-700 text-white font-semibold flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Settle</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleWithdrawalDecision(w.id, 'reject_and_reverse')
                                  }
                                  className="px-2.5 py-1 rounded border border-red-400 text-red-700 dark:text-red-400 font-semibold flex items-center gap-1"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Reject</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleWithdrawalDecision(w.id, 'mark_failed')
                                  }
                                  className="px-2 py-1 rounded border border-amber-500/40 text-amber-700 dark:text-amber-300 font-semibold text-[11px]"
                                >
                                  Mark Failed
                                </button>
                              </div>
                            ) : (
                              <span className="text-neutral-400 font-mono">
                                Finalized ({w.status.toUpperCase()})
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              PAYOUT CONFIGURATION TAB (UPI vs USDT Status, Thresholds, Fees)
             ================================================================ */}
          {section === 'payout-config' && (
            <form onSubmit={handleSaveCustomCodes} className="space-y-6">
              <div className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 text-xs font-mono uppercase text-blue-600 dark:text-blue-400 font-semibold">
                      <Coins className="w-3.5 h-3.5" />
                      <span>Global Settlement & Rail Governance</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-neutral-950 dark:text-white">
                      Payout Configuration — India UPI & Global USDT Rails
                    </h2>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-2xl">
                      Toggle real-time availability of UPI vs USDT payout rails, configure minimum withdrawal thresholds, and manage custom fee percentages.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleSyncLiveFx}
                      disabled={syncingFx}
                      className="min-h-[42px] px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncingFx ? 'animate-spin' : ''}`} />
                      <span>{syncingFx ? 'Syncing Live Rates...' : 'Sync Live USDT/INR Rate'}</span>
                    </button>
                    <button
                      type="submit"
                      className="min-h-[42px] px-5 py-2.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors whitespace-nowrap"
                    >
                      Save Payout Configuration
                    </button>
                  </div>
                </div>

                {/* Dual Rail Configuration Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Card 1: Lightning India UPI Rail Configuration */}
                  <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 space-y-5">
                    <div className="flex items-start justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 inline-flex items-center justify-center shrink-0">
                          <Zap className="w-5 h-5 text-amber-400 dark:text-amber-600 icon-anim-bolt" />
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                            Lightning India UPI Payout Rail
                          </h3>
                          <p className="text-xs text-neutral-500 font-mono">
                            GPay · PhonePe · Paytm · BHIM (@vpa)
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={codesForm.upiPayoutEnabled}
                        onClick={() =>
                          setCodesForm({
                            ...codesForm,
                            upiPayoutEnabled: !codesForm.upiPayoutEnabled,
                          })
                        }
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold inline-flex items-center gap-2 transition-colors ${
                          codesForm.upiPayoutEnabled
                            ? 'bg-emerald-600 text-white'
                            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            codesForm.upiPayoutEnabled ? 'bg-white' : 'bg-neutral-500'
                          }`}
                        />
                        <span>
                          {codesForm.upiPayoutEnabled ? 'UPI RAIL: ACTIVE' : 'UPI RAIL: PAUSED'}
                        </span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="upi-min-threshold-input"
                          className="block text-xs font-medium text-neutral-800 dark:text-neutral-200 mb-1"
                        >
                          UPI Minimum Withdrawal ($ USD)
                        </label>
                        <input
                          id="upi-min-threshold-input"
                          type="number"
                          step="0.50"
                          min="1.00"
                          value={codesForm.upiMinWithdrawalUsd}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setCodesForm({ ...codesForm, upiMinWithdrawalUsd: val });
                            setMinWithdrawInput(String(val));
                          }}
                          className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="upi-fee-percent-input"
                          className="block text-xs font-medium text-neutral-800 dark:text-neutral-200 mb-1"
                        >
                          UPI Withdrawal Fee (%)
                        </label>
                        <input
                          id="upi-fee-percent-input"
                          type="number"
                          step="0.10"
                          min="0"
                          max="25"
                          value={codesForm.upiFeePercent}
                          onChange={(e) =>
                            setCodesForm({ ...codesForm, upiFeePercent: Number(e.target.value) })
                          }
                          className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-200/80 dark:border-neutral-800">
                      <div>
                        <label className="block text-xs font-medium mb-1">UPI Gateway Provider</label>
                        <input
                          type="text"
                          value={codesForm.upiProviderName}
                          onChange={(e) =>
                            setCodesForm({ ...codesForm, upiProviderName: e.target.value })
                          }
                          className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          USD → INR UPI Settlement Rate
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          value={inrRateInput}
                          onChange={(e) => {
                            setInrRateInput(e.target.value);
                            setCodesForm({ ...codesForm, usdToInrRate: Number(e.target.value) });
                          }}
                          className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Global USDT Stablecoin Rail Configuration */}
                  <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 space-y-5">
                    <div className="flex items-start justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white inline-flex items-center justify-center shrink-0">
                          <Coins className="w-5 h-5 icon-anim-float" />
                        </span>
                        <div>
                          <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                            Global USDT Stablecoin Payout Rail
                          </h3>
                          <p className="text-xs text-neutral-500 font-mono">
                            TRC-20 · ERC-20 · BEP-20 · Polygon (1 USDT = ₹
                            {Number(codesForm.usdtToInrRate || 88.85).toFixed(2)} INR)
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={codesForm.usdtPayoutEnabled}
                        onClick={() =>
                          setCodesForm({
                            ...codesForm,
                            usdtPayoutEnabled: !codesForm.usdtPayoutEnabled,
                          })
                        }
                        className={`min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold inline-flex items-center gap-2 transition-colors ${
                          codesForm.usdtPayoutEnabled
                            ? 'bg-emerald-600 text-white'
                            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            codesForm.usdtPayoutEnabled ? 'bg-white' : 'bg-neutral-500'
                          }`}
                        />
                        <span>
                          {codesForm.usdtPayoutEnabled ? 'USDT RAIL: ACTIVE' : 'USDT RAIL: PAUSED'}
                        </span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="usdt-min-threshold-input"
                          className="block text-xs font-medium text-neutral-800 dark:text-neutral-200 mb-1"
                        >
                          USDT Minimum Withdrawal ($ USD)
                        </label>
                        <input
                          id="usdt-min-threshold-input"
                          type="number"
                          step="1.00"
                          min="5.00"
                          value={codesForm.usdtMinWithdrawalUsd}
                          onChange={(e) =>
                            setCodesForm({
                              ...codesForm,
                              usdtMinWithdrawalUsd: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="usdt-fee-percent-input"
                          className="block text-xs font-medium text-neutral-800 dark:text-neutral-200 mb-1"
                        >
                          Global USDT Withdrawal Fee (%)
                        </label>
                        <input
                          id="usdt-fee-percent-input"
                          type="number"
                          step="0.10"
                          min="0"
                          max="25"
                          value={codesForm.usdtFeePercent}
                          onChange={(e) =>
                            setCodesForm({
                              ...codesForm,
                              usdtFeePercent: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-neutral-200/80 dark:border-neutral-800">
                      <div>
                        <label htmlFor="usdt-inr-rate-input" className="block text-xs font-medium mb-1">
                          Live USDT → INR Rate (₹)
                        </label>
                        <input
                          id="usdt-inr-rate-input"
                          type="number"
                          step="0.05"
                          min="70"
                          max="110"
                          value={codesForm.usdtToInrRate ?? 88.85}
                          onChange={(e) =>
                            setCodesForm({
                              ...codesForm,
                              usdtToInrRate: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-emerald-500/50 bg-white dark:bg-neutral-950 font-bold text-emerald-700 dark:text-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Supported USDT Networks
                        </label>
                        <input
                          type="text"
                          value={codesForm.usdtSupportedNetworks}
                          onChange={(e) =>
                            setCodesForm({
                              ...codesForm,
                              usdtSupportedNetworks: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Treasury Settlement Wallet
                        </label>
                        <input
                          type="text"
                          value={codesForm.usdtTreasuryWallet}
                          onChange={(e) =>
                            setCodesForm({
                              ...codesForm,
                              usdtTreasuryWallet: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* ================================================================
              E. ADVERTISING & VAST STUDIO + F. SITE BRANDING & CUSTOMIZER
             ================================================================ */}
          {(section === 'advertising' || section === 'site-config') && (
            <form onSubmit={handleSaveCustomCodes} className="space-y-6">
              <div className="p-6 rounded-xl color-graded-panel space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-neutral-950 dark:text-white">
                      {section === 'site-config'
                        ? 'Site Branding, Hero Headline, Upload Limits & Infrastructure Customizer'
                        : 'Custom Code, VAST Ad Network & Dynamic CPM Tier Studio'}
                    </h2>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Customize landing page hero text, global announcement banner, upload limits, VAST ad tags, and storage/payment endpoints. All changes apply live across the website.
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold whitespace-nowrap"
                  >
                    Save All Customizations Live
                  </button>
                </div>

                {/* Live Site Branding, Hero Text & Feature Switches */}
                <div className="space-y-4">
                  <h3 className="text-xs font-mono uppercase text-blue-700 dark:text-blue-400 font-semibold">
                    1. Live Website Branding, Hero Text & Platform Controls
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Custom Home Hero Headline
                      </label>
                      <input
                        type="text"
                        value={codesForm.customHeroHeadline || ''}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, customHeroHeadline: e.target.value })
                        }
                        placeholder="Your Content. Your Links. Your Earnings."
                        className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Custom Home Hero Subheadline (Leave blank for dynamic plan text)
                      </label>
                      <input
                        type="text"
                        value={codesForm.customHeroSubheadline || ''}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, customHeroSubheadline: e.target.value })
                        }
                        placeholder="Optional custom subheadline..."
                        className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium mb-1">
                        Global Top Announcement Banner Text
                      </label>
                      <input
                        type="text"
                        value={codesForm.announcementBanner || ''}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, announcementBanner: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Max File Upload Size Limit (MB)
                      </label>
                      <input
                        type="number"
                        min="50"
                        max="51200"
                        value={codesForm.maxUploadSizeMb ?? 5120}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, maxUploadSizeMb: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Official Creator Community / Telegram URL
                      </label>
                      <input
                        type="text"
                        value={codesForm.officialTelegramUrl || ''}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, officialTelegramUrl: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                  </div>

                  {/* Interactive Platform Feature Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                    <label className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex items-center justify-between gap-2 text-xs cursor-pointer">
                      <span className="font-semibold">Top Announcement Bar</span>
                      <input
                        type="checkbox"
                        checked={Boolean(codesForm.announcementBannerEnabled)}
                        onChange={(e) =>
                          setCodesForm({
                            ...codesForm,
                            announcementBannerEnabled: e.target.checked,
                          })
                        }
                        className="accent-blue-600 w-4 h-4"
                      />
                    </label>
                    <label className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex items-center justify-between gap-2 text-xs cursor-pointer">
                      <span className="font-semibold">Allow New Sign-Ups</span>
                      <input
                        type="checkbox"
                        checked={Boolean(codesForm.registrationEnabled)}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, registrationEnabled: e.target.checked })
                        }
                        className="accent-blue-600 w-4 h-4"
                      />
                    </label>
                    <label className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex items-center justify-between gap-2 text-xs cursor-pointer">
                      <span className="font-semibold">Auto-Approve KYC Payouts</span>
                      <input
                        type="checkbox"
                        checked={Boolean(codesForm.autoApproveKycPayouts)}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, autoApproveKycPayouts: e.target.checked })
                        }
                        className="accent-blue-600 w-4 h-4"
                      />
                    </label>
                    <label className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex items-center justify-between gap-2 text-xs cursor-pointer">
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        Maintenance Alert Banner
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(codesForm.maintenanceMode)}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, maintenanceMode: e.target.checked })
                        }
                        className="accent-amber-600 w-4 h-4"
                      />
                    </label>
                  </div>
                </div>

                {/* 2. Dynamic Ad-Intensity CPM Rates */}
                <div className="space-y-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <h3 className="text-xs font-mono uppercase text-blue-700 dark:text-blue-400 font-semibold">
                    2. 2-Plan Creator eCPM Rates ($2.00 Balanced & $3.00 Max Ads)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Balanced Plan Target eCPM ($ USD)
                      </label>
                      <input
                        type="number"
                        step="0.10"
                        value={codesForm.balancedAdsCpmUsd}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, balancedAdsCpmUsd: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Max Ads Plan Target eCPM ($ USD)
                      </label>
                      <input
                        type="number"
                        step="0.10"
                        value={codesForm.maxAdsCpmUsd}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, maxAdsCpmUsd: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. VAST Tag URLs & Custom Ad Network Script Codes */}
                <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <h3 className="text-xs font-mono uppercase text-blue-700 dark:text-blue-400 font-semibold">
                    3. VAST 4.2 Video Ad Tags & Custom Ad / Analytics Code Injection
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">Pre-Roll VAST Tag URL</label>
                      <input
                        type="text"
                        value={codesForm.vastPreRollTagUrl}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, vastPreRollTagUrl: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Mid-Roll VAST Tag URL</label>
                      <input
                        type="text"
                        value={codesForm.vastMidRollTagUrl}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, vastMidRollTagUrl: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Post-Roll VAST Tag URL</label>
                      <input
                        type="text"
                        value={codesForm.vastPostRollTagUrl}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, vastPostRollTagUrl: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Custom Ad Network / Banner / Pop-Under JS Code Snippet
                    </label>
                    <textarea
                      rows={3}
                      value={codesForm.customAdScriptCode}
                      onChange={(e) =>
                        setCodesForm({ ...codesForm, customAdScriptCode: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Custom Header Verification / Analytics Script (`&lt;head&gt;`)
                      </label>
                      <textarea
                        rows={3}
                        value={codesForm.customHeaderScriptCode}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, customHeaderScriptCode: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Custom Video Player Hook / Watermark Script
                      </label>
                      <textarea
                        rows={3}
                        value={codesForm.customPlayerEmbedCode}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, customPlayerEmbedCode: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Payment Gateway, S3 Object Storage & Site Endpoints */}
                <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <h3 className="text-xs font-mono uppercase text-blue-700 dark:text-blue-400 font-semibold">
                    4. UPI Payout Gateway, Object Storage (S3/R2) & CDN Configuration
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">UPI Payout Provider</label>
                      <input
                        type="text"
                        value={codesForm.upiProviderName}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, upiProviderName: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Gateway Key / Client ID</label>
                      <input
                        type="text"
                        value={codesForm.upiKeyId}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, upiKeyId: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">UPI Webhook Endpoint</label>
                      <input
                        type="text"
                        value={codesForm.upiWebhookEndpoint}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, upiWebhookEndpoint: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">S3 / R2 Endpoint URL</label>
                      <input
                        type="text"
                        value={codesForm.s3EndpointUrl}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, s3EndpointUrl: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Storage Bucket Name</label>
                      <input
                        type="text"
                        value={codesForm.s3BucketName}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, s3BucketName: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">CDN Delivery Domain</label>
                      <input
                        type="text"
                        value={codesForm.cdnCustomDomain}
                        onChange={(e) =>
                          setCodesForm({ ...codesForm, cdnCustomDomain: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
                  >
                    Save All Customizations & Apply Live
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ================================================================
              G. ACTIVITY LOGS TAB (AUTOMATIC REAL-TIME ADMIN ACTION AUDIT)
             ================================================================ */}
          {(section === 'activity-logs' || section === 'security-audit') && (
            <div id="admin-activity-logs-tab" className="space-y-6">
              {/* Top Activity Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl color-graded-panel">
                  <p className="text-xs text-neutral-500">Total Recorded Admin Actions</p>
                  <p className="text-2xl font-bold font-mono tabular-nums mt-1 text-neutral-950 dark:text-white">
                    {adminData.auditLogs.length} Events
                  </p>
                  <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    Active Admin ID: {vaultAdminId || 'Riwaz'}
                  </p>
                </div>
                <div className="p-4 rounded-xl color-graded-panel">
                  <p className="text-xs text-neutral-500">Config & CPM Rate Changes</p>
                  <p className="text-2xl font-bold font-mono tabular-nums mt-1 text-blue-600 dark:text-blue-400">
                    {
                      adminData.auditLogs.filter(
                        (l) => classifyActivityCategory(l.action, l.entityType) === 'config'
                      ).length
                    }
                  </p>
                  <p className="text-[11px] font-mono text-neutral-500 mt-1">
                    Monetization, FX & Branding
                  </p>
                </div>
                <div className="p-4 rounded-xl color-graded-panel">
                  <p className="text-xs text-neutral-500">User Bans, Roles & Wallet Actions</p>
                  <p className="text-2xl font-bold font-mono tabular-nums mt-1 text-amber-600 dark:text-amber-400">
                    {
                      adminData.auditLogs.filter(
                        (l) => classifyActivityCategory(l.action, l.entityType) === 'users'
                      ).length
                    }
                  </p>
                  <p className="text-[11px] font-mono text-neutral-500 mt-1">
                    Suspensions, KYC & Credits
                  </p>
                </div>
                <div className="p-4 rounded-xl color-graded-panel">
                  <p className="text-xs text-neutral-500">Payout Status Updates</p>
                  <p className="text-2xl font-bold font-mono tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">
                    {
                      adminData.auditLogs.filter(
                        (l) => classifyActivityCategory(l.action, l.entityType) === 'payouts'
                      ).length
                    }
                  </p>
                  <p className="text-[11px] font-mono text-neutral-500 mt-1">
                    UPI & USDT Settlements / Reversals
                  </p>
                </div>
              </div>

              {/* Filter Bar, Category Pills & CSV Export */}
              <div className="p-4 sm:p-5 rounded-xl color-graded-panel space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 uppercase">
                      AUTOMATIC ADMIN ACTIVITY STREAM
                    </span>
                    <h2 className="text-base font-bold text-neutral-950 dark:text-white">
                      Activity Logs — Config Changes, User Bans & Payout Updates
                    </h2>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                      Automatically records every significant action performed in the Admin Portal with exact timestamp and Admin Identifier.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fetchAdminData()}
                      className="px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh Logs</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportActivityLogsCsv}
                      className="px-3.5 py-1.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Activity CSV</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: 'all', label: 'All Activity' },
                        { id: 'config', label: 'Config Changes' },
                        { id: 'users', label: 'User Bans & Wallet' },
                        { id: 'payouts', label: 'Payout Updates' },
                        { id: 'content', label: 'Content & Broadcasts' },
                        { id: 'security', label: 'Vault Auth' },
                      ] as const
                    ).map((pill) => (
                      <button
                        key={pill.id}
                        type="button"
                        onClick={() => setActivityCategoryFilter(pill.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                          activityCategoryFilter === pill.id
                            ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 font-bold'
                            : 'bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="activity-logs-search-input"
                      type="text"
                      placeholder="Search action, admin ID, details..."
                      value={auditFilter}
                      onChange={(e) => setAuditFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    />
                  </div>
                </div>
              </div>

              {/* Activity Logs Table */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-950">
                <div className="overflow-x-auto">
                  <table
                    id="admin-activity-logs-table"
                    className="w-full text-left border-collapse text-xs"
                  >
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50">
                        <th className="py-3 px-4 font-medium">Timestamp</th>
                        <th className="py-3 px-4 font-medium">Admin Identifier</th>
                        <th className="py-3 px-4 font-medium">Category & Action</th>
                        <th className="py-3 px-4 font-medium">Activity Details & Target</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {filteredAuditLogs.map((log) => {
                        const ts = formatLogTimestamp(log.createdAt);
                        const category = classifyActivityCategory(log.action, log.entityType);
                        const summary = formatActivitySummary(log);
                        const displayAdminId =
                          log.actorUid === 'admin_super_01' || log.actorUid === 'admin_riwaz'
                            ? 'Riwaz'
                            : log.actorUid;

                        const badgeStyles: Record<typeof category, string> = {
                          config:
                            'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
                          users:
                            'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
                          payouts:
                            'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
                          content:
                            'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
                          security:
                            'bg-neutral-500/15 text-neutral-700 dark:text-neutral-300 border-neutral-500/30',
                        };

                        return (
                          <tr
                            key={log.id}
                            className="hover:bg-neutral-50/70 dark:hover:bg-neutral-900/40 transition-colors"
                          >
                            <td className="py-3.5 px-4 font-mono tabular-nums whitespace-nowrap">
                              <p className="font-semibold text-neutral-900 dark:text-white">
                                {ts.formatted}
                              </p>
                              <span className="text-[10px] text-neutral-500">{ts.relative}</span>
                            </td>
                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 font-bold text-[11px]">
                                  {displayAdminId}
                                </span>
                                <span className="text-[10px] text-neutral-500 uppercase">
                                  {log.actorRole}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono whitespace-nowrap">
                              <span
                                className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase mb-1 ${badgeStyles[category]}`}
                              >
                                {category}
                              </span>
                              <p className="font-semibold text-neutral-900 dark:text-white">
                                {log.action}
                              </p>
                            </td>
                            <td className="py-3.5 px-4">
                              <p className="font-medium text-neutral-900 dark:text-white">
                                {summary}
                              </p>
                              <p className="font-mono text-[11px] text-neutral-500 break-all mt-0.5">
                                Target: {log.entityType} #{log.entityId} · {log.metadataJson}
                              </p>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
