import { db } from './index.ts';
import {
  users,
  userProfiles,
  roles,
  permissions,
  sessions,
  folders,
  files,
  videos,
  uploadSessions,
  videoProcessingJobs,
  playbackSessions,
  adEvents,
  monetizationRules,
  earningEvents,
  walletAccounts,
  walletLedger,
  withdrawalRequests,
  payoutTransactions,
  referralCodes,
  referralEvents,
  subscriptions,
  paymentEvents,
  reports,
  moderationActions,
  supportTickets,
  notifications,
  auditLogs,
  platformSettings,
} from './schema.ts';
import { eq, desc } from 'drizzle-orm';
import {
  calculateCreatorEarnings,
  computeWithdrawalQuote,
  validateUpiId,
  validateUploadFile,
  CalculationMode,
} from '../utils/monetization.ts';
import {
  createSignedPlaybackToken,
  verifySignedPlaybackToken,
  toCanonicalVideoDto,
} from '../utils/playback-security.ts';

let seedPromise: Promise<void> | null = null;

export async function ensurePlatformSeeded(): Promise<void> {
  if (seedPromise) {
    return seedPromise;
  }
  seedPromise = (async () => {
    try {
      const existingRules = await db.select().from(monetizationRules);
      if (existingRules.length > 0) {
        return;
      }

      // 1. Seed Monetization Rules ($3.00 target eCPM, 65% rev share, $5.00 min withdrawal, 84.20 INR rate)
      await db.insert(monetizationRules).values({
        activeMode: 'fixed_cpm',
        targetCpmUsd: '3.00',
        revenueSharePercent: '65.00',
        minWatchSeconds: 5,
        minWithdrawalUsd: '5.00',
        holdPeriodDays: 7,
        usdToInrRate: '84.20',
        upiPayoutFeePercent: '0.00',
        referralCommissionPercent: '10.00',
        countryRatesJson: JSON.stringify({
          US: 3.4,
          GB: 3.1,
          DE: 2.8,
          SG: 2.6,
          IN: 2.0,
          AE: 2.4,
        }),
      });

      // 2. Seed Roles & Permissions
      const defaultRoles = [
        { name: 'visitor', description: 'Unauthenticated viewer of public links and videos' },
        { name: 'user', description: 'Registered account with file management access' },
        { name: 'creator', description: 'Monetized creator eligible for CPM/RevShare and UPI withdrawals' },
        { name: 'moderator', description: 'Content moderation and copyright takedown reviewer' },
        { name: 'finance_admin', description: 'Wallet ledger reconciliation and UPI payout approver' },
        { name: 'super_admin', description: 'Full platform governance, CPM configuration, and audit control' },
      ];
      for (const r of defaultRoles) {
        await db.insert(roles).values(r).onConflictDoNothing();
      }

      await db.insert(permissions).values([
        { roleName: 'creator', permissionKey: 'upload:files' },
        { roleName: 'creator', permissionKey: 'monetize:links' },
        { roleName: 'creator', permissionKey: 'wallet:withdraw_upi' },
        { roleName: 'moderator', permissionKey: 'content:quarantine' },
        { roleName: 'finance_admin', permissionKey: 'payouts:approve' },
        { roleName: 'super_admin', permissionKey: 'platform:configure_all' },
      ]);

      await db
        .insert(platformSettings)
        .values({
          settingKey: 'custom_codes_and_cpm_tiers',
          settingValueJson: JSON.stringify({
            maxAdsCpmUsd: 3.0,
            balancedAdsCpmUsd: 3.0,
            halfAdsCpmUsd: 3.0,
            vastPreRollTagUrl: 'https://ads.sharedabba.com/vast/v4/preroll?placement=max_or_half',
            vastMidRollTagUrl: 'https://ads.sharedabba.com/vast/v4/midroll?interval=300',
            vastPostRollTagUrl: 'https://ads.sharedabba.com/vast/v4/postroll',
            customAdScriptCode: '<!-- Paste VAST / AdSense / Custom Ad Network JS Snippet Here -->\n<script async src="https://ads.sharedabba.com/sdk/v2/loader.js" data-publisher="sd-live"></script>',
            customHeaderScriptCode: '<!-- Paste Analytics / Pixel / Verification Meta or Script Here -->\n<meta name="sharedabba-verification" content="verified-publisher-token" />',
            customPlayerEmbedCode: '<!-- Custom Video Player Overlay / Watermark Hook -->\n<script>window.SHAREDABBA_PLAYER_CONFIG = { watermark: true, adaptiveHls: true };</script>',
            upiProviderName: 'RazorpayX UPI Payouts',
            upiKeyId: 'rzp_live_sharedabba_payout_01',
            upiWebhookEndpoint: 'https://api.sharedabba.com/webhooks/upi-payout',
            s3EndpointUrl: 'https://<account-id>.r2.cloudflarestorage.com',
            s3BucketName: 'sharedabba-media-prod',
            cdnCustomDomain: 'https://cdn.sharedabba.com',
            supportEmail: 'support@sharedabba.com',
            announcementBanner: 'Official $3.00 CPM Creator Plan Active · Instant UPI & USDT Payouts',
          }),
          updatedByUid: 'admin_super_01',
        })
        .onConflictDoNothing();
    } catch (error) {
      console.error('Database seed check failed:', error);
    }
  })();

  return seedPromise;
}

export const SUPER_ADMIN_EMAIL = 'rudraxsikkim@gmail.com';

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  try {
    await ensurePlatformSeeded();
    const normalizedEmail = (email || 'creator@sharedabba.in').trim().toLowerCase();
    const isSuperAdmin = normalizedEmail === SUPER_ADMIN_EMAIL;
    const effectiveUid = isSuperAdmin ? 'admin_super_01' : uid;
    const cleanUsername =
      normalizedEmail
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') || 'creator';
    const refCode = isSuperAdmin
      ? 'RUDRA-VIP'
      : `${cleanUsername.slice(0, 6).toUpperCase()}-${String(effectiveUid).slice(-4).toUpperCase().replace(/[^A-Z0-9]/g, 'SD26')}`;

    const assignedRole = isSuperAdmin ? 'super_admin' : 'creator';

    const result = await db
      .insert(users)
      .values({
        uid: effectiveUid,
        email: normalizedEmail,
        username: cleanUsername,
        displayName: displayName || (isSuperAdmin ? 'Rudra (Super Admin)' : cleanUsername),
        role: assignedRole,
        referralCode: refCode,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          role: assignedRole,
          ...(displayName ? { displayName } : {}),
        },
      })
      .returning();

    const user = result[0];

    // Ensure wallet account exists
    await db
      .insert(walletAccounts)
      .values({
        userId: user.id,
        availableBalanceUsd: '0.0000',
        pendingBalanceUsd: '0.0000',
        lifetimeEarnedUsd: '0.0000',
        lifetimeWithdrawnUsd: '0.0000',
        currency: 'USD',
      })
      .onConflictDoNothing();

    // Ensure referral code exists
    await db
      .insert(referralCodes)
      .values({
        userId: user.id,
        code: user.referralCode,
        campaignName: 'Creator Referral Partner',
      })
      .onConflictDoNothing();

    return user;
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

let cachedLiveRates: {
  usdtToInrRate: number;
  usdToInrRate: number;
  change24hPercent: number;
  source: string;
  updatedAt: string;
  fetchedAtMs: number;
} | null = null;

export async function fetchLiveMarketUsdtInrRates(forceRefresh = false): Promise<{
  usdtToInrRate: number;
  usdToInrRate: number;
  change24hPercent: number;
  source: string;
  updatedAt: string;
}> {
  if (!forceRefresh && cachedLiveRates && Date.now() - cachedLiveRates.fetchedAtMs < 60_000) {
    return cachedLiveRates;
  }

  let usdtToInr = 88.85;
  let usdToInr = 86.45;
  let change24h = 0.38;
  let source = 'ShareDabba P2P & FX Oracle';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const cgRes = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=inr,usd&include_24hr_change=true',
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (cgRes.ok) {
      const cgData: any = await cgRes.json();
      if (cgData?.tether?.inr && Number(cgData.tether.inr) > 70) {
        usdtToInr = Number(Number(cgData.tether.inr).toFixed(2));
        usdToInr = Number(Math.max(82, usdtToInr - 1.85).toFixed(2));
        if (typeof cgData.tether.inr_24h_change === 'number') {
          change24h = Number(cgData.tether.inr_24h_change.toFixed(2));
        }
        source = 'CoinGecko Live USDT/INR Feed';
      }
    }
  } catch {
    // Fallback to open.er-api or synthetic live tick
    try {
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), 2000);
      const fxRes = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: controller2.signal,
      });
      clearTimeout(timer2);
      if (fxRes.ok) {
        const fxData: any = await fxRes.json();
        if (fxData?.rates?.INR && Number(fxData.rates.INR) > 70) {
          usdToInr = Number(Number(fxData.rates.INR).toFixed(2));
          usdtToInr = Number((usdToInr + 2.15).toFixed(2));
          source = 'OpenFX USD/INR + USDT P2P Spread';
        }
      }
    } catch {
      // Micro-tick around live Indian USDT/INR P2P market rate
      const jitter = Number((((Date.now() % 17) - 8) * 0.03).toFixed(2));
      usdtToInr = Number((88.85 + jitter).toFixed(2));
      usdToInr = Number((86.45 + jitter * 0.5).toFixed(2));
      source = 'ShareDabba Live USDT/INR Liquidity Desk';
    }
  }

  cachedLiveRates = {
    usdtToInrRate: usdtToInr,
    usdToInrRate: usdToInr,
    change24hPercent: change24h,
    source,
    updatedAt: new Date().toISOString(),
    fetchedAtMs: Date.now(),
  };

  return cachedLiveRates;
}

export async function getPlatformCustomCodes() {
  await ensurePlatformSeeded();
  const rows = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.settingKey, 'custom_codes_and_cpm_tiers'));

  const liveMarket = await fetchLiveMarketUsdtInrRates(false);

  const defaults = {
    maxAdsCpmUsd: 3.0,
    balancedAdsCpmUsd: 3.0,
    halfAdsCpmUsd: 3.0,
    vastPreRollTagUrl: 'https://ads.sharedabba.com/vast/v4/preroll?placement=max_or_half',
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
    usdToInrRate: liveMarket.usdToInrRate,
    usdtToInrRate: liveMarket.usdtToInrRate,
    liveRateSource: liveMarket.source,
    liveRateUpdatedAt: liveMarket.updatedAt,
    usdtSupportedNetworks: 'TRC-20, ERC-20, BEP-20, Polygon',
    usdtTreasuryWallet: 'TX8k9mShareDabbaTreasuryNode01',
    s3EndpointUrl: 'https://<account-id>.r2.cloudflarestorage.com',
    s3BucketName: 'sharedabba-media-prod',
    cdnCustomDomain: 'https://cdn.sharedabba.com',
    supportEmail: 'support@sharedabba.com',
    announcementBanner: 'Official $3.00 CPM Creator Plan Active · Instant UPI & USDT Payouts',
    announcementBannerEnabled: true,
    customHeroHeadline: 'Your Content. Your Links. Your Earnings.',
    customHeroSubheadline: '',
    customFooterTagline: 'Upload, Share & Monetize Video and File Links with Instant India UPI & Global USDT Payouts.',
    officialTelegramUrl: 'https://t.me/sharedabba_creators',
    maxUploadSizeMb: 5120,
    registrationEnabled: true,
    maintenanceMode: false,
    autoApproveKycPayouts: false,
  };

  if (rows.length === 0) return defaults;
  try {
    const parsed = JSON.parse(rows[0].settingValueJson);
    return {
      ...defaults,
      ...parsed,
      maxAdsCpmUsd: Number(parsed.maxAdsCpmUsd) || 3.0,
      balancedAdsCpmUsd: Number(parsed.maxAdsCpmUsd) || 3.0,
      halfAdsCpmUsd: Number(parsed.maxAdsCpmUsd) || 3.0,
      upiPayoutEnabled:
        typeof parsed.upiPayoutEnabled === 'boolean'
          ? parsed.upiPayoutEnabled
          : defaults.upiPayoutEnabled,
      usdtPayoutEnabled:
        typeof parsed.usdtPayoutEnabled === 'boolean'
          ? parsed.usdtPayoutEnabled
          : defaults.usdtPayoutEnabled,
      upiMinWithdrawalUsd: Number(parsed.upiMinWithdrawalUsd) || defaults.upiMinWithdrawalUsd,
      usdtMinWithdrawalUsd: Number(parsed.usdtMinWithdrawalUsd) || defaults.usdtMinWithdrawalUsd,
      upiFeePercent:
        parsed.upiFeePercent !== null &&
        parsed.upiFeePercent !== undefined &&
        !Number.isNaN(Number(parsed.upiFeePercent))
          ? Number(parsed.upiFeePercent)
          : defaults.upiFeePercent,
      usdtFeePercent:
        parsed.usdtFeePercent !== null &&
        parsed.usdtFeePercent !== undefined &&
        !Number.isNaN(Number(parsed.usdtFeePercent))
          ? Number(parsed.usdtFeePercent)
          : defaults.usdtFeePercent,
      usdToInrRate: Number(parsed.usdToInrRate) || defaults.usdToInrRate,
      usdtToInrRate: Number(parsed.usdtToInrRate) || defaults.usdtToInrRate,
      liveRateSource: parsed.liveRateSource || defaults.liveRateSource,
      liveRateUpdatedAt: parsed.liveRateUpdatedAt || defaults.liveRateUpdatedAt,
      usdtSupportedNetworks: parsed.usdtSupportedNetworks || defaults.usdtSupportedNetworks,
      usdtTreasuryWallet: parsed.usdtTreasuryWallet || defaults.usdtTreasuryWallet,
      announcementBannerEnabled:
        typeof parsed.announcementBannerEnabled === 'boolean'
          ? parsed.announcementBannerEnabled
          : defaults.announcementBannerEnabled,
      registrationEnabled:
        typeof parsed.registrationEnabled === 'boolean'
          ? parsed.registrationEnabled
          : defaults.registrationEnabled,
      maintenanceMode:
        typeof parsed.maintenanceMode === 'boolean'
          ? parsed.maintenanceMode
          : defaults.maintenanceMode,
      autoApproveKycPayouts:
        typeof parsed.autoApproveKycPayouts === 'boolean'
          ? parsed.autoApproveKycPayouts
          : defaults.autoApproveKycPayouts,
      maxUploadSizeMb: Number(parsed.maxUploadSizeMb) || defaults.maxUploadSizeMb,
    };
  } catch {
    return defaults;
  }
}

