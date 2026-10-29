import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import {
  AdminSection,
  FileRecord,
  MonetizationRulesRecord,
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
  onSwitchToAdminAccount: () => void;
  onRefreshGlobal: () => Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  section,
  onChangeSection,
  authHeaders,
  onSwitchToAdminAccount,
  onRefreshGlobal,
}) => {
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

  const [loading, setLoading] = useState(true);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  // Monetization Config Form State
  const [modeInput, setModeInput] = useState<'fixed_cpm' | 'revenue_share'>('fixed_cpm');
  const [cpmInput, setCpmInput] = useState('2.00');
  const [revShareInput, setRevShareInput] = useState('65.00');
  const [minWithdrawInput, setMinWithdrawInput] = useState('5.00');
  const [inrRateInput, setInrRateInput] = useState('84.20');
  const [refCommInput, setRefCommInput] = useState('10.00');

  // Custom Codes, Scripts & Dynamic Ad-Tier CPM Studio State
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
    announcementBanner: 'Dynamic CPM Tiers Active: Max Ads ($3.00 eCPM) & Balanced ($2.00 eCPM)',
  });
  const [syncingFx, setSyncingFx] = useState(false);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        setAdminData(data);
        if (data.monetizationRules) {
          setModeInput(data.monetizationRules.activeMode);
          setCpmInput(data.monetizationRules.targetCpmUsd);
          setRevShareInput(data.monetizationRules.revenueSharePercent);
          setMinWithdrawInput(data.monetizationRules.minWithdrawalUsd);
          setInrRateInput(data.monetizationRules.usdToInrRate);
          setRefCommInput(data.monetizationRules.referralCommissionPercent);
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
          }));
        }
      }
    } catch (e) {
      console.error('Admin load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncLiveFx = async () => {
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

  useEffect(() => {
    fetchAdminData();
  }, []);

  const navItems: Array<{ id: AdminSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: 'Platform Overview', icon: Shield },
    { id: 'payout-config', label: 'Payout Configuration', icon: Coins },
    { id: 'users', label: 'A. User Management', icon: Users },
    { id: 'content', label: 'B. Content & DMCA', icon: FileText },
    { id: 'monetization', label: 'C. Monetization & CPM', icon: Sliders },
    { id: 'finance', label: 'D. Finance & UPI Payouts', icon: Landmark },
    { id: 'advertising', label: 'E. Advertising & VAST', icon: Radio },
    { id: 'site-config', label: 'F. Site & Integrations', icon: Settings },
    { id: 'security-audit', label: 'G. Security & Audit Logs', icon: Lock },
  ];

  if (loading && !adminData) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <p className="text-xs font-mono text-neutral-500">Loading Administration Console...</p>
      </div>
    );
  }

  if (!adminData) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-4">
        <h2 className="text-xl font-bold">Authorized Staff Session Required</h2>
        <button
          type="button"
          onClick={onSwitchToAdminAccount}
          className="px-4 py-2 rounded-md bg-neutral-950 text-white text-xs font-semibold"
        >
          Authenticate as Super Admin
        </button>
      </div>
    );
  }

  const totalStorageBytes = adminData.files.reduce((a, f) => a + f.sizeBytes, 0);
  const totalViews = adminData.files.reduce((a, f) => a + f.viewsCount, 0);
  const totalMonetizedViews = adminData.files.reduce((a, f) => a + f.monetizedViewsCount, 0);
  const creatorRevUsd = adminData.files.reduce((a, f) => a + Number(f.estimatedEarningsUsd), 0);
  const grossAdRevUsd = creatorRevUsd * 1.54;

  const handleSaveMonetization = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/monetization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        activeMode: modeInput,
        targetCpmUsd: Number(cpmInput),
        revenueSharePercent: Number(revShareInput),
        minWithdrawalUsd: Number(minWithdrawInput),
        usdToInrRate: Number(inrRateInput),
        referralCommissionPercent: Number(refCommInput),
      }),
    });
    if (res.ok) {
      setActionBanner(
        `Updated monetization engine to ${modeInput === 'fixed_cpm' ? `Fixed CPM ($${cpmInput})` : `Revenue Share (${revShareInput}%)`} and logged in audit trail.`
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
      headers: { 'Content-Type': 'application/json', ...authHeaders },
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
        // Handled by handleFirestoreError when Firebase session is active
      }
      setActionBanner(
        `Saved Payout & FX Configuration — Live USDT/INR: ₹${Number(payload.usdtToInrRate).toFixed(2)} · UPI USD/INR: ₹${Number(payload.usdToInrRate).toFixed(2)} · UPI (${payload.upiPayoutEnabled ? 'ENABLED' : 'PAUSED'}, Min: $${Number(payload.upiMinWithdrawalUsd).toFixed(2)}) · USDT (${payload.usdtPayoutEnabled ? 'ENABLED' : 'PAUSED'}, Min: $${Number(payload.usdtMinWithdrawalUsd).toFixed(2)}).`
      );
      await fetchAdminData();
      await onRefreshGlobal();
    }
  };

  const handleWithdrawalDecision = async (
    withdrawalId: number,
    action: 'approve_and_settle' | 'reject_and_reverse'
  ) => {
    const res = await fetch('/api/admin/withdrawals/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        withdrawalId,
        action,
        adminNote:
          action === 'approve_and_settle'
            ? 'Verified UPI payout settled via RazorpayX IMPS/UPI rail'
            : 'Rejected during finance audit; returned to available wallet balance',
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setActionBanner(
        action === 'approve_and_settle'
          ? `Settled withdrawal ${data.requestUuid} (UTR: ${data.providerReference}).`
          : `Rejected withdrawal ${data.requestUuid} and created auditable reversal entry.`
      );
      await fetchAdminData();
      await onRefreshGlobal();
    } else {
      setActionBanner(data.error || 'Action failed');
    }
  };

  const handleModerate = async (
    targetType: 'file' | 'user' | 'report',
    targetId: number,
    action: string,
    reason: string
  ) => {
    const res = await fetch('/api/admin/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ targetType, targetId, action, reason }),
    });
    if (res.ok) {
      setActionBanner(`Moderation action (${action}) applied to ${targetType} #${targetId}.`);
      await fetchAdminData();
      await onRefreshGlobal();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Admin Sidebar */}
        <aside className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-950 text-white space-y-1">
            <p className="text-[11px] font-mono text-neutral-400">PROTECTED STAFF CONSOLE</p>
            <p className="text-sm font-bold">ShareDabba /admin</p>
            <p className="text-xs font-mono text-blue-400">Role: SUPER_ADMIN · MFA Verified</p>
          </div>

          <nav aria-label="Admin Navigation" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-1">
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
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Admin Main Viewport */}
        <div className="flex-1 min-w-0 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
            <div>
              <p className="text-xs font-mono text-neutral-500">
                Administration / {navItems.find((n) => n.id === section)?.label}
              </p>
              <h1 className="text-2xl font-bold text-neutral-950 dark:text-white">
                {navItems.find((n) => n.id === section)?.label}
              </h1>
            </div>
            <span className="text-xs font-mono text-neutral-500">
              Governance Mode: Active · Audit Logging Enabled
            </span>
          </div>

          {actionBanner && (
            <div className="p-3 rounded-md bg-neutral-950 text-white text-xs font-mono flex items-center justify-between">
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

          {/* OVERVIEW */}
          {section === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
                  <p className="text-xs text-neutral-500">Registered Users / Creators</p>
                  <p className="text-2xl font-bold font-mono tabular-nums mt-1">
                    {adminData.users.length} Accounts
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
                  <p className="text-xs text-neutral-500">Total Uploaded Storage</p>
                  <p className="text-2xl font-bold font-mono tabular-nums mt-1">
                    {formatBytes(totalStorageBytes)}
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
                  <p className="text-xs text-neutral-500">Total / Monetized Views</p>
                  <p className="text-2xl font-bold font-mono tabular-nums mt-1">
                    {totalViews.toLocaleString()} / {totalMonetizedViews.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
                  <p className="text-xs text-neutral-500">Gross Ad Rev / Creator Share</p>
                  <p className="text-2xl font-bold font-mono tabular-nums mt-1">
                    ${grossAdRevUsd.toFixed(2)} / ${creatorRevUsd.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <h2 className="text-sm font-bold">Pending UPI Withdrawal Queue</h2>
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
                    {adminData.withdrawals.map((w) => (
                      <div key={w.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <p className="font-mono font-semibold">
                            {w.requestUuid} · {w.destinationUpiId}
                          </p>
                          <p className="text-[11px] font-mono text-neutral-500">
                            ${Number(w.amountUsd).toFixed(2)} USD (₹{w.netPayoutInr} INR) · {w.status.toUpperCase()}
                          </p>
                        </div>
                        {w.status === 'under_review' && (
                          <button
                            type="button"
                            onClick={() => onChangeSection('finance')}
                            className="px-2.5 py-1 rounded bg-neutral-950 text-white text-xs font-semibold"
                          >
                            Review
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <h2 className="text-sm font-bold">Open Abuse & Copyright Reports</h2>
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
                    {adminData.reports.map((r) => (
                      <div key={r.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{r.reasonCategory.toUpperCase()}</p>
                          <p className="text-neutral-500 line-clamp-1">{r.details}</p>
                        </div>
                        <span className="font-mono text-[11px] uppercase">{r.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* A. USER MANAGEMENT */}
          {section === 'users' && (
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50">
                    <th className="py-2.5 px-4 font-medium">User / Email</th>
                    <th className="py-2.5 px-4 font-medium">Role & Plan</th>
                    <th className="py-2.5 px-4 font-medium">UPI & KYC</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium text-right">Governance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {adminData.users.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 px-4">
                        <p className="font-semibold">{u.displayName}</p>
                        <p className="text-[11px] font-mono text-neutral-500">{u.email}</p>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {u.role} · {u.plan}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {u.upiId || 'None'} · KYC: {u.kycVerified ? 'YES' : 'NO'}
                      </td>
                      <td className="py-3 px-4 font-mono uppercase">{u.status}</td>
                      <td className="py-3 px-4 text-right">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* B. CONTENT MANAGEMENT & DMCA */}
          {section === 'content' && (
            <div className="space-y-6">
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50">
                      <th className="py-2.5 px-4 font-medium">Uploaded File</th>
                      <th className="py-2.5 px-4 font-medium">Malware & Status</th>
                      <th className="py-2.5 px-4 font-medium text-right">Size</th>
                      <th className="py-2.5 px-4 font-medium text-right">Moderation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {adminData.files.map((f) => (
                      <tr key={f.id}>
                        <td className="py-3 px-4">
                          <p className="font-semibold">{f.title}</p>
                          <p className="text-[11px] font-mono text-neutral-500">{f.filename}</p>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          Scan: {f.malwareScanStatus.toUpperCase()} · Status: {f.status.toUpperCase()}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {formatBytes(f.sizeBytes)}
                        </td>
                        <td className="py-3 px-4 text-right">
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
                            {f.status === 'ready' ? 'Quarantine File' : 'Reinstate File'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* C. MONETIZATION & CPM ENGINE */}
          {section === 'monetization' && (
            <form
              onSubmit={handleSaveMonetization}
              className="p-6 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-5 max-w-2xl"
            >
              <h2 className="text-base font-bold">
                Creator Monetization & Target CPM Configuration
              </h2>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                Select EITHER Mode A (Fixed Creator CPM) OR Mode B (Verified Advertising Revenue Share). Changes immediately apply to all subsequent playback verification events.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Active Calculation Mode</label>
                  <select
                    value={modeInput}
                    onChange={(e) => setModeInput(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                  >
                    <option value="fixed_cpm">Mode A: Fixed Creator CPM ($ / 1,000 views)</option>
                    <option value="revenue_share">Mode B: Verified Advertising Revenue Share (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Target Creator eCPM (USD)
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

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Referral Commission (%)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={refCommInput}
                    onChange={(e) => setRefCommInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
              >
                Save Monetization Rules & Log Audit Entry
              </button>
            </form>
          )}

          {/* D. FINANCE & UPI PAYOUT RECONCILIATION */}
          {section === 'finance' && (
            <div className="space-y-6">
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800">
                  <h2 className="text-sm font-bold">
                    UPI Withdrawal Requests & Webhook Reconciliation
                  </h2>
                </div>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50">
                      <th className="py-2.5 px-4 font-medium">Request UUID</th>
                      <th className="py-2.5 px-4 font-medium">UPI Destination</th>
                      <th className="py-2.5 px-4 font-medium text-right">Amount USD / INR</th>
                      <th className="py-2.5 px-4 font-medium">Status & UTR</th>
                      <th className="py-2.5 px-4 font-medium text-right">Finance Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {adminData.withdrawals.map((w) => (
                      <tr key={w.id}>
                        <td className="py-3 px-4 font-mono">{w.requestUuid}</td>
                        <td className="py-3 px-4 font-mono">{w.destinationUpiId}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          ${Number(w.amountUsd).toFixed(2)} (₹{w.netPayoutInr})
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {w.status.toUpperCase()} {w.providerReference ? `· ${w.providerReference}` : ''}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {w.status === 'under_review' ? (
                            <div className="inline-flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleWithdrawalDecision(w.id, 'approve_and_settle')}
                                className="px-2.5 py-1 rounded bg-emerald-800 text-white font-semibold flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                <span>Settle UPI</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleWithdrawalDecision(w.id, 'reject_and_reverse')}
                                className="px-2.5 py-1 rounded border border-red-400 text-red-700 dark:text-red-400 font-semibold flex items-center gap-1"
                              >
                                <X className="w-3 h-3" />
                                <span>Reject & Reverse</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-neutral-400 font-mono">Finalized (Immutable)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DEDICATED PAYOUT CONFIGURATION TAB (UPI vs USDT Status, $5 / $20 Thresholds, Global Fee %) */}
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
                      Toggle real-time availability of UPI vs USDT payout rails, configure the $5.00 UPI and $20.00 USDT minimum withdrawal thresholds, and manage custom fee percentages for domestic and global withdrawals.
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

                {/* Dual Rail Configuration Cards: India UPI ($5 Min) vs Global USDT ($20 Min) */}
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

                      {/* Real-time UPI Status Toggle */}
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
                        <span>{codesForm.upiPayoutEnabled ? 'UPI RAIL: ACTIVE' : 'UPI RAIL: PAUSED'}</span>
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
                        <span className="text-[11px] font-mono text-neutral-500">
                          Default: $5.00 USD (₹{(Number(codesForm.upiMinWithdrawalUsd || 5) * Number(inrRateInput || 86.45)).toFixed(0)} INR)
                        </span>
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
                        <span className="text-[11px] font-mono text-neutral-500">
                          Default: 0.00% (Zero-Fee Domestic IMPS/UPI)
                        </span>
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
                        <label className="block text-xs font-medium mb-1">USD → INR UPI Settlement Rate</label>
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
                            TRC-20 · ERC-20 · BEP-20 · Polygon (1 USDT = ₹{Number(codesForm.usdtToInrRate || 88.85).toFixed(2)} INR)
                          </p>
                        </div>
                      </div>

                      {/* Real-time USDT Status Toggle */}
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
                        <span>{codesForm.usdtPayoutEnabled ? 'USDT RAIL: ACTIVE' : 'USDT RAIL: PAUSED'}</span>
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
                        <span className="text-[11px] font-mono text-neutral-500">
                          Default: $20.00 (≈ ₹{(Number(codesForm.usdtMinWithdrawalUsd || 20) * Number(codesForm.usdtToInrRate || 88.85)).toFixed(0)} INR)
                        </span>
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
                        <span className="text-[11px] font-mono text-neutral-500">
                          Default: 1.50% (Covers On-Chain Gas & Liquidity Settlement)
                        </span>
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
                        <label className="block text-xs font-medium mb-1">Supported USDT Networks</label>
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
                        <label className="block text-xs font-medium mb-1">Treasury Settlement Wallet</label>
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

                {/* Live Settlement Simulation & Fee Preview Bar */}
                <div className="p-4 rounded-xl bg-neutral-100/80 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono tabular-nums">
                  <div>
                    <p className="text-neutral-500">UPI Threshold Quote ($5.00):</p>
                    <p className="font-bold text-neutral-950 dark:text-white mt-0.5">
                      Min ${Number(codesForm.upiMinWithdrawalUsd).toFixed(2)} · Fee {Number(codesForm.upiFeePercent).toFixed(2)}% → Net ₹
                      {(
                        Number(codesForm.upiMinWithdrawalUsd) *
                        (1 - Number(codesForm.upiFeePercent) / 100) *
                        Number(inrRateInput || 86.45)
                      ).toFixed(2)}{' '}
                      INR
                    </p>
                  </div>
                  <div>
                    <p className="text-neutral-500">USDT Threshold Quote ($20.00 @ ₹{Number(codesForm.usdtToInrRate || 88.85).toFixed(2)}):</p>
                    <p className="font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                      Net{' '}
                      {(
                        Number(codesForm.usdtMinWithdrawalUsd) *
                        (1 - Number(codesForm.usdtFeePercent) / 100)
                      ).toFixed(2)}{' '}
                      USDT (≈ ₹
                      {(
                        Number(codesForm.usdtMinWithdrawalUsd) *
                        (1 - Number(codesForm.usdtFeePercent) / 100) *
                        Number(codesForm.usdtToInrRate || 88.85)
                      ).toFixed(2)}{' '}
                      INR)
                    </p>
                  </div>
                  <div className="flex items-center sm:justify-end">
                    <button
                      type="submit"
                      className="min-h-[40px] w-full sm:w-auto px-5 py-2 rounded-lg bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-sans font-semibold"
                    >
                      Apply & Persist Payout Rules
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}

          {/* E. ADVERTISING & F. SITE & INFRASTRUCTURE CONFIGURATION (FULL CODE & SCRIPT STUDIO) */}
          {(section === 'advertising' || section === 'site-config') && (
            <form onSubmit={handleSaveCustomCodes} className="space-y-6">
              <div className="p-6 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-neutral-950 dark:text-white">
                      Custom Code, VAST Ad Network & Dynamic CPM Tier Studio
                    </h2>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Add, edit, or replace any ad network code, VAST tag URL, dynamic CPM rate, header script, or payment/storage endpoint directly below. Changes apply across the entire platform immediately.
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold whitespace-nowrap"
                  >
                    Save All Codes & Dynamic CPM Tiers
                  </button>
                </div>

                {/* 1. Dynamic Ad-Intensity CPM Rates */}
                <div className="space-y-3">
                  <h3 className="text-xs font-mono uppercase text-blue-700 dark:text-blue-400 font-semibold">
                    1. Dynamic Ad-Intensity CPM Plan Rates (Landing Page & Player)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <span className="text-[11px] text-neutral-500">
                        Default: $3.00 (Maximum Potential Earning)
                      </span>
                    </div>
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
                      <span className="text-[11px] text-neutral-500">
                        Default: $2.00 (Standard Recommended)
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. VAST Tag URLs & Custom Ad Network Script Codes */}
                <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <h3 className="text-xs font-mono uppercase text-blue-700 dark:text-blue-400 font-semibold">
                    2. VAST 4.2 Video Ad Tags & Custom Ad / Analytics Code Injection
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

                {/* 3. Payment Gateway, S3 Object Storage & Site Endpoints */}
                <div className="space-y-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <h3 className="text-xs font-mono uppercase text-blue-700 dark:text-blue-400 font-semibold">
                    3. UPI Payout Gateway, Object Storage (S3/R2) & CDN Configuration
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
                    className="px-6 py-2.5 rounded-md bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 text-xs font-semibold"
                  >
                    Save All Custom Codes & Apply Live
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* G. SECURITY & AUDIT LOGS */}
          {section === 'security-audit' && (
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 bg-neutral-50 dark:bg-neutral-900/50">
                    <th className="py-2.5 px-4 font-medium">Actor UID & Role</th>
                    <th className="py-2.5 px-4 font-medium">Action</th>
                    <th className="py-2.5 px-4 font-medium">Entity</th>
                    <th className="py-2.5 px-4 font-medium">Audit Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {adminData.auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-3 px-4 font-mono">
                        {log.actorUid} ({log.actorRole})
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold">{log.action}</td>
                      <td className="py-3 px-4 font-mono">
                        {log.entityType} #{log.entityId}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-neutral-500">
                        {log.metadataJson}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
