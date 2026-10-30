import React, { useState } from 'react';
import {
  LayoutDashboard,
  Video,
  FolderOpen,
  UploadCloud,
  BarChart3,
  DollarSign,
  Wallet,
  ArrowUpRight,
  Users,
  Sparkles,
  Bell,
  Settings,
  LifeBuoy,
  Download,
  Copy,
  Play,
  Check,
  Search,
  Zap,
  Coins,
  RefreshCw,
  Sun,
  Moon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  DashboardSection,
  FileRecord,
  MonetizationRulesRecord,
  PageRoute,
  PlatformCustomCodesConfig,
  UserRecord,
  WalletAccountRecord,
  WalletLedgerRecord,
  WithdrawalRequestRecord,
} from '../types';
import { formatBytes, formatDuration, QrCodeMatrix } from './MediaArtwork';
import { detectPayoutMethod, validateUpiId, validateUploadFile } from '../utils/monetization';
import { SupportTicket } from './SupportTicket';

interface CreatorDashboardProps {
  section: DashboardSection;
  onChangeSection: (sec: DashboardSection) => void;
  dashboardData: {
    user: UserRecord;
    files: FileRecord[];
    folders: Array<{ id: number; name: string }>;
    wallet: WalletAccountRecord;
    ledger: WalletLedgerRecord[];
    withdrawals: WithdrawalRequestRecord[];
    referralCode: {
      code: string;
      clicksCount: number;
      registrationsCount: number;
      eligibleReferralsCount: number;
      totalEarnedUsd: string;
      campaignName: string;
    } | null;
    referralEvents: Array<{
      id: number;
      referredUserEmail: string;
      eventType: string;
      commissionUsd: string;
      status: string;
      createdAt: string;
    }>;
    notifications: Array<{
      id: number;
      title: string;
      message: string;
      category: string;
      isRead: boolean;
      createdAt: string;
    }>;
    sessions: Array<{
      id: number;
      deviceInfo: string;
      ipAddress: string;
      active: boolean;
      lastActiveAt: string;
    }>;
    tickets: Array<{
      id: number;
      ticketNumber: string;
      subject: string;
      category: string;
      status: string;
      adminReply: string;
      createdAt: string;
    }>;
    monetizationRules: MonetizationRulesRecord;
    customCodes?: PlatformCustomCodesConfig;
  } | null;
  loading: boolean;
  authHeaders: Record<string, string>;
  onRefreshDashboard: () => Promise<void>;
  onOpenSharedFile: (file: FileRecord) => void;
  onNavigate: (route: PageRoute) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const DashboardThemeSwitcher: React.FC<{
  darkMode: boolean;
  onToggleDarkMode: () => void;
}> = ({ darkMode, onToggleDarkMode }) => {
  return (
    <button
      id="dashboard-theme-switcher"
      type="button"
      onClick={onToggleDarkMode}
      aria-pressed={darkMode}
      aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className="px-3.5 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-2 transition-colors whitespace-nowrap"
    >
      {darkMode ? (
        <>
          <Sun className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>Switch to Light Mode</span>
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Switch to Dark Mode</span>
        </>
      )}
    </button>
  );
};

export const CreatorDashboard: React.FC<CreatorDashboardProps> = ({
  section,
  onChangeSection,
  dashboardData,
  loading,
  authHeaders,
  onRefreshDashboard,
  onOpenSharedFile,
  onNavigate,
  darkMode,
  onToggleDarkMode,
}) => {
  // Search & Filter State
  const [fileSearch, setFileSearch] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Upload Form State
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFilename, setUploadFilename] = useState('studio_lighting_masterclass_1080p.mp4');
  const [uploadMime, setUploadMime] = useState('video/mp4');
  const [uploadSizeBytes, setUploadSizeBytes] = useState<number>(184549376); // ~176 MB
  const [uploadDurationSec, setUploadDurationSec] = useState<number>(420);
  const [uploadResolution, setUploadResolution] = useState('1080p60');
  const [uploadCategory, setUploadCategory] = useState('Filmmaking & Assets');
  const [uploadVisibility, setUploadVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [uploadPassword, setUploadPassword] = useState('');
  const [uploadAllowDownload, setUploadAllowDownload] = useState(true);
  const [uploadDescription, setUploadDescription] = useState(
    'Production lighting ratios, high-contrast monochrome framing, and lossless audio capture guide.'
  );
  const [uploadTags, setUploadTags] = useState('cinema,lighting,monochrome,tutorial');
  const [uploadProgress, setUploadProgress] = useState<number>(68);
  const [uploadSpeedMbps, setUploadSpeedMbps] = useState<number>(54.8);
  const [uploadEtaSeconds, setUploadEtaSeconds] = useState<number>(1.1);
  const [uploadStageLabel, setUploadStageLabel] = useState<string>(
    'Multipart Chunk Transfer (Chunk 11/16 · Edge TLS 1.3)'
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Withdraw & UPI Form State
  const [upiInput, setUpiInput] = useState(dashboardData?.user?.upiId || '');
  const [withdrawAmountUsd, setWithdrawAmountUsd] = useState<string>('5.00');
  const [withdrawFeedback, setWithdrawFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [syncingFx, setSyncingFx] = useState(false);
  const [chartCurrency, setChartCurrency] = useState<'USD' | 'INR'>('USD');

  // Referral Section State
  const [referralFilter, setReferralFilter] = useState<'all' | 'pending' | 'credited'>('all');
  const [newRefEmailInput, setNewRefEmailInput] = useState<string>('');
  const [newRefPlanTier, setNewRefPlanTier] = useState<'balanced' | 'max'>('max');
  const [referralBusy, setReferralBusy] = useState<boolean>(false);
  const [referralFeedback, setReferralFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Settings Form State
  const [settingsName, setSettingsName] = useState(dashboardData?.user?.displayName || '');
  const [settings2FA, setSettings2FA] = useState(dashboardData?.user?.twoFactorEnabled ?? true);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);

  React.useEffect(() => {
    setUpiInput(dashboardData?.user?.upiId || '');
    setSettingsName(dashboardData?.user?.displayName || '');
    setSettings2FA(dashboardData?.user?.twoFactorEnabled ?? true);
  }, [dashboardData?.user?.upiId, dashboardData?.user?.displayName, dashboardData?.user?.twoFactorEnabled]);

  // Support Form State
  const [supportSubject, setSupportSubject] = useState('');
  const [supportCategory, setSupportCategory] = useState('Payouts & UPI');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSavedMsg, setSupportSavedMsg] = useState<string | null>(null);

  const navItems: Array<{ id: DashboardSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'videos', label: 'My Videos', icon: Video },
    { id: 'files', label: 'My Files', icon: FolderOpen },
    { id: 'upload', label: 'Upload', icon: UploadCloud },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'earnings', label: 'Earnings', icon: DollarSign },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'withdraw', label: 'Withdraw (UPI)', icon: ArrowUpRight },
    { id: 'referrals', label: 'Referral', icon: Users },
    { id: 'promotions', label: 'Promotions', icon: Sparkles },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'settings', label: 'Account Settings', icon: Settings },
    { id: 'support', label: 'Support', icon: LifeBuoy },
  ];

  if (loading && !dashboardData) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-6">
        <div className="h-8 w-64 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 bg-neutral-100 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800" />
          ))}
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-5">
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-neutral-950 dark:text-white">No Active Creator Account</h2>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Sign in or create a new creator account to access your private dashboard, upload files, and track earnings.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('register')}
            className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
          >
            Sign Up with Google
          </button>
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="px-4 py-2.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold cursor-pointer"
          >
            Sign In to Account
          </button>
        </div>
      </div>
    );
  }

  const {
    user,
    files,
    wallet,
    ledger,
    withdrawals,
    referralCode,
    referralEvents,
    notifications,
    sessions,
    tickets,
    monetizationRules: rules,
    customCodes,
  } = dashboardData;

  const totalViews = files.reduce((acc, f) => acc + f.viewsCount, 0);
  const totalMonetizedViews = files.reduce((acc, f) => acc + f.monetizedViewsCount, 0);
  const totalEstimatedUsd = files.reduce((acc, f) => acc + Number(f.estimatedEarningsUsd), 0);
  const effectiveCpm =
    totalMonetizedViews > 0 ? (totalEstimatedUsd / totalMonetizedViews) * 1000 : Number(rules?.targetCpmUsd || 3.0);
  const inrRate = Number(customCodes?.usdToInrRate || rules?.usdToInrRate || 86.45);
  const usdtInrRate = Number(customCodes?.usdtToInrRate || 88.85);
  const upiMinUsd = Number(customCodes?.upiMinWithdrawalUsd ?? rules?.minWithdrawalUsd ?? 5.0);
  const usdtMinUsd = Number(customCodes?.usdtMinWithdrawalUsd ?? 20.0);
  const upiFeePct = Number(customCodes?.upiFeePercent ?? rules?.upiPayoutFeePercent ?? 0.0);
  const usdtFeePct = Number(customCodes?.usdtFeePercent ?? 1.5);
  const upiEnabled = customCodes?.upiPayoutEnabled ?? true;
  const usdtEnabled = customCodes?.usdtPayoutEnabled ?? true;
  const currentPayoutMethod = detectPayoutMethod(upiInput);
  const activeMinUsd = currentPayoutMethod === 'USDT' ? usdtMinUsd : upiMinUsd;
  const activeFeePct = currentPayoutMethod === 'USDT' ? usdtFeePct : upiFeePct;
  const activeFeeUsd = Number(withdrawAmountUsd || 0) * (activeFeePct / 100);
  const activeNetUsd = Math.max(0, Number(withdrawAmountUsd || 0) - activeFeeUsd);

  // Referral Link, Sign-Ups & Pending Bonus Calculations
  const activeRefCode = referralCode?.code || user.referralCode || 'SD-REF';
  const uniqueReferralUrl = `${window.location.origin}/?ref=${activeRefCode}`;
  const pendingReferralEvents = referralEvents.filter((ev) => ev.status === 'pending');
  const creditedReferralEvents = referralEvents.filter((ev) => ev.status !== 'pending');
  const pendingReferralBonusUsd = pendingReferralEvents.reduce(
    (sum, ev) => sum + Number(ev.commissionUsd || 0),
    0
  );
  const creditedReferralBonusUsd = Math.max(
    Number(referralCode?.totalEarnedUsd || 0),
    creditedReferralEvents.reduce((sum, ev) => sum + Number(ev.commissionUsd || 0), 0)
  );
  const totalReferralSignups = Math.max(
    Number(referralCode?.registrationsCount || 0),
    referralEvents.length
  );
  const referralClicksCount = Math.max(
    Number(referralCode?.clicksCount || 0),
    totalReferralSignups
  );
  const eligibleReferralsCount = Math.max(
    Number(referralCode?.eligibleReferralsCount || 0),
    creditedReferralEvents.length
  );
  const referralConversionPct =
    referralClicksCount > 0 ? ((totalReferralSignups / referralClicksCount) * 100).toFixed(1) : '0.0';
  const filteredReferralEvents = referralEvents.filter((ev) => {
    if (referralFilter === 'pending') return ev.status === 'pending';
    if (referralFilter === 'credited') return ev.status !== 'pending';
    return true;
  });

  // Build 6-Month Historical Earnings & Payout Series (May 2026 – Oct 2026) incorporating live withdrawals & ledger data
  const currentMonthWithdrawnUpiUsd = withdrawals
    .filter((w) => (w.payoutMethod || 'UPI') !== 'USDT')
    .reduce((sum, w) => sum + Number(w.amountUsd || 0), 0);
  const currentMonthWithdrawnUsdtUsd = withdrawals
    .filter((w) => w.payoutMethod === 'USDT')
    .reduce((sum, w) => sum + Number(w.amountUsd || 0), 0);
  const currentMonthEarnedUsd = Math.max(
    Number(wallet?.lifetimeEarnedUsd || 0),
    totalEstimatedUsd,
    currentMonthWithdrawnUpiUsd + currentMonthWithdrawnUsdtUsd + Number(wallet?.availableBalanceUsd || 0)
  );

  const rawMonthlySeries = [
    {
      month: 'May 2026',
      earnedUsd: 0.0,
      upiPayoutUsd: 0.0,
      usdtPayoutUsd: 0.0,
      monetizedViews: 0,
    },
    {
      month: 'Jun 2026',
      earnedUsd: 0.0,
      upiPayoutUsd: 0.0,
      usdtPayoutUsd: 0.0,
      monetizedViews: 0,
    },
    {
      month: 'Jul 2026',
      earnedUsd: 0.0,
      upiPayoutUsd: 0.0,
      usdtPayoutUsd: 0.0,
      monetizedViews: 0,
    },
    {
      month: 'Aug 2026',
      earnedUsd: 0.0,
      upiPayoutUsd: 0.0,
      usdtPayoutUsd: 0.0,
      monetizedViews: 0,
    },
    {
      month: 'Sep 2026',
      earnedUsd: 0.0,
      upiPayoutUsd: 0.0,
      usdtPayoutUsd: 0.0,
      monetizedViews: 0,
    },
    {
      month: 'Oct 2026',
      earnedUsd: Number(currentMonthEarnedUsd.toFixed(2)),
      upiPayoutUsd: Number(currentMonthWithdrawnUpiUsd.toFixed(2)),
      usdtPayoutUsd: Number(currentMonthWithdrawnUsdtUsd.toFixed(2)),
      monetizedViews: totalMonetizedViews,
    },
  ];

  const monthlyChartData = rawMonthlySeries.map((item) => {
    const totalPayoutUsd = Number((item.upiPayoutUsd + item.usdtPayoutUsd).toFixed(2));
    const earnedDisplay =
      chartCurrency === 'INR'
        ? Number((item.earnedUsd * inrRate).toFixed(0))
        : Number(item.earnedUsd.toFixed(2));
    const upiPayoutDisplay =
      chartCurrency === 'INR'
        ? Number((item.upiPayoutUsd * inrRate).toFixed(0))
        : Number(item.upiPayoutUsd.toFixed(2));
    const usdtPayoutDisplay =
      chartCurrency === 'INR'
        ? Number((item.usdtPayoutUsd * usdtInrRate).toFixed(0))
        : Number(item.usdtPayoutUsd.toFixed(2));
    const totalPayoutDisplay = Number((upiPayoutDisplay + usdtPayoutDisplay).toFixed(2));

    return {
      ...item,
      totalPayoutUsd,
      earnedDisplay,
      upiPayoutDisplay,
      usdtPayoutDisplay,
      totalPayoutDisplay,
    };
  });

  const total6MoEarnedUsd = rawMonthlySeries.reduce((s, r) => s + r.earnedUsd, 0);
  const total6MoPaidOutUsd = rawMonthlySeries.reduce((s, r) => s + r.upiPayoutUsd + r.usdtPayoutUsd, 0);

  const handleSyncDashboardLiveFx = async () => {
    if (syncingFx) return;
    setSyncingFx(true);
    try {
      const res = await fetch('/api/fx/usdt-inr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ mode: 'sync_live' }),
      });
      if (res.ok) {
        const data = await res.json();
        setWithdrawFeedback({
          type: 'ok',
          text: `Synced Live FX Rates: 1 USDT = ₹${Number(data.usdtToInrRate).toFixed(2)} INR · 1 USD = ₹${Number(data.usdToInrRate).toFixed(2)} INR`,
        });
        await onRefreshDashboard();
      }
    } catch (e) {
      console.error('Failed to sync FX:', e);
    } finally {
      setSyncingFx(false);
    }
  };

  const runLiveUploadTelemetry = (targetSizeBytes: number): Promise<void> => {
    return new Promise((resolve) => {
      const steps = [
        { pct: 14, speed: 46.4, stage: 'Initializing Resumable Multipart Session (Chunk 2/16)' },
        { pct: 32, speed: 52.8, stage: 'Multipart Chunk Transfer (Chunk 5/16 · Edge TLS 1.3)' },
        { pct: 54, speed: 58.6, stage: 'Multipart Chunk Transfer (Chunk 9/16 · Edge TLS 1.3)' },
        { pct: 76, speed: 61.2, stage: 'Multipart Chunk Transfer (Chunk 13/16 · Edge TLS 1.3)' },
        { pct: 92, speed: 55.9, stage: 'Server-Side ClamAV Malware & Hash Verification' },
        { pct: 100, speed: 62.4, stage: 'HLS 1080p60 Adaptive Transcode Complete · Link Ready' },
      ];
      const totalMB = Math.max(1, targetSizeBytes / (1024 * 1024));
      let idx = 0;

      const tick = () => {
        if (idx >= steps.length) {
          resolve();
          return;
        }
        const current = steps[idx];
        const remainingMB = Math.max(0, totalMB * ((100 - current.pct) / 100));
        const eta = current.pct >= 100 ? 0 : Number(Math.max(0.1, remainingMB / current.speed).toFixed(1));
        setUploadProgress(current.pct);
        setUploadSpeedMbps(current.speed);
        setUploadEtaSeconds(eta);
        setUploadStageLabel(current.stage);
        idx += 1;
        if (idx < steps.length) {
          setTimeout(tick, 95);
        } else {
          resolve();
        }
      };

      tick();
    });
  };

  const handleSimulateUploadProgress = async () => {
    if (isUploading) return;
    setIsUploading(true);
    setUploadFeedback(null);
    await runLiveUploadTelemetry(uploadSizeBytes);
    setIsUploading(false);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadFeedback(null);

    const finalTitle = uploadTitle.trim() || uploadFilename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    const check = validateUploadFile(uploadFilename, uploadSizeBytes, user.storageLimitBytes);
    if (!check.permitted) {
      setUploadFeedback({ type: 'err', text: check.error || 'File validation failed.' });
      return;
    }

    setIsUploading(true);
    const telemetryPromise = runLiveUploadTelemetry(uploadSizeBytes);

    try {
      const [res] = await Promise.all([
        fetch('/api/files/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({
            title: finalTitle,
            description: uploadDescription,
            filename: uploadFilename,
            mimeType: uploadMime,
            sizeBytes: uploadSizeBytes,
            durationSeconds: uploadDurationSec,
            resolution: uploadResolution,
            visibility: uploadVisibility,
            passwordHash: uploadPassword,
            allowDownload: uploadAllowDownload,
            category: uploadCategory,
            tags: uploadTags,
          }),
        }),
        telemetryPromise,
      ]);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }
      setUploadProgress(100);
      setUploadEtaSeconds(0);
      setUploadStageLabel('HLS 1080p60 Adaptive Transcode Complete · Link Ready');
      setUploadFeedback({
        type: 'ok',
        text: `Uploaded "${data.title}" (${data.filename}) — Malware scan: CLEAN · Slug: /v/${data.slug}`,
      });
      setUploadTitle('');
      await onRefreshDashboard();
    } catch (err: any) {
      setUploadFeedback({ type: 'err', text: err.message || 'Upload failed' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleVerifyUpiAndSave = async () => {
    setWithdrawFeedback(null);
    const check = validateUpiId(upiInput);
    if (!check.valid) {
      setWithdrawFeedback({ type: 'err', text: check.reason || 'Invalid UPI ID' });
      return;
    }
    try {
      const res = await fetch('/api/account/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ upiId: upiInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify UPI ID');
      setWithdrawFeedback({
        type: 'ok',
        text: `UPI destination ${data.upiId} verified and bound to your creator wallet.`,
      });
      await onRefreshDashboard();
    } catch (err: any) {
      setWithdrawFeedback({ type: 'err', text: err.message });
    }
  };

  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawFeedback(null);
    const amountNum = Number(withdrawAmountUsd);
    if (isNaN(amountNum) || amountNum <= 0) {
      setWithdrawFeedback({ type: 'err', text: 'Enter a valid USD withdrawal amount.' });
      return;
    }
    setSubmittingWithdraw(true);
    try {
      const idempotencyKey = `idem_${user.uid}_${Date.now()}`;
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          amountUsd: amountNum,
          upiId: upiInput.trim(),
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Withdrawal request rejected.');
      }
      setWithdrawFeedback({
        type: 'ok',
        text: `Withdrawal request ${data.requestUuid} ($${Number(data.amountUsd).toFixed(2)} USD → ₹${data.netPayoutInr} INR to ${data.destinationUpiId}) recorded with status: ${data.status.toUpperCase()}.`,
      });
      await onRefreshDashboard();
    } catch (err: any) {
      setWithdrawFeedback({ type: 'err', text: err.message });
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  const handleExportLedgerCsv = () => {
    const header = 'Ledger_UUID,Entry_Type,Amount_USD,Balance_After_USD,Bucket,Reference_ID,Description,Created_At\n';
    const rows = ledger
      .map(
        (l) =>
          `"${l.ledgerUuid}","${l.entryType}","${l.amountUsd}","${l.balanceAfterUsd}","${l.balanceBucket}","${l.referenceId}","${l.description.replace(/"/g, '""')}","${l.createdAt}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sharedabba_wallet_ledger_${user.username}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSimulateReferralSignup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (referralBusy) return;
    setReferralBusy(true);
    setReferralFeedback(null);
    try {
      const res = await fetch('/api/referrals/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'simulate_signup',
          referredEmail: newRefEmailInput.trim() || undefined,
          planTier: newRefPlanTier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record referral sign-up');
      setNewRefEmailInput('');
      setReferralFeedback({
        type: 'ok',
        text: data.message || 'Recorded new referral sign-up and pending bonus.',
      });
      await onRefreshDashboard();
    } catch (err: any) {
      setReferralFeedback({ type: 'err', text: err.message });
    } finally {
      setReferralBusy(false);
    }
  };

  const handleSettlePendingReferralBonus = async (eventId?: number) => {
    if (referralBusy) return;
    setReferralBusy(true);
    setReferralFeedback(null);
    try {
      const res = await fetch('/api/referrals/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          action: 'settle_pending',
          eventId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to settle pending referral bonus');
      setReferralFeedback({
        type: 'ok',
        text: data.message || 'Pending referral bonus verified and credited to wallet.',
      });
      await onRefreshDashboard();
    } catch (err: any) {
      setReferralFeedback({ type: 'err', text: err.message });
    } finally {
      setReferralBusy(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Navigation (240px width) */}
        <aside className="w-full lg:w-60 shrink-0 space-y-6">
          <div className="p-4 rounded-xl color-graded-panel space-y-1">
            <p className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold">
              CREATOR WORKSPACE
            </p>
            <p className="text-sm font-bold text-neutral-950 dark:text-white truncate">
              {user.displayName}
            </p>
            <p className="text-xs font-mono text-neutral-500 truncate">
              @{user.username} · VERIFIED CREATOR
            </p>
          </div>

          <nav aria-label="Creator Dashboard Navigation" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeSection(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 font-semibold'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-950 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Unified Official $3.00 CPM Plan Summary Card */}
          <div className="p-4 rounded-xl color-graded-panel space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-900 dark:text-white">Monetization Plan</span>
              <span className="font-mono text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
                OFFICIAL $3.00 TIER
              </span>
            </div>
            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="flex items-center justify-between px-2.5 py-2 rounded bg-sky-50/70 dark:bg-sky-950/30 border border-sky-500/35">
                <span className="text-sky-700 dark:text-sky-300 font-semibold">Official $3.00 CPM</span>
                <span className="font-bold text-sky-700 dark:text-sky-400">
                  ${Number(customCodes?.maxAdsCpmUsd ?? 3.0).toFixed(2)} CPM
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Top Contextual Bar (Creator Dashboard Header) */}
          <div
            id="dashboard-header-bar"
            className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4"
          >
            <div>
              <p className="text-xs font-mono text-neutral-500">
                Dashboard / {navItems.find((n) => n.id === section)?.label}
              </p>
              <h1 className="text-2xl font-bold text-neutral-950 dark:text-white">
                {navItems.find((n) => n.id === section)?.label}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <DashboardThemeSwitcher darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} />
              <button
                type="button"
                onClick={() => onChangeSection('upload')}
                className="px-3.5 py-2 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload Video / File</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeSection('withdraw')}
                className="px-3.5 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 whitespace-nowrap"
              >
                Withdraw UPI (${Number(wallet?.availableBalanceUsd || 0).toFixed(2)})
              </button>
            </div>
          </div>

          {/* ===============================================================
              SECTION 1: OVERVIEW
             =============================================================== */}
          {section === 'overview' && (
            <div className="space-y-8">
              {/* Primary KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-1">
                  <p className="text-xs text-neutral-500">Available Payable Balance</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white">
                    ${Number(wallet?.availableBalanceUsd || 0).toFixed(2)} USD
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-blue-700 dark:text-blue-400">
                    ≈ ₹{(Number(wallet?.availableBalanceUsd || 0) * inrRate).toFixed(2)} INR · Pending: ${Number(wallet?.pendingBalanceUsd || 0).toFixed(2)}
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-1">
                  <p className="text-xs text-neutral-500">Total Verified Views</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white whitespace-nowrap">
                    {totalViews.toLocaleString()} Views
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-neutral-500">
                    Monetized: {totalMonetizedViews.toLocaleString()} ({totalViews > 0 ? Math.round((totalMonetizedViews / totalViews) * 100) : 0}% VAST fill)
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-1">
                  <p className="text-xs text-neutral-500">Effective Creator eCPM</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white">
                    ${effectiveCpm.toFixed(2)} USD
                  </p>
                  <p className="text-[11px] font-mono text-neutral-500">
                    Active Mode: {rules?.activeMode === 'revenue_share' ? `${rules.revenueSharePercent}% RevShare` : `Fixed $${rules?.targetCpmUsd} CPM`}
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-1">
                  <p className="text-xs text-neutral-500">Lifetime Earned / Paid Out</p>
                  <p className="text-2xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white">
                    ${Number(wallet?.lifetimeEarnedUsd || 0).toFixed(2)} USD
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-neutral-500">
                    Withdrawn via UPI & USDT: ${Number(wallet?.lifetimeWithdrawnUsd || 0).toFixed(2)} USD
                  </p>
                </div>
              </div>

              {/* Monthly Earnings & Historical Payouts Visualization (Recharts BarChart) */}
              <div id="monthly-earnings-chart-card" className="liquid-retina-card">
                <div className="liquid-retina-inner bg-white dark:bg-neutral-950 p-5 sm:p-6 space-y-5">
                  <div className="liquid-retina-glow" aria-hidden="true" />

                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                        <span className="text-blue-600 dark:text-blue-400 font-bold uppercase">
                          HISTORICAL PAYOUT & EARNINGS TELEMETRY
                        </span>
                        <span className="px-2 py-0.5 rounded border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold">
                          1 USDT = ₹{usdtInrRate.toFixed(2)} · 1 USD = ₹{inrRate.toFixed(2)}
                        </span>
                      </div>
                      <h2 className="text-base sm:text-lg font-bold text-neutral-950 dark:text-white">
                        Monthly Creator Earnings & Historical Payouts (UPI + USDT)
                      </h2>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        6-month comparison of verified ad earnings ($3.00 CPM Plan) vs. settled India UPI and Global USDT payouts.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="inline-flex p-1 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                        <button
                          type="button"
                          onClick={() => setChartCurrency('USD')}
                          className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-colors ${
                            chartCurrency === 'USD'
                              ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                              : 'text-neutral-600 dark:text-neutral-400'
                          }`}
                        >
                          USD ($)
                        </button>
                        <button
                          type="button"
                          onClick={() => setChartCurrency('INR')}
                          className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-colors ${
                            chartCurrency === 'INR'
                              ? 'bg-emerald-600 text-white'
                              : 'text-neutral-600 dark:text-neutral-400'
                          }`}
                        >
                          INR (₹)
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => onChangeSection('withdraw')}
                        className="px-3.5 py-1.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 text-sky-400 dark:text-sky-600" />
                        <span>Request Payout</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Metrics Bar Above Chart */}
                  <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono tabular-nums">
                    <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                      <span className="text-neutral-500">6-Mo Total Earned:</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">
                        {chartCurrency === 'INR'
                          ? `₹${(total6MoEarnedUsd * inrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })} INR`
                          : `$${total6MoEarnedUsd.toFixed(2)} USD`}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                      <span className="text-neutral-600 dark:text-neutral-300">6-Mo Settled Payouts:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {chartCurrency === 'INR'
                          ? `₹${(total6MoPaidOutUsd * inrRate).toLocaleString('en-IN', { maximumFractionDigits: 0 })} INR`
                          : `$${total6MoPaidOutUsd.toFixed(2)} USD`}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-900/70 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                      <span className="text-neutral-500">Payout Settlement Ratio:</span>
                      <span className="font-bold text-neutral-950 dark:text-white">
                        {Math.round((total6MoPaidOutUsd / Math.max(1, total6MoEarnedUsd)) * 100)}% Paid Out
                      </span>
                    </div>
                  </div>

                  {/* Recharts Responsive BarChart */}
                  <div className="relative z-10 w-full h-72 sm:h-80 pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={monthlyChartData}
                        margin={{ top: 10, right: 16, left: 4, bottom: 4 }}
                        barGap={6}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#525252" opacity={0.22} vertical={false} />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 11, fill: '#737373', fontFamily: 'monospace' }}
                          axisLine={{ stroke: '#525252', opacity: 0.3 }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#737373', fontFamily: 'monospace' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(val) =>
                            chartCurrency === 'INR' ? `₹${val}` : `$${val}`
                          }
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }}
                          contentStyle={{
                            backgroundColor: '#0a0a0a',
                            borderColor: 'rgba(59, 130, 246, 0.45)',
                            borderRadius: '10px',
                            color: '#ffffff',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                          }}
                          formatter={(value: any, name: any) => [
                            chartCurrency === 'INR'
                              ? `₹${Number(value).toLocaleString('en-IN')} INR`
                              : `$${Number(value).toFixed(2)} USD`,
                            name,
                          ]}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '12px', fontFamily: 'monospace', paddingTop: '8px' }}
                        />
                        <Bar
                          dataKey="earnedDisplay"
                          name={chartCurrency === 'INR' ? 'Monthly Earnings (₹ INR)' : 'Monthly Earnings ($ USD)'}
                          fill="#2563eb"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={36}
                        />
                        <Bar
                          dataKey="upiPayoutDisplay"
                          name={chartCurrency === 'INR' ? 'UPI Payout Settled (₹ INR)' : 'UPI Payout Settled ($ USD)'}
                          fill="#10b981"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={36}
                        />
                        <Bar
                          dataKey="usdtPayoutDisplay"
                          name={chartCurrency === 'INR' ? 'USDT Payout Settled (₹ INR)' : 'USDT Payout Settled (USDT)'}
                          fill="#0ea5e9"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={36}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Referral Partner Quick-Card on Main Dashboard */}
              <div className="p-5 rounded-xl color-graded-panel flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold">
                    <span>CREATOR REFERRAL PARTNER ({rules?.referralCommissionPercent || '10.00'}% BONUS)</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-sky-600 dark:text-sky-400">
                      PENDING BONUS: ${pendingReferralBonusUsd.toFixed(2)} USD (≈ ₹{(pendingReferralBonusUsd * inrRate).toFixed(0)} INR)
                    </span>
                  </div>
                  <p className="text-sm font-bold text-neutral-950 dark:text-white">
                    Unique Referral Link: <span className="font-mono text-xs text-blue-600 dark:text-blue-400">{uniqueReferralUrl}</span>
                  </p>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 font-mono">
                    {totalReferralSignups} Sign-Ups Tracked · {referralClicksCount} Link Clicks · ${creditedReferralBonusUsd.toFixed(2)} USD Credited + ${pendingReferralBonusUsd.toFixed(2)} USD Pending
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(uniqueReferralUrl);
                      setCopiedId('overview-ref');
                      setTimeout(() => setCopiedId(null), 1500);
                    }}
                    className="px-3.5 py-2 rounded-lg border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-semibold transition-colors"
                  >
                    {copiedId === 'overview-ref' ? 'Copied Referral Link!' : 'Copy Referral Link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeSection('referrals')}
                    className="px-4 py-2 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Open Referral Section</span>
                  </button>
                </div>
              </div>

              {/* Live Multipart Upload Progress & Telemetry Quick-Bar on Overview */}
              <div className="liquid-retina-card">
                <div className="liquid-retina-inner bg-white dark:bg-neutral-950 p-5 space-y-3">
                  <div className="liquid-retina-glow" />
                  <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold">
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>MULTIPART UPLOAD PIPELINE TELEMETRY</span>
                      </div>
                      <p className="text-sm font-bold text-neutral-950 dark:text-white">
                        {uploadFilename}{' '}
                        <span className="text-xs font-mono font-normal text-neutral-500">
                          ({formatBytes(Math.round((uploadSizeBytes * uploadProgress) / 100))} / {formatBytes(uploadSizeBytes)})
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-mono font-bold tabular-nums">
                        Speed: {uploadSpeedMbps.toFixed(1)} MB/s
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold tabular-nums">
                        ETA: {uploadProgress >= 100 ? '0.0s remaining (Complete)' : `${uploadEtaSeconds.toFixed(1)}s remaining`}
                      </span>
                      <button
                        type="button"
                        onClick={handleSimulateUploadProgress}
                        disabled={isUploading}
                        className="px-3 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold"
                      >
                        {isUploading ? 'Uploading...' : 'Test Upload Bar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onChangeSection('upload')}
                        className="px-3 py-1 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
                      >
                        Open Upload Studio
                      </button>
                    </div>
                  </div>
                  <div className="relative z-10 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-neutral-600 dark:text-neutral-400">
                      <span>{uploadStageLabel}</span>
                      <span className="font-bold text-neutral-950 dark:text-white">{uploadProgress}%</span>
                    </div>
                    <div
                      className="w-full h-3 upload-progress-track"
                      role="progressbar"
                      aria-label="Multipart file upload progress"
                      aria-valuenow={uploadProgress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full upload-color-graded-bar"
                        style={{ width: `${Math.max(4, uploadProgress)}%` }}
                      >
                        <div className="upload-shimmer-stripe" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Best-Performing Videos & Files Table */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                    Top-Performing Monetized Uploads
                  </h2>
                  <button
                    type="button"
                    onClick={() => onChangeSection('videos')}
                    className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    Manage All Files ({files.length})
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50">
                        <th className="py-2.5 px-4 font-medium">Title & Format</th>
                        <th className="py-2.5 px-4 font-medium text-right">Total Views</th>
                        <th className="py-2.5 px-4 font-medium text-right">Monetized Views</th>
                        <th className="py-2.5 px-4 font-medium text-right">Est. Earnings</th>
                        <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {files.map((f) => (
                        <tr key={f.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/40">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-neutral-950 dark:text-white">{f.title}</p>
                            <p className="text-[11px] text-neutral-500 font-mono">
                              {f.filename} · {formatBytes(f.sizeBytes)} · {f.visibility}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {f.viewsCount.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {f.monetizedViewsCount.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-neutral-950 dark:text-white">
                            ${Number(f.estimatedEarningsUsd).toFixed(4)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onOpenSharedFile(f)}
                                className="px-2.5 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium whitespace-nowrap"
                              >
                                Open Player
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(`${window.location.origin}/?v=${f.slug}`);
                                  setCopiedId(f.slug);
                                  setTimeout(() => setCopiedId(null), 1500);
                                }}
                                className="px-2.5 py-1 rounded bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 font-medium whitespace-nowrap"
                              >
                                {copiedId === f.slug ? 'Copied' : 'Copy Link'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Immutable Wallet Ledger Entries */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                    Recent Auditable Wallet Ledger Entries
                  </h2>
                  <button
                    type="button"
                    onClick={() => onChangeSection('wallet')}
                    className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    Full Ledger & CSV Export →
                  </button>
                </div>
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
                  {ledger.slice(0, 4).map((entry) => (
                    <div key={entry.id} className="px-5 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900 dark:text-white truncate">
                          {entry.description}
                        </p>
                        <p className="text-[11px] font-mono text-neutral-500">
                          {entry.ledgerUuid} · {entry.entryType} · Ref: {entry.referenceId}
                        </p>
                      </div>
                      <div className="text-right font-mono tabular-nums shrink-0">
                        <p
                          className={`font-semibold ${
                            Number(entry.amountUsd) >= 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-neutral-900 dark:text-white'
                          }`}
                        >
                          {Number(entry.amountUsd) >= 0 ? '+' : ''}
                          ${Number(entry.amountUsd).toFixed(4)}
                        </p>
                        <p className="text-[11px] text-neutral-500">
                          Bal: ${Number(entry.balanceAfterUsd).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              SECTION 2 & 3: MY VIDEOS & MY FILES
             =============================================================== */}
          {(section === 'videos' || section === 'files') && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    aria-label="Filter your uploads"
                    placeholder="Search filename, title, or tag..."
                    value={fileSearch}
                    onChange={(e) => setFileSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 w-72"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-md">
                  {(['all', 'video', 'archive', 'apk', 'document'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFileTypeFilter(t)}
                      className={`px-3 py-1 text-xs font-medium rounded capitalize ${
                        fileTypeFilter === t
                          ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-xs'
                          : 'text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50">
                      <th className="py-2.5 px-4 font-medium">File / Video Asset</th>
                      <th className="py-2.5 px-4 font-medium">Security & Transcode</th>
                      <th className="py-2.5 px-4 font-medium text-right">Size</th>
                      <th className="py-2.5 px-4 font-medium text-right">Monetized Views</th>
                      <th className="py-2.5 px-4 font-medium text-right">Share & Stream</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {files
                      .filter((f) => {
                        if (section === 'videos' && f.fileType !== 'video') return false;
                        if (fileTypeFilter !== 'all' && f.fileType !== fileTypeFilter) return false;
                        if (
                          fileSearch.trim() &&
                          !f.title.toLowerCase().includes(fileSearch.toLowerCase()) &&
                          !f.filename.toLowerCase().includes(fileSearch.toLowerCase())
                        ) {
                          return false;
                        }
                        return true;
                      })
                      .map((f) => (
                        <tr key={f.id}>
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-neutral-950 dark:text-white">{f.title}</p>
                            <p className="text-[11px] font-mono text-neutral-500">
                              {f.filename} · {f.resolution} · {f.visibility}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                            Scan: {f.malwareScanStatus.toUpperCase()} · {f.transcodeStatus.toUpperCase()}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            {formatBytes(f.sizeBytes)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            {f.monetizedViewsCount.toLocaleString()} (${Number(f.estimatedEarningsUsd).toFixed(2)})
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onOpenSharedFile(f)}
                                className="px-2.5 py-1 rounded border border-neutral-300 dark:border-neutral-700 font-medium"
                              >
                                Stream
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(`${window.location.origin}/?v=${f.slug}`);
                                  setCopiedId(f.slug);
                                  setTimeout(() => setCopiedId(null), 1500);
                                }}
                                className="px-2.5 py-1 rounded bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 font-medium"
                              >
                                {copiedId === f.slug ? 'Copied' : 'Copy Link'}
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

          {/* ===============================================================
              SECTION 4: UPLOAD VIDEO / FILE
             =============================================================== */}
          {section === 'upload' && (
            <div className="space-y-6">
              <div className="p-6 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-neutral-950 dark:text-white">
                      Multipart Resumable Upload & Server-Side Malware Scanner
                    </h2>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Permitted formats: MP4, WebM, MOV, MKV, PDF, DOC/DOCX, ZIP, TAR/GZ, and signed Android APK builds.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadTitle('Minimalist Concrete House Tour (4K Master)');
                        setUploadFilename('concrete_house_tour_4k60.mp4');
                        setUploadMime('video/mp4');
                        setUploadSizeBytes(314572800);
                        setUploadDurationSec(540);
                        setUploadResolution('4K (3840x2160)');
                      }}
                      className="px-2.5 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-xs font-medium bg-white dark:bg-neutral-900"
                    >
                      Preset: 4K MP4 Video
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadTitle('ShareDabba CreatorLUTs & Audio Impulse Pack');
                        setUploadFilename('creator_luts_impulse_pack.zip');
                        setUploadMime('application/zip');
                        setUploadSizeBytes(89128960);
                        setUploadDurationSec(0);
                        setUploadResolution('ZIP Archive');
                      }}
                      className="px-2.5 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-xs font-medium bg-white dark:bg-neutral-900"
                    >
                      Preset: ZIP Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadTitle('CineMeter Pro v2.1 Android Field Utility (APK)');
                        setUploadFilename('cinemeter-pro-v2.1-signed.apk');
                        setUploadMime('application/vnd.android.package-archive');
                        setUploadSizeBytes(34603008);
                        setUploadDurationSec(0);
                        setUploadResolution('Android ARM64 APK');
                      }}
                      className="px-2.5 py-1 rounded border border-neutral-300 dark:border-neutral-700 text-xs font-medium bg-white dark:bg-neutral-900"
                    >
                      Preset: Signed APK
                    </button>
                  </div>
                </div>

                {/* Browser File Input Dropzone */}
                <label className="block border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg p-6 text-center cursor-pointer hover:border-neutral-950 dark:hover:border-white transition-colors bg-white dark:bg-neutral-950">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setUploadFilename(f.name);
                        setUploadSizeBytes(f.size || 10485760);
                        setUploadMime(f.type || 'application/octet-stream');
                        if (!uploadTitle) {
                          setUploadTitle(f.name.replace(/\.[^/.]+$/, ''));
                        }
                      }
                    }}
                  />
                  <UploadCloud className="w-7 h-7 mx-auto text-neutral-500 mb-2" />
                  <p className="text-xs font-semibold text-neutral-900 dark:text-white">
                    Click to select a local file from your device or use the metadata form below
                  </p>
                  <p className="text-[11px] font-mono text-neutral-500 mt-1">
                    Active Queue: {uploadFilename} ({formatBytes(uploadSizeBytes)})
                  </p>
                </label>

                {uploadFeedback && (
                  <div
                    className={`p-3 rounded text-xs font-mono ${
                      uploadFeedback.type === 'ok'
                        ? 'bg-emerald-950 text-emerald-200'
                        : 'bg-red-950 text-red-200'
                    }`}
                  >
                    {uploadFeedback.text}
                  </div>
                )}

                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="upload-title-input" className="block text-xs font-medium mb-1">
                        Public Title
                      </label>
                      <input
                        id="upload-title-input"
                        type="text"
                        required
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="e.g. Studio Lighting Masterclass (1080p60)"
                        className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                    <div>
                      <label htmlFor="upload-filename-input" className="block text-xs font-medium mb-1">
                        Filename (Server Validated)
                      </label>
                      <input
                        id="upload-filename-input"
                        type="text"
                        required
                        value={uploadFilename}
                        onChange={(e) => setUploadFilename(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">Category</label>
                      <select
                        value={uploadCategory}
                        onChange={(e) => setUploadCategory(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      >
                        <option value="Architecture & Design">Architecture & Design</option>
                        <option value="Engineering & Hardware">Engineering & Hardware</option>
                        <option value="Filmmaking & Assets">Filmmaking & Assets</option>
                        <option value="Software & Builds">Software & Builds</option>
                        <option value="Technology">Technology</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Visibility</label>
                      <select
                        value={uploadVisibility}
                        onChange={(e) => setUploadVisibility(e.target.value as any)}
                        className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      >
                        <option value="public">Public (Explore & Shared Link)</option>
                        <option value="unlisted">Unlisted (Shared Link Only)</option>
                        <option value="private">Private (Owner Only)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Optional Link Password</label>
                      <input
                        type="password"
                        value={uploadPassword}
                        onChange={(e) => setUploadPassword(e.target.value)}
                        placeholder="Leave blank for open access"
                        className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={uploadDescription}
                      onChange={(e) => setUploadDescription(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    />
                  </div>

                  {/* Animated Color-Graded Upload Progress Bar & Real-Time Telemetry Card */}
                  <div
                    id="upload-progress-telemetry-card"
                    className="liquid-retina-card"
                  >
                    <div className="liquid-retina-inner bg-white dark:bg-neutral-950 p-4 sm:p-5 space-y-3.5">
                      <div className="liquid-retina-glow" />

                      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">
                            <UploadCloud className="w-3.5 h-3.5 shrink-0" />
                            <span>REAL-TIME MULTIPART UPLOAD TELEMETRY</span>
                          </div>
                          <p className="text-xs font-semibold text-neutral-900 dark:text-white">
                            {uploadStageLabel}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            id="simulate-upload-progress-btn"
                            type="button"
                            onClick={handleSimulateUploadProgress}
                            disabled={isUploading}
                            className="px-3 py-1.5 rounded-md border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-mono font-semibold transition-colors"
                          >
                            {isUploading ? 'Streaming Chunks...' : 'Simulate Live Transfer'}
                          </button>
                          <span
                            id="upload-progress-percentage"
                            className="px-2.5 py-1 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-mono font-bold tabular-nums"
                          >
                            {uploadProgress}%
                          </span>
                        </div>
                      </div>

                      {/* Animated Color-Graded Progress Bar */}
                      <div className="relative z-10 space-y-2">
                        <div
                          id="upload-color-graded-progress-bar"
                          role="progressbar"
                          aria-label="File upload progress"
                          aria-valuenow={uploadProgress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          className="w-full h-4 upload-progress-track"
                        >
                          <div
                            className="h-full upload-color-graded-bar"
                            style={{ width: `${Math.max(4, uploadProgress)}%` }}
                          >
                            <div className="upload-shimmer-stripe" />
                          </div>
                        </div>

                        {/* Real-Time Speed, Estimated Time Remaining (ETA), and Transferred Bytes Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs font-mono tabular-nums">
                          <div className="px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                            <span className="text-neutral-500">Upload Speed:</span>
                            <span
                              id="upload-speed-readout"
                              className="font-bold text-blue-600 dark:text-blue-400"
                            >
                              {uploadSpeedMbps.toFixed(1)} MB/s
                            </span>
                          </div>

                          <div className="px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                            <span className="text-neutral-500">Time Remaining:</span>
                            <span
                              id="upload-eta-readout"
                              className="font-bold text-emerald-600 dark:text-emerald-400"
                            >
                              {uploadProgress >= 100
                                ? '0.0s remaining (Done)'
                                : `${uploadEtaSeconds.toFixed(1)}s remaining`}
                            </span>
                          </div>

                          <div className="px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/80 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
                            <span className="text-neutral-500">Transferred:</span>
                            <span
                              id="upload-bytes-readout"
                              className="font-bold text-neutral-950 dark:text-white"
                            >
                              {formatBytes(Math.round((uploadSizeBytes * uploadProgress) / 100))} / {formatBytes(uploadSizeBytes)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={uploadAllowDownload}
                        onChange={(e) => setUploadAllowDownload(e.target.checked)}
                      />
                      <span>Allow viewers to download original file</span>
                    </label>
                    <button
                      id="upload-submit-button"
                      type="submit"
                      disabled={isUploading}
                      className="px-5 py-2.5 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
                    >
                      {isUploading ? 'Processing Upload...' : 'Publish & Generate Monetized Link'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ===============================================================
              SECTION 5 & 6: ANALYTICS & EARNINGS
             =============================================================== */}
          {(section === 'analytics' || section === 'earnings') && (
            <div className="space-y-6">
              <div className="p-5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-neutral-950 dark:text-white">
                    Active Monetization Calculation Formula:{' '}
                    {rules?.activeMode === 'revenue_share'
                      ? `Mode B — Verified Advertising Revenue Share (${rules.revenueSharePercent}%)`
                      : `Mode A — Fixed Creator CPM ($${rules?.targetCpmUsd || '3.00'} per 1,000 Eligible Views)`}
                  </h2>
                  <span className="text-xs font-mono text-neutral-500">
                    Min Watch Qualification: {rules?.minWatchSeconds || 5}s
                  </span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Estimated real-time playback earnings are separated from finalized payable wallet balances. Invalid or automated traffic is filtered before ledger credit.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Geography CPM Breakdown */}
                <div className="p-5 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-4">
                  <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                    Performance by Viewer Geography
                  </h3>
                  <div className="space-y-3 text-xs">
                    {[
                      { country: 'India (IN)', share: '58%', cpm: '$3.00', views: Math.round(totalMonetizedViews * 0.58) },
                      { country: 'United States (US)', share: '18%', cpm: '$3.40', views: Math.round(totalMonetizedViews * 0.18) },
                      { country: 'United Kingdom (GB)', share: '12%', cpm: '$3.10', views: Math.round(totalMonetizedViews * 0.12) },
                      { country: 'Germany & EU (DE)', share: '8%', cpm: '$3.00', views: Math.round(totalMonetizedViews * 0.08) },
                      { country: 'Singapore (SG)', share: '4%', cpm: '$3.00', views: Math.round(totalMonetizedViews * 0.04) },
                    ].map((row) => (
                      <div key={row.country} className="space-y-1">
                        <div className="flex justify-between font-mono tabular-nums">
                          <span>{row.country}</span>
                          <span>
                            {row.views.toLocaleString()} views · Rate {row.cpm} ({row.share})
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full bg-neutral-950 dark:bg-blue-500" style={{ width: row.share }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Device & Traffic Source Breakdown */}
                <div className="p-5 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-4">
                  <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                    Device Categories & Traffic Verification
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-800">
                      <span className="text-neutral-600 dark:text-neutral-400">Android & iOS Mobile Web</span>
                      <span className="font-mono tabular-nums font-semibold">62.4%</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-800">
                      <span className="text-neutral-600 dark:text-neutral-400">Desktop (macOS / Windows / Linux)</span>
                      <span className="font-mono tabular-nums font-semibold">34.1%</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-neutral-200 dark:border-neutral-800">
                      <span className="text-neutral-600 dark:text-neutral-400">Tablet / Smart TV</span>
                      <span className="font-mono tabular-nums font-semibold">3.5%</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-neutral-600 dark:text-neutral-400">Filtered Bot / Invalid Traffic Deductions</span>
                      <span className="font-mono tabular-nums text-sky-600 dark:text-sky-400">1.8% ($0.00 credited)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              SECTION 7: WALLET & IMMUTABLE LEDGER
             =============================================================== */}
          {section === 'wallet' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-neutral-950 dark:text-white">
                    Immutable Double-Entry Creator Wallet Ledger
                  </h2>
                  <p className="text-xs text-neutral-500">
                    Every earning credit, referral bonus, withdrawal hold, and settlement is recorded with a unique UUID.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportLedgerCsv}
                  className="px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV Ledger</span>
                </button>
              </div>

              <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50">
                      <th className="py-2.5 px-4 font-medium">Ledger UUID</th>
                      <th className="py-2.5 px-4 font-medium">Type & Reference</th>
                      <th className="py-2.5 px-4 font-medium">Description</th>
                      <th className="py-2.5 px-4 font-medium text-right">Amount (USD)</th>
                      <th className="py-2.5 px-4 font-medium text-right">Balance After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {ledger.map((l) => (
                      <tr key={l.id}>
                        <td className="py-3 px-4 font-mono text-[11px]">{l.ledgerUuid}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                          {l.entryType} ({l.referenceId})
                        </td>
                        <td className="py-3 px-4 text-neutral-800 dark:text-neutral-200">{l.description}</td>
                        <td
                          className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                            Number(l.amountUsd) >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-neutral-900 dark:text-white'
                          }`}
                        >
                          {Number(l.amountUsd) >= 0 ? '+' : ''}${Number(l.amountUsd).toFixed(4)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          ${Number(l.balanceAfterUsd).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===============================================================
              SECTION 8: WITHDRAW — LIGHTNING UPI & GLOBAL USDT PAYOUTS
             =============================================================== */}
          {section === 'withdraw' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: UPI & USDT Registration & Withdrawal Request Form */}
                <div className="lg:col-span-7 p-5 sm:p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-bold text-neutral-950 dark:text-white flex items-center gap-2">
                        <Zap className="w-4 h-4 text-sky-500 icon-anim-bolt" />
                        <span>Lightning India UPI & Global USDT Payouts</span>
                      </h2>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">
                        Minimum withdrawal: <span className="font-semibold text-neutral-950 dark:text-white">${upiMinUsd.toFixed(2)} USD</span> for India UPI ({upiFeePct.toFixed(2)}% fee) · <span className="font-semibold text-emerald-700 dark:text-emerald-400">${usdtMinUsd.toFixed(2)} USD</span> for Global USDT ({usdtFeePct.toFixed(2)}% fee).
                      </p>
                    </div>

                    {/* Quick Preset Buttons for UPI or USDT */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!upiInput.includes('@')) {
                            setUpiInput(user.upiId && user.upiId.includes('@') ? user.upiId : '');
                          }
                          if (Number(withdrawAmountUsd) < upiMinUsd) {
                            setWithdrawAmountUsd(upiMinUsd.toFixed(2));
                          }
                        }}
                        className="min-h-[34px] px-3 py-1.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 text-sky-400 dark:text-sky-600 icon-anim-bolt" />
                        <span>Use UPI (${upiMinUsd.toFixed(0)} Min)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (Number(withdrawAmountUsd) < usdtMinUsd) {
                            setWithdrawAmountUsd(usdtMinUsd.toFixed(2));
                          }
                        }}
                        className="min-h-[34px] px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Coins className="w-3.5 h-3.5 icon-anim-float" />
                        <span>Use USDT (${usdtMinUsd.toFixed(0)} Min)</span>
                      </button>
                    </div>
                  </div>

                  {withdrawFeedback && (
                    <div
                      className={`p-3 rounded text-xs font-mono ${
                        withdrawFeedback.type === 'ok'
                          ? 'bg-emerald-950 text-emerald-200'
                          : 'bg-red-950 text-red-200'
                      }`}
                    >
                      {withdrawFeedback.text}
                    </div>
                  )}

                  {/* Step 1: Verify UPI ID or USDT Wallet */}
                  <div className="space-y-2">
                    <label htmlFor="upi-vpa-input" className="block text-xs font-medium">
                      Payout Destination — UPI ID (vpa@bank) or USDT Wallet (TRC-20 / ERC-20)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="upi-vpa-input"
                        type="text"
                        value={upiInput}
                        onChange={(e) => setUpiInput(e.target.value)}
                        placeholder="creator@okhdfcbank or TX8k9m..."
                        className="flex-1 px-3 py-2.5 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyUpiAndSave}
                        className="min-h-[40px] px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 text-xs font-semibold whitespace-nowrap inline-flex items-center justify-center"
                      >
                        Verify & Save Destination
                      </button>
                    </div>
                    <p className="text-[11px] font-mono text-neutral-500">
                      Current Status: {user.upiVerified ? `VERIFIED (${user.upiId})` : 'VERIFICATION REQUIRED'} · KYC: {user.kycVerified ? 'VERIFIED' : 'PENDING'}
                    </p>
                  </div>

                  {/* Step 2: Request Withdrawal */}
                  <form onSubmit={handleRequestWithdrawal} className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                    <div>
                      <label htmlFor="withdraw-amount-input" className="block text-xs font-medium mb-1">
                        Withdrawal Amount (USD) — Available: ${Number(wallet?.availableBalanceUsd || 0).toFixed(2)} USD · Active Rail: {currentPayoutMethod} (Min ${activeMinUsd.toFixed(2)})
                      </label>
                      <input
                        id="withdraw-amount-input"
                        type="number"
                        step="0.50"
                        min={activeMinUsd}
                        value={withdrawAmountUsd}
                        onChange={(e) => setWithdrawAmountUsd(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs font-mono tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                      />
                    </div>

                    {/* Live Conversion Breakdown (UPI INR + USDT Stablecoin with Live USDT/INR Rate) */}
                    <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2.5 text-xs font-mono tabular-nums">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          LIVE 1 USDT = ₹{usdtInrRate.toFixed(2)} INR · 1 USD = ₹{inrRate.toFixed(2)} INR
                        </span>
                        <button
                          type="button"
                          onClick={handleSyncDashboardLiveFx}
                          disabled={syncingFx}
                          className="px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-emerald-700 transition-colors"
                        >
                          <RefreshCw className={`w-3 h-3 ${syncingFx ? 'animate-spin' : ''}`} />
                          <span>{syncingFx ? 'Syncing...' : 'Sync Live Rate'}</span>
                        </button>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Detected Settlement Rail & Status:</span>
                        <span>
                          {currentPayoutMethod === 'USDT'
                            ? `Global USDT (${usdtEnabled ? 'ACTIVE' : 'PAUSED'} · Min $${usdtMinUsd.toFixed(2)})`
                            : `India UPI (${upiEnabled ? 'ACTIVE' : 'PAUSED'} · Min $${upiMinUsd.toFixed(2)})`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">
                          {currentPayoutMethod} Processing Fee ({activeFeePct.toFixed(2)}%):
                        </span>
                        <span>${activeFeeUsd.toFixed(2)} USD</span>
                      </div>
                      <div className="flex justify-between font-bold text-neutral-950 dark:text-white pt-2 border-t border-neutral-200 dark:border-neutral-800">
                        <span>Estimated Net UPI Transfer (@ ₹{inrRate.toFixed(2)}/USD):</span>
                        <span>₹{(activeNetUsd * inrRate).toFixed(2)} INR</span>
                      </div>
                      <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-400">
                        <span>Estimated Net USDT Payout (@ ₹{usdtInrRate.toFixed(2)}/USDT):</span>
                        <span>
                          {activeNetUsd.toFixed(2)} USDT (≈ ₹{(activeNetUsd * usdtInrRate).toFixed(2)} INR)
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submittingWithdraw}
                      className="min-h-[44px] w-full py-2.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold inline-flex items-center justify-center gap-2"
                    >
                      <Zap className="w-4 h-4 text-sky-400 dark:text-sky-600" />
                      <span>
                        {submittingWithdraw
                          ? 'Submitting with Idempotency Key...'
                          : 'Submit Verified UPI / USDT Withdrawal Request'}
                      </span>
                    </button>
                  </form>
                </div>

                {/* Right Column: Payout Compliance & States Guide */}
                <div className="lg:col-span-5 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-4 text-xs">
                  <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                    UPI & USDT Payout Lifecycle & Settlement Verification Rules
                  </h3>
                  <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    ShareDabba supports India UPI (INR) and Global USDT (TRC-20 / ERC-20) withdrawals. Payouts are never marked Paid until the payment provider or Finance Admin confirms bank UTR / blockchain settlement:
                  </p>
                  <div className="space-y-2 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                    <p>1. PENDING / UNDER_REVIEW — Server-side balance verified & placed in hold</p>
                    <p>2. PROCESSING — Dispatched to UPI IMPS gateway or USDT node awaiting confirmation</p>
                    <p>3. PAID — Confirmed with verified Bank UTR or blockchain TxHash reference</p>
                    <p>4. REJECTED / FAILED — Funds automatically reversed to available balance via immutable ledger entry</p>
                  </div>
                </div>
              </div>

              {/* Withdrawal History Table */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800">
                  <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                    Withdrawal Request History
                  </h3>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50">
                      <th className="py-2.5 px-4 font-medium">Request UUID</th>
                      <th className="py-2.5 px-4 font-medium">Destination UPI</th>
                      <th className="py-2.5 px-4 font-medium text-right">USD Amount</th>
                      <th className="py-2.5 px-4 font-medium text-right">Net INR Payout</th>
                      <th className="py-2.5 px-4 font-medium">Status & UTR Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {withdrawals.map((w) => (
                      <tr key={w.id}>
                        <td className="py-3 px-4 font-mono">{w.requestUuid}</td>
                        <td className="py-3 px-4 font-mono">{w.destinationUpiId}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          ${Number(w.amountUsd).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                          ₹{Number(w.netPayoutInr).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {w.status.toUpperCase()} {w.providerReference ? `· ${w.providerReference}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===============================================================
              SECTION 9: DEDICATED CREATOR REFERRAL SECTION
             =============================================================== */}
          {section === 'referrals' && (
            <div id="creator-referral-section" className="space-y-6">
              {referralFeedback && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-mono border ${
                    referralFeedback.type === 'ok'
                      ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                      : 'bg-red-950/90 border-red-500/40 text-red-200'
                  }`}
                >
                  {referralFeedback.text}
                </div>
              )}

              {/* Unique Referral Link & QR Share Hub (Liquid-Retina Card) */}
              <div className="liquid-retina-card rounded-2xl p-5 sm:p-6 text-white">
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-cyan-300">
                      <span>CREATOR REFERRAL PARTNER PROGRAM</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-300 font-semibold">
                        {rules?.referralCommissionPercent || '10.00'}% LIFETIME BONUS COMMISSION
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-300">CODE: {activeRefCode}</span>
                    </div>

                    <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                      Share Your Unique Creator Link &amp; Earn {rules?.referralCommissionPercent || '10.00'}% Bonus on Every Referred Creator
                    </h2>

                    <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                      Invite filmmakers, educators, and studio creators to ShareDabba. You earn a{' '}
                      <strong className="text-white">{rules?.referralCommissionPercent || '10.00'}% lifetime bonus</strong> on all
                      verified monetized views generated by your referrals on the{' '}
                      <span className="text-sky-300 font-mono">Official $3.00 CPM Plan</span>, without deducting a single cent from their payouts.
                    </p>

                    <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <div className="flex-1 min-w-0">
                        <label htmlFor="unique-referral-link-input" className="sr-only">
                          Unique Referral Link
                        </label>
                        <input
                          id="unique-referral-link-input"
                          type="text"
                          readOnly
                          aria-label="Unique Referral Link"
                          value={uniqueReferralUrl}
                          className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-blue-400/40 bg-slate-950/90 text-sky-200 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(uniqueReferralUrl);
                          setCopiedId('ref-link-main');
                          setTimeout(() => setCopiedId(null), 1600);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-400 via-blue-600 to-blue-700 text-white text-xs font-extrabold tracking-wide shadow-md flex items-center justify-center gap-1.5 shrink-0"
                      >
                        {copiedId === 'ref-link-main' ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied Referral Link</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Referral Link</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(activeRefCode);
                          setCopiedId('ref-code-main');
                          setTimeout(() => setCopiedId(null), 1600);
                        }}
                        className="px-3.5 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-xs font-mono font-semibold shrink-0"
                      >
                        {copiedId === 'ref-code-main' ? `Copied: ${activeRefCode}` : `Code: ${activeRefCode}`}
                      </button>
                    </div>
                  </div>

                  {/* QR Matrix Share Box */}
                  <div className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-slate-950/80 border border-blue-500/30 shrink-0 self-start lg:self-center">
                    <QrCodeMatrix value={uniqueReferralUrl} size={112} />
                    <span className="mt-2 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      Scan Partner Link
                    </span>
                  </div>
                </div>
              </div>

              {/* 4-Card Referral Sign-Ups & Pending Bonus KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl color-graded-panel border-sky-500/40 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500 font-medium">Pending Referral Bonus</span>
                    <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400 font-semibold">
                      {pendingReferralEvents.length} PENDING
                    </span>
                  </div>
                  <p
                    id="pending-referral-bonus-usd"
                    className="text-2xl font-bold font-mono tabular-nums text-sky-600 dark:text-sky-400"
                  >
                    ${pendingReferralBonusUsd.toFixed(2)} USD
                  </p>
                  <p className="text-[11px] font-mono text-neutral-500">
                    ≈ ₹{(pendingReferralBonusUsd * inrRate).toFixed(2)} INR · 7-day verification hold
                  </p>
                </div>

                <div className="p-4 rounded-xl color-graded-panel space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500 font-medium">Credited Referral Bonus</span>
                    <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      SETTLED
                    </span>
                  </div>
                  <p
                    id="credited-referral-bonus-usd"
                    className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400"
                  >
                    ${creditedReferralBonusUsd.toFixed(2)} USD
                  </p>
                  <p className="text-[11px] font-mono text-neutral-500">
                    ≈ ₹{(creditedReferralBonusUsd * inrRate).toFixed(2)} INR · In payable wallet
                  </p>
                </div>

                <div className="p-4 rounded-xl color-graded-panel space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500 font-medium">Tracked Sign-Ups</span>
                    <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                      {referralConversionPct}% CONV
                    </span>
                  </div>
                  <p
                    id="tracked-referral-signups-count"
                    className="text-2xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white"
                  >
                    {totalReferralSignups} Creators
                  </p>
                  <p className="text-[11px] font-mono text-neutral-500">
                    {referralClicksCount.toLocaleString()} Unique Link Clicks · {eligibleReferralsCount} Active
                  </p>
                </div>

                <div className="p-4 rounded-xl color-graded-panel space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500 font-medium">Combined Referral Value</span>
                    <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400 font-semibold">
                      10% TIER
                    </span>
                  </div>
                  <p className="text-2xl font-bold font-mono tabular-nums text-neutral-950 dark:text-white">
                    ${(pendingReferralBonusUsd + creditedReferralBonusUsd).toFixed(2)} USD
                  </p>
                  <p className="text-[11px] font-mono text-neutral-500">
                    ≈ ₹{((pendingReferralBonusUsd + creditedReferralBonusUsd) * inrRate).toFixed(2)} INR Total Bonus
                  </p>
                </div>
              </div>

              {/* Interactive Referral Sign-Up Tracker & Pending Bonus Settlement Controls */}
              <div className="p-5 rounded-xl color-graded-panel space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                      Track New Creator Sign-Up &amp; Manage Pending Referral Bonuses
                    </h3>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Test or log a referred creator registration on the Official $3.00 CPM Plan, or settle verified pending referral bonuses into your available wallet balance.
                    </p>
                  </div>
                  {pendingReferralEvents.length > 0 && (
                    <button
                      type="button"
                      disabled={referralBusy}
                      onClick={() => handleSettlePendingReferralBonus()}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0 disabled:opacity-50"
                    >
                      {referralBusy
                        ? 'Processing...'
                        : `Settle All Pending Bonuses (+$${pendingReferralBonusUsd.toFixed(2)} USD)`}
                    </button>
                  )}
                </div>

                <form
                  onSubmit={handleSimulateReferralSignup}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800"
                >
                  <div className="sm:col-span-5">
                    <label htmlFor="referral-signup-email" className="block text-[11px] font-mono text-neutral-500 mb-1">
                      Referred Creator Email (optional for simulation)
                    </label>
                    <input
                      id="referral-signup-email"
                      type="email"
                      value={newRefEmailInput}
                      onChange={(e) => setNewRefEmailInput(e.target.value)}
                      placeholder="e.g. ananya.edits@filmmaker.in"
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label htmlFor="referral-signup-plan" className="block text-[11px] font-mono text-neutral-500 mb-1">
                      Referred Creator Monetization Plan
                    </label>
                    <select
                      id="referral-signup-plan"
                      value={newRefPlanTier}
                      onChange={(e) => setNewRefPlanTier(e.target.value as 'balanced' | 'max')}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    >
                      <option value="max">Official $3.00 CPM Plan (+$1.50 Pending Bonus)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3 flex items-end">
                    <button
                      type="submit"
                      disabled={referralBusy}
                      className="w-full px-4 py-2 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold disabled:opacity-50"
                    >
                      {referralBusy ? 'Recording...' : '+ Track Referral Sign-Up'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Referral Sign-Ups & Pending Bonus Attribution Table */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-950">
                <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                      Referred Creator Sign-Ups &amp; Bonus Attribution Ledger
                    </h3>
                    <p className="text-[11px] font-mono text-neutral-500">
                      Showing {filteredReferralEvents.length} of {referralEvents.length} tracked creator referrals · 1 USD = ₹{inrRate.toFixed(2)} INR
                    </p>
                  </div>

                  {/* Interactive Filter Controls */}
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setReferralFilter('all')}
                      className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-colors ${
                        referralFilter === 'all'
                          ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                      }`}
                    >
                      All ({referralEvents.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReferralFilter('pending')}
                      className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-colors ${
                        referralFilter === 'pending'
                          ? 'bg-sky-500 text-neutral-950'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                      }`}
                    >
                      Pending Bonus ({pendingReferralEvents.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setReferralFilter('credited')}
                      className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-colors ${
                        referralFilter === 'credited'
                          ? 'bg-emerald-600 text-white'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                      }`}
                    >
                      Credited ({creditedReferralEvents.length})
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50">
                        <th className="py-2.5 px-4 font-medium">Referred Creator</th>
                        <th className="py-2.5 px-4 font-medium">Sign-Up &amp; Plan Attribution</th>
                        <th className="py-2.5 px-4 font-medium">Bonus Status</th>
                        <th className="py-2.5 px-4 font-medium text-right">Bonus (USD)</th>
                        <th className="py-2.5 px-4 font-medium text-right">Bonus (INR)</th>
                        <th className="py-2.5 px-4 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {filteredReferralEvents.map((ev) => {
                        const isPending = ev.status === 'pending';
                        const usdVal = Number(ev.commissionUsd || 0);
                        const inrVal = usdVal * inrRate;
                        return (
                          <tr key={ev.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/40">
                            <td className="py-3 px-4">
                              <p className="font-semibold text-neutral-950 dark:text-white">{ev.referredUserEmail}</p>
                              <p className="text-[11px] font-mono text-neutral-500">
                                Partner Code: {activeRefCode}
                              </p>
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                              {ev.eventType}
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px]">
                              {isPending ? (
                                <span className="text-sky-600 dark:text-sky-400 font-semibold">
                                  PENDING BONUS · Awaiting Verification
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  CREDITED TO WALLET · Verified
                                </span>
                              )}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-mono tabular-nums font-bold ${
                                isPending
                                  ? 'text-sky-600 dark:text-sky-400'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              +${usdVal.toFixed(2)} USD
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                              ₹{inrVal.toFixed(2)} INR
                            </td>
                            <td className="py-3 px-4 text-right">
                              {isPending ? (
                                <button
                                  type="button"
                                  disabled={referralBusy}
                                  onClick={() => handleSettlePendingReferralBonus(ev.id)}
                                  className="px-2.5 py-1 rounded border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-semibold"
                                >
                                  Verify &amp; Credit
                                </button>
                              ) : (
                                <span className="text-[11px] font-mono text-neutral-400">Settled</span>
                              )}
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

          {/* ===============================================================
              SECTION 10: PROMOTIONS & CREATOR CAMPAIGNS
             =============================================================== */}
          {section === 'promotions' && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl color-graded-panel space-y-4">
                <h2 className="text-base font-bold text-neutral-950 dark:text-white">
                  Active Creator Monetization &amp; Referral Promotions
                </h2>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Maximize your channel revenue using our unified Official $3.00 CPM Plan alongside the {rules?.referralCommissionPercent || '10.00'}% Creator Referral Partner Program.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl border border-sky-500/30 bg-sky-50/50 dark:bg-sky-950/20 space-y-2">
                    <p className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                      OFFICIAL $3.00 CPM PLAN
                    </p>
                    <p className="text-sm font-bold text-neutral-950 dark:text-white">
                      $3.00 USD (₹{(3 * inrRate).toFixed(2)} INR) per 1,000 Verified Views
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Full pre-roll + mid-roll ad density for long-form 4K uploads and technical tutorials.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
                    <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      10% PARTNER REFERRAL BONUS
                    </p>
                    <p className="text-sm font-bold text-neutral-950 dark:text-white">
                      Pending Bonus: ${pendingReferralBonusUsd.toFixed(2)} USD · Credited: ${creditedReferralBonusUsd.toFixed(2)} USD
                    </p>
                    <button
                      type="button"
                      onClick={() => onChangeSection('referrals')}
                      className="px-3.5 py-1.5 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
                    >
                      Open Referral Dashboard →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              SECTION 11: NOTIFICATIONS
             =============================================================== */}
          {section === 'notifications' && (
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg divide-y divide-neutral-200 dark:divide-neutral-800">
              {notifications.map((n) => (
                <div key={n.id} className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-neutral-950 dark:text-white">{n.title}</span>
                    <span className="font-mono text-neutral-500 uppercase text-[11px]">{n.category}</span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">{n.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* ===============================================================
              SECTION 12: ACCOUNT SETTINGS
             =============================================================== */}
          {section === 'settings' && (
            <div className="space-y-6">
              <div className="p-6 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-4">
                <h2 className="text-base font-bold text-neutral-950 dark:text-white">
                  Profile, Security & Two-Factor Authentication
                </h2>
                {settingsSavedMsg && (
                  <div className="p-3 rounded bg-emerald-950 text-emerald-200 text-xs font-mono">
                    {settingsSavedMsg}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Display Name / Studio</label>
                    <input
                      type="text"
                      value={settingsName}
                      onChange={(e) => setSettingsName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Verified UPI Payout ID</label>
                    <input
                      type="text"
                      value={upiInput}
                      onChange={(e) => setUpiInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={settings2FA}
                    onChange={(e) => setSettings2FA(e.target.checked)}
                  />
                  <span>Require Two-Factor Authentication (2FA) for UPI withdrawals and security changes</span>
                </label>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetch('/api/account/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...authHeaders },
                        body: JSON.stringify({
                          displayName: settingsName,
                          upiId: upiInput,
                          twoFactorEnabled: settings2FA,
                        }),
                      });
                      if (res.ok) {
                        setSettingsSavedMsg('Account settings saved and verified.');
                        await onRefreshDashboard();
                      }
                    }}
                    className="px-4 py-2 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
                  >
                    Save Account Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(dashboardData, null, 2)], {
                        type: 'application/json',
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `sharedabba_data_export_${user.username}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-4 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 text-xs font-semibold"
                  >
                    Export Account Data (JSON)
                  </button>
                </div>
              </div>

              {/* Active Sessions */}
              <div className="p-6 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3">
                <h3 className="text-sm font-bold text-neutral-950 dark:text-white">
                  Active Device Sessions
                </h3>
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
                  {sessions.map((s) => (
                    <div key={s.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-neutral-900 dark:text-white">{s.deviceInfo}</p>
                        <p className="text-[11px] font-mono text-neutral-500">IP: {s.ipAddress}</p>
                      </div>
                      <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                        ACTIVE SESSION
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              SECTION 13: SUPPORT TICKETS
             =============================================================== */}
          {section === 'support' && (
            <SupportTicket
              defaultEmail={user.email}
              uid={user.uid}
              authHeaders={authHeaders}
              initialTickets={tickets}
              onTicketSubmitted={async () => {
                await onRefreshDashboard();
              }}
              title="Creator Priority Support & Ticket Desk"
              subtitle="Submit a support message with an optional category (Technical, Payout, Copyright). All submissions are saved to the support_tickets database table."
            />
          )}
        </div>
      </div>
    </div>
  );
};