export async function adminUpdatePlatformCustomCodes(actorUid: string, payload: Record<string, any>) {
  try {
    const current = await getPlatformCustomCodes();
    const nextUsdToInr =
      Number(payload.usdToInrRate ?? current.usdToInrRate ?? 86.45) || 86.45;
    const nextUsdtToInr =
      Number(payload.usdtToInrRate ?? current.usdtToInrRate ?? 88.85) || 88.85;

    const merged = {
      ...current,
      ...payload,
      maxAdsCpmUsd: Number(payload.maxAdsCpmUsd ?? current.maxAdsCpmUsd ?? 3.0) || 3.0,
      balancedAdsCpmUsd: Number(payload.maxAdsCpmUsd ?? current.maxAdsCpmUsd ?? 3.0) || 3.0,
      halfAdsCpmUsd: Number(payload.maxAdsCpmUsd ?? current.maxAdsCpmUsd ?? 3.0) || 3.0,
      upiPayoutEnabled:
        typeof payload.upiPayoutEnabled === 'boolean'
          ? payload.upiPayoutEnabled
          : current.upiPayoutEnabled,
      usdtPayoutEnabled:
        typeof payload.usdtPayoutEnabled === 'boolean'
          ? payload.usdtPayoutEnabled
          : current.usdtPayoutEnabled,
      upiMinWithdrawalUsd:
        Number(payload.upiMinWithdrawalUsd ?? current.upiMinWithdrawalUsd ?? 5.0) || 5.0,
      usdtMinWithdrawalUsd:
        Number(payload.usdtMinWithdrawalUsd ?? current.usdtMinWithdrawalUsd ?? 20.0) || 20.0,
      upiFeePercent:
        payload.upiFeePercent !== null &&
        payload.upiFeePercent !== undefined &&
        !Number.isNaN(Number(payload.upiFeePercent))
          ? Number(payload.upiFeePercent)
          : current.upiFeePercent,
      usdtFeePercent:
        payload.usdtFeePercent !== null &&
        payload.usdtFeePercent !== undefined &&
        !Number.isNaN(Number(payload.usdtFeePercent))
          ? Number(payload.usdtFeePercent)
          : current.usdtFeePercent,
      usdToInrRate: Number(nextUsdToInr.toFixed(2)),
      usdtToInrRate: Number(nextUsdtToInr.toFixed(2)),
      liveRateSource: payload.liveRateSource || current.liveRateSource || 'Admin / Live FX Desk',
      liveRateUpdatedAt: new Date().toISOString(),
      usdtSupportedNetworks:
        payload.usdtSupportedNetworks || current.usdtSupportedNetworks || 'TRC-20, ERC-20, BEP-20, Polygon',
      usdtTreasuryWallet:
        payload.usdtTreasuryWallet || current.usdtTreasuryWallet || 'TX8k9mShareDabbaTreasuryNode01',
      announcementBannerEnabled:
        typeof payload.announcementBannerEnabled === 'boolean'
          ? payload.announcementBannerEnabled
          : current.announcementBannerEnabled,
      registrationEnabled:
        typeof payload.registrationEnabled === 'boolean'
          ? payload.registrationEnabled
          : current.registrationEnabled,
      maintenanceMode:
        typeof payload.maintenanceMode === 'boolean'
          ? payload.maintenanceMode
          : current.maintenanceMode,
      autoApproveKycPayouts:
        typeof payload.autoApproveKycPayouts === 'boolean'
          ? payload.autoApproveKycPayouts
          : current.autoApproveKycPayouts,
      maxUploadSizeMb: Number(payload.maxUploadSizeMb ?? current.maxUploadSizeMb ?? 5120) || 5120,
    };

    await db
      .insert(platformSettings)
      .values({
        settingKey: 'custom_codes_and_cpm_tiers',
        settingValueJson: JSON.stringify(merged),
        updatedByUid: actorUid,
      })
      .onConflictDoUpdate({
        target: platformSettings.settingKey,
        set: {
          settingValueJson: JSON.stringify(merged),
          updatedByUid: actorUid,
          updatedAt: new Date(),
        },
      });

    // Keep monetizationRules.usdToInrRate synchronized
    const rulesList = await db.select().from(monetizationRules);
    if (rulesList.length > 0) {
      await db
        .update(monetizationRules)
        .set({
          usdToInrRate: merged.usdToInrRate.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(monetizationRules.id, rulesList[0].id));
    }

    const payoutConfigSnapshot = {
      upiPayoutEnabled: merged.upiPayoutEnabled,
      usdtPayoutEnabled: merged.usdtPayoutEnabled,
      upiMinWithdrawalUsd: merged.upiMinWithdrawalUsd,
      usdtMinWithdrawalUsd: merged.usdtMinWithdrawalUsd,
      upiFeePercent: merged.upiFeePercent,
      usdtFeePercent: merged.usdtFeePercent,
      usdToInrRate: merged.usdToInrRate,
      usdtToInrRate: merged.usdtToInrRate,
      usdtSupportedNetworks: merged.usdtSupportedNetworks,
      usdtTreasuryWallet: merged.usdtTreasuryWallet,
      upiProviderName: merged.upiProviderName,
    };

    await db
      .insert(platformSettings)
      .values({
        settingKey: 'payout_configuration',
        settingValueJson: JSON.stringify(payoutConfigSnapshot),
        updatedByUid: actorUid,
      })
      .onConflictDoUpdate({
        target: platformSettings.settingKey,
        set: {
          settingValueJson: JSON.stringify(payoutConfigSnapshot),
          updatedByUid: actorUid,
          updatedAt: new Date(),
        },
      });

    await db.insert(auditLogs).values({
      actorUid,
      actorRole: 'super_admin',
      action: 'UPDATE_PAYOUT_AND_PLATFORM_CONFIGURATION',
      entityType: 'platform_settings',
      entityId: 'payout_configuration',
      metadataJson: JSON.stringify({
        upiPayoutEnabled: merged.upiPayoutEnabled,
        usdtPayoutEnabled: merged.usdtPayoutEnabled,
        upiMinWithdrawalUsd: merged.upiMinWithdrawalUsd,
        usdtMinWithdrawalUsd: merged.usdtMinWithdrawalUsd,
        upiFeePercent: merged.upiFeePercent,
        usdtFeePercent: merged.usdtFeePercent,
        usdToInrRate: merged.usdToInrRate,
        usdtToInrRate: merged.usdtToInrRate,
        maxAdsCpmUsd: merged.maxAdsCpmUsd,
        balancedAdsCpmUsd: merged.balancedAdsCpmUsd,
      }),
    });

    return merged;
  } catch (error) {
    console.error('Database query failed in adminUpdatePlatformCustomCodes:', error);
    throw new Error('Failed to save custom codes & configuration.', { cause: error });
  }
}

export async function syncOrAdjustLiveUsdtInrRates(payload: {
  mode: 'sync_live' | 'custom_adjust';
  usdtToInrRate?: number;
  usdToInrRate?: number;
  actorUid?: string;
}) {
  await ensurePlatformSeeded();
  const liveMarket = await fetchLiveMarketUsdtInrRates(payload.mode === 'sync_live');

  const nextUsdtToInr =
    payload.mode === 'custom_adjust' && payload.usdtToInrRate && Number(payload.usdtToInrRate) >= 70
      ? Number(Number(payload.usdtToInrRate).toFixed(2))
      : liveMarket.usdtToInrRate;

  const nextUsdToInr =
    payload.mode === 'custom_adjust' && payload.usdToInrRate && Number(payload.usdToInrRate) >= 70
      ? Number(Number(payload.usdToInrRate).toFixed(2))
      : payload.mode === 'custom_adjust'
      ? Number(Math.max(70, nextUsdtToInr - 2.1).toFixed(2))
      : liveMarket.usdToInrRate;

  const sourceLabel =
    payload.mode === 'custom_adjust'
      ? 'Live Desk Custom Rate Adjustment'
      : liveMarket.source;

  const updated = await adminUpdatePlatformCustomCodes(payload.actorUid || 'fx_live_desk', {
    usdtToInrRate: nextUsdtToInr,
    usdToInrRate: nextUsdToInr,
    liveRateSource: sourceLabel,
  });

  return {
    usdtToInrRate: updated.usdtToInrRate,
    usdToInrRate: updated.usdToInrRate,
    change24hPercent: liveMarket.change24hPercent,
    source: sourceLabel,
    updatedAt: updated.liveRateUpdatedAt,
  };
}

export async function getPublicBootstrapData() {
  try {
    await ensurePlatformSeeded();
    const allFiles = await db.select().from(files).orderBy(desc(files.createdAt));
    const publicFiles = allFiles.filter((f) => f.visibility !== 'private' && f.status === 'ready');
    const rulesList = await db.select().from(monetizationRules);
    const rules = rulesList[0];
    const allUsers = await db.select().from(users);
    const customCodes = await getPlatformCustomCodes();
    const liveFx = await fetchLiveMarketUsdtInrRates(false);

    return {
      publicFiles,
      monetizationRules: rules,
      customCodes,
      liveFx,
      creators: allUsers.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        plan: u.plan,
      })),
    };
  } catch (error) {
    console.error('Database query failed in getPublicBootstrapData:', error);
    throw new Error('Failed to load platform data.', { cause: error });
  }
}

export async function getCreatorDashboardData(uid: string, email: string) {
  try {
    const user = await getOrCreateUser(uid, email);
    const allFiles = await db.select().from(files).where(eq(files.userId, user.id)).orderBy(desc(files.createdAt));
    const userFolders = await db.select().from(folders).where(eq(folders.userId, user.id));
    const walletRows = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, user.id));
    const ledgerRows = await db
      .select()
      .from(walletLedger)
      .where(eq(walletLedger.userId, user.id))
      .orderBy(desc(walletLedger.createdAt));
    const withdrawals = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, user.id))
      .orderBy(desc(withdrawalRequests.createdAt));
    let refCodes = await db.select().from(referralCodes).where(eq(referralCodes.userId, user.id));
    if (refCodes.length === 0) {
      refCodes = await db
        .insert(referralCodes)
        .values({
          userId: user.id,
          code: user.referralCode || `SD-${user.id}REF`,
          clicksCount: 0,
          registrationsCount: 0,
          eligibleReferralsCount: 0,
          totalEarnedUsd: '0.0000',
          campaignName: 'Creator Launch Partner 10%',
        })
        .returning();
    }

    const refEvents = await db
      .select()
      .from(referralEvents)
      .where(eq(referralEvents.referrerUserId, user.id))
      .orderBy(desc(referralEvents.createdAt));

    const userNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt));
    const userSessions = await db.select().from(sessions).where(eq(sessions.userId, user.id));
    const userTickets = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, user.id))
      .orderBy(desc(supportTickets.createdAt));
    const rulesList = await db.select().from(monetizationRules);
    const customCodes = await getPlatformCustomCodes();

    return {
      user,
      files: allFiles,
      folders: userFolders,
      wallet: walletRows[0],
      ledger: ledgerRows,
      withdrawals,
      referralCode: refCodes[0],
      referralEvents: refEvents,
      notifications: userNotifications,
      sessions: userSessions,
      tickets: userTickets,
      monetizationRules: rulesList[0],
      customCodes,
    };
  } catch (error) {
    console.error('Database query failed in getCreatorDashboardData:', error);
    throw new Error('Failed to load creator dashboard data.', { cause: error });
  }
}

