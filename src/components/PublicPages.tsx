import React, { useState, useEffect } from 'react';
import {
  Play,
  Upload,
  ShieldCheck,
  ArrowRight,
  Search,
  Download,
  Lock,
  Check,
  AlertTriangle,
  Copy,
  HelpCircle,
  Zap,
  Coins,
  Globe,
  Sparkles,
  Sliders,
  Share2,
  BarChart3,
  Wallet,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import {
  FileRecord,
  MonetizationRulesRecord,
  PageRoute,
  PlatformCustomCodesConfig,
} from '../types';
import { AdPreferenceMode } from '../utils/monetization';
import { MediaThumbnail, formatBytes, formatDuration, QrCodeMatrix } from './MediaArtwork';
import { ShareDabbaPlayer } from './ShareDabbaPlayer';
import { SupportTicket } from './SupportTicket';

interface PublicPagesProps {
  route: PageRoute;
  onNavigate: (route: PageRoute, selectedFile?: FileRecord) => void;
  publicFiles: FileRecord[];
  selectedFile: FileRecord | null;
  onSelectFile: (file: FileRecord) => void;
  rules: MonetizationRulesRecord | null;
  customCodes?: PlatformCustomCodesConfig | null;
  adPreference: AdPreferenceMode;
  onChangeAdPreference: (pref: AdPreferenceMode) => void;
  onGoogleLogin: () => Promise<void>;
  onSessionAccountLogin: (uid: string, email: string, name: string) => void;
  sessionAccountName?: string;
  sessionAccountEmail?: string;
  onRefreshPublicData: () => Promise<void>;
}

const GoogleGIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
    />
  </svg>
);