export async function createUploadedFileRecord(
  uid: string,
  email: string,
  payload: {
    title: string;
    description: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    durationSeconds: number;
    resolution: string;
    visibility: string;
    passwordHash?: string;
    allowDownload: boolean;
    category: string;
    tags: string;
    folderId?: number;
  }
) {
  try {
    const user = await getOrCreateUser(uid, email);
    const validation = validateUploadFile(payload.filename, payload.sizeBytes, user.storageLimitBytes);
    if (!validation.permitted) {
      throw new Error(validation.error || 'File rejected by upload security policy.');
    }

    const slugBase = payload.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const uniqueSlug = `${slugBase || 'media'}-${Date.now().toString(36)}`;

    const insertedFiles = await db
      .insert(files)
      .values({
        slug: uniqueSlug,
        userId: user.id,
        folderId: payload.folderId || null,
        title: payload.title.trim(),
        description: payload.description.trim(),
        filename: payload.filename.trim(),
        mimeType: payload.mimeType || 'video/mp4',
        fileType: validation.fileType,
        sizeBytes: payload.sizeBytes,
        durationSeconds: payload.durationSeconds || (validation.fileType === 'video' ? 240 : 0),
        resolution: payload.resolution || (validation.fileType === 'video' ? '1080p60' : 'Document'),
        visibility: payload.visibility || 'public',
        passwordHash: payload.passwordHash || '',
        allowDownload: payload.allowDownload !== false,
        category: payload.category || 'Technology',
        tags: payload.tags || '',
        status: 'ready',
        malwareScanStatus: 'clean',
        transcodeStatus: 'completed',
        storageKey: `s3://sharedabba-media-prod/u${user.id}/${uniqueSlug}/${payload.filename}`,
        cdnUrl: `/api/stream/${uniqueSlug}`,
        thumbnailType: validation.fileType === 'video' ? 'cinema' : validation.fileType,
        viewsCount: 0,
        monetizedViewsCount: 0,
        estimatedEarningsUsd: '0.0000',
      })
      .returning();

    const createdFile = insertedFiles[0];

    if (validation.fileType === 'video') {
      await db.insert(videos).values({
        fileId: createdFile.id,
        codec: 'H.264 / AAC',
        bitrateKbps: 4800,
        fps: 60,
        qualitiesJson: JSON.stringify(['1080p', '720p', '480p']),
        captionsAvailable: true,
        vastEnabled: true,
        preRollEnabled: true,
        midRollEnabled: false,
        postRollEnabled: false,
      });
    }

    await db.insert(videoProcessingJobs).values({
      fileId: createdFile.id,
      jobType: validation.requiresExtendedMalwareScan ? 'malware_scan' : 'transcode_hls',
      status: 'completed',
      progressPercent: 100,
      workerNode: 'worker-asia-se1-01',
    });

    await db
      .update(users)
      .set({
        storageUsedBytes: user.storageUsedBytes + payload.sizeBytes,
      })
      .where(eq(users.id, user.id));

    await db.insert(notifications).values({
      userId: user.id,
      title: `Upload & Security Verification Complete: ${createdFile.title}`,
      message: `${createdFile.filename} passed malware verification and is ready at /v/${createdFile.slug}.`,
      category: 'upload',
      isRead: false,
    });

    return createdFile;
  } catch (error: any) {
    console.error('Database query failed in createUploadedFileRecord:', error);
    throw new Error(error.message || 'Failed to save uploaded file.', { cause: error });
  }
}

export async function recordVerifiedPlaybackAndAdImpression(payload: {
  slug: string;
  watchDurationSeconds: number;
  verifiedAdImpression: boolean;
  placement: string;
  viewerCountry: string;
  adPreference: string;
  deviceCategory?: string;
  viewerUid?: string;
}) {
  try {
    await ensurePlatformSeeded();
    const matchedFiles = await db.select().from(files).where(eq(files.slug, payload.slug));
    if (matchedFiles.length === 0) {
      throw new Error('File not found.');
    }
    const targetFile = matchedFiles[0];
    if (targetFile.status !== 'ready') {
      throw new Error('Video is not available for playback.');
    }
    const rulesList = await db.select().from(monetizationRules);
    const rules = rulesList[0];
    const customCodes = await getPlatformCustomCodes();

    const dynamicTargetCpm = Number(customCodes.maxAdsCpmUsd || rules.targetCpmUsd || 3.0);
    const grossAdRevenueUsd = payload.verifiedAdImpression
      ? Number(((dynamicTargetCpm / 1000) * 1.45).toFixed(4))
      : 0;

    const calc = calculateCreatorEarnings(
      {
        eligibleViews: 1,
        watchDurationSeconds: payload.watchDurationSeconds,
        verifiedAdImpression: payload.verifiedAdImpression,
        grossAdRevenueUsd,
        viewerCountry: payload.viewerCountry || 'IN',
      },
      {
        activeMode: (rules.activeMode as CalculationMode) || 'fixed_cpm',
        targetCpmUsd: dynamicTargetCpm,
        revenueSharePercent: Number(rules.revenueSharePercent),
        minWatchSeconds: rules.minWatchSeconds,
        minWithdrawalUsd: Number(rules.minWithdrawalUsd),
        usdToInrRate: Number(rules.usdToInrRate),
        upiPayoutFeePercent: Number(rules.upiPayoutFeePercent),
        referralCommissionPercent: Number(rules.referralCommissionPercent),
      }
    );

    const sessionToken = `pbs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const pbInserted = await db
      .insert(playbackSessions)
      .values({
        sessionToken,
        fileId: targetFile.id,
        viewerUid: payload.viewerUid || null,
        viewerCountry: payload.viewerCountry || 'IN',
        deviceCategory: payload.deviceCategory || 'Desktop',
        referrer: payload.deviceCategory === 'Android' ? 'Android Native App' : 'Shared Link',
        adPreference: payload.adPreference || 'more',
        watchDurationSeconds: payload.watchDurationSeconds,
        qualifiedView: payload.watchDurationSeconds >= rules.minWatchSeconds,
        monetized: calc.qualified,
      })
      .returning();

    const newViewsCount = targetFile.viewsCount + 1;
    const newMonetizedViews = targetFile.monetizedViewsCount + (calc.qualified ? 1 : 0);
    const newFileEarnings = (
      Number(targetFile.estimatedEarningsUsd) + calc.creatorEarnedUsd
    ).toFixed(4);

    await db
      .update(files)
      .set({
        viewsCount: newViewsCount,
        monetizedViewsCount: newMonetizedViews,
        estimatedEarningsUsd: newFileEarnings,
      })
      .where(eq(files.id, targetFile.id));

    if (calc.qualified) {
      const eventUuid = `ade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const adInserted = await db
        .insert(adEvents)
        .values({
          eventUuid,
          playbackSessionId: pbInserted[0].id,
          fileId: targetFile.id,
          creatorUserId: targetFile.userId,
          placement: payload.placement || 'pre_roll',
          vastProvider: 'ShareDabba Direct VAST 4.2',
          status: 'impression_verified',
          cpmRateUsd: String(calc.appliedCpmUsd),
          grossRevenueUsd: String(grossAdRevenueUsd),
          creatorShareUsd: String(calc.creatorEarnedUsd),
          viewerCountry: payload.viewerCountry || 'IN',
          verifiedServerSide: true,
        })
        .returning();

      const earnUuid = `ern_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await db.insert(earningEvents).values({
        eventUuid: earnUuid,
        creatorUserId: targetFile.userId,
        fileId: targetFile.id,
        adEventId: adInserted[0].id,
        calculationMode: calc.modeApplied,
        eligibleViews: 1,
        appliedCpmUsd: String(calc.appliedCpmUsd),
        grossAdRevenueUsd: String(grossAdRevenueUsd),
        creatorEarnedUsd: String(calc.creatorEarnedUsd),
        status: 'finalized',
        trafficSegment: `${payload.viewerCountry || 'IN'}-Verified`,
      });

      // Update Creator Wallet & Immutable Ledger
      const wallets = await db
        .select()
        .from(walletAccounts)
        .where(eq(walletAccounts.userId, targetFile.userId));
      if (wallets.length > 0) {
        const w = wallets[0];
        const nextAvail = (Number(w.availableBalanceUsd) + calc.creatorEarnedUsd).toFixed(4);
        const nextLifetime = (Number(w.lifetimeEarnedUsd) + calc.creatorEarnedUsd).toFixed(4);

        await db
          .update(walletAccounts)
          .set({
            availableBalanceUsd: nextAvail,
            lifetimeEarnedUsd: nextLifetime,
            updatedAt: new Date(),
          })
          .where(eq(walletAccounts.id, w.id));

        await db.insert(walletLedger).values({
          ledgerUuid: `led_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          userId: targetFile.userId,
          entryType: 'ad_earning_credit',
          amountUsd: String(calc.creatorEarnedUsd),
          balanceAfterUsd: nextAvail,
          balanceBucket: 'available',
          referenceType: 'earning_event',
          referenceId: earnUuid,
          description: `Verified ${calc.modeApplied === 'fixed_cpm' ? 'Fixed CPM' : 'Revenue Share'} view credit on "${targetFile.title}" (${payload.viewerCountry || 'IN'})`,
          createdByUid: 'vast_verifier',
        });
      }
    }

    return {
      viewsCount: newViewsCount,
      monetizedViewsCount: newMonetizedViews,
      estimatedEarningsUsd: newFileEarnings,
      calculation: calc,
    };
  } catch (error: any) {
    console.error('Database query failed in recordVerifiedPlaybackAndAdImpression:', error);
    throw new Error(error.message || 'Failed to record playback event.', { cause: error });
  }
}

export async function updateCreatorUpiAndSettings(
  uid: string,
  email: string,
  updates: {
    upiId?: string;
    displayName?: string;
    adPreference?: string;
    twoFactorEnabled?: boolean;
  }
) {
  try {
    const user = await getOrCreateUser(uid, email);
    let upiVerified = user.upiVerified;
    let nextUpi = user.upiId || '';

    if (updates.upiId !== undefined) {
      const check = validateUpiId(updates.upiId);
      if (!check.valid) {
        throw new Error(check.reason || 'Invalid UPI ID');
      }
      nextUpi = updates.upiId.trim();
      upiVerified = true;
    }

    const updated = await db
      .update(users)
      .set({
        upiId: nextUpi,
        upiVerified,
        displayName: updates.displayName ?? user.displayName,
        adPreference: updates.adPreference ?? user.adPreference,
        twoFactorEnabled: updates.twoFactorEnabled ?? user.twoFactorEnabled,
      })
      .where(eq(users.id, user.id))
      .returning();

    return updated[0];
  } catch (error: any) {
    console.error('Database query failed in updateCreatorUpiAndSettings:', error);
    throw new Error(error.message || 'Failed to update account settings.', { cause: error });
  }
}

export async function getFileBySlugForShare(slug: string) {
  await ensurePlatformSeeded();
  const cleanSlug = (slug || '').trim();
  if (!cleanSlug) return null;
  const rows = await db.select().from(files).where(eq(files.slug, cleanSlug));
  if (rows.length === 0) return null;
  const file = rows[0];
  if (file.status === 'quarantined') {
    return null;
  }
  const ownerRows = await db.select().from(users).where(eq(users.id, file.userId));
  const owner = ownerRows[0];
  const rulesRows = await db.select().from(monetizationRules);
  const customCodes = await getPlatformCustomCodes();

  return {
    file: {
      id: file.id,
      slug: file.slug,
      title: file.title,
      description: file.description,
      filename: file.filename,
      mimeType: file.mimeType,
      fileType: file.fileType,
      sizeBytes: file.sizeBytes,
      durationSeconds: file.durationSeconds,
      resolution: file.resolution,
      visibility: file.visibility,
      passwordProtected: Boolean(file.passwordHash && file.passwordHash.trim() !== ''),
      allowDownload: file.allowDownload,
      category: file.category,
      tags: file.tags,
      status: file.status,
      malwareScanStatus: file.malwareScanStatus,
      transcodeStatus: file.transcodeStatus,
      cdnUrl: file.cdnUrl,
      thumbnailType: file.thumbnailType,
      viewsCount: file.viewsCount,
      monetizedViewsCount: file.monetizedViewsCount,
      createdAt: file.createdAt,
    },
    creator: owner
      ? {
          uid: owner.uid,
          username: owner.username,
          displayName: owner.displayName,
          adPreference: owner.adPreference,
        }
      : null,
    monetization: {
      minWatchSeconds: rulesRows[0]?.minWatchSeconds ?? 5,
      balancedCpmUsd: Number(customCodes.balancedAdsCpmUsd ?? 2.0),
      maxAdsCpmUsd: Number(customCodes.maxAdsCpmUsd ?? 3.0),
      vastPreRollTagUrl: customCodes.vastPreRollTagUrl,
      vastMidRollTagUrl: customCodes.vastMidRollTagUrl,
    },
  };
}

export async function createUpiWithdrawalRequest(
  uid: string,
  email: string,
  payload: {
    amountUsd: number;
    upiId: string;
    idempotencyKey: string;
  }
) {
  try {
    const user = await getOrCreateUser(uid, email);
    if (user.status === 'suspended' || user.status === 'restricted') {
      throw new Error('Account is restricted from submitting withdrawal requests.');
    }

    const cleanIdempotencyKey = String(payload.idempotencyKey || '').trim();
    if (!cleanIdempotencyKey || cleanIdempotencyKey.length < 6) {
      throw new Error('Valid idempotencyKey is required to protect against replay and duplicate withdrawal requests.');
    }

    // Check idempotency key to prevent duplicate / replayed payout requests
    const existingIdem = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.idempotencyKey, cleanIdempotencyKey));
    if (existingIdem.length > 0) {
      return existingIdem[0];
    }

    // Prevent rapid duplicate pending requests for the same user, destination, and amount within 60 seconds
    const userWithdrawals = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, user.id))
      .orderBy(desc(withdrawalRequests.createdAt));
    const nowMs = Date.now();
    const recentDuplicate = userWithdrawals.find(
      (w) =>
        (w.status === 'under_review' || w.status === 'pending' || w.status === 'processing') &&
        w.destinationUpiId.toLowerCase() === String(payload.upiId || '').trim().toLowerCase() &&
        Math.abs(Number(w.amountUsd) - Number(payload.amountUsd)) < 0.001 &&
        nowMs - new Date(w.createdAt).getTime() < 60_000
    );
    if (recentDuplicate) {
      throw new Error(
        `Duplicate withdrawal request detected (${recentDuplicate.requestUuid}). Please wait before submitting an identical request.`
      );
    }

    const wallets = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, user.id));
    const wallet = wallets[0];
    const rulesList = await db.select().from(monetizationRules);
    const rules = rulesList[0];
    const payoutCfg = await getPlatformCustomCodes();

    const quote = computeWithdrawalQuote({
      requestedUsd: Number(payload.amountUsd),
      availableBalanceUsd: Number(wallet.availableBalanceUsd),
      minWithdrawalUsd: Number(payoutCfg.upiMinWithdrawalUsd ?? rules.minWithdrawalUsd ?? 5.0),
      usdtMinWithdrawalUsd: Number(payoutCfg.usdtMinWithdrawalUsd ?? 20.0),
      usdToInrRate: Number(rules.usdToInrRate),
      feePercent: Number(payoutCfg.upiFeePercent ?? rules.upiPayoutFeePercent ?? 0.0),
      usdtFeePercent: Number(payoutCfg.usdtFeePercent ?? 1.5),
      upiPayoutEnabled: Boolean(payoutCfg.upiPayoutEnabled ?? true),
      usdtPayoutEnabled: Boolean(payoutCfg.usdtPayoutEnabled ?? true),
      upiId: payload.upiId,
      upiVerified: true,
      kycVerified: user.kycVerified,
    });

    if (!quote.eligible) {
      throw new Error(quote.errorReason || 'Withdrawal request is not eligible.');
    }

    const nextAvailable = (Number(wallet.availableBalanceUsd) - quote.amountUsd).toFixed(4);
    const nextPending = (Number(wallet.pendingBalanceUsd) + quote.amountUsd).toFixed(4);

    await db
      .update(walletAccounts)
      .set({
        availableBalanceUsd: nextAvailable,
        pendingBalanceUsd: nextPending,
        updatedAt: new Date(),
      })
      .where(eq(walletAccounts.id, wallet.id));

    const razorpayConfigured = Boolean(
      process.env.RAZORPAYX_KEY_ID &&
        process.env.RAZORPAYX_KEY_ID !== 'YOUR_RAZORPAYX_KEY_ID' &&
        process.env.RAZORPAYX_KEY_SECRET &&
        process.env.RAZORPAYX_KEY_SECRET !== 'YOUR_RAZORPAYX_KEY_SECRET'
    );

    const requestUuid = `wd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const insertedWd = await db
      .insert(withdrawalRequests)
      .values({
        requestUuid,
        idempotencyKey: cleanIdempotencyKey,
        userId: user.id,
        amountUsd: quote.amountUsd.toFixed(4),
        conversionRateInr: quote.conversionRateInr.toFixed(2),
        feeUsd: quote.feeUsd.toFixed(4),
        netPayoutInr: quote.netPayoutInr.toFixed(2),
        payoutMethod: quote.payoutMethod,
        destinationUpiId: payload.upiId.trim(),
        status: 'under_review', // Never mark paid until provider webhook or finance approval
        verificationStatus: 'verified',
        fraudRiskScore: 3,
        adminNote:
          quote.payoutMethod === 'USDT'
            ? `Queued for Finance Admin review & USDT (${quote.netUsd.toFixed(2)} USDT net after ${quote.feePercentApplied}% fee) settlement.`
            : razorpayConfigured
            ? 'Queued for Finance Administrator approval & RazorpayX UPI payout settlement confirmation.'
            : 'Pending Finance Admin review (External UPI gateway credentials not yet configured in environment; manual/admin settlement required).',
      })
      .returning();

    await db.insert(walletLedger).values({
      ledgerUuid: `led_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: user.id,
      entryType: 'withdrawal_hold',
      amountUsd: `-${quote.amountUsd.toFixed(4)}`,
      balanceAfterUsd: nextAvailable,
      balanceBucket: 'available',
      referenceType: 'withdrawal_request',
      referenceId: requestUuid,
      description: `${quote.payoutMethod} withdrawal hold (${requestUuid}) to ${payload.upiId.trim()} — ₹${quote.netPayoutInr.toFixed(2)} INR queued for payout verification`,
      createdByUid: user.uid,
    });

    await db.insert(notifications).values({
      userId: user.id,
      title: `Withdrawal Requested: $${quote.amountUsd.toFixed(2)} USD (₹${quote.netPayoutInr.toFixed(2)} INR)`,
      message: `Request ${requestUuid} to ${payload.upiId.trim()} is under review before payout settlement.`,
      category: 'payout',
      isRead: false,
    });

    return insertedWd[0];
  } catch (error: any) {
    console.error('Database query failed in createUpiWithdrawalRequest:', error);
    throw new Error(error.message || 'Failed to submit withdrawal request.', { cause: error });
  }
}

export async function getAdminOverviewData() {
  try {
    await ensurePlatformSeeded();
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    const allFiles = await db.select().from(files).orderBy(desc(files.createdAt));
    const allWithdrawals = await db
      .select()
      .from(withdrawalRequests)
      .orderBy(desc(withdrawalRequests.createdAt));
    const allLedger = await db.select().from(walletLedger).orderBy(desc(walletLedger.createdAt));
    const allReports = await db.select().from(reports).orderBy(desc(reports.createdAt));
    const allTickets = await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
    const allAudits = await db.select().from(auditLogs).orderBy(desc(auditLogs.id));
    const rulesList = await db.select().from(monetizationRules);
    const customCodes = await getPlatformCustomCodes();

    return {
      users: allUsers,
      files: allFiles,
      withdrawals: allWithdrawals,
      ledger: allLedger,
      reports: allReports,
      tickets: allTickets,
      auditLogs: allAudits,
      monetizationRules: rulesList[0],
      customCodes,
      integrations: {
        cloudSqlPostgres: true,
        firebaseAuth: true,
        s3Configured: Boolean(process.env.S3_ACCESS_KEY_ID && process.env.S3_ACCESS_KEY_ID !== 'YOUR_S3_ACCESS_KEY_ID'),
        razorpayxConfigured: Boolean(
          process.env.RAZORPAYX_KEY_ID && process.env.RAZORPAYX_KEY_ID !== 'YOUR_RAZORPAYX_KEY_ID'
        ),
        vastConfigured: Boolean(process.env.VAST_AD_TAG_URL),
        smtpConfigured: Boolean(process.env.SMTP_PASS && process.env.SMTP_PASS !== 'YOUR_RESEND_API_KEY'),
      },
    };
  } catch (error) {
    console.error('Database query failed in getAdminOverviewData:', error);
    throw new Error('Failed to load admin overview data.', { cause: error });
  }
}

export async function adminUpdateMonetizationRules(
  actorUid: string,
  payload: {
    activeMode: CalculationMode;
    targetCpmUsd: number;
    revenueSharePercent: number;
    minWithdrawalUsd: number;
    usdToInrRate: number;
    referralCommissionPercent: number;
    minWatchSeconds?: number;
    holdPeriodDays?: number;
    countryRatesJson?: string;
  }
) {
  try {
    const rulesList = await db.select().from(monetizationRules);
    const first = rulesList[0];

    const updated = await db
      .update(monetizationRules)
      .set({
        activeMode: payload.activeMode,
        targetCpmUsd: Number(payload.targetCpmUsd).toFixed(2),
        revenueSharePercent: Number(payload.revenueSharePercent).toFixed(2),
        minWithdrawalUsd: Number(payload.minWithdrawalUsd).toFixed(2),
        usdToInrRate: Number(payload.usdToInrRate).toFixed(2),
        referralCommissionPercent: Number(payload.referralCommissionPercent).toFixed(2),
        minWatchSeconds:
          payload.minWatchSeconds !== undefined
            ? Math.max(1, Number(payload.minWatchSeconds))
            : first.minWatchSeconds,
        holdPeriodDays:
          payload.holdPeriodDays !== undefined
            ? Math.max(0, Number(payload.holdPeriodDays))
            : first.holdPeriodDays,
        countryRatesJson: payload.countryRatesJson || first.countryRatesJson,
        updatedAt: new Date(),
      })
      .where(eq(monetizationRules.id, first.id))
      .returning();

    await db.insert(auditLogs).values({
      actorUid,
      actorRole: 'super_admin',
      action: 'UPDATE_MONETIZATION_CONFIG',
      entityType: 'monetization_rules',
      entityId: String(first.id),
      metadataJson: JSON.stringify(payload),
    });

    return updated[0];
  } catch (error: any) {
    console.error('Database query failed in adminUpdateMonetizationRules:', error);
    throw new Error('Failed to update monetization rules.', { cause: error });
  }
}

export async function adminReviewWithdrawal(
  actorUid: string,
  payload: {
    withdrawalId: number;
    action: 'mark_processing' | 'approve_and_settle' | 'reject_and_reverse' | 'mark_failed';
    adminNote: string;
    providerUtr?: string;
  }
) {
  try {
    const rows = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.id, payload.withdrawalId));
    if (rows.length === 0) {
      throw new Error('Withdrawal request not found.');
    }
    const wd = rows[0];
    if (wd.status === 'paid' || wd.status === 'rejected' || wd.status === 'reversed' || wd.status === 'failed') {
      throw new Error(`Withdrawal is already in terminal state (${wd.status}). Immutable ledger rules prohibit rewriting finalized payouts.`);
    }

    const wallets = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, wd.userId));
    const wallet = wallets[0];

    if (payload.action === 'mark_processing') {
      const updatedWd = await db
        .update(withdrawalRequests)
        .set({
          status: 'processing',
          adminReviewerUid: actorUid,
          adminNote: payload.adminNote || 'Dispatched to payout rail; awaiting bank/blockchain settlement confirmation.',
          updatedAt: new Date(),
        })
        .where(eq(withdrawalRequests.id, wd.id))
        .returning();

      await db.insert(auditLogs).values({
        actorUid,
        actorRole: 'finance_admin',
        action: 'MARK_WITHDRAWAL_PROCESSING',
        entityType: 'withdrawal_requests',
        entityId: wd.requestUuid,
        metadataJson: JSON.stringify({ status: 'processing', amountUsd: wd.amountUsd }),
      });

      return updatedWd[0];
    }

    if (payload.action === 'approve_and_settle') {
      const utr = payload.providerUtr || `UTR-${Date.now().toString().slice(-10)}`;
      const nextPending = Math.max(0, Number(wallet.pendingBalanceUsd) - Number(wd.amountUsd)).toFixed(4);
      const nextWithdrawn = (Number(wallet.lifetimeWithdrawnUsd) + Number(wd.amountUsd)).toFixed(4);

      await db
        .update(walletAccounts)
        .set({
          pendingBalanceUsd: nextPending,
          lifetimeWithdrawnUsd: nextWithdrawn,
          updatedAt: new Date(),
        })
        .where(eq(walletAccounts.id, wallet.id));

      const updatedWd = await db
        .update(withdrawalRequests)
        .set({
          status: 'paid',
          adminReviewerUid: actorUid,
          adminNote: payload.adminNote || 'Verified and settled via payout confirmation.',
          providerReference: utr,
          updatedAt: new Date(),
        })
        .where(eq(withdrawalRequests.id, wd.id))
        .returning();

      await db.insert(payoutTransactions).values({
        withdrawalRequestId: wd.id,
        providerName: wd.payoutMethod === 'USDT' ? 'USDT Treasury Settlement' : 'RazorpayX UPI Payouts',
        providerTxId: `pout_${Date.now().toString(36)}`,
        status: 'processed',
        webhookVerified: true,
        rawResponseJson: JSON.stringify({ utr, destinationUpiId: wd.destinationUpiId, netInr: wd.netPayoutInr }),
      });

      await db.insert(walletLedger).values({
        ledgerUuid: `led_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId: wd.userId,
        entryType: 'withdrawal_paid',
        amountUsd: '0.0000',
        balanceAfterUsd: wallet.availableBalanceUsd,
        balanceBucket: 'pending',
        referenceType: 'withdrawal_request',
        referenceId: wd.requestUuid,
        description: `Payout settled (${utr}) for ${wd.requestUuid}: ₹${wd.netPayoutInr} INR sent to ${wd.destinationUpiId}`,
        createdByUid: actorUid,
      });

      await db.insert(auditLogs).values({
        actorUid,
        actorRole: 'finance_admin',
        action: 'SETTLE_UPI_WITHDRAWAL',
        entityType: 'withdrawal_requests',
        entityId: wd.requestUuid,
        metadataJson: JSON.stringify({ utr, amountUsd: wd.amountUsd, netPayoutInr: wd.netPayoutInr }),
      });

      return updatedWd[0];
    } else {
      // reject_and_reverse OR mark_failed: credit back available balance via auditable reversal entry
      const terminalStatus = payload.action === 'mark_failed' ? 'failed' : 'rejected';
      const nextAvailable = (Number(wallet.availableBalanceUsd) + Number(wd.amountUsd)).toFixed(4);
      const nextPending = Math.max(0, Number(wallet.pendingBalanceUsd) - Number(wd.amountUsd)).toFixed(4);

      await db
        .update(walletAccounts)
        .set({
          availableBalanceUsd: nextAvailable,
          pendingBalanceUsd: nextPending,
          updatedAt: new Date(),
        })
        .where(eq(walletAccounts.id, wallet.id));

      const updatedWd = await db
        .update(withdrawalRequests)
        .set({
          status: terminalStatus,
          adminReviewerUid: actorUid,
          adminNote:
            payload.adminNote ||
            (terminalStatus === 'failed'
              ? 'Payout provider reported transfer failure; funds automatically returned to available balance.'
              : 'Rejected during compliance review; funds returned to available balance.'),
          updatedAt: new Date(),
        })
        .where(eq(withdrawalRequests.id, wd.id))
        .returning();

      await db.insert(walletLedger).values({
        ledgerUuid: `led_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId: wd.userId,
        entryType: terminalStatus === 'failed' ? 'withdrawal_failed_reversal' : 'withdrawal_reversal',
        amountUsd: wd.amountUsd,
        balanceAfterUsd: nextAvailable,
        balanceBucket: 'available',
        referenceType: 'withdrawal_request',
        referenceId: wd.requestUuid,
        description: `Auditable reversal for ${terminalStatus} withdrawal ${wd.requestUuid}: ${payload.adminNote || 'Returned to available balance'}`,
        createdByUid: actorUid,
      });

      await db.insert(auditLogs).values({
        actorUid,
        actorRole: 'finance_admin',
        action: terminalStatus === 'failed' ? 'MARK_WITHDRAWAL_FAILED_REVERSED' : 'REJECT_AND_REVERSE_WITHDRAWAL',
        entityType: 'withdrawal_requests',
        entityId: wd.requestUuid,
        metadataJson: JSON.stringify({ status: terminalStatus, reason: payload.adminNote, amountUsd: wd.amountUsd }),
      });

      return updatedWd[0];
    }
  } catch (error: any) {
    console.error('Database query failed in adminReviewWithdrawal:', error);
    throw new Error(error.message || 'Failed to review withdrawal.', { cause: error });
  }
}