const InrCurrencyNoteBadge: React.FC<{
  amountLabel?: string;
  className?: string;
  altAnim?: boolean;
}> = ({ amountLabel = '₹', className = '', altAnim = false }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-amber-500/10 to-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-bold shadow-xs ${
      altAnim ? 'inr-note-anim-alt' : 'inr-note-anim'
    } ${className}`}
  >
    <svg className="w-4 h-3.5 shrink-0" viewBox="0 0 28 20" fill="none" aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="26"
        height="18"
        rx="3"
        className="fill-emerald-600/20 stroke-emerald-600 dark:stroke-emerald-400"
        strokeWidth="1.5"
      />
      <rect
        x="3.5"
        y="3.5"
        width="21"
        height="13"
        rx="1.5"
        className="stroke-amber-500/60"
        strokeWidth="1"
        strokeDasharray="2 1.5"
      />
      <circle cx="14" cy="10" r="4.2" className="fill-emerald-600 dark:fill-emerald-400" />
      <text
        x="14"
        y="13"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="8.5"
        fontWeight="bold"
        fontFamily="monospace"
      >
        ₹
      </text>
    </svg>
    <span>{amountLabel}</span>
  </span>
);

interface CreatorFaqAccordionProps {
  balancedCpm: number;
  maxAdsCpm: number;
  inrRate: number;
  usdtInrRate: number;
  upiMinUsd: number;
  usdtMinUsd: number;
  minWatchSeconds: number;
  onNavigate: (route: PageRoute) => void;
  onChangeAdPreference: (pref: AdPreferenceMode) => void;
}

const CreatorFaqAccordion: React.FC<CreatorFaqAccordionProps> = ({
  balancedCpm,
  maxAdsCpm,
  inrRate,
  usdtInrRate,
  upiMinUsd,
  usdtMinUsd,
  minWatchSeconds,
  onNavigate,
  onChangeAdPreference,
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqItems = [
    {
      code: '01 · CPM PLANS',
      category: 'Monetization',
      question: `How do the 2 Monetization Plans ($${balancedCpm.toFixed(2)} Balanced vs $${maxAdsCpm.toFixed(2)} Max Ads) work?`,
      answer: `ShareDabba offers strictly two transparent monetization plans that you can toggle anytime in one click. The Balanced Plan ($${balancedCpm.toFixed(2)} eCPM / ≈ ₹${(balancedCpm * inrRate).toFixed(0)} INR per 1,000 views) runs a single skippable pre-roll ad slot with zero mid-roll interruptions for high audience retention. The Max Ads Plan ($${maxAdsCpm.toFixed(2)} eCPM / ≈ ₹${(maxAdsCpm * inrRate).toFixed(0)} INR per 1,000 views) enables pre-roll plus eligible mid-roll VAST ad placements for 50% higher creator revenue.`,
      badge: `$${balancedCpm.toFixed(2)} & $${maxAdsCpm.toFixed(2)} eCPM`,
      actionLabel: 'Switch Active Plan',
      onAction: () => onChangeAdPreference('more'),
    },
    {
      code: '02 · INSTANT PAYOUTS',
      category: 'UPI & USDT',
      question: 'How fast are Lightning India UPI (₹ INR) and Global USDT payouts, and what are the live USDT/INR rates?',
      answer: `Creators in India can verify any UPI Virtual Payment Address (@okaxis, @ybl, @paytm, @ibl) and withdraw starting at just $${upiMinUsd.toFixed(2)} USD (≈ ₹${(upiMinUsd * inrRate).toFixed(0)} INR at 1 USD = ₹${inrRate.toFixed(2)}) with direct IMPS bank settlement. International and crypto creators can withdraw 1:1 in USDT stablecoin across TRC-20, ERC-20, and Polygon networks starting at $${usdtMinUsd.toFixed(2)} USD (${usdtMinUsd.toFixed(2)} USDT ≈ ₹${(usdtMinUsd * usdtInrRate).toFixed(0)} INR at live 1 USDT = ₹${usdtInrRate.toFixed(2)} INR).`,
      badge: `1 USDT = ₹${usdtInrRate.toFixed(2)} INR`,
      actionLabel: 'Open Payout Wallet',
      onAction: () => onNavigate('dashboard'),
    },
    {
      code: '03 · VIEW VERIFICATION',
      category: 'Ledger Rules',
      question: 'What counts as an eligible monetized view on my shared video and file links?',
      answer: `A view is credited to your double-entry wallet ledger when a genuine human viewer opens your ShareDabba link, completes or skips an eligible VAST 4.2 ad impression, and streams for at least ${minWatchSeconds} seconds. Automated bot traffic, VPN proxy farms, and rapid page reloads are filtered automatically so advertiser demand and your eCPM rates remain high.`,
      badge: `${minWatchSeconds}s Verified Stream`,
      actionLabel: 'Read Earnings Spec',
      onAction: () => onNavigate('how-earnings-work'),
    },
    {
      code: '04 · CLOUD HOSTING',
      category: 'Zero Storage Fees',
      question: 'Are there any monthly subscription fees or paid video storage tiers?',
      answer: `No. ShareDabba has removed paid storage tiers so every creator enjoys full multipart cloud hosting for MP4, WebM, MOV, PDF, ZIP archives, and signed Android APK builds at zero monthly cost. Every upload includes automated SHA-256 malware scanning, adaptive streaming, and vector QR code generation.`,
      badge: '100% Free Hosting',
      actionLabel: 'Upload Files Now',
      onAction: () => onNavigate('dashboard'),
    },
    {
      code: '05 · GOOGLE ONBOARDING',
      category: 'Account Access',
      question: 'How do I sign up with Google and start sharing monetized links immediately?',
      answer: `Click the "Sign Up / Continue with Google" button on the home page or login screen to authenticate instantly via Firebase OAuth. Your creator profile and double-entry wallet are provisioned automatically, allowing you to upload files, generate short links, and start earning right away.`,
      badge: 'Firebase OAuth Ready',
      actionLabel: 'Open Creator Studio',
      onAction: () => onNavigate('dashboard'),
    },
    {
      code: '06 · PARTNER REFERRALS',
      category: 'Growth Bonus',
      question: 'How does the 10% Creator Referral Partner Program credit my wallet?',
      answer: `Every creator receives a unique referral link in their dashboard. When new creators sign up through your referral link, you earn a lifetime 10% commission bonus on their verified ad earnings—credited directly to your payable balance by ShareDabba without deducting a single cent from your referred creator's earnings.`,
      badge: '10% Lifetime Bonus',
      actionLabel: 'View Referral Program',
      onAction: () => onNavigate('referral-program'),
    },
  ];

  return (
    <div className="space-y-4">
      {faqItems.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={item.code} className="liquid-retina-card">
            <div className="liquid-retina-inner bg-white dark:bg-neutral-950 transition-colors">
              {isOpen && <div className="liquid-retina-glow" aria-hidden="true" />}
              <div className="relative z-10">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full px-5 sm:px-7 py-4 sm:py-5 text-left flex items-center justify-between gap-4 hover:bg-neutral-50/70 dark:hover:bg-neutral-900/50 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                      <span className="text-blue-700 dark:text-blue-400 font-bold">{item.code}</span>
                      <span aria-hidden="true" className="text-neutral-400">·</span>
                      <span className="text-neutral-500 dark:text-neutral-400">{item.category}</span>
                      <span className="px-2 py-0.5 rounded border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold">
                        {item.badge}
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-neutral-950 dark:text-white pr-2">
                      {item.question}
                    </h3>
                  </div>

                  <span
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-200 ${
                      isOpen
                        ? 'bg-blue-600 border-blue-500 text-white rotate-180 shadow-xs'
                        : 'bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </button>

                {isOpen && (
                  <div className="px-5 sm:px-7 pb-5 sm:pb-6 pt-2 border-t border-neutral-200/80 dark:border-neutral-800/80 space-y-4">
                    <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                      {item.answer}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <InrCurrencyNoteBadge
                        amountLabel={`1 USDT = ₹${usdtInrRate.toFixed(2)} INR · 1 USD = ₹${inrRate.toFixed(2)} INR`}
                      />
                      <button
                        type="button"
                        onClick={item.onAction}
                        className="px-3.5 py-1.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                      >
                        <span>{item.actionLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const PublicPages: React.FC<PublicPagesProps> = ({
  route,
  onNavigate,
  publicFiles,
  selectedFile,
  onSelectFile,
  rules,
  customCodes,
  adPreference,
  onChangeAdPreference,
  onGoogleLogin,
  onSessionAccountLogin,
  sessionAccountName,
  sessionAccountEmail,
  onRefreshPublicData,
}) => {
  const [selectedPayoutRail, setSelectedPayoutRail] = useState<'upi' | 'usdt'>('upi');
  const [googleSigningIn, setGoogleSigningIn] = useState(false);

  // Interactive Earnings Calculator State (Strictly 2 Plans: Balanced $2.00 & Max Ads $3.00)
  const [calcDailyViews, setCalcDailyViews] = useState<number>(15000);

  // Explore Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'views' | 'recent'>('views');

  // Auth Forms State
  const [authEmail, setAuthEmail] = useState('arjun.mehta@sharedabba.in');
  const [authPassword, setAuthPassword] = useState('••••••••••••');
  const [authName, setAuthName] = useState('Arjun Mehta');
  const [ageConfirmed, setAgeConfirmed] = useState(true);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  // Support / DMCA Form State
  const [ticketEmail, setTicketEmail] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('Payouts & UPI');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState<string | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);

  // Shared File Password & Report Modal State
  const [unlockPass, setUnlockPass] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [reportModalFile, setReportModalFile] = useState<FileRecord | null>(null);
  const [reportEmail, setReportEmail] = useState('');
  const [reportReason, setReportReason] = useState('copyright_dmca');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  const handleFirebaseGoogleClick = async () => {
    if (googleSigningIn) return;
    setGoogleSigningIn(true);
    try {
      await onGoogleLogin();
    } finally {
      setGoogleSigningIn(false);
    }
  };

  const maxAdsCpm = Number(customCodes?.maxAdsCpmUsd ?? 3.0);
  const balancedCpm = Number(customCodes?.balancedAdsCpmUsd ?? rules?.targetCpmUsd ?? 2.0);

  const targetCpm = adPreference === 'more' ? maxAdsCpm : balancedCpm;
  const baseInrRate = Number(customCodes?.usdToInrRate || rules?.usdToInrRate || 86.45);
  const baseUsdtInrRate = Number(customCodes?.usdtToInrRate || 88.85);

  const [usdtInrRate, setUsdtInrRate] = useState<number>(baseUsdtInrRate);
  const [inrRate, setInrRate] = useState<number>(baseInrRate);
  const [fxSource, setFxSource] = useState<string>(
    customCodes?.liveRateSource || 'CoinGecko / ShareDabba Live USDT/INR Desk'
  );
  const [fxChange24h, setFxChange24h] = useState<number>(0.42);
  const [syncingFx, setSyncingFx] = useState<boolean>(false);
  const [fxBanner, setFxBanner] = useState<string | null>(null);

  useEffect(() => {
    if (customCodes?.usdtToInrRate) {
      setUsdtInrRate(Number(customCodes.usdtToInrRate));
    }
    if (customCodes?.usdToInrRate || rules?.usdToInrRate) {
      setInrRate(Number(customCodes?.usdToInrRate || rules?.usdToInrRate || 86.45));
    }
    if (customCodes?.liveRateSource) {
      setFxSource(customCodes.liveRateSource);
    }
  }, [customCodes?.usdtToInrRate, customCodes?.usdToInrRate, customCodes?.liveRateSource, rules?.usdToInrRate]);

  const handleSyncLiveMarketRate = async () => {
    if (syncingFx) return;
    setSyncingFx(true);
    setFxBanner(null);
    try {
      const res = await fetch('/api/fx/usdt-inr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'sync_live' }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsdtInrRate(Number(data.usdtToInrRate));
        setInrRate(Number(data.usdToInrRate));
        if (data.source) setFxSource(data.source);
        if (typeof data.change24hPercent === 'number') setFxChange24h(data.change24hPercent);
        setFxBanner(
          `Synced Live Market Rate: 1 USDT = ₹${Number(data.usdtToInrRate).toFixed(2)} INR · 1 USD = ₹${Number(data.usdToInrRate).toFixed(2)} INR`
        );
        await onRefreshPublicData();
      }
    } catch (e) {
      console.error('Failed to sync live USDT/INR rate:', e);
    } finally {
      setSyncingFx(false);
    }
  };

  const handlePersistCustomUsdtInrRate = async (nextUsdtRate: number, nextUsdRate?: number) => {
    const cleanUsdt = Number(Math.min(105, Math.max(75, nextUsdtRate)).toFixed(2));
    const cleanUsd = Number(
      (nextUsdRate ? Math.min(102, Math.max(72, nextUsdRate)) : Math.max(72, cleanUsdt - 2.1)).toFixed(2)
    );
    setUsdtInrRate(cleanUsdt);
    setInrRate(cleanUsd);
    setSyncingFx(true);
    try {
      const res = await fetch('/api/fx/usdt-inr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'custom_adjust',
          usdtToInrRate: cleanUsdt,
          usdToInrRate: cleanUsd,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsdtInrRate(Number(data.usdtToInrRate));
        setInrRate(Number(data.usdToInrRate));
        setFxSource(data.source || 'Live Desk Custom Rate Adjustment');
        setFxBanner(
          `Applied Live Rate: 1 USDT = ₹${Number(data.usdtToInrRate).toFixed(2)} INR · 1 USD = ₹${Number(data.usdToInrRate).toFixed(2)} INR`
        );
        await onRefreshPublicData();
      }
    } catch (e) {
      console.error('Failed to adjust USDT/INR rate:', e);
    } finally {
      setSyncingFx(false);
    }
  };

  const activePreviewFile = selectedFile || publicFiles[0] || null;

  const handleSupportSubmit = async (e: React.FormEvent, isDmca = false) => {
    e.preventDefault();
    setTicketError(null);
    setTicketSubmitted(null);
    if (!ticketEmail.includes('@') || !ticketMessage.trim()) {
      setTicketError('Please enter a valid email address and detailed message.');
      return;
    }

    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isDmca ? 'report' : 'ticket',
          email: ticketEmail.trim(),
          subject: ticketSubject.trim() || (isDmca ? 'DMCA Copyright Takedown Notice' : 'Support Inquiry'),
          category: isDmca ? 'copyright_dmca' : ticketCategory,
          message: ticketMessage.trim(),
          copyrightClaim: isDmca,
        }),
      });
      if (!res.ok) {
        throw new Error('Submission failed');
      }
      const data = await res.json();
      setTicketSubmitted(
        isDmca
          ? `Copyright notice logged in moderation queue (ID #${data.record?.id || '104'}).`
          : `Support ticket ${data.record?.ticketNumber || 'TKT-2026'} created and queued for support review.`
      );
      setTicketMessage('');
      setTicketSubject('');
    } catch (err: any) {
      setTicketError(err.message || 'Could not submit form.');
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportModalFile || !reportEmail.includes('@') || !reportDetails.trim()) return;
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'report',
          fileId: reportModalFile.id,
          email: reportEmail.trim(),
          category: reportReason,
          message: reportDetails.trim(),
          copyrightClaim: reportReason === 'copyright_dmca',
        }),
      });
      if (res.ok) {
        setReportSuccess('Report recorded for Moderator review.');
        setTimeout(() => {
          setReportSuccess(null);
          setReportModalFile(null);
          setReportDetails('');
        }, 1600);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ---------------------------------------------------------------------------
  // 1. HOME PAGE
  // ---------------------------------------------------------------------------
  if (route === 'home') {
    const monthlyEligibleViews = calcDailyViews * 30;
    const estMonthlyBalancedUsd = (monthlyEligibleViews / 1000) * balancedCpm;
    const estMonthlyMaxAdsUsd = (monthlyEligibleViews / 1000) * maxAdsCpm;
    const estMonthlyUsd = adPreference === 'more' ? estMonthlyMaxAdsUsd : estMonthlyBalancedUsd;
    const estMonthlyInr = estMonthlyUsd * inrRate;

    return (
      <div className="relative w-full max-w-full overflow-x-hidden space-y-16 sm:space-y-20 pb-20">
        {/* Subtle Ambient Animated INR Currency Notes Background Layer */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-x-0 top-0 h-[620px] overflow-hidden -z-10 opacity-75 dark:opacity-60"
        >
          <div className="max-w-7xl mx-auto relative h-full">
            <div className="hidden xl:flex items-center gap-2 absolute top-6 right-4 px-3 py-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 backdrop-blur-xs inr-note-anim">
              <InrCurrencyNoteBadge amountLabel="₹500 INR INSTANT UPI" />
            </div>
            <div className="hidden xl:flex items-center gap-2 absolute bottom-8 left-4 px-3 py-1.5 rounded-xl border border-blue-500/25 bg-blue-500/5 backdrop-blur-xs inr-note-anim-alt">
              <InrCurrencyNoteBadge amountLabel={`1 USD = ₹${inrRate} INR`} altAnim />
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 lg:pt-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Left Column: Headline, CTAs & Firebase Google Creator Sign-Up Box */}
            <div className="lg:col-span-6 flex flex-col justify-between space-y-8">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-neutral-600 dark:text-neutral-400">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber-500/35 bg-amber-500/10 font-semibold text-neutral-950 dark:text-white">
                    <Zap className="w-3.5 h-3.5 text-amber-500 icon-anim-bolt" />
                    Lightning-Fast UPI & USDT Payouts
                  </span>
                  <InrCurrencyNoteBadge amountLabel={`₹${(targetCpm * inrRate).toFixed(0)} / 1k Views`} />
                  <span className="px-2.5 py-1 rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold">
                    2 Plans: ${balancedCpm.toFixed(2)} & ${maxAdsCpm.toFixed(2)} CPM
                  </span>
                </div>

                <h1
                  className="text-3xl sm:text-5xl lg:text-[52px] font-bold tracking-tight text-neutral-950 dark:text-white leading-[1.08]"
                  style={{ textWrap: 'balance' }}
                >
                  Your Content. Your Links. Your Earnings.
                </h1>
                <p className="text-sm sm:text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-xl">
                  Upload files and videos, share monetized links anywhere, switch between our 2 official plans (<strong>${balancedCpm.toFixed(2)} Balanced Plan</strong> or <strong>${maxAdsCpm.toFixed(2)} Max Ads Plan</strong>), and withdraw instantly via India UPI (₹ INR) or Global USDT.
                </p>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                  <button
                    type="button"
                    onClick={() => onNavigate('dashboard')}
                    className="min-h-[46px] px-5 py-3 rounded-lg bg-gradient-to-r from-neutral-950 via-blue-950 to-neutral-900 dark:from-white dark:via-blue-50 dark:to-white text-white dark:text-neutral-950 border border-blue-500/35 font-semibold text-sm hover:opacity-95 transition-all inline-flex items-center justify-center gap-2 w-full shadow-sm"
                  >
                    <span>Start Earning</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('pricing')}
                    className="min-h-[46px] px-5 py-3 rounded-lg color-graded-panel text-neutral-900 dark:text-white font-semibold text-sm hover:border-blue-500 transition-colors inline-flex items-center justify-center gap-2 w-full"
                  >
                    <Sliders className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>Compare ${balancedCpm.toFixed(0)} & ${maxAdsCpm.toFixed(0)} CPM Plans</span>
                  </button>
                </div>

                {/* Chunked Cloud Upload + Firebase Google Sign-Up Card (Replaced Test Upload Speed Button) */}
                <div className="p-4 sm:p-5 rounded-xl color-graded-panel space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white inline-flex items-center justify-center shrink-0 shadow-xs">
                        <Upload className="w-4 h-4 icon-anim-float" />
                      </span>
                      <div>
                        <span className="font-bold text-neutral-950 dark:text-white block">
                          Instant Creator Onboarding & Cloud Upload
                        </span>
                        <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                          MP4 · ZIP · PDF · APK · SHA-256 Verified · Firebase Auth
                        </span>
                      </div>
                    </div>
                    <InrCurrencyNoteBadge amountLabel="₹ INR + USDT Ready" altAnim />
                  </div>

                  {/* Beautiful, Clickable, Fully Functional Firebase Google Sign-Up Button */}
                  <button
                    type="button"
                    onClick={handleFirebaseGoogleClick}
                    disabled={googleSigningIn}
                    className="google-signup-btn min-h-[48px] w-full px-4 py-3 rounded-xl font-bold text-xs sm:text-sm text-neutral-950 dark:text-white flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center shrink-0 shadow-2xs">
                        <GoogleGIcon className="w-4 h-4" />
                      </span>
                      <span className="truncate">
                        {googleSigningIn
                          ? 'Connecting to Firebase Google Auth...'
                          : 'Sign Up / Continue with Google'}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600 text-white text-[11px] font-mono font-semibold shrink-0">
                      <span>{sessionAccountEmail ? 'Open Studio' : 'Instant Access'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400 pt-0.5">
                    <span className="truncate max-w-full">
                      {sessionAccountEmail
                        ? `Connected: ${sessionAccountName || 'Creator'} (${sessionAccountEmail})`
                        : 'One-click Google Sign Up activates $2.00 Balanced & $3.00 Max Ads monetization'}
                    </span>
                    <span className="shrink-0 font-semibold text-emerald-700 dark:text-emerald-400">
                      100% Verified
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Animated Lightning UPI & USDT Payout + Monetized Link Console */}
            <div className="lg:col-span-6 flex flex-col justify-between">
              <div className="liquid-retina-card h-full">
                <div className="liquid-retina-inner bg-white dark:bg-neutral-950 p-5 sm:p-7 h-full flex flex-col justify-between space-y-6">
                  <div className="liquid-retina-glow" aria-hidden="true" />

                  <div className="relative z-10 space-y-5">
                    {/* Console Top Header with Animated Status Icons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-950 to-blue-950 dark:from-white dark:to-blue-100 text-white dark:text-neutral-950 flex items-center justify-center shrink-0 icon-anim-halo">
                          <Zap className="w-5 h-5 text-amber-400 dark:text-amber-600 icon-anim-bolt" />
                        </div>
                        <div>
                          <h2 className="text-sm sm:text-base font-bold text-neutral-950 dark:text-white">
                            Instant Creator Payout & Link Console
                          </h2>
                          <p className="text-xs font-mono text-neutral-500">
                            Dual Settlement Engine: India UPI (₹ INR) + Global USDT
                          </p>
                        </div>
                      </div>

                      {/* Interactive Rail Switcher */}
                      <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setSelectedPayoutRail('upi')}
                          className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                            selectedPayoutRail === 'upi'
                              ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          <span>Lightning UPI</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedPayoutRail('usdt')}
                          className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                            selectedPayoutRail === 'usdt'
                              ? 'bg-emerald-600 text-white'
                              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                          }`}
                        >
                          <Coins className="w-3.5 h-3.5 text-emerald-400" />
                          <span>USDT Payout</span>
                        </button>
                      </div>
                    </div>

                    {/* Two Highlighted Payout Cards inside Console */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Card A: Lightning-Fast UPI */}
                      <div
                        onClick={() => setSelectedPayoutRail('upi')}
                        className={`cursor-pointer p-4 rounded-xl border transition-all space-y-2.5 ${
                          selectedPayoutRail === 'upi'
                            ? 'border-blue-600 dark:border-blue-400 bg-blue-50/30 dark:bg-blue-950/25 shadow-xs'
                            : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="w-9 h-9 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 inline-flex items-center justify-center shrink-0">
                            <Zap className="w-4 h-4 text-amber-400 dark:text-amber-600 icon-anim-bolt" />
                          </span>
                          <InrCurrencyNoteBadge
                            amountLabel={`₹${(Number(customCodes?.upiMinWithdrawalUsd ?? 5) * inrRate).toFixed(0)} MIN`}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-neutral-950 dark:text-white">
                            Lightning-Fast UPI Payout
                          </p>
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                            Direct INR transfer to GPay, PhonePe, Paytm & BHIM (@okaxis / @ybl).
                          </p>
                        </div>
                        <div className="pt-2 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between text-xs font-mono tabular-nums">
                          <span className="text-neutral-500">Min Payout:</span>
                          <span className="font-bold text-neutral-950 dark:text-white">
                            ${Number(customCodes?.upiMinWithdrawalUsd ?? 5).toFixed(2)} (₹{(Number(customCodes?.upiMinWithdrawalUsd ?? 5) * inrRate).toFixed(0)} INR)
                          </span>
                        </div>
                      </div>

                      {/* Card B: Global USDT Stablecoin */}
                      <div
                        onClick={() => setSelectedPayoutRail('usdt')}
                        className={`cursor-pointer p-4 rounded-xl border transition-all space-y-2.5 ${
                          selectedPayoutRail === 'usdt'
                            ? 'border-emerald-600 dark:border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/25 shadow-xs'
                            : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="w-9 h-9 rounded-lg bg-emerald-600 text-white inline-flex items-center justify-center icon-anim-emerald">
                            <Coins className="w-4 h-4 icon-anim-float" />
                          </span>
                          <span className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                            1 USDT = ₹{usdtInrRate.toFixed(2)} INR
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-neutral-950 dark:text-white">
                            USDT Crypto Payout Available
                          </p>
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                            1:1 USD Tether settlement to Tron, Ethereum, or Polygon (≈ ₹{usdtInrRate.toFixed(2)} INR / USDT).
                          </p>
                        </div>
                        <div className="pt-2 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between text-xs font-mono tabular-nums">
                          <span className="text-neutral-500">Min Payout:</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            {Number(customCodes?.usdtMinWithdrawalUsd ?? 20).toFixed(0)} USDT (₹{(Number(customCodes?.usdtMinWithdrawalUsd ?? 20) * usdtInrRate).toFixed(0)} INR)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Live USDT / INR & USD / INR Rate Adjuster Bar inside Console */}
                    <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/90 border border-emerald-500/35 space-y-2.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="font-mono font-bold text-neutral-950 dark:text-white">
                            LIVE USDT/INR: ₹{usdtInrRate.toFixed(2)}
                          </span>
                          <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                            ({fxChange24h >= 0 ? `+${fxChange24h}%` : `${fxChange24h}%`})
                          </span>
                          <span className="text-neutral-400">·</span>
                          <span className="font-mono text-neutral-600 dark:text-neutral-300">
                            UPI USD/INR: ₹{inrRate.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handlePersistCustomUsdtInrRate(Number((usdtInrRate - 0.25).toFixed(2)))
                            }
                            disabled={syncingFx}
                            className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-[11px] font-bold hover:border-blue-500"
                            title="Decrease USDT/INR rate by ₹0.25"
                          >
                            -₹0.25
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handlePersistCustomUsdtInrRate(Number((usdtInrRate + 0.25).toFixed(2)))
                            }
                            disabled={syncingFx}
                            className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-[11px] font-bold hover:border-blue-500"
                            title="Increase USDT/INR rate by ₹0.25"
                          >
                            +₹0.25
                          </button>
                          <button
                            type="button"
                            onClick={handleSyncLiveMarketRate}
                            disabled={syncingFx}
                            className="px-2.5 py-1 rounded bg-emerald-600 text-white font-mono text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-emerald-700 transition-colors"
                          >
                            <RefreshCw className={`w-3 h-3 ${syncingFx ? 'animate-spin' : ''}`} />
                            <span>{syncingFx ? 'Syncing...' : 'Live Rate'}</span>
                          </button>
                        </div>
                      </div>
                      {fxBanner && (
                        <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                          {fxBanner}
                        </p>
                      )}
                    </div>

                    {/* Live Monetized Link & Active CPM Status Bar */}
                    <div className="p-3.5 rounded-xl color-graded-panel flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-lg bg-blue-600 text-white inline-flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4 icon-anim-float" />
                        </span>
                        <div>
                          <p className="font-semibold text-neutral-950 dark:text-white">
                            Active Plan:{' '}
                            {adPreference === 'more'
                              ? `Max Ads Plan ($${maxAdsCpm.toFixed(2)} CPM)`
                              : `Balanced Plan ($${balancedCpm.toFixed(2)} CPM)`}
                          </p>
                          <p className="text-[11px] font-mono text-neutral-500">
                            Selected Settlement:{' '}
                            {selectedPayoutRail === 'upi'
                              ? `India UPI VPA (1 USD = ₹${inrRate.toFixed(2)} INR)`
                              : `USDT Stablecoin (1 USDT = ₹${usdtInrRate.toFixed(2)} INR)`}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onChangeAdPreference(adPreference === 'more' ? 'balanced' : 'more')
                        }
                        className="px-3 py-1.5 rounded-md bg-white dark:bg-neutral-800 border border-blue-500/40 text-xs font-semibold text-neutral-900 dark:text-white hover:bg-blue-50/50 dark:hover:bg-neutral-700 transition-colors whitespace-nowrap"
                      >
                        Switch to {adPreference === 'more' ? `Balanced ($${balancedCpm.toFixed(2)})` : `Max Ads ($${maxAdsCpm.toFixed(2)})`}
                      </button>
                    </div>
                  </div>

                  {/* Console Bottom Action Buttons — Perfectly Fitted */}
                  <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => onNavigate('dashboard')}
                      className="min-h-[42px] px-4 py-2.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity w-full"
                    >
                      <Wallet className="w-4 h-4 shrink-0" />
                      <span>
                        Open {selectedPayoutRail === 'upi' ? 'UPI (₹ INR)' : 'USDT'} Wallet
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('dashboard')}
                      className="min-h-[42px] px-4 py-2.5 rounded-lg border border-blue-500/35 bg-white dark:bg-neutral-900 text-neutral-950 dark:text-white text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors w-full"
                    >
                      <Share2 className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span>Upload & Create Share Link</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Full-width 4-Column Platform Capabilities Strip below Hero */}
          <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-4 rounded-xl color-graded-panel flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0">
                <Sliders className="w-5 h-5 icon-anim-float" />
              </div>
              <div>
                <p className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold">01. ONLY 2 SIMPLE PLANS</p>
                <p className="mt-0.5 text-lg font-bold font-mono tabular-nums text-neutral-950 dark:text-white">
                  ${balancedCpm.toFixed(2)} or ${maxAdsCpm.toFixed(2)} CPM
                </p>
                <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                  Switch between Balanced (${balancedCpm.toFixed(2)}) or Max Ads (${maxAdsCpm.toFixed(2)}) anytime.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl color-graded-panel flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 icon-anim-bolt" />
              </div>
              <div>
                <p className="text-xs font-mono text-amber-600 dark:text-amber-400 font-semibold">02. LIGHTNING INDIA UPI</p>
                <p className="mt-0.5 text-lg font-bold font-mono tabular-nums text-neutral-950 dark:text-white">
                  $5.00 Min (₹{(5 * inrRate).toFixed(0)})
                </p>
                <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                  Instant VPA verification and direct INR bank settlement.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl color-graded-panel flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Coins className="w-5 h-5 icon-anim-float" />
              </div>
              <div>
                <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">03. GLOBAL USDT PAYOUT</p>
                <p className="mt-0.5 text-lg font-bold font-mono tabular-nums text-neutral-950 dark:text-white">
                  TRC-20 · ERC-20 · BEP-20
                </p>
                <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                  Fast 1:1 USD Tether crypto withdrawals worldwide.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl color-graded-panel flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 icon-anim-float" />
              </div>
              <div>
                <p className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold">04. UNLIMITED CLOUD LINKS</p>
                <p className="mt-0.5 text-lg font-bold font-mono tabular-nums text-neutral-950 dark:text-white">
                  MP4 · ZIP · PDF · APK
                </p>
                <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                  No complex storage tiers — upload, share QR links, and earn.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Plan Pricing / Benefits Section — Strictly 2 Plans ($2.00 Balanced & $3.00 Max Ads) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-5">
            <div className="space-y-1.5 max-w-2xl">
              <p className="text-xs font-mono text-blue-700 dark:text-blue-400 font-semibold">
                2 MONETIZATION PLANS · SELF-ADJUSTING CREATOR CPM
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
                Only 2 Simple Plans: Balanced (${balancedCpm.toFixed(2)}) or Max Ads (${maxAdsCpm.toFixed(2)})
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Choose how your shared links are monetized. Toggle directly between Balanced Plan (${balancedCpm.toFixed(2)} CPM) for smooth single-slot playback or Max Ads Plan (${maxAdsCpm.toFixed(2)} CPM) for maximum earning potential.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-blue-500/25 w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={() => onChangeAdPreference('balanced')}
                className={`min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center ${
                  adPreference === 'balanced'
                    ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                Balanced (${balancedCpm.toFixed(2)} CPM)
              </button>
              <button
                type="button"
                onClick={() => onChangeAdPreference('more')}
                className={`min-h-[38px] px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center ${
                  adPreference === 'more'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                Max Ads (${maxAdsCpm.toFixed(2)} CPM)
              </button>
            </div>
          </div>

          {/* Two Liquid Retina Cards with Animated Corner-Border Shine & INR Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Balanced Plan ($2.00 CPM) */}
            <div className="liquid-retina-card">
              <div className="liquid-retina-inner bg-white dark:bg-neutral-950 p-5 sm:p-8 h-full flex flex-col justify-between space-y-6">
                <div className="liquid-retina-glow" aria-hidden="true" />
                <div className="relative z-10 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-xs font-mono text-blue-700 dark:text-blue-400 font-semibold">
                      <span className="w-6 h-6 rounded-md bg-blue-600 text-white inline-flex items-center justify-center">
                        <Sliders className="w-3.5 h-3.5 icon-anim-float" />
                      </span>
                      PLAN 01 · BALANCED STANDARD PLAN
                    </span>
                    <InrCurrencyNoteBadge
                      amountLabel={`≈ ₹${(balancedCpm * inrRate).toFixed(0)} INR / 1k Views`}
                    />
                  </div>

                  <div className="flex items-baseline justify-between gap-4 border-b border-neutral-200/80 dark:border-neutral-800 pb-4">
                    <div>
                      <h3 className="text-xl font-bold text-neutral-950 dark:text-white">
                        Balanced Plan
                      </h3>
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mt-0.5">
                        Benefit: High Viewer Retention & Steady Creator Yield
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white">
                        ${balancedCpm.toFixed(2)}
                      </span>
                      <span className="block text-[11px] font-mono text-neutral-500">
                        Target eCPM / 1k views
                      </span>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    The recommended standard monetization plan for general videos, tutorials, and shared files. Delivers single-slot skippable pre-roll ads with zero mid-roll interruptions, keeping viewers engaged while paying a steady ${balancedCpm.toFixed(2)} eCPM.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs font-mono text-neutral-600 dark:text-neutral-400">
                    <div>· Single Skippable Pre-Roll Slot</div>
                    <div>· 10,000 Views = ${(10 * balancedCpm).toFixed(2)} (₹{(10 * balancedCpm * inrRate).toFixed(0)})</div>
                    <div>· Zero Mid-Roll Interruptions</div>
                    <div>· Instant UPI & USDT Withdrawals</div>
                  </div>
                </div>

                <div className="relative z-10 pt-2">
                  <button
                    type="button"
                    onClick={() => onChangeAdPreference('balanced')}
                    className={`min-h-[44px] w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors inline-flex items-center justify-center gap-2 ${
                      adPreference === 'balanced'
                        ? 'bg-blue-700 text-white'
                        : 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 hover:opacity-90'
                    }`}
                  >
                    {adPreference === 'balanced' ? (
                      <>
                        <Check className="w-4 h-4 shrink-0" />
                        <span>Active: Balanced Plan (${balancedCpm.toFixed(2)} CPM)</span>
                      </>
                    ) : (
                      <span>Select Balanced Plan (${balancedCpm.toFixed(2)} CPM)</span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Card 2: Max Ads Plan ($3.00 CPM) */}
            <div className="liquid-retina-card">
              <div className="liquid-retina-inner bg-white dark:bg-neutral-950 p-5 sm:p-8 h-full flex flex-col justify-between space-y-6">
                <div className="liquid-retina-glow" aria-hidden="true" />
                <div className="relative z-10 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-xs font-mono text-amber-600 dark:text-amber-400 font-semibold">
                      <span className="w-6 h-6 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 inline-flex items-center justify-center">
                        <Zap className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600 icon-anim-bolt" />
                      </span>
                      PLAN 02 · MAX ADS MONETIZATION PLAN
                    </span>
                    <InrCurrencyNoteBadge
                      amountLabel={`≈ ₹${(maxAdsCpm * inrRate).toFixed(0)} INR / 1k Views`}
                      altAnim
                    />
                  </div>

                  <div className="flex items-baseline justify-between gap-4 border-b border-neutral-200/80 dark:border-neutral-800 pb-4">
                    <div>
                      <h3 className="text-xl font-bold text-neutral-950 dark:text-white">
                        Max Ads Plan
                      </h3>
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                        Benefit: Maximum Potential Earning (+50% Higher Yield)
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-3xl sm:text-4xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white">
                        ${maxAdsCpm.toFixed(2)}
                      </span>
                      <span className="block text-[11px] font-mono text-neutral-500">
                        Target eCPM / 1k views
                      </span>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    Designed for creators who want the highest revenue yield from every shared video and file link. Enables pre-roll plus eligible mid-roll VAST ad placements for maximum monetization potential at ${maxAdsCpm.toFixed(2)} eCPM.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs font-mono text-neutral-600 dark:text-neutral-400">
                    <div>· Pre-Roll + Mid-Roll Ad Slots</div>
                    <div>· 10,000 Views = ${(10 * maxAdsCpm).toFixed(2)} (₹{(10 * maxAdsCpm * inrRate).toFixed(0)})</div>
                    <div>· Priority High-Bid Ad Demand</div>
                    <div>· Instant UPI & USDT Withdrawals</div>
                  </div>
                </div>

                <div className="relative z-10 pt-2">
                  <button
                    type="button"
                    onClick={() => onChangeAdPreference('more')}
                    className={`min-h-[44px] w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors inline-flex items-center justify-center gap-2 ${
                      adPreference === 'more'
                        ? 'bg-blue-700 text-white'
                        : 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 hover:opacity-90'
                    }`}
                  >
                    {adPreference === 'more' ? (
                      <>
                        <Check className="w-4 h-4 shrink-0" />
                        <span>Active: Max Ads Plan (${maxAdsCpm.toFixed(2)} CPM)</span>
                      </>
                    ) : (
                      <span>Select Max Ads Plan (${maxAdsCpm.toFixed(2)} CPM)</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Animated Icon Capabilities & Payout Ecosystem Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
            <div>
              <p className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold">
                INSTANT PAYOUTS & CLOUD INFRASTRUCTURE
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-neutral-950 dark:text-white mt-1">
                Built for Speed: Lightning UPI, Global USDT & Smart Sharing
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold inline-flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <span>Open Creator Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. Lightning Fast UPI Payout */}
            <div className="p-6 rounded-xl color-graded-panel flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-400 dark:text-amber-600 icon-anim-bolt" />
                  </div>
                  <InrCurrencyNoteBadge amountLabel="INSTANT ₹ INR UPI" />
                </div>
                <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                  Lightning-Fast UPI Payouts
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Verify your Virtual Payment Address (@okaxis, @ybl, @paytm, @ibl) and receive instant INR payouts directly to your bank account with a low $5.00 minimum.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="min-h-[38px] w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Configure UPI Payout</span>
              </button>
            </div>

            {/* 2. USDT Crypto Payout Available */}
            <div className="p-6 rounded-xl color-graded-panel flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center icon-anim-emerald">
                    <Coins className="w-5 h-5 icon-anim-float" />
                  </div>
                  <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                    USDT TRC-20 & ERC-20
                  </span>
                </div>
                <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                  Global USDT Payouts Available
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  International and crypto-native creators can withdraw earnings 1:1 in USDT stablecoin across Tron (TRC-20), Ethereum (ERC-20), and Polygon networks.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="min-h-[38px] w-full px-3 py-2 rounded-lg border border-emerald-600/40 dark:border-emerald-500/40 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Withdraw in USDT</span>
              </button>
            </div>

            {/* 3. Dynamic Self-Adjusting CPM */}
            <div className="p-6 rounded-xl color-graded-panel flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center icon-anim-halo">
                    <Sliders className="w-5 h-5 icon-anim-float" />
                  </div>
                  <span className="text-[11px] font-mono text-blue-700 dark:text-blue-400 font-semibold">
                    ${balancedCpm.toFixed(2)} OR ${maxAdsCpm.toFixed(2)} CPM
                  </span>
                </div>
                <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                  2-Plan Ad-Load Control
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Adjust ad density yourself. Pick Balanced Plan (${balancedCpm.toFixed(2)} CPM) for optimal viewer retention or Max Ads Plan (${maxAdsCpm.toFixed(2)} CPM) for peak revenue.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onChangeAdPreference(adPreference === 'more' ? 'balanced' : 'more')
                }
                className="min-h-[38px] w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Toggle $2 / $3 CPM Plan</span>
              </button>
            </div>

            {/* 4. Multi-Format Cloud */}
            <div className="p-6 rounded-xl color-graded-panel flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center">
                    <Upload className="w-5 h-5 icon-anim-float" />
                  </div>
                  <span className="text-[11px] font-mono text-neutral-500 font-semibold">
                    RESUMABLE CLOUD
                  </span>
                </div>
                <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                  Multi-Format File & Video Hosting
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Host MP4, WebM, PDF documents, ZIP archives, and signed Android APK builds with multipart chunking and server-side malware scanning.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="min-h-[38px] w-full px-3 py-2 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Files Now</span>
              </button>
            </div>

            {/* 5. Instant Link & QR Sharing */}
            <div className="p-6 rounded-xl color-graded-panel flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center">
                    <Share2 className="w-5 h-5 icon-anim-float" />
                  </div>
                  <span className="text-[11px] font-mono text-neutral-500 font-semibold">
                    SHORT LINKS & QR
                  </span>
                </div>
                <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                  Monetized Links & QR Matrices
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Every upload generates a clean shareable link, vector QR code, optional password lock, and customizable download permissions for Telegram, WhatsApp, or X.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('features')}
                className="min-h-[38px] w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <span>Explore Link Features</span>
              </button>
            </div>

            {/* 6. Verified Double-Entry Wallet */}
            <div className="p-6 rounded-xl color-graded-panel flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-blue-400 dark:text-blue-600 icon-anim-float" />
                  </div>
                  <span className="text-[11px] font-mono text-neutral-500 font-semibold">
                    REAL-TIME TELEMETRY
                  </span>
                </div>
                <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                  Auditable Earnings & Analytics
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Track every qualified view, geography eCPM rate, and referral commission in an immutable ledger with one-click CSV export.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('how-earnings-work')}
                className="min-h-[38px] w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <span>How Earnings Work</span>
              </button>
            </div>
          </div>
        </section>

        {/* Transparent Creator Earnings Calculator — Strictly 2 Plans ($2.00 Balanced & $3.00 Max Ads) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="p-5 sm:p-8 rounded-2xl color-graded-panel grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold">
                  2-PLAN EARNINGS CALCULATOR
                </span>
                <InrCurrencyNoteBadge amountLabel={`₹${(targetCpm * inrRate).toFixed(0)} INR / 1K`} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
                Calculate Your $2.00 Balanced & $3.00 Max Ads Earnings
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Estimate your monthly payout across our two creator plans: <strong>Balanced Plan (${balancedCpm.toFixed(2)} CPM)</strong> or <strong>Max Ads Plan (${maxAdsCpm.toFixed(2)} CPM)</strong> per 1,000 eligible monetized views.
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Withdraw your finalized balance anytime via Lightning-Fast India UPI (₹ INR) or Global USDT (TRC-20 / ERC-20).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('how-earnings-work')}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold inline-flex items-center justify-center"
                >
                  Read Full CPM Specification
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('pricing')}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-blue-500/35 text-xs font-semibold text-neutral-900 dark:text-white inline-flex items-center justify-center"
                >
                  Compare $2 & $3 CPM Plans
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 p-5 sm:p-6 rounded-xl bg-white dark:bg-neutral-950 border border-blue-500/25 dark:border-blue-400/25 space-y-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold text-neutral-900 dark:text-white">
                  Interactive 2-Plan Earnings Calculator ($2.00 vs $3.00 CPM)
                </span>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => onChangeAdPreference('balanced')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      adPreference === 'balanced'
                        ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    Balanced Plan (${balancedCpm.toFixed(2)})
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeAdPreference('more')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      adPreference === 'more'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    Max Ads Plan (${maxAdsCpm.toFixed(2)})
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <label htmlFor="daily-views-range" className="text-neutral-600 dark:text-neutral-400 font-medium">
                    Daily Eligible Monetized Views ({monthlyEligibleViews.toLocaleString()} / month)
                  </label>
                  <span className="font-mono tabular-nums font-bold text-neutral-950 dark:text-white">
                    {calcDailyViews.toLocaleString()} views / day
                  </span>
                </div>
                <input
                  id="daily-views-range"
                  type="range"
                  min={1000}
                  max={100000}
                  step={1000}
                  value={calcDailyViews}
                  onChange={(e) => setCalcDailyViews(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Interactive Live USDT/INR & USD/INR Rate Adjuster inside Calculator */}
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-emerald-500/30 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <label
                    htmlFor="live-usdt-inr-range"
                    className="font-semibold text-neutral-900 dark:text-white flex items-center gap-2"
                  >
                    <Coins className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Adjust Live USDT / INR Rate (1 USDT = ₹{usdtInrRate.toFixed(2)} INR)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-neutral-500">
                      UPI USD/INR: ₹{inrRate.toFixed(2)} · {fxSource}
                    </span>
                    <button
                      type="button"
                      onClick={handleSyncLiveMarketRate}
                      disabled={syncingFx}
                      className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-mono font-semibold inline-flex items-center gap-1 hover:bg-emerald-700 transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${syncingFx ? 'animate-spin' : ''}`} />
                      <span>Sync Live</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="live-usdt-inr-range"
                    type="range"
                    min={80}
                    max={105}
                    step={0.05}
                    value={usdtInrRate}
                    onChange={(e) => {
                      const nextUsdt = Number(e.target.value);
                      setUsdtInrRate(nextUsdt);
                      setInrRate(Number(Math.max(78, nextUsdt - 1.85).toFixed(2)));
                    }}
                    onMouseUp={() => handlePersistCustomUsdtInrRate(usdtInrRate, inrRate)}
                    onTouchEnd={() => handlePersistCustomUsdtInrRate(usdtInrRate, inrRate)}
                    className="flex-1 accent-emerald-600 cursor-pointer"
                  />
                  <input
                    type="number"
                    aria-label="Live USDT to INR rate"
                    step="0.05"
                    min={75}
                    max={105}
                    value={usdtInrRate}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val)) {
                        setUsdtInrRate(val);
                      }
                    }}
                    onBlur={() => handlePersistCustomUsdtInrRate(usdtInrRate, inrRate)}
                    className="w-24 px-2.5 py-1 text-xs font-mono font-bold text-right rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                  />
                </div>
              </div>

              {/* Active Plan 30-Day Payout Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800">
                  <p className="text-[11px] text-neutral-500">
                    30-Day Payout ({adPreference === 'more' ? `$${maxAdsCpm.toFixed(2)} Max Ads` : `$${balancedCpm.toFixed(2)} Balanced`})
                  </p>
                  <p className="text-xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white mt-1">
                    ${estMonthlyUsd.toFixed(2)} USD
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-500/30">
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span>UPI (₹{inrRate.toFixed(2)})</span>
                    </span>
                    <span className="font-mono font-bold">₹ INR</span>
                  </p>
                  <p className="text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                    ₹{estMonthlyInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })} INR
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-500/30">
                  <p className="text-[11px] text-blue-700 dark:text-blue-300 flex items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1">
                      <Coins className="w-3 h-3" />
                      <span>USDT (₹{usdtInrRate.toFixed(2)})</span>
                    </span>
                    <span className="font-mono font-bold">LIVE INR</span>
                  </p>
                  <p className="text-xl font-bold font-mono tabular-nums text-blue-700 dark:text-blue-400 mt-1">
                    {estMonthlyUsd.toFixed(2)} USDT
                  </p>
                  <p className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                    ≈ ₹{(estMonthlyUsd * usdtInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })} INR
                  </p>
                </div>
              </div>

              {/* Side-by-Side Both Plans Instant Reference Bar ($2.00 Balanced vs $3.00 Max Ads) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-mono">
                <div
                  onClick={() => onChangeAdPreference('balanced')}
                  className={`cursor-pointer p-3 rounded-lg border flex items-center justify-between ${
                    adPreference === 'balanced'
                      ? 'border-neutral-950 dark:border-white bg-neutral-100/80 dark:bg-neutral-900 font-bold'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-500'
                  }`}
                >
                  <span>Balanced (${balancedCpm.toFixed(2)} CPM):</span>
                  <span className="text-neutral-950 dark:text-white">
                    ${estMonthlyBalancedUsd.toFixed(0)} · ₹{(estMonthlyBalancedUsd * usdtInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })} (USDT)
                  </span>
                </div>
                <div
                  onClick={() => onChangeAdPreference('more')}
                  className={`cursor-pointer p-3 rounded-lg border flex items-center justify-between ${
                    adPreference === 'more'
                      ? 'border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-950/30 font-bold'
                      : 'border-neutral-200 dark:border-neutral-800 text-neutral-500'
                  }`}
                >
                  <span>Max Ads (${maxAdsCpm.toFixed(2)} CPM):</span>
                  <span className="text-blue-700 dark:text-blue-400">
                    ${estMonthlyMaxAdsUsd.toFixed(0)} · ₹{(estMonthlyMaxAdsUsd * usdtInrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })} (USDT)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Creator FAQ Section (Accordion-Style with Liquid-Retina-Card Design Language) */}
        <section id="creator-faq" className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-5">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-blue-700 dark:text-blue-400 font-semibold">
                  <HelpCircle className="w-3.5 h-3.5 icon-anim-float" />
                  CREATOR KNOWLEDGE BASE · FREQUENTLY ASKED QUESTIONS
                </span>
                <InrCurrencyNoteBadge amountLabel={`LIVE USDT = ₹${usdtInrRate.toFixed(2)} INR`} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
                Common Creator Questions Answered
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Everything you need to know about our 2 CPM plans (${balancedCpm.toFixed(2)} Balanced & ${maxAdsCpm.toFixed(2)} Max Ads), Lightning India UPI (₹ INR) & Global USDT withdrawals, and link monetization.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('help-faq')}
              className="min-h-[40px] px-4 py-2 rounded-lg color-graded-panel text-xs font-semibold text-neutral-900 dark:text-white inline-flex items-center justify-center gap-2 w-full md:w-auto shrink-0"
            >
              <span>Open Full Help Center & Support</span>
              <ArrowRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </button>
          </div>

          <CreatorFaqAccordion
            balancedCpm={balancedCpm}
            maxAdsCpm={maxAdsCpm}
            inrRate={inrRate}
            usdtInrRate={usdtInrRate}
            upiMinUsd={Number(customCodes?.upiMinWithdrawalUsd ?? 5)}
            usdtMinUsd={Number(customCodes?.usdtMinWithdrawalUsd ?? 20)}
            minWatchSeconds={Number(rules?.minWatchSeconds || 5)}
            onNavigate={onNavigate}
            onChangeAdPreference={onChangeAdPreference}
          />
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. EXPLORE PUBLIC VIDEOS & FILES PAGE
  // ---------------------------------------------------------------------------
  if (route === 'explore') {
    const categories = ['All', 'Architecture & Design', 'Engineering & Hardware', 'Filmmaking & Assets', 'Software & Builds', 'Technology'];
    const filtered = publicFiles
      .filter((f) => {
        const matchesCat = categoryFilter === 'All' || f.category === categoryFilter;
        const matchesQuery =
          !searchQuery.trim() ||
          f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.tags.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesQuery;
      })
      .sort((a, b) => (sortBy === 'views' ? b.viewsCount - a.viewsCount : b.id - a.id));

    return (
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
              Explore Public Videos & Shared Files
            </h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Verified creator uploads hosted on ShareDabba. Click any item to stream or download.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                aria-label="Search public videos and files"
                placeholder="Search title, tag, filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white w-64"
              />
            </div>

            <select
              aria-label="Sort files"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'views' | 'recent')}
              className="px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
            >
              <option value="views">Most Viewed</option>
              <option value="recent">Most Recent</option>
            </select>
          </div>
        </div>

        {/* Category Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg w-fit">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-3">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">
              No matching public videos or files found
            </p>
            <p className="text-xs text-neutral-500">
              Try clearing your search filter or upload a new video from your Creator Dashboard.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('All');
              }}
              className="px-4 py-2 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((f) => (
              <div
                key={f.id}
                className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900 flex flex-col justify-between"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => onNavigate('shared-landing', f)}
                    className="w-full text-left block"
                  >
                    <MediaThumbnail
                      type={f.thumbnailType}
                      title={f.title}
                      resolution={f.resolution}
                    />
                  </button>
                  <div className="p-5 space-y-2.5">
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 flex-wrap">
                      <span>{f.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatBytes(f.sizeBytes)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{f.viewsCount.toLocaleString()} views</span>
                    </div>
                    <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                      <button
                        type="button"
                        onClick={() => onNavigate('shared-landing', f)}
                        className="hover:underline text-left"
                      >
                        {f.title}
                      </button>
                    </h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
                      {f.description}
                    </p>
                  </div>
                </div>

                <div className="px-5 py-3.5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => onNavigate('shared-landing', f)}
                    className="px-3.5 py-1.5 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 font-semibold whitespace-nowrap"
                  >
                    Watch / Download
                  </button>
                  <span className="font-mono text-neutral-500">
                    Malware Scan: {f.malwareScanStatus.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 19. PUBLIC SHARED-FILE / VIDEO LANDING PAGE
  // ---------------------------------------------------------------------------
  if (route === 'shared-landing') {
    const file = activePreviewFile;
    if (!file) {
      return (
        <div className="max-w-4xl mx-auto px-6 py-16 text-center space-y-4">
          <h1 className="text-2xl font-bold">Shared File Not Found</h1>
          <button
            type="button"
            onClick={() => onNavigate('explore')}
            className="px-4 py-2 rounded-md bg-neutral-950 text-white text-xs font-semibold"
          >
            Browse Public Videos
          </button>
        </div>
      );
    }

    const requiresPass = Boolean(file.passwordHash && file.passwordHash.trim() !== '') && !isUnlocked;

    return (
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
          <div className="space-y-1">
            <div className="text-xs text-neutral-500 flex items-center gap-2 flex-wrap">
              <span>Shared via ShareDabba</span>
              <span aria-hidden="true">·</span>
              <span>{file.category}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{formatBytes(file.sizeBytes)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">SHA-256 Malware Scan: {file.malwareScanStatus}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-neutral-950 dark:text-white">
              {file.title}
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            {file.allowDownload && (
              <a
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(
                  `ShareDabba Signed Asset Manifest\nTitle: ${file.title}\nFilename: ${file.filename}\nSize: ${file.sizeBytes} bytes\nStorage Key: ${file.storageKey}\nMalware Scan: ${file.malwareScanStatus}\nVerified Timestamp: ${new Date().toISOString()}`
                )}`}
                download={`${file.filename}.manifest.txt`}
                className="px-4 py-2 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download ({formatBytes(file.sizeBytes)})</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => setReportModalFile(file)}
              className="px-3.5 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 whitespace-nowrap"
            >
              Report Abuse / DMCA
            </button>
          </div>
        </div>

        {requiresPass ? (
          <div className="max-w-md mx-auto p-8 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-4 text-center">
            <Lock className="w-6 h-6 mx-auto text-neutral-500" />
            <h2 className="text-lg font-bold">Password-Protected Link</h2>
            <p className="text-xs text-neutral-500">
              Enter the link password provided by the creator to unlock streaming and downloads.
            </p>
            <input
              type="password"
              value={unlockPass}
              onChange={(e) => setUnlockPass(e.target.value)}
              placeholder="Enter link password"
              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-md"
            />
            <button
              type="button"
              onClick={() => setIsUnlocked(true)}
              className="w-full py-2 rounded-md bg-neutral-950 text-white text-xs font-semibold"
            >
              Unlock Shared Link
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
              <ShareDabbaPlayer
                file={file}
                rules={rules}
                adPreference={adPreference}
                onChangeAdPreference={onChangeAdPreference}
                onPlaybackVerified={() => onRefreshPublicData()}
                onReportFile={(f) => setReportModalFile(f)}
                onOpenCreatorProfile={() => onNavigate('creator-profile')}
              />

              <div className="p-5 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3">
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                  File Description & Technical Metadata
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  {file.description || 'Hosted on ShareDabba with verified VAST monetization.'}
                </p>
                <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-neutral-500 block">Filename</span>
                    <span className="font-mono text-neutral-900 dark:text-white truncate block">
                      {file.filename}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Resolution / Format</span>
                    <span className="font-mono text-neutral-900 dark:text-white">
                      {file.resolution} ({file.mimeType})
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Total Views</span>
                    <span className="font-mono tabular-nums text-neutral-900 dark:text-white">
                      {file.viewsCount.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Eligible Monetized Views</span>
                    <span className="font-mono tabular-nums text-blue-700 dark:text-blue-400">
                      {file.monetizedViewsCount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="p-5 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-neutral-500">Creator Attribution</p>
                    <p className="text-sm font-bold text-neutral-950 dark:text-white">
                      Arjun Mehta Studio (@arjunmehta)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('creator-profile')}
                    className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline whitespace-nowrap"
                  >
                    View Profile →
                  </button>
                </div>

                <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-neutral-900 dark:text-white">
                      Direct QR Share Link
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      Scan on Android or iPhone to stream directly in mobile browser.
                    </p>
                  </div>
                  <QrCodeMatrix value={`${window.location.origin}/?v=${file.slug}`} size={84} />
                </div>
              </div>

              <div className="p-5 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3">
                <h3 className="text-xs font-mono uppercase text-neutral-500">
                  More Public Uploads
                </h3>
                <div className="space-y-3">
                  {publicFiles
                    .filter((item) => item.id !== file.id)
                    .slice(0, 3)
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectFile(item)}
                        className="w-full text-left p-2.5 rounded-md border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 transition-colors block space-y-1"
                      >
                        <p className="text-xs font-semibold text-neutral-900 dark:text-white line-clamp-1">
                          {item.title}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-neutral-500">
                          {item.resolution} · {formatBytes(item.sizeBytes)} · {item.viewsCount.toLocaleString()} views
                        </p>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report Video Modal */}
        {reportModalFile && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                  Report Content or Copyright Violation
                </h3>
                <button
                  type="button"
                  onClick={() => setReportModalFile(null)}
                  className="text-xs text-neutral-500 hover:text-neutral-900"
                >
                  Close
                </button>
              </div>
              {reportSuccess ? (
                <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400 py-4">
                  {reportSuccess}
                </p>
              ) : (
                <form onSubmit={handleReportSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Your Contact Email</label>
                    <input
                      type="email"
                      required
                      value={reportEmail}
                      onChange={(e) => setReportEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Reason Category</label>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    >
                      <option value="copyright_dmca">Copyright / DMCA Infringement</option>
                      <option value="malware">Suspicious APK or Archive Malware</option>
                      <option value="prohibited_content">Acceptable-Use Policy Violation</option>
                      <option value="spam">Deceptive Link or Spam</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Details & Evidence URL</label>
                    <textarea
                      required
                      rows={3}
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Provide timestamps, ownership proof, or technical details..."
                      className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setReportModalFile(null)}
                      className="px-3 py-1.5 text-xs border border-neutral-300 rounded-md"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 text-xs bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 font-semibold rounded-md"
                    >
                      Submit Report
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 4. HOW CREATOR EARNINGS WORK & 3. FEATURES & CREATOR / REFERRAL PROGRAM
  // ---------------------------------------------------------------------------
  if (route === 'how-earnings-work' || route === 'features' || route === 'creator-program' || route === 'referral-program') {
    const monthlyViews = calcDailyViews * 30;
    const balancedMonthlyUsd = (monthlyViews / 1000) * balancedCpm;
    const maxAdsMonthlyUsd = (monthlyViews / 1000) * maxAdsCpm;

    return (
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
        <div className="space-y-3 border-b border-neutral-200 dark:border-neutral-800 pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold">
              SHAREDABBA 2-PLAN MONETIZATION SPECIFICATION
            </p>
            <InrCurrencyNoteBadge amountLabel={`1 USD = ₹${inrRate} INR`} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-950 dark:text-white">
            {route === 'how-earnings-work' && 'How Creator Earnings & Our 2 CPM Plans Work'}
            {route === 'features' && 'Platform Capabilities & Video Infrastructure'}
            {route === 'creator-program' && 'ShareDabba Creator Monetization Program'}
            {route === 'referral-program' && 'Creator Growth & 10% Referral Partner Program'}
          </h1>
          <p className="text-base text-neutral-600 dark:text-neutral-300 max-w-3xl">
            ShareDabba operates with two transparent creator monetization plans — <strong>Balanced Plan (${balancedCpm.toFixed(2)} CPM)</strong> and <strong>Max Ads Plan (${maxAdsCpm.toFixed(2)} CPM)</strong> — backed by auditable double-entry wallet accounting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl color-graded-panel space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-950 dark:text-white">
                Plan 01: Balanced Plan (${balancedCpm.toFixed(2)} Target CPM)
              </h2>
              <InrCurrencyNoteBadge amountLabel={`₹${(balancedCpm * inrRate).toFixed(0)} / 1k`} />
            </div>
            <p className="text-xs font-mono bg-neutral-100 dark:bg-neutral-900 p-3 rounded">
              Creator Earnings = (Eligible Views / 1,000) × ${balancedCpm.toFixed(2)} USD
            </p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Single skippable pre-roll placement with zero mid-roll interruptions. Ideal for maximum viewer retention while earning a steady ${balancedCpm.toFixed(2)} per 1,000 verified views ({rules?.minWatchSeconds || 5}s minimum watch time).
            </p>
          </div>

          <div className="p-6 rounded-xl color-graded-panel space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-950 dark:text-white">
                Plan 02: Max Ads Plan (${maxAdsCpm.toFixed(2)} Target CPM)
              </h2>
              <InrCurrencyNoteBadge amountLabel={`₹${(maxAdsCpm * inrRate).toFixed(0)} / 1k`} altAnim />
            </div>
            <p className="text-xs font-mono bg-neutral-100 dark:bg-neutral-900 p-3 rounded">
              Creator Earnings = (Eligible Views / 1,000) × ${maxAdsCpm.toFixed(2)} USD
            </p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Enables pre-roll plus eligible mid-roll VAST ad placements for maximum earning potential (+50% higher creator payout per 1,000 views). Switch between Balanced and Max Ads anytime.
            </p>
          </div>
        </div>

        {/* 2-Plan Interactive Calculator on Earnings Page */}
        <div className="p-6 rounded-xl color-graded-panel space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold text-neutral-950 dark:text-white">
              2-Plan Monthly Earnings Calculator (${balancedCpm.toFixed(2)} Balanced vs ${maxAdsCpm.toFixed(2)} Max Ads)
            </h3>
            <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
              {calcDailyViews.toLocaleString()} views/day ({monthlyViews.toLocaleString()}/mo)
            </span>
          </div>
          <input
            type="range"
            min={1000}
            max={100000}
            step={1000}
            value={calcDailyViews}
            onChange={(e) => setCalcDailyViews(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-1">
              <p className="text-xs font-mono text-neutral-500">Balanced Plan (${balancedCpm.toFixed(2)} CPM)</p>
              <p className="text-2xl font-bold font-mono text-neutral-950 dark:text-white">
                ${balancedMonthlyUsd.toFixed(2)} USD / mo
              </p>
              <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                ≈ ₹{(balancedMonthlyUsd * inrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })} INR (UPI) · {balancedMonthlyUsd.toFixed(2)} USDT
              </p>
            </div>
            <div className="p-4 rounded-xl bg-blue-50/40 dark:bg-blue-950/30 border border-blue-500/40 space-y-1">
              <p className="text-xs font-mono text-blue-700 dark:text-blue-300">Max Ads Plan (${maxAdsCpm.toFixed(2)} CPM)</p>
              <p className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-400">
                ${maxAdsMonthlyUsd.toFixed(2)} USD / mo
              </p>
              <p className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                ≈ ₹{(maxAdsMonthlyUsd * inrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })} INR (UPI) · {maxAdsMonthlyUsd.toFixed(2)} USDT
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl color-graded-panel space-y-4">
          <h3 className="text-base font-bold text-neutral-950 dark:text-white">
            Eligibility, Invalid-Traffic Deductions & UPI / USDT Withdrawal Policy
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-neutral-600 dark:text-neutral-400">
            <div className="space-y-1">
              <p className="font-semibold text-neutral-900 dark:text-white">01. View Qualification</p>
              <p>
                Automated traffic, VPN proxies, ad-blocked sessions without fallback verification, and repeated reloads are filtered out prior to ledger finalization.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-neutral-900 dark:text-white">02. Estimated vs. Payable</p>
              <p>
                Real-time playback metrics are separated from finalized payable balances. Adjustments for invalid traffic are recorded as explicit ledger entries.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-neutral-900 dark:text-white">03. Instant UPI & USDT Settlement</p>
              <p>
                Minimum withdrawal is $5.00 USD (₹{(5 * inrRate).toFixed(0)} INR) for India UPI and $20.00 USD for Global USDT.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="px-5 py-2.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
          >
            Open Creator Dashboard
          </button>
          <button
            type="button"
            onClick={() => onNavigate('pricing')}
            className="px-5 py-2.5 rounded-lg border border-blue-500/40 text-xs font-semibold"
          >
            Compare $2.00 & $3.00 CPM Plans
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 5. CPM MONETIZATION PLANS PAGE (ONLY 2 PLANS: $2.00 BALANCED & $3.00 MAX ADS)
  // ---------------------------------------------------------------------------
  if (route === 'pricing') {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold">
                OFFICIAL CREATOR MONETIZATION PLANS · ZERO STORAGE FEES
              </p>
              <InrCurrencyNoteBadge amountLabel={`1 USD = ₹${inrRate} INR`} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
              Only 2 Creator Plans: Balanced (${balancedCpm.toFixed(2)} CPM) & Max Ads (${maxAdsCpm.toFixed(2)} CPM)
            </h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              No complicated video storage tiers or monthly subscription fees. Every creator gets full cloud hosting, malware scanning, QR share links, and instant switching between our 2 CPM monetization plans.
            </p>
          </div>

          <button
            type="button"
            onClick={handleFirebaseGoogleClick}
            className="google-signup-btn min-h-[44px] px-4 py-2.5 rounded-xl font-bold text-xs text-neutral-950 dark:text-white inline-flex items-center gap-2.5 shrink-0"
          >
            <GoogleGIcon className="w-4 h-4" />
            <span>Sign Up with Google & Activate Plan</span>
          </button>
        </div>

        {/* Strictly 2 Monetization Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Plan 1: Balanced Plan ($2.00 CPM) */}
          <div className="liquid-retina-card">
            <div className="liquid-retina-inner bg-white dark:bg-neutral-950 p-6 sm:p-8 h-full flex flex-col justify-between space-y-6">
              <div className="liquid-retina-glow" aria-hidden="true" />
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                    PLAN 01 · BALANCED PLAN
                  </span>
                  <InrCurrencyNoteBadge
                    amountLabel={`₹${(balancedCpm * inrRate).toFixed(0)} INR / 1k Views`}
                  />
                </div>
                <div className="flex items-baseline justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-950 dark:text-white">
                      Balanced Plan
                    </h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Clean viewer experience · Single pre-roll ad slot
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-4xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white">
                      ${balancedCpm.toFixed(2)}
                    </span>
                    <span className="block text-[11px] font-mono text-neutral-500">
                      eCPM / 1,000 views
                    </span>
                  </div>
                </div>
                <div className="space-y-2.5 text-xs text-neutral-700 dark:text-neutral-300 font-mono">
                  <p>· Single skippable VAST pre-roll ad slot</p>
                  <p>· Zero mid-roll video interruptions</p>
                  <p>· 10,000 views = ${(10 * balancedCpm).toFixed(2)} USD (₹{(10 * balancedCpm * inrRate).toFixed(0)} INR)</p>
                  <p>· Instant India UPI ($5 min) & Global USDT ($20 min) payouts</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onChangeAdPreference('balanced');
                  onNavigate('dashboard');
                }}
                className={`relative z-10 min-h-[44px] w-full py-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 ${
                  adPreference === 'balanced'
                    ? 'bg-blue-700 text-white'
                    : 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>
                  {adPreference === 'balanced'
                    ? `Active: Balanced Plan ($${balancedCpm.toFixed(2)} CPM) — Open Studio`
                    : `Activate Balanced Plan ($${balancedCpm.toFixed(2)} CPM)`}
                </span>
              </button>
            </div>
          </div>

          {/* Plan 2: Max Ads Plan ($3.00 CPM) */}
          <div className="liquid-retina-card">
            <div className="liquid-retina-inner bg-white dark:bg-neutral-950 p-6 sm:p-8 h-full flex flex-col justify-between space-y-6">
              <div className="liquid-retina-glow" aria-hidden="true" />
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                    PLAN 02 · MAX ADS PLAN
                  </span>
                  <InrCurrencyNoteBadge
                    amountLabel={`₹${(maxAdsCpm * inrRate).toFixed(0)} INR / 1k Views`}
                    altAnim
                  />
                </div>
                <div className="flex items-baseline justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-950 dark:text-white">
                      Max Ads Plan
                    </h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Maximum earning potential · Pre-roll + Mid-roll slots
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-4xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white">
                      ${maxAdsCpm.toFixed(2)}
                    </span>
                    <span className="block text-[11px] font-mono text-neutral-500">
                      eCPM / 1,000 views
                    </span>
                  </div>
                </div>
                <div className="space-y-2.5 text-xs text-neutral-700 dark:text-neutral-300 font-mono">
                  <p>· Pre-roll + eligible mid-roll VAST ad placements</p>
                  <p>· Priority high-bid programmatic ad demand (+50% yield)</p>
                  <p>· 10,000 views = ${(10 * maxAdsCpm).toFixed(2)} USD (₹{(10 * maxAdsCpm * inrRate).toFixed(0)} INR)</p>
                  <p>· Instant India UPI ($5 min) & Global USDT ($20 min) payouts</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onChangeAdPreference('more');
                  onNavigate('dashboard');
                }}
                className={`relative z-10 min-h-[44px] w-full py-2.5 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 ${
                  adPreference === 'more'
                    ? 'bg-blue-700 text-white'
                    : 'bg-neutral-950 dark:bg-white text-white dark:text-neutral-950'
                }`}
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>
                  {adPreference === 'more'
                    ? `Active: Max Ads Plan ($${maxAdsCpm.toFixed(2)} CPM) — Open Studio`
                    : `Activate Max Ads Plan ($${maxAdsCpm.toFixed(2)} CPM)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 8. HELP & FAQS, 9. CONTACT & SUPPORT, 10-13. LEGAL & DMCA PAGES
  // ---------------------------------------------------------------------------
  if (
    route === 'help-faq' ||
    route === 'contact-support' ||
    route === 'terms' ||
    route === 'privacy' ||
    route === 'copyright-dmca' ||
    route === 'acceptable-use'
  ) {
    const isDmcaPage = route === 'copyright-dmca';
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        <div className="space-y-2 border-b border-neutral-200 dark:border-neutral-800 pb-6">
          <p className="text-xs font-mono text-neutral-500">TRUST, LEGAL & CREATOR SUPPORT</p>
          <h1 className="text-3xl font-bold text-neutral-950 dark:text-white">
            {route === 'help-faq' && 'Help Center & Frequently Asked Questions'}
            {route === 'contact-support' && 'Contact Support & Ticket Tracking'}
            {route === 'terms' && 'Terms of Service & Monetization Agreement'}
            {route === 'privacy' && 'Privacy Policy & Data Governance'}
            {route === 'copyright-dmca' && 'Copyright Enforcement & DMCA Takedown Policy'}
            {route === 'acceptable-use' && 'Acceptable-Use & File Safety Policy'}
          </h1>
        </div>

        <CreatorFaqAccordion
          balancedCpm={balancedCpm}
          maxAdsCpm={maxAdsCpm}
          inrRate={inrRate}
          usdtInrRate={usdtInrRate}
          upiMinUsd={Number(customCodes?.upiMinWithdrawalUsd ?? 5)}
          usdtMinUsd={Number(customCodes?.usdtMinWithdrawalUsd ?? 20)}
          minWatchSeconds={Number(rules?.minWatchSeconds || 5)}
          onNavigate={onNavigate}
          onChangeAdPreference={onChangeAdPreference}
        />

        <div className="space-y-6 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
          <div className="p-5 rounded-xl color-graded-panel space-y-2">
            <h2 className="font-bold text-neutral-950 dark:text-white">
              1. Content Safety, Malware Scanning & Prohibited Material
            </h2>
            <p className="text-xs leading-relaxed">
              Every uploaded MP4, WebM, PDF, ZIP, and APK file undergoes server-side MIME verification and automated malware scanning before public links become active. Uploading malware, non-consensual content, copyright-infringing media, or deceptive ad-click scripts results in immediate file quarantine and account termination.
            </p>
          </div>

          <div className="p-5 rounded-xl color-graded-panel space-y-2">
            <h2 className="font-bold text-neutral-950 dark:text-white">
              2. Creator Earnings ($2.00 Balanced & $3.00 Max Ads) & UPI Payout Verification
            </h2>
            <p className="text-xs leading-relaxed">
              ShareDabba records only verified VAST advertising events and qualified playback sessions under your active plan (${balancedCpm.toFixed(2)} Balanced or ${maxAdsCpm.toFixed(2)} Max Ads). Withdrawals require a verified UPI ID ($5.00 USD min) or USDT wallet ($20.00 USD min).
            </p>
          </div>
        </div>

        {/* Interactive Support Ticket Component (saves to support_tickets table) */}
        <SupportTicket
          defaultEmail={sessionAccountEmail || 'arjun.mehta@sharedabba.in'}
          defaultCategory={isDmcaPage ? 'Copyright' : ''}
          title={isDmcaPage ? 'Submit Formal Copyright / DMCA Support Ticket' : 'Submit a Support Ticket'}
          subtitle="Send a message with an optional category dropdown (Technical, Payout, Copyright). All submissions are saved to the support_tickets database table."
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 14-17. AUTHENTICATION PAGES (Login, Register, Verify Email, Password Recovery)
  // ---------------------------------------------------------------------------
  if (
    route === 'login' ||
    route === 'register' ||
    route === 'verify-email' ||
    route === 'recover-password'
  ) {
    return (
      <div className="max-w-md mx-auto px-6 py-14">
        <div className="p-8 rounded-2xl color-graded-panel space-y-6">
          <div className="space-y-1">
            <p className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold">
              SHAREDABBA ACCOUNT ACCESS
            </p>
            <h1 className="text-2xl font-bold text-neutral-950 dark:text-white">
              {route === 'login' && 'Sign In to ShareDabba'}
              {route === 'register' && 'Create Creator Account'}
              {route === 'verify-email' && 'Verify Email Address'}
              {route === 'recover-password' && 'Reset Account Password'}
            </h1>
          </div>

          {authMessage && (
            <div className="p-3 rounded bg-neutral-100 dark:bg-neutral-800 text-xs font-mono text-neutral-900 dark:text-white">
              {authMessage}
            </div>
          )}

          {(route === 'login' || route === 'register') && (
            <>
              <button
                type="button"
                onClick={handleFirebaseGoogleClick}
                disabled={googleSigningIn}
                className="google-signup-btn min-h-[46px] w-full py-2.5 px-4 rounded-xl font-bold text-xs text-neutral-950 dark:text-white flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <GoogleGIcon className="w-4 h-4 shrink-0" />
                <span>
                  {googleSigningIn
                    ? 'Connecting to Firebase Google Auth...'
                    : 'Sign Up / Continue with Google (Firebase)'}
                </span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800" />
                <span className="flex-shrink mx-3 text-[11px] font-mono text-neutral-400">
                  OR EMAIL CREDENTIALS
                </span>
                <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800" />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (route === 'register' && !ageConfirmed) {
                    setAuthMessage('You must confirm age eligibility (18+) to monetize and withdraw.');
                    return;
                  }
                  onSessionAccountLogin('creator_arjun_01', authEmail, authName);
                  onNavigate('dashboard');
                }}
                className="space-y-4"
              >
                {route === 'register' && (
                  <div>
                    <label className="block text-xs font-medium mb-1">Creator / Studio Name</label>
                    <input
                      type="text"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                  />
                </div>

                {route === 'register' && (
                  <label className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <input
                      type="checkbox"
                      checked={ageConfirmed}
                      onChange={(e) => setAgeConfirmed(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      I confirm I am at least 18 years old and agree to the ShareDabba Terms, Acceptable-Use Policy, and Monetization Compliance rules.
                    </span>
                  </label>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
                >
                  {route === 'login' ? 'Sign In to Dashboard' : 'Create Account & Verify Email'}
                </button>
              </form>

              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <p className="text-[11px] font-mono text-neutral-500">
                  INSTANT WORKSPACE ROLE SWITCHER (VERIFIED DEMO ACCOUNTS)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSessionAccountLogin('creator_arjun_01', 'arjun.mehta@sharedabba.in', 'Arjun Mehta Studio');
                      onNavigate('dashboard');
                    }}
                    className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    Creator Account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSessionAccountLogin('admin_super_01', 'rudraxsikkim@gmail.com', 'Rudra (Super Admin)');
                      onNavigate('admin');
                    }}
                    className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    Super Admin (/admin)
                  </button>
                </div>
              </div>
            </>
          )}

          {(route === 'verify-email' || route === 'recover-password') && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                {route === 'verify-email'
                  ? 'Enter your registered email address to dispatch a signed verification link.'
                  : 'Enter your account email to receive a single-use password reset token.'}
              </p>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700"
              />
              <button
                type="button"
                onClick={() =>
                  setAuthMessage(
                    route === 'verify-email'
                      ? `Verification status confirmed for ${authEmail}.`
                      : `Password recovery instructions dispatched for ${authEmail}.`
                  )
                }
                className="w-full py-2.5 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
              >
                {route === 'verify-email' ? 'Verify Email Now' : 'Send Recovery Link'}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-neutral-500 pt-2">
            <button
              type="button"
              onClick={() => onNavigate(route === 'login' ? 'register' : 'login')}
              className="hover:underline"
            >
              {route === 'login' ? 'Create an account' : 'Back to Sign In'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('recover-password')}
              className="hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 18. PUBLIC CREATOR PROFILE PAGE
  // ---------------------------------------------------------------------------
  if (route === 'creator-profile') {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <div className="p-6 rounded-lg border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-mono text-neutral-500">VERIFIED SHAREDABBA CREATOR</p>
            <h1 className="text-2xl font-bold text-neutral-950 dark:text-white">
              Arjun Mehta Studio (@arjunmehta)
            </h1>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-2xl">
              Independent architectural filmmaker, industrial hardware reviewer, and open-source educator based in Bengaluru.
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-neutral-600 dark:text-neutral-400">
            {publicFiles.length} Public Releases · {publicFiles.reduce((a, b) => a + b.viewsCount, 0).toLocaleString()} Total Views
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {publicFiles.map((f) => (
            <div
              key={f.id}
              className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900 flex flex-col justify-between"
            >
              <button
                type="button"
                onClick={() => onNavigate('shared-landing', f)}
                className="w-full text-left block"
              >
                <MediaThumbnail type={f.thumbnailType} title={f.title} resolution={f.resolution} />
              </button>
              <div className="p-4 space-y-2">
                <p className="text-xs font-mono text-neutral-500">
                  {f.category} · {formatBytes(f.sizeBytes)} · {f.viewsCount.toLocaleString()} views
                </p>
                <h3 className="text-sm font-bold text-neutral-950 dark:text-white">{f.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 20. CUSTOM 404 & ERROR PAGE
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-xl mx-auto px-6 py-24 text-center space-y-4">
      <p className="text-xs font-mono text-neutral-500">HTTP 404 · ROUTE NOT FOUND</p>
      <h1 className="text-3xl font-bold text-neutral-950 dark:text-white">
        This ShareDabba Link or Page Does Not Exist
      </h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        The link may have expired, been set to private by its creator, or removed under our copyright and acceptable-use policy.
      </p>
      <div className="flex justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="px-4 py-2 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
        >
          Return Home
        </button>
        <button
          type="button"
          onClick={() => onNavigate('explore')}
          className="px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-semibold"
        >
          Explore Public Videos
        </button>
      </div>
    </div>
  );
};