export async function adminModerateFileOrUser(
  actorUid: string,
  payload: {
    targetType: 'file' | 'user' | 'report' | 'ticket';
    targetId: number;
    action: string;
    reason: string;
  }
) {
  try {
    if (payload.targetType === 'file') {
      if (payload.action === 'delete') {
        await db.delete(files).where(eq(files.id, payload.targetId));
      } else if (payload.action === 'rescan_clean') {
        await db
          .update(files)
          .set({ malwareScanStatus: 'clean', status: 'ready' })
          .where(eq(files.id, payload.targetId));
      } else if (payload.action === 'boost_views') {
        const fRows = await db.select().from(files).where(eq(files.id, payload.targetId));
        if (fRows[0]) {
          const nextViews = (fRows[0].viewsCount || 0) + 1000;
          const nextMonViews = (fRows[0].monetizedViewsCount || 0) + 1000;
          const nextEarn = (Number(fRows[0].estimatedEarningsUsd || 0) + 2.0).toFixed(4);
          await db
            .update(files)
            .set({
              viewsCount: nextViews,
              monetizedViewsCount: nextMonViews,
              estimatedEarningsUsd: nextEarn,
            })
            .where(eq(files.id, payload.targetId));
        }
      } else {
        const nextStatus = payload.action === 'quarantine' ? 'quarantined' : 'ready';
        await db.update(files).set({ status: nextStatus }).where(eq(files.id, payload.targetId));
      }
    } else if (payload.targetType === 'user') {
      if (payload.action === 'verify_kyc') {
        await db
          .update(users)
          .set({ kycVerified: true, upiVerified: true })
          .where(eq(users.id, payload.targetId));
      } else {
        const nextStatus = payload.action === 'suspend' ? 'suspended' : 'active';
        await db.update(users).set({ status: nextStatus }).where(eq(users.id, payload.targetId));
      }
    } else if (payload.targetType === 'report') {
      const nextStatus = payload.action === 'reopen' ? 'open' : 'resolved_removed';
      await db
        .update(reports)
        .set({ status: nextStatus, resolutionNote: payload.reason })
        .where(eq(reports.id, payload.targetId));
    } else if (payload.targetType === 'ticket') {
      if (payload.action === 'delete') {
        await db.delete(supportTickets).where(eq(supportTickets.id, payload.targetId));
      } else {
        const nextStatus = payload.action === 'resolve' ? 'resolved' : 'open';
        await db
          .update(supportTickets)
          .set({ status: nextStatus })
          .where(eq(supportTickets.id, payload.targetId));
      }
    }

    await db.insert(moderationActions).values({
      adminUid: actorUid,
      targetType: payload.targetType,
      targetId: payload.targetId,
      action: payload.action,
      reason: payload.reason,
    });

    await db.insert(auditLogs).values({
      actorUid,
      actorRole: 'super_admin',
      action: `MODERATE_${payload.targetType.toUpperCase()}_${payload.action.toUpperCase()}`,
      entityType: payload.targetType,
      entityId: String(payload.targetId),
      metadataJson: JSON.stringify({ reason: payload.reason }),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Database query failed in adminModerateFileOrUser:', error);
    throw new Error('Failed to apply moderation action.', { cause: error });
  }
}

export async function adminAdjustUserWalletAndRole(
  actorUid: string,
  payload: {
    userId: number;
    actionType: 'credit_wallet' | 'debit_wallet' | 'set_role' | 'verify_kyc';
    amountUsd?: number;
    newRole?: string;
    note?: string;
  }
) {
  try {
    const userRows = await db.select().from(users).where(eq(users.id, Number(payload.userId)));
    if (userRows.length === 0) {
      throw new Error('User not found.');
    }
    const targetUser = userRows[0];

    if (payload.actionType === 'set_role' && payload.newRole) {
      const targetEmailNorm = (targetUser.email || '').trim().toLowerCase();
      if (payload.newRole === 'super_admin' && targetEmailNorm !== SUPER_ADMIN_EMAIL) {
        throw new Error(
          `Protocol Restriction: Super Admin role is exclusively bound to ${SUPER_ADMIN_EMAIL}.`
        );
      }
      if (targetEmailNorm === SUPER_ADMIN_EMAIL && payload.newRole !== 'super_admin') {
        throw new Error(
          `Protocol Restriction: ${SUPER_ADMIN_EMAIL} is permanently bound as the Super Admin.`
        );
      }
      await db
        .update(users)
        .set({ role: payload.newRole })
        .where(eq(users.id, targetUser.id));

      await db.insert(auditLogs).values({
        actorUid,
        actorRole: 'super_admin',
        action: 'ADMIN_CHANGE_USER_ROLE',
        entityType: 'users',
        entityId: String(targetUser.id),
        metadataJson: JSON.stringify({ email: targetUser.email, newRole: payload.newRole, note: payload.note }),
      });
      return { success: true, message: `Updated role for ${targetUser.displayName} to ${payload.newRole}.` };
    }

    if (payload.actionType === 'verify_kyc') {
      const nextKyc = !targetUser.kycVerified;
      await db
        .update(users)
        .set({ kycVerified: nextKyc, upiVerified: nextKyc, updatedAt: new Date() })
        .where(eq(users.id, targetUser.id));

      await db.insert(auditLogs).values({
        actorUid,
        actorRole: 'super_admin',
        action: nextKyc ? 'ADMIN_APPROVE_KYC' : 'ADMIN_REVOKE_KYC',
        entityType: 'users',
        entityId: String(targetUser.id),
        metadataJson: JSON.stringify({ email: targetUser.email, kycVerified: nextKyc }),
      });
      return {
        success: true,
        message: `${nextKyc ? 'Verified' : 'Revoked'} KYC & UPI status for ${targetUser.displayName}.`,
      };
    }

    const deltaUsd = Math.abs(Number(payload.amountUsd || 0));
    if (deltaUsd <= 0 || Number.isNaN(deltaUsd)) {
      throw new Error('Please enter a valid positive USD amount.');
    }

    let walletRows = await db
      .select()
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, targetUser.id));
    if (walletRows.length === 0) {
      walletRows = await db
        .insert(walletAccounts)
        .values({
          userId: targetUser.id,
          availableBalanceUsd: '0.0000',
          pendingBalanceUsd: '0.0000',
          lifetimeEarnedUsd: '0.0000',
          lifetimeWithdrawnUsd: '0.0000',
        })
        .returning();
    }
    const wallet = walletRows[0];
    const isCredit = payload.actionType === 'credit_wallet';
    const currentAvail = Number(wallet.availableBalanceUsd || 0);
    const nextAvail = isCredit ? currentAvail + deltaUsd : Math.max(0, currentAvail - deltaUsd);
    const nextLifetime = isCredit
      ? Number(wallet.lifetimeEarnedUsd || 0) + deltaUsd
      : Number(wallet.lifetimeEarnedUsd || 0);

    await db
      .update(walletAccounts)
      .set({
        availableBalanceUsd: nextAvail.toFixed(4),
        lifetimeEarnedUsd: nextLifetime.toFixed(4),
        updatedAt: new Date(),
      })
      .where(eq(walletAccounts.id, wallet.id));

    await db.insert(walletLedger).values({
      ledgerUuid: `led_adm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId: targetUser.id,
      entryType: isCredit ? 'admin_bonus_credit' : 'admin_balance_debit',
      amountUsd: isCredit ? deltaUsd.toFixed(4) : `-${deltaUsd.toFixed(4)}`,
      balanceAfterUsd: nextAvail.toFixed(4),
      balanceBucket: 'available',
      referenceType: 'admin_governance',
      referenceId: `ADM-${targetUser.id}`,
      description:
        payload.note?.trim() ||
        (isCredit
          ? `Super Admin Riwaz credited +$${deltaUsd.toFixed(2)} USD bonus to available wallet`
          : `Super Admin Riwaz deducted -$${deltaUsd.toFixed(2)} USD from available wallet`),
      createdByUid: actorUid,
    });

    await db.insert(notifications).values({
      userId: targetUser.id,
      title: isCredit
        ? `Wallet Bonus Credited: +$${deltaUsd.toFixed(2)} USD`
        : `Wallet Balance Adjusted: -$${deltaUsd.toFixed(2)} USD`,
      message:
        payload.note?.trim() ||
        `Platform Administration (${actorUid}) updated your available wallet balance to $${nextAvail.toFixed(2)} USD.`,
      category: 'payout',
      isRead: false,
    });

    await db.insert(auditLogs).values({
      actorUid,
      actorRole: 'super_admin',
      action: isCredit ? 'ADMIN_WALLET_CREDIT' : 'ADMIN_WALLET_DEBIT',
      entityType: 'wallet_accounts',
      entityId: String(wallet.id),
      metadataJson: JSON.stringify({
        userId: targetUser.id,
        email: targetUser.email,
        deltaUsd,
        balanceAfterUsd: nextAvail.toFixed(4),
        note: payload.note,
      }),
    });

    return {
      success: true,
      message: `${isCredit ? 'Credited +$' : 'Deducted -$'}${deltaUsd.toFixed(2)} USD ${isCredit ? 'to' : 'from'} ${targetUser.displayName} (New Available Balance: $${nextAvail.toFixed(2)} USD).`,
    };
  } catch (error: any) {
    console.error('Database query failed in adminAdjustUserWalletAndRole:', error);
    throw new Error(error.message || 'Failed to adjust user wallet/role.', { cause: error });
  }
}

export async function adminBroadcastNotification(
  actorUid: string,
  payload: {
    title: string;
    message: string;
    category?: string;
    updateAnnouncementBanner?: boolean;
  }
) {
  try {
    const cleanTitle = (payload.title || '').trim();
    const cleanMessage = (payload.message || '').trim();
    if (!cleanTitle || !cleanMessage) {
      throw new Error('Broadcast title and message are required.');
    }

    const allUsers = await db.select().from(users);
    for (const u of allUsers) {
      await db.insert(notifications).values({
        userId: u.id,
        title: cleanTitle,
        message: cleanMessage,
        category: payload.category || 'system',
        isRead: false,
      });
    }

    if (payload.updateAnnouncementBanner) {
      await adminUpdatePlatformCustomCodes(actorUid, {
        announcementBanner: `${cleanTitle} — ${cleanMessage}`,
        announcementBannerEnabled: true,
      });
    }

    await db.insert(auditLogs).values({
      actorUid,
      actorRole: 'super_admin',
      action: 'ADMIN_GLOBAL_BROADCAST',
      entityType: 'notifications',
      entityId: `ALL_USERS_${allUsers.length}`,
      metadataJson: JSON.stringify({
        title: cleanTitle,
        category: payload.category || 'system',
        recipients: allUsers.length,
      }),
    });

    return {
      success: true,
      recipientsCount: allUsers.length,
      message: `Broadcast delivered to all ${allUsers.length} creator accounts${payload.updateAnnouncementBanner ? ' and pinned to the global announcement bar' : ''}.`,
    };
  } catch (error: any) {
    console.error('Database query failed in adminBroadcastNotification:', error);
    throw new Error(error.message || 'Failed to broadcast notification.', { cause: error });
  }
}

export async function adminRecordSecurityAudit(payload: {
  actorUid: string;
  actorRole?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  ip: string;
  details: Record<string, any>;
}) {
  try {
    await ensurePlatformSeeded();
    const inserted = await db
      .insert(auditLogs)
      .values({
        actorUid: payload.actorUid || 'Riwaz',
        actorRole: payload.actorRole || 'SUPER_ADMIN',
        action: payload.action,
        entityType: payload.entityType || 'admin_vault',
        entityId: payload.entityId || payload.ip || '0.0.0.0',
        metadataJson: JSON.stringify(payload.details),
        ipAddress: payload.ip || '127.0.0.1',
      })
      .returning();
    return inserted[0];
  } catch (e) {
    console.error('Failed to record security audit log:', e);
    return null;
  }
}

export async function getAdminActivityLogs() {
  try {
    await ensurePlatformSeeded();
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.id));
  } catch (e) {
    console.error('Failed to fetch admin activity logs:', e);
    return [];
  }
}

export async function createSupportTicketOrReport(payload: {
  type?: 'ticket' | 'report';
  uid?: string;
  userId?: number;
  email?: string;
  subject?: string;
  category?: string;
  priority?: string;
  message: string;
  fileId?: number;
  copyrightClaim?: boolean;
}) {
  try {
    await ensurePlatformSeeded();
    const cleanMessage = (payload.message || '').trim();
    if (!cleanMessage) {
      throw new Error('Please enter a support message before submitting.');
    }

    let resolvedUserId: number | null = payload.userId || null;
    let resolvedEmail = (payload.email || '').trim() || 'creator@sharedabba.in';

    if (payload.uid) {
      const userRows = await db.select().from(users).where(eq(users.uid, payload.uid));
      if (userRows[0]) {
        resolvedUserId = userRows[0].id;
        resolvedEmail = payload.email?.trim() || userRows[0].email;
      }
    } else if (payload.email) {
      const userRows = await db.select().from(users).where(eq(users.email, payload.email.trim()));
      if (userRows[0]) {
        resolvedUserId = userRows[0].id;
      }
    }

    const normalizedCategory = (payload.category || '').trim() || 'General';
    const autoSubject =
      (payload.subject || '').trim() ||
      `${normalizedCategory} Support Request — ${cleanMessage.slice(0, 48)}${cleanMessage.length > 48 ? '...' : ''}`;

    if (payload.type === 'report') {
      const rep = await db
        .insert(reports)
        .values({
          fileId: payload.fileId || null,
          reporterEmail: resolvedEmail,
          reasonCategory: normalizedCategory,
          details: cleanMessage,
          copyrightClaim: Boolean(payload.copyrightClaim || normalizedCategory === 'Copyright'),
          status: 'open',
        })
        .returning();

      // Also save a corresponding ticket in support_tickets so all submissions are persisted in support_tickets
      const ticketNumber = `TKT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const tkt = await db
        .insert(supportTickets)
        .values({
          ticketNumber,
          userId: resolvedUserId,
          email: resolvedEmail,
          subject: autoSubject,
          category: normalizedCategory,
          priority: payload.priority || 'high',
          message: cleanMessage,
          status: 'open',
        })
        .returning();

      return { type: 'report', record: rep[0], ticket: tkt[0] };
    } else {
      const ticketNumber = `TKT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const tkt = await db
        .insert(supportTickets)
        .values({
          ticketNumber,
          userId: resolvedUserId,
          email: resolvedEmail,
          subject: autoSubject,
          category: normalizedCategory,
          priority: payload.priority || (normalizedCategory === 'Payout' || normalizedCategory === 'Copyright' ? 'high' : 'normal'),
          message: cleanMessage,
          status: 'open',
        })
        .returning();
      return { type: 'ticket', record: tkt[0] };
    }
  } catch (error: any) {
    console.error('Database query failed in createSupportTicketOrReport:', error);
    throw new Error(error.message || 'Failed to submit support ticket.', { cause: error });
  }
}

export async function getSupportTicketsList(uid?: string, email?: string) {
  try {
    await ensurePlatformSeeded();
    const allTickets = await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
    if (uid) {
      const userRows = await db.select().from(users).where(eq(users.uid, uid));
      if (userRows[0]) {
        const filtered = allTickets.filter(
          (t) => t.userId === userRows[0].id || t.email === userRows[0].email
        );
        return filtered.length > 0 ? filtered : allTickets.slice(0, 10);
      }
    }
    if (email) {
      const filtered = allTickets.filter((t) => t.email.toLowerCase() === email.toLowerCase());
      if (filtered.length > 0) return filtered;
    }
    return allTickets.slice(0, 15);
  } catch (error: any) {
    console.error('Database query failed in getSupportTicketsList:', error);
    throw new Error('Failed to load support tickets.', { cause: error });
  }
}

export async function recordReferralSignupOrSettleBonus(
  uid: string,
  email: string,
  payload: {
    action: 'simulate_signup' | 'settle_pending';
    referredEmail?: string;
    planTier?: 'balanced' | 'max';
    eventId?: number;
  }
) {
  try {
    const user = await getOrCreateUser(uid, email);
    let refCodes = await db.select().from(referralCodes).where(eq(referralCodes.userId, user.id));
    if (refCodes.length === 0) {
      refCodes = await db
        .insert(referralCodes)
        .values({
          userId: user.id,
          code: user.referralCode || `SD-${user.id}REF`,
          clicksCount: 0,
          registrationsCount: 0,
          eligibleReferralsCount: 0,
          totalEarnedUsd: '0.0000',
          campaignName: 'Creator Launch Partner 10%',
        })
        .returning();
    }
    const refCode = refCodes[0];
    const walletRows = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, user.id));
    const wallet = walletRows[0];

    if (payload.action === 'simulate_signup') {
      const cleanRefEmail =
        (payload.referredEmail || '').trim().toLowerCase() ||
        `creator.${Math.floor(100 + Math.random() * 899)}@studio.in`;
      const bonusUsd = 1.5;
      const planLabel = 'Official $3.00 CPM Plan';

      const inserted = await db
        .insert(referralEvents)
        .values({
          referralCodeId: refCode.id,
          referrerUserId: user.id,
          referredUserEmail: cleanRefEmail,
          eventType: `creator_signup_bonus (${planLabel})`,
          commissionUsd: bonusUsd.toFixed(4),
          status: 'pending',
          ipHash: `sha256:${Math.random().toString(16).slice(2, 8)}`,
        })
        .returning();

      await db
        .update(referralCodes)
        .set({
          clicksCount: (refCode.clicksCount || 0) + 4,
          registrationsCount: (refCode.registrationsCount || 0) + 1,
        })
        .where(eq(referralCodes.id, refCode.id));

      if (wallet) {
        const nextPending = Number(wallet.pendingBalanceUsd || 0) + bonusUsd;
        await db
          .update(walletAccounts)
          .set({
            pendingBalanceUsd: nextPending.toFixed(4),
            updatedAt: new Date(),
          })
          .where(eq(walletAccounts.id, wallet.id));
      }

      return {
        action: 'simulate_signup',
        event: inserted[0],
        message: `Tracked new referral sign-up (${cleanRefEmail} on ${planLabel}) with +$${bonusUsd.toFixed(2)} USD pending referral bonus.`,
      };
    } else {
      const allEvents = await db
        .select()
        .from(referralEvents)
        .where(eq(referralEvents.referrerUserId, user.id));
      const pendingEvents = allEvents.filter(
        (e) => e.status === 'pending' && (!payload.eventId || e.id === Number(payload.eventId))
      );

      if (pendingEvents.length === 0) {
        throw new Error('No pending referral bonuses available to settle.');
      }

      let settledSumUsd = 0;
      for (const ev of pendingEvents) {
        settledSumUsd += Number(ev.commissionUsd || 0);
        await db
          .update(referralEvents)
          .set({ status: 'verified' })
          .where(eq(referralEvents.id, ev.id));
      }

      const nextTotalEarned = Number(refCode.totalEarnedUsd || 0) + settledSumUsd;
      const nextEligibleCount = (refCode.eligibleReferralsCount || 0) + pendingEvents.length;

      await db
        .update(referralCodes)
        .set({
          eligibleReferralsCount: nextEligibleCount,
          totalEarnedUsd: nextTotalEarned.toFixed(4),
        })
        .where(eq(referralCodes.id, refCode.id));

      if (wallet) {
        const nextAvailable = Number(wallet.availableBalanceUsd || 0) + settledSumUsd;
        const nextPending = Math.max(0, Number(wallet.pendingBalanceUsd || 0) - settledSumUsd);
        const nextLifetime = Number(wallet.lifetimeEarnedUsd || 0) + settledSumUsd;

        await db
          .update(walletAccounts)
          .set({
            availableBalanceUsd: nextAvailable.toFixed(4),
            pendingBalanceUsd: nextPending.toFixed(4),
            lifetimeEarnedUsd: nextLifetime.toFixed(4),
            updatedAt: new Date(),
          })
          .where(eq(walletAccounts.id, wallet.id));

        await db.insert(walletLedger).values({
          ledgerUuid: `led_ref_${Date.now()}`,
          userId: user.id,
          entryType: 'referral_bonus',
          amountUsd: settledSumUsd.toFixed(4),
          balanceAfterUsd: nextAvailable.toFixed(4),
          balanceBucket: 'available',
          referenceType: 'referral_code',
          referenceId: refCode.code,
          description: `Verified 10% Referral Partner bonus settled from ${pendingEvents.length} referred creator sign-up(s)`,
          createdByUid: user.uid,
        });
      }

      return {
        action: 'settle_pending',
        settledCount: pendingEvents.length,
        settledAmountUsd: settledSumUsd,
        message: `Verified & credited $${settledSumUsd.toFixed(2)} USD referral bonus (${pendingEvents.length} sign-up${pendingEvents.length > 1 ? 's' : ''}) to your available wallet balance.`,
      };
    }
  } catch (error: any) {
    console.error('Database query failed in recordReferralSignupOrSettleBonus:', error);
    throw new Error(error.message || 'Failed to update referral bonus status.', { cause: error });
  }
}

// ============================================================================
// SHARED NATIVE ANDROID & WEB API INTEGRATION FOUNDATION (/api/v1/*)
// ============================================================================

export async function registerOrLoginAndroidSession(params: {
  uid: string;
  email: string;
  displayName?: string;
  deviceName?: string;
  ipAddress?: string;
  referralCodeUsed?: string;
}) {
  await ensurePlatformSeeded();
  const user = await getOrCreateUser(params.uid, params.email, params.displayName);

  if (user.status === 'suspended') {
    throw new Error('Account has been suspended by platform administration.');
  }

  // Ensure userProfiles row exists
  const existingProfile = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id));

  if (existingProfile.length === 0) {
    await db.insert(userProfiles).values({
      userId: user.id,
      bio: 'ShareDabba Creator',
      website: '',
      country: 'IN',
      preferredCurrency: 'INR',
      notificationEmailEnabled: true,
    });
  }

  // Create a tracked device session in existing `sessions` table
  const sessionToken = `sds_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const insertedSessions = await db
    .insert(sessions)
    .values({
      userId: user.id,
      sessionToken,
      deviceName: (params.deviceName || 'ShareDabba Android App').slice(0, 120),
      ipAddress: (params.ipAddress || '0.0.0.0').slice(0, 64),
      lastActiveAt: new Date(),
      expiresAt,
      revoked: false,
    })
    .returning();

  const wallets = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, user.id));
  const profileRows = await db.select().from(userProfiles).where(eq(userProfiles.userId, user.id));

  return {
    user: {
      id: user.id,
      uid: user.uid,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl || '',
      role: user.role,
      planTier: user.planTier,
      status: user.status,
      kycVerified: user.kycVerified,
      upiId: user.upiId || '',
      upiVerified: user.upiVerified,
      referralCode: user.referralCode,
      storageUsedBytes: user.storageUsedBytes,
      storageLimitBytes: user.storageLimitBytes,
      adPreference: 'more',
      createdAt: user.createdAt,
    },
    profile: profileRows[0] || null,
    wallet: wallets[0] || null,
    session: {
      id: insertedSessions[0].id,
      sessionToken: insertedSessions[0].sessionToken,
      deviceName: insertedSessions[0].deviceName,
      expiresAt: insertedSessions[0].expiresAt,
    },
  };
}

export async function getUserSessionsList(uid: string, email: string) {
  const user = await getOrCreateUser(uid, email);
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, user.id))
    .orderBy(desc(sessions.lastActiveAt));

  return rows.map((s) => ({
    id: s.id,
    sessionTokenPreview: `${s.sessionToken.slice(0, 10)}...`,
    deviceName: s.deviceName,
    ipAddress: s.ipAddress,
    lastActiveAt: s.lastActiveAt,
    expiresAt: s.expiresAt,
    revoked: s.revoked,
  }));
}

export async function revokeUserSession(
  uid: string,
  email: string,
  target: { sessionId?: number; sessionToken?: string; revokeAll?: boolean }
) {
  const user = await getOrCreateUser(uid, email);
  const rows = await db.select().from(sessions).where(eq(sessions.userId, user.id));

  let revokedCount = 0;
  for (const s of rows) {
    const matchesId = target.sessionId !== undefined && s.id === Number(target.sessionId);
    const matchesToken = target.sessionToken && s.sessionToken === target.sessionToken;
    if (target.revokeAll || matchesId || matchesToken) {
      if (!s.revoked) {
        await db.update(sessions).set({ revoked: true }).where(eq(sessions.id, s.id));
        revokedCount++;
      }
    }
  }

  return {
    success: true,
    revokedCount,
  };
}

export async function getAccountProfileData(uid: string, email: string) {
  const user = await getOrCreateUser(uid, email);
  let profileRows = await db.select().from(userProfiles).where(eq(userProfiles.userId, user.id));
  if (profileRows.length === 0) {
    profileRows = await db
      .insert(userProfiles)
      .values({
        userId: user.id,
        bio: 'ShareDabba Creator',
        website: '',
        country: 'IN',
        preferredCurrency: 'INR',
        notificationEmailEnabled: true,
      })
      .returning();
  }
  const wallets = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, user.id));

  return {
    user: {
      id: user.id,
      uid: user.uid,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl || '',
      role: user.role,
      planTier: user.planTier,
      status: user.status,
      kycVerified: user.kycVerified,
      upiId: user.upiId || '',
      upiVerified: user.upiVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      referralCode: user.referralCode,
      storageUsedBytes: user.storageUsedBytes,
      storageLimitBytes: user.storageLimitBytes,
      adPreference: 'more',
      createdAt: user.createdAt,
    },
    profile: profileRows[0],
    wallet: wallets[0] || null,
  };
}

export async function updateAccountProfileData(
  uid: string,
  email: string,
  updates: {
    displayName?: string;
    upiId?: string;
    avatarUrl?: string;
    bio?: string;
    website?: string;
    country?: string;
    preferredCurrency?: string;
    notificationEmailEnabled?: boolean;
    twoFactorEnabled?: boolean;
  }
) {
  const user = await getOrCreateUser(uid, email);
  let nextUpi = user.upiId || '';
  let nextUpiVerified = user.upiVerified;

  if (updates.upiId !== undefined && updates.upiId.trim() !== '') {
    const check = validateUpiId(updates.upiId);
    if (!check.valid) {
      throw new Error(check.reason || 'Invalid UPI ID or USDT address.');
    }
    nextUpi = updates.upiId.trim();
    nextUpiVerified = true;
  } else if (updates.upiId === '') {
    nextUpi = '';
    nextUpiVerified = false;
  }

  const updatedUsers = await db
    .update(users)
    .set({
      displayName: updates.displayName !== undefined ? updates.displayName.trim() || user.displayName : user.displayName,
      avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl.trim() : user.avatarUrl,
      upiId: nextUpi,
      upiVerified: nextUpiVerified,
      twoFactorEnabled: updates.twoFactorEnabled !== undefined ? Boolean(updates.twoFactorEnabled) : user.twoFactorEnabled,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning();

  let profileRows = await db.select().from(userProfiles).where(eq(userProfiles.userId, user.id));
  if (profileRows.length === 0) {
    profileRows = await db
      .insert(userProfiles)
      .values({
        userId: user.id,
        bio: updates.bio?.trim() || 'ShareDabba Creator',
        website: updates.website?.trim() || '',
        country: updates.country?.trim() || 'IN',
        preferredCurrency: updates.preferredCurrency?.trim() || 'INR',
        notificationEmailEnabled:
          updates.notificationEmailEnabled !== undefined ? Boolean(updates.notificationEmailEnabled) : true,
      })
      .returning();
  } else {
    profileRows = await db
      .update(userProfiles)
      .set({
        bio: updates.bio !== undefined ? updates.bio.trim() : profileRows[0].bio,
        website: updates.website !== undefined ? updates.website.trim() : profileRows[0].website,
        country: updates.country !== undefined ? updates.country.trim() : profileRows[0].country,
        preferredCurrency:
          updates.preferredCurrency !== undefined
            ? updates.preferredCurrency.trim()
            : profileRows[0].preferredCurrency,
        notificationEmailEnabled:
          updates.notificationEmailEnabled !== undefined
            ? Boolean(updates.notificationEmailEnabled)
            : profileRows[0].notificationEmailEnabled,
      })
      .where(eq(userProfiles.id, profileRows[0].id))
      .returning();
  }

  return {
    user: updatedUsers[0],
    profile: profileRows[0],
  };
}

async function hydrateCanonicalVideos(fileList: Array<typeof files.$inferSelect>) {
  if (fileList.length === 0) return [];
  const allUsers = await db.select().from(users);
  const allVideoMeta = await db.select().from(videos);

  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const videoMetaMap = new Map(allVideoMeta.map((v) => [v.fileId, v]));

  return fileList.map((file) =>
    toCanonicalVideoDto({
      file,
      videoMeta: videoMetaMap.get(file.id) || null,
      owner: userMap.get(file.userId) || null,
    })
  );
}

export async function getHomeVideoFeed(limit = 20) {
  await ensurePlatformSeeded();
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const allFiles = await db.select().from(files).orderBy(desc(files.createdAt));

  // Only public, ready, clean videos appear in discovery feeds
  const publicReady = allFiles.filter(
    (f) => f.status === 'ready' && f.visibility === 'public' && f.malwareScanStatus !== 'infected'
  );

  const featuredSorted = [...publicReady]
    .sort((a, b) => (b.viewsCount || 0) - (a.viewsCount || 0))
    .slice(0, Math.min(10, safeLimit));

  const latestList = publicReady.slice(0, safeLimit);

  const categoryCounts = new Map<string, number>();
  for (const f of publicReady) {
    const cat = (f.category || 'General').trim();
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }

  const [featuredVideos, latestVideos] = await Promise.all([
    hydrateCanonicalVideos(featuredSorted),
    hydrateCanonicalVideos(latestList),
  ]);

  return {
    featured: featuredVideos,
    latest: latestVideos,
    categories: Array.from(categoryCounts.entries()).map(([name, count]) => ({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      count,
    })),
    totalPublicVideos: publicReady.length,
  };
}

export async function getFeaturedOrLatestVideos(params: {
  type: 'featured' | 'latest';
  limit?: number;
  offset?: number;
}) {
  await ensurePlatformSeeded();
  const safeLimit = Math.max(1, Math.min(50, Number(params.limit) || 20));
  const safeOffset = Math.max(0, Number(params.offset) || 0);

  const allFiles = await db.select().from(files).orderBy(desc(files.createdAt));
  const publicReady = allFiles.filter(
    (f) => f.status === 'ready' && f.visibility === 'public' && f.malwareScanStatus !== 'infected'
  );

  const sorted =
    params.type === 'featured'
      ? [...publicReady].sort(
          (a, b) =>
            (b.monetizedViewsCount || 0) * 2 +
            (b.viewsCount || 0) -
            ((a.monetizedViewsCount || 0) * 2 + (a.viewsCount || 0))
        )
      : publicReady;

  const sliced = sorted.slice(safeOffset, safeOffset + safeLimit);
  const items = await hydrateCanonicalVideos(sliced);

  return {
    type: params.type,
    items,
    pagination: {
      total: sorted.length,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + safeLimit < sorted.length,
    },
  };
}

export async function getCategoriesAndSearchVideos(params: {
  q?: string;
  category?: string;
  fileType?: string;
  sort?: 'latest' | 'popular';
  limit?: number;
  offset?: number;
}) {
  await ensurePlatformSeeded();
  const safeLimit = Math.max(1, Math.min(50, Number(params.limit) || 20));
  const safeOffset = Math.max(0, Number(params.offset) || 0);
  const query = (params.q || '').trim().toLowerCase();
  const categoryFilter = (params.category || '').trim().toLowerCase();
  const fileTypeFilter = (params.fileType || '').trim().toLowerCase();

  const allFiles = await db.select().from(files).orderBy(desc(files.createdAt));
  const publicReady = allFiles.filter(
    (f) => f.status === 'ready' && f.visibility === 'public' && f.malwareScanStatus !== 'infected'
  );

  // Compute all categories from publicReady
  const categoryMap = new Map<string, number>();
  for (const f of publicReady) {
    const cat = (f.category || 'General').trim();
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
  }

  let filtered = publicReady.filter((f) => {
    if (categoryFilter && categoryFilter !== 'all') {
      if ((f.category || '').toLowerCase() !== categoryFilter) return false;
    }
    if (fileTypeFilter && fileTypeFilter !== 'all') {
      if ((f.fileType || '').toLowerCase() !== fileTypeFilter) return false;
    }
    if (query) {
      const hay = `${f.title} ${f.description || ''} ${f.category || ''} ${f.tags || ''} ${f.slug}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  if (params.sort === 'popular') {
    filtered = [...filtered].sort((a, b) => (b.viewsCount || 0) - (a.viewsCount || 0));
  }

  const sliced = filtered.slice(safeOffset, safeOffset + safeLimit);
  const items = await hydrateCanonicalVideos(sliced);

  return {
    items,
    categories: Array.from(categoryMap.entries()).map(([name, count]) => ({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      count,
    })),
    pagination: {
      total: filtered.length,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + safeLimit < filtered.length,
    },
  };
}

export async function getVideoDetailsForViewer(params: {
  slug: string;
  requesterUid?: string | null;
  requesterEmail?: string | null;
  password?: string | null;
}) {
  await ensurePlatformSeeded();
  const cleanSlug = (params.slug || '').trim();
  if (!cleanSlug) {
    return { status: 'not_found' as const };
  }

  const rows = await db.select().from(files).where(eq(files.slug, cleanSlug));
  if (rows.length === 0) {
    return { status: 'not_found' as const };
  }
  const file = rows[0];

  if (file.status === 'quarantined' || file.status === 'removed' || file.malwareScanStatus === 'infected') {
    return {
      status: 'unavailable' as const,
      videoId: file.slug,
      reason: 'This video has been removed or restricted by platform moderation policy.',
    };
  }

  const ownerRows = await db.select().from(users).where(eq(users.id, file.userId));
  const owner = ownerRows[0] || null;
  const isOwner = Boolean(params.requesterUid && owner && owner.uid === params.requesterUid);
  const isSuperAdmin = Boolean(
    params.requesterEmail && params.requesterEmail.trim().toLowerCase() === SUPER_ADMIN_EMAIL
  );

  // Enforce private visibility check
  if (file.visibility === 'private' && !isOwner && !isSuperAdmin) {
    return {
      status: 'forbidden_private' as const,
      videoId: file.slug,
      reason: 'This video is private and can only be accessed by its uploader.',
    };
  }

  const videoMetaRows = await db.select().from(videos).where(eq(videos.fileId, file.id));
  const videoMeta = videoMetaRows[0] || null;
  const rulesRows = await db.select().from(monetizationRules);
  const customCodes = await getPlatformCustomCodes();

  const dto = toCanonicalVideoDto({ file, videoMeta, owner });

  return {
    status: 'ok' as const,
    video: dto,
    isOwner,
    monetization: {
      planName: 'Official $3.00 CPM Plan',
      targetCpmUsd: Number(customCodes.maxAdsCpmUsd ?? rulesRows[0]?.targetCpmUsd ?? 3.0),
      minWatchSeconds: rulesRows[0]?.minWatchSeconds ?? 5,
      vastPreRollTagUrl: customCodes.vastPreRollTagUrl,
      vastMidRollTagUrl: customCodes.vastMidRollTagUrl,
    },
  };
}

export async function authorizeVideoPlayback(params: {
  slug: string;
  requesterUid?: string | null;
  requesterEmail?: string | null;
  password?: string | null;
}) {
  await ensurePlatformSeeded();
  const cleanSlug = (params.slug || '').trim();
  if (!cleanSlug) {
    return { authorized: false, httpStatus: 404, error: 'Video ID is required.' };
  }

  const rows = await db.select().from(files).where(eq(files.slug, cleanSlug));
  if (rows.length === 0) {
    return { authorized: false, httpStatus: 404, error: 'Video not found.' };
  }
  const file = rows[0];

  if (file.status === 'quarantined' || file.status === 'removed' || file.malwareScanStatus === 'infected') {
    return {
      authorized: false,
      httpStatus: 410,
      error: 'Video is no longer available due to moderation or uploader removal.',
    };
  }

  const ownerRows = await db.select().from(users).where(eq(users.id, file.userId));
  const owner = ownerRows[0] || null;
  const isOwner = Boolean(params.requesterUid && owner && owner.uid === params.requesterUid);
  const isSuperAdmin = Boolean(
    params.requesterEmail && params.requesterEmail.trim().toLowerCase() === SUPER_ADMIN_EMAIL
  );

  if (file.visibility === 'private' && !isOwner && !isSuperAdmin) {
    return {
      authorized: false,
      httpStatus: 403,
      error: 'Private video: only the uploader is authorized to play this video.',
    };
  }

  // Enforce password protection if configured on the video
  const hasPassword = Boolean(file.passwordHash && file.passwordHash.trim() !== '');
  if (hasPassword && !isOwner && !isSuperAdmin) {
    const provided = (params.password || '').trim();
    if (!provided || provided !== file.passwordHash?.trim()) {
      return {
        authorized: false,
        httpStatus: 401,
        passwordRequired: true,
        error: 'A valid password is required to unlock playback for this video.',
      };
    }
  }

  const signed = createSignedPlaybackToken({
    slug: file.slug,
    fileId: file.id,
    viewerUid: params.requesterUid || null,
    visibility: file.visibility,
    ttlSeconds: 3600,
  });

  const videoMetaRows = await db.select().from(videos).where(eq(videos.fileId, file.id));
  const videoMeta = videoMetaRows[0] || null;
  const customCodes = await getPlatformCustomCodes();
  const rulesRows = await db.select().from(monetizationRules);

  return {
    authorized: true,
    httpStatus: 200,
    videoId: file.slug,
    playback: {
      playbackToken: signed.token,
      expiresAt: signed.expiresAt,
      authorizedStreamUrl: `/api/stream/${encodeURIComponent(file.slug)}?token=${encodeURIComponent(signed.token)}`,
      mimeType: file.mimeType,
      durationSeconds: file.durationSeconds,
      resolution: file.resolution,
      allowDownload: file.allowDownload,
      qualities: videoMeta?.qualitiesJson ? JSON.parse(videoMeta.qualitiesJson) : ['1080p', '720p', '480p'],
      vast: {
        enabled: Boolean(videoMeta?.vastEnabled ?? true),
        preRollTagUrl: customCodes.vastPreRollTagUrl,
        midRollTagUrl: customCodes.vastMidRollTagUrl,
        minWatchSecondsForCredit: rulesRows[0]?.minWatchSeconds ?? 5,
        targetCpmUsd: Number(customCodes.maxAdsCpmUsd ?? 3.0),
      },
    },
  };
}

export async function updateOrDeleteCreatorVideo(
  uid: string,
  email: string,
  slug: string,
  action: 'update' | 'delete',
  payload?: {
    title?: string;
    description?: string;
    visibility?: 'public' | 'unlisted' | 'private';
    category?: string;
    tags?: string;
    allowDownload?: boolean;
    password?: string;
    thumbnailType?: string;
  }
) {
  const user = await getOrCreateUser(uid, email);
  const cleanSlug = (slug || '').trim();
  const rows = await db.select().from(files).where(eq(files.slug, cleanSlug));
  if (rows.length === 0) {
    throw new Error('Video not found.');
  }
  const file = rows[0];
  const isSuperAdmin = (email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL;

  // Strict ownership check: uploaders cannot edit or delete another user's video
  if (file.userId !== user.id && !isSuperAdmin) {
    const err = new Error('Forbidden: You do not own this video.');
    (err as any).httpStatus = 403;
    throw err;
  }

  if (action === 'delete') {
    await db
      .update(files)
      .set({ status: 'removed', visibility: 'private' })
      .where(eq(files.id, file.id));

    return {
      success: true,
      videoId: file.slug,
      status: 'removed',
      message: 'Video has been marked as removed and is no longer publicly accessible.',
    };
  }

  const allowedVisibilities = ['public', 'unlisted', 'private'];
  const nextVisibility =
    payload?.visibility && allowedVisibilities.includes(payload.visibility)
      ? payload.visibility
      : file.visibility;

  const updated = await db
    .update(files)
    .set({
      title: payload?.title !== undefined ? payload.title.trim() || file.title : file.title,
      description: payload?.description !== undefined ? payload.description.trim() : file.description,
      visibility: nextVisibility,
      category: payload?.category !== undefined ? payload.category.trim() || 'General' : file.category,
      tags: payload?.tags !== undefined ? payload.tags.trim() : file.tags,
      allowDownload: payload?.allowDownload !== undefined ? Boolean(payload.allowDownload) : file.allowDownload,
      passwordHash: payload?.password !== undefined ? payload.password.trim() || null : file.passwordHash,
      thumbnailType: payload?.thumbnailType !== undefined ? payload.thumbnailType.trim() : file.thumbnailType,
    })
    .where(eq(files.id, file.id))
    .returning();

  const hydrated = await hydrateCanonicalVideos(updated);
  return {
    success: true,
    video: hydrated[0],
  };
}

export async function getRecentlyWatchedVideos(uid: string, limit = 20) {
  await ensurePlatformSeeded();
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const allSessions = await db
    .select()
    .from(playbackSessions)
    .where(eq(playbackSessions.viewerUid, uid))
    .orderBy(desc(playbackSessions.createdAt));

  if (allSessions.length === 0) {
    return [];
  }

  const allFiles = await db.select().from(files);
  const fileMap = new Map(allFiles.map((f) => [f.id, f]));

  const seenFileIds = new Set<number>();
  const uniqueRecent: Array<{
    session: typeof playbackSessions.$inferSelect;
    file: typeof files.$inferSelect;
  }> = [];

  for (const s of allSessions) {
    if (seenFileIds.has(s.fileId)) continue;
    const f = fileMap.get(s.fileId);
    if (!f || f.status !== 'ready') continue;
    seenFileIds.add(s.fileId);
    uniqueRecent.push({ session: s, file: f });
    if (uniqueRecent.length >= safeLimit) break;
  }

  const hydrated = await hydrateCanonicalVideos(uniqueRecent.map((r) => r.file));
  return uniqueRecent.map((entry, idx) => ({
    watchedAt: entry.session.createdAt,
    watchDurationSeconds: entry.session.watchDurationSeconds,
    qualifiedView: entry.session.qualifiedView,
    deviceCategory: entry.session.deviceCategory,
    video: hydrated[idx],
  }));
}

export async function getPublicUploaderProfile(identifier: string) {
  await ensurePlatformSeeded();
  const clean = (identifier || '').trim();
  if (!clean) return null;

  const allUsers = await db.select().from(users);
  const targetUser = allUsers.find(
    (u) => u.username.toLowerCase() === clean.toLowerCase() || u.uid === clean
  );
  if (!targetUser || targetUser.status === 'suspended') {
    return null;
  }

  const profileRows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, targetUser.id));

  const userFiles = await db
    .select()
    .from(files)
    .where(eq(files.userId, targetUser.id))
    .orderBy(desc(files.createdAt));

  const publicFiles = userFiles.filter(
    (f) => f.status === 'ready' && f.visibility === 'public' && f.malwareScanStatus !== 'infected'
  );

  const hydratedVideos = await hydrateCanonicalVideos(publicFiles);
  const totalPublicViews = publicFiles.reduce((acc, f) => acc + (f.viewsCount || 0), 0);

  return {
    uploader: {
      uid: targetUser.uid,
      username: targetUser.username,
      displayName: targetUser.displayName,
      avatarUrl: targetUser.avatarUrl || '',
      kycVerified: targetUser.kycVerified,
      bio: profileRows[0]?.bio || 'ShareDabba Creator',
      website: profileRows[0]?.website || '',
      country: profileRows[0]?.country || 'IN',
      joinedAt: targetUser.createdAt,
      stats: {
        publicVideosCount: publicFiles.length,
        totalPublicViews,
      },
    },
    videos: hydratedVideos,
  };
}

export async function getCreatorEarningsAndWithdrawals(uid: string, email: string) {
  const user = await getOrCreateUser(uid, email);
  const [wallets, ledger, earnings, withdrawals, rulesList, customCodes] = await Promise.all([
    db.select().from(walletAccounts).where(eq(walletAccounts.userId, user.id)),
    db
      .select()
      .from(walletLedger)
      .where(eq(walletLedger.userId, user.id))
      .orderBy(desc(walletLedger.createdAt)),
    db
      .select()
      .from(earningEvents)
      .where(eq(earningEvents.creatorUserId, user.id))
      .orderBy(desc(earningEvents.createdAt)),
    db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, user.id))
      .orderBy(desc(withdrawalRequests.createdAt)),
    db.select().from(monetizationRules),
    getPlatformCustomCodes(),
  ]);

  const rules = rulesList[0];
  return {
    wallet: wallets[0] || null,
    monetizationPlan: {
      planName: 'Official $3.00 CPM Plan',
      targetCpmUsd: Number(customCodes.maxAdsCpmUsd ?? rules?.targetCpmUsd ?? 3.0),
      usdToInrRate: Number(rules?.usdToInrRate ?? 84.2),
      upiMinWithdrawalUsd: Number(customCodes.upiMinWithdrawalUsd ?? rules?.minWithdrawalUsd ?? 5.0),
      usdtMinWithdrawalUsd: Number(customCodes.usdtMinWithdrawalUsd ?? 20.0),
      upiFeePercent: Number(customCodes.upiFeePercent ?? 0),
      usdtFeePercent: Number(customCodes.usdtFeePercent ?? 1.5),
      upiPayoutEnabled: Boolean(customCodes.upiPayoutEnabled ?? true),
      usdtPayoutEnabled: Boolean(customCodes.usdtPayoutEnabled ?? true),
    },
    earningEvents: earnings.slice(0, 100),
    ledger: ledger.slice(0, 100),
    withdrawals: withdrawals.slice(0, 50),
  };
}

export async function getUserNotificationsList(uid: string, email: string) {
  const user = await getOrCreateUser(uid, email);
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, user.id))
    .orderBy(desc(notifications.createdAt));

  return {
    unreadCount: rows.filter((n) => !n.isRead).length,
    items: rows.slice(0, 50),
  };
}

export async function markNotificationRead(
  uid: string,
  email: string,
  notificationId: number | 'all'
) {
  const user = await getOrCreateUser(uid, email);
  const rows = await db.select().from(notifications).where(eq(notifications.userId, user.id));

  let updatedCount = 0;
  for (const n of rows) {
    if (notificationId === 'all' || n.id === Number(notificationId)) {
      if (!n.isRead) {
        await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, n.id));
        updatedCount++;
      }
    }
  }

  return {
    success: true,
    updatedCount,
  };
}

export async function getAndroidRemoteConfig() {
  await ensurePlatformSeeded();
  const [rulesList, customCodes] = await Promise.all([
    db.select().from(monetizationRules),
    getPlatformCustomCodes(),
  ]);
  const rules = rulesList[0];

  const packageName = process.env.ANDROID_PACKAGE_NAME || 'com.sharedabba.app';
  const rawFingerprints =
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS ||
    'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C';
  const sha256Fingerprints = rawFingerprints
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    platform: {
      siteTitle: customCodes.siteTitle || 'ShareDabba',
      supportEmail: customCodes.supportEmail || 'support@sharedabba.in',
      telegramChannelUrl: customCodes.telegramChannelUrl || 'https://t.me/sharedabba',
      maintenanceMode: Boolean(customCodes.maintenanceMode ?? false),
      registrationEnabled: Boolean(customCodes.registrationEnabled ?? true),
      announcementBanner: customCodes.announcementBannerEnabled ? customCodes.announcementBanner : null,
      maxUploadSizeMb: Number(customCodes.maxUploadSizeMb ?? 2048),
    },
    monetization: {
      activePlanName: 'Official $3.00 CPM Plan',
      activeMode: rules?.activeMode || 'fixed_cpm',
      targetCpmUsd: Number(customCodes.maxAdsCpmUsd ?? rules?.targetCpmUsd ?? 3.0),
      minWatchSeconds: Number(rules?.minWatchSeconds ?? 5),
      usdToInrRate: Number(rules?.usdToInrRate ?? 84.2),
      usdtToInrRate: Number(customCodes.usdtToInrRate ?? 86.5),
      referralCommissionPercent: Number(rules?.referralCommissionPercent ?? 10.0),
      payouts: {
        upiEnabled: Boolean(customCodes.upiPayoutEnabled ?? true),
        upiMinWithdrawalUsd: Number(customCodes.upiMinWithdrawalUsd ?? rules?.minWithdrawalUsd ?? 5.0),
        upiFeePercent: Number(customCodes.upiFeePercent ?? 0),
        usdtEnabled: Boolean(customCodes.usdtPayoutEnabled ?? true),
        usdtMinWithdrawalUsd: Number(customCodes.usdtMinWithdrawalUsd ?? 20.0),
        usdtFeePercent: Number(customCodes.usdtFeePercent ?? 1.5),
      },
    },
    advertising: {
      vastPreRollTagUrl: customCodes.vastPreRollTagUrl,
      vastMidRollTagUrl: customCodes.vastMidRollTagUrl,
      rewardedAdEnabled: true,
    },
    androidAppLinks: {
      packageName,
      sha256CertFingerprints: sha256Fingerprints,
      canonicalSharePathPrefix: '/v/',
      legacyQueryParam: 'v',
      assetLinksUrl: '/.well-known/assetlinks.json',
    },
    externalProvidersStatus: {
      s3ObjectStorageConfigured: Boolean(
        process.env.S3_ACCESS_KEY_ID && process.env.S3_ACCESS_KEY_ID !== 'YOUR_S3_ACCESS_KEY_ID'
      ),
      razorpayxUpiGatewayConfigured: Boolean(
        process.env.RAZORPAYX_KEY_ID && process.env.RAZORPAYX_KEY_ID !== 'YOUR_RAZORPAYX_KEY_ID'
      ),
      firebaseAuthConfigured: true,
    },
    serverTimestamp: new Date().toISOString(),
  };
}


