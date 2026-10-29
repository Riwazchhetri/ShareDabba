import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import {
  getPublicBootstrapData,
  getCreatorDashboardData,
  createUploadedFileRecord,
  recordVerifiedPlaybackAndAdImpression,
  updateCreatorUpiAndSettings,
  createUpiWithdrawalRequest,
  getAdminOverviewData,
  adminUpdateMonetizationRules,
  adminUpdatePlatformCustomCodes,
  adminReviewWithdrawal,
  adminModerateFileOrUser,
  adminAdjustUserWalletAndRole,
  adminBroadcastNotification,
  adminRecordSecurityAudit,
  getAdminActivityLogs,
  createSupportTicketOrReport,
  getSupportTicketsList,
  fetchLiveMarketUsdtInrRates,
  syncOrAdjustLiveUsdtInrRates,
  recordReferralSignupOrSettleBonus,
  getFileBySlugForShare,
} from './src/db/repository.ts';

dotenv.config();

// ============================================================================
// STRICT ADMIN VAULT SECURITY PROTOCOL (ID: Riwaz | PASS: 7001473587)
// ============================================================================
const ADMIN_VAULT_ID = 'Riwaz';
const ADMIN_VAULT_PASS = '7001473587';
const VAULT_SECRET = crypto.randomBytes(32).toString('hex');
const VAULT_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 2 * 60 * 1000; // 2 minutes lockout after 5 bad attempts

interface VaultSession {
  token: string;
  adminId: string;
  issuedAt: number;
  expiresAt: number;
  ip: string;
}

const activeAdminVaultSessions = new Map<string, VaultSession>();
const failedLoginTracker = new Map<string, { count: number; lockedUntil: number }>();

function timingSafeStringMatch(input: string, expected: string): boolean {
  const inputHash = crypto.createHash('sha256').update(String(input)).digest();
  const expectedHash = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(inputHash, expectedHash);
}

function createSignedVaultToken(adminId: string): string {
  const nonce = crypto.randomBytes(18).toString('hex');
  const payload = `${adminId}.${Date.now()}.${nonce}`;
  const sig = crypto.createHmac('sha256', VAULT_SECRET).update(payload).digest('hex');
  return `sdvault_${Buffer.from(payload).toString('base64url')}.${sig}`;
}

function requireAdminVault(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = (req.headers['x-admin-vault-token'] as string) || '';
  if (!token) {
    res.status(401).json({
      error: 'Admin Vault Lock Active: Please authenticate with Super Admin ID & Password.',
      code: 'VAULT_LOCKED',
    });
    return;
  }

  const session = activeAdminVaultSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    if (session) activeAdminVaultSessions.delete(token);
    res.status(401).json({
      error: 'Admin Vault session expired or invalid. Please re-enter Super Admin credentials.',
      code: 'VAULT_SESSION_EXPIRED',
    });
    return;
  }

  (req as any).adminVaultSession = session;
  next();
}

// Sliding-Window Rate Limiter for Abuse & Replay Mitigation
const rateLimitBuckets = new Map<string, number[]>();
function createRateLimiter(windowMs: number, maxRequests: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const recent = (rateLimitBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      res.status(429).json({
        error: 'Rate limit exceeded. Please wait before sending additional requests.',
      });
      return;
    }
    recent.push(now);
    rateLimitBuckets.set(key, recent);
    next();
  };
}

// Verify Authenticated Administrator Role on the Server
function requireSuperAdmin(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const email = (req.user?.email || '').trim().toLowerCase();
  const role = req.user?.role || '';
  if (role !== 'super_admin' && email !== 'rudraxsikkim@gmail.com') {
    res.status(403).json({
      error: 'Forbidden: Administrator permissions required.',
    });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'ShareDabba Core API',
      timestamp: new Date().toISOString(),
    });
  });

  // Live USDT/INR & USD/INR FX Oracle Endpoint
  app.get('/api/fx/usdt-inr', async (req, res) => {
    try {
      const force = req.query.refresh === '1';
      const data = await fetchLiveMarketUsdtInrRates(force);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch live USDT/INR rate' });
    }
  });

  // Adjust or Sync Live USDT/INR & USD/INR Rates
  app.post('/api/fx/usdt-inr', async (req, res) => {
    try {
      const result = await syncOrAdjustLiveUsdtInrRates({
        mode: req.body?.mode === 'custom_adjust' ? 'custom_adjust' : 'sync_live',
        usdtToInrRate: req.body?.usdtToInrRate ? Number(req.body.usdtToInrRate) : undefined,
        usdToInrRate: req.body?.usdToInrRate ? Number(req.body.usdToInrRate) : undefined,
        actorUid: (req.headers['x-sharedabba-uid'] as string) || 'fx_live_desk',
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to adjust live USDT/INR rate' });
    }
  });

  // Public bootstrap data
  app.get('/api/public/bootstrap', async (_req, res) => {
    try {
      const data = await getPublicBootstrapData();
      res.json(data);
    } catch (error: any) {
      console.error('Failed to load public bootstrap data:', error);
      res.status(500).json({ error: error.message || 'Failed to load platform data' });
    }
  });

  // Creator dashboard data
  app.get('/api/dashboard', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email;
      const data = await getCreatorDashboardData(uid, email);
      res.json(data);
    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
      res.status(500).json({ error: error.message || 'Failed to load dashboard' });
    }
  });

  // Upload file / video metadata & server-side validation
  app.post('/api/files/upload', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email;
      const created = await createUploadedFileRecord(uid, email, req.body);
      res.status(201).json(created);
    } catch (error: any) {
      console.error('Upload validation or persistence failed:', error);
      res.status(400).json({ error: error.message || 'Upload failed' });
    }
  });

  // Record server-verified playback & VAST ad impression
  app.post('/api/playback/verify', async (req, res) => {
    try {
      const result = await recordVerifiedPlaybackAndAdImpression(req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Failed to verify playback event:', error);
      res.status(400).json({ error: error.message || 'Playback verification failed' });
    }
  });

  // Update creator UPI ID & account settings
  app.post('/api/account/settings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email;
      const updatedUser = await updateCreatorUpiAndSettings(uid, email, req.body);
      res.json(updatedUser);
    } catch (error: any) {
      console.error('Failed to update settings:', error);
      res.status(400).json({ error: error.message || 'Settings update failed' });
    }
  });

  // Request UPI withdrawal
  app.post('/api/wallet/withdraw', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email;
      const withdrawal = await createUpiWithdrawalRequest(uid, email, req.body);
      res.status(201).json(withdrawal);
    } catch (error: any) {
      console.error('Withdrawal request failed:', error);
      res.status(400).json({ error: error.message || 'Withdrawal request failed' });
    }
  });

  // Referral Sign-Up Tracking & Pending Bonus Settlement
  app.post('/api/referrals/track', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email;
      const result = await recordReferralSignupOrSettleBonus(uid, email, req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Referral tracking failed:', error);
      res.status(400).json({ error: error.message || 'Referral tracking action failed' });
    }
  });

  // List support tickets saved in support_tickets table
  app.get('/api/support', async (req, res) => {
    try {
      const uid = (req.headers['x-sharedabba-uid'] as string) || (req.query.uid as string) || undefined;
      const email = (req.query.email as string) || undefined;
      const tickets = await getSupportTicketsList(uid, email);
      res.json({ tickets });
    } catch (error: any) {
      console.error('Failed to fetch support tickets:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch support tickets' });
    }
  });

  // Public / Creator support ticket & DMCA report submission (saves to support_tickets table)
  app.post('/api/support', async (req, res) => {
    try {
      const uid = req.body?.uid || (req.headers['x-sharedabba-uid'] as string) || undefined;
      const result = await createSupportTicketOrReport({ ...req.body, uid });
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Support/report submission failed:', error);
      res.status(400).json({ error: error.message || 'Submission failed' });
    }
  });

  // ==========================================================================
  // ADMIN VAULT AUTHENTICATION ENDPOINTS (ID: Riwaz | PASS: 7001473587 | EMAIL: rudraxsikkim@gmail.com)
  // ==========================================================================
  const SUPER_ADMIN_BOUND_EMAIL = 'rudraxsikkim@gmail.com';

  app.post('/api/admin/auth/login', async (req, res) => {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const record = failedLoginTracker.get(ip) || { count: 0, lockedUntil: 0 };

    if (record.lockedUntil > now) {
      const waitSec = Math.ceil((record.lockedUntil - now) / 1000);
      await adminRecordSecurityAudit({
        actorUid: 'BLOCKED_INTRUDER',
        action: 'ADMIN_VAULT_LOCKOUT_REJECT',
        ip,
        details: { waitSeconds: waitSec },
      });
      res.status(429).json({
        error: `Security Protocol Lockout Active: Too many failed attempts. Retry in ${waitSec}s.`,
        remainingAttempts: 0,
        lockedUntil: record.lockedUntil,
      });
      return;
    }

    const inputEmail = String(req.body?.email || '').trim().toLowerCase();
    const inputId = String(req.body?.adminId || '').trim();
    const inputPass = String(req.body?.password || '').trim();

    // Check if login is via bound Super Admin email (rudraxsikkim@gmail.com)
    if (inputEmail && !inputId && !inputPass) {
      if (!timingSafeStringMatch(inputEmail, SUPER_ADMIN_BOUND_EMAIL)) {
        await adminRecordSecurityAudit({
          actorUid: inputEmail,
          actorRole: 'CREATOR',
          action: 'ADMIN_EMAIL_BINDING_REJECTED',
          ip,
          details: {
            attemptedEmail: inputEmail,
            summary: `Rejected non-admin email (${inputEmail}) from Super Admin Portal; routed as normal creator`,
          },
        });
        res.status(403).json({
          error: `Access Denied: Only ${SUPER_ADMIN_BOUND_EMAIL} is bound to Super Admin. ${inputEmail} is a Normal Creator account.`,
        });
        return;
      }

      failedLoginTracker.delete(ip);
      const token = createSignedVaultToken(ADMIN_VAULT_ID);
      const session: VaultSession = {
        token,
        adminId: ADMIN_VAULT_ID,
        issuedAt: now,
        expiresAt: now + VAULT_SESSION_TTL_MS,
        ip,
      };
      activeAdminVaultSessions.set(token, session);

      await adminRecordSecurityAudit({
        actorUid: `${ADMIN_VAULT_ID} (${SUPER_ADMIN_BOUND_EMAIL})`,
        actorRole: 'SUPER_ADMIN',
        action: 'ADMIN_EMAIL_BOUND_LOGIN_SUCCESS',
        entityType: 'admin_vault',
        entityId: SUPER_ADMIN_BOUND_EMAIL,
        ip,
        details: {
          summary: `Super Admin ${SUPER_ADMIN_BOUND_EMAIL} (${ADMIN_VAULT_ID}) unlocked the Admin Portal via Exclusive Email Binding`,
          email: SUPER_ADMIN_BOUND_EMAIL,
          adminId: ADMIN_VAULT_ID,
          protocol: 'FIREBASE-EMAIL-BOUND-HMAC-SHA256',
          expiresAt: session.expiresAt,
        },
      });

      res.json({
        authenticated: true,
        token,
        adminId: ADMIN_VAULT_ID,
        email: SUPER_ADMIN_BOUND_EMAIL,
        role: 'SUPER_ADMIN',
        expiresAt: session.expiresAt,
        protocol: 'Exclusive Email Binding (rudraxsikkim@gmail.com) + SHA-256 Vault',
      });
      return;
    }

    const idMatch =
      timingSafeStringMatch(inputId, ADMIN_VAULT_ID) ||
      timingSafeStringMatch(inputId.toLowerCase(), SUPER_ADMIN_BOUND_EMAIL);
    const passMatch = timingSafeStringMatch(inputPass, ADMIN_VAULT_PASS);

    if (!idMatch || !passMatch) {
      const nextCount = record.count + 1;
      const isLocked = nextCount >= MAX_FAILED_ATTEMPTS;
      const lockedUntil = isLocked ? now + LOCKOUT_DURATION_MS : 0;
      failedLoginTracker.set(ip, { count: isLocked ? 0 : nextCount, lockedUntil });

      const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - nextCount);
      await adminRecordSecurityAudit({
        actorUid: inputId || 'UNKNOWN_ACTOR',
        action: 'ADMIN_VAULT_LOGIN_FAILED',
        ip,
        details: { attemptedId: inputId, remainingAttempts: remaining, locked: isLocked },
      });

      res.status(401).json({
        error: isLocked
          ? 'Maximum failed attempts reached. Admin Vault locked for 120 seconds.'
          : `Access Denied: Invalid Super Admin ID or Passkey (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before protocol lockout).`,
        remainingAttempts: remaining,
      });
      return;
    }

    // Reset failed tracker on valid login
    failedLoginTracker.delete(ip);

    const token = createSignedVaultToken(ADMIN_VAULT_ID);
    const session: VaultSession = {
      token,
      adminId: ADMIN_VAULT_ID,
      issuedAt: now,
      expiresAt: now + VAULT_SESSION_TTL_MS,
      ip,
    };
    activeAdminVaultSessions.set(token, session);

    await adminRecordSecurityAudit({
      actorUid: ADMIN_VAULT_ID,
      actorRole: 'SUPER_ADMIN',
      action: 'ADMIN_VAULT_LOGIN_SUCCESS',
      entityType: 'admin_vault',
      entityId: ADMIN_VAULT_ID,
      ip,
      details: {
        summary: `Super Admin ${ADMIN_VAULT_ID} (${SUPER_ADMIN_BOUND_EMAIL}) unlocked the Admin Portal via SHA-256 Timing-Safe Protocol`,
        adminId: ADMIN_VAULT_ID,
        email: SUPER_ADMIN_BOUND_EMAIL,
        protocol: 'HMAC-SHA256-TIMING-SAFE',
        expiresAt: session.expiresAt,
      },
    });

    res.json({
      authenticated: true,
      token,
      adminId: ADMIN_VAULT_ID,
      email: SUPER_ADMIN_BOUND_EMAIL,
      role: 'SUPER_ADMIN',
      expiresAt: session.expiresAt,
      protocol: 'SHA-256 Timing-Safe + HMAC Token Protocol',
    });
  });

  app.post('/api/admin/auth/logout', async (req, res) => {
    const token = (req.headers['x-admin-vault-token'] as string) || '';
    const session = token ? activeAdminVaultSessions.get(token) : undefined;
    if (token) {
      activeAdminVaultSessions.delete(token);
    }
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    await adminRecordSecurityAudit({
      actorUid: session?.adminId || ADMIN_VAULT_ID,
      actorRole: 'SUPER_ADMIN',
      action: 'ADMIN_VAULT_LOCKED',
      entityType: 'admin_vault',
      entityId: session?.adminId || ADMIN_VAULT_ID,
      ip,
      details: {
        summary: `Super Admin ${session?.adminId || ADMIN_VAULT_ID} locked the Admin Vault session`,
      },
    });
    res.json({ success: true });
  });

  // Protected Admin Panel Overview (Requires Admin Vault Token + Super Admin Role)
  app.get('/api/admin/overview', requireAdminVault, requireAuth, requireSuperAdmin, async (_req: AuthRequest, res) => {
    try {
      const data = await getAdminOverviewData();
      res.json(data);
    } catch (error: any) {
      console.error('Failed to load admin overview:', error);
      res.status(500).json({ error: error.message || 'Failed to load admin overview' });
    }
  });

  // Admin: Fetch Activity Logs
  app.get('/api/admin/activity-logs', requireAdminVault, requireAuth, requireSuperAdmin, async (_req: AuthRequest, res) => {
    try {
      const logs = await getAdminActivityLogs();
      res.json({ logs });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load activity logs' });
    }
  });

  // Admin: Record Custom Activity Log Entry
  app.post('/api/admin/activity-logs', requireAdminVault, requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const adminId = (req as any).adminVaultSession?.adminId || ADMIN_VAULT_ID;
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const entry = await adminRecordSecurityAudit({
        actorUid: adminId,
        actorRole: 'SUPER_ADMIN',
        action: String(req.body?.action || 'ADMIN_MANUAL_LOG_ENTRY').toUpperCase(),
        entityType: String(req.body?.entityType || 'admin_portal'),
        entityId: String(req.body?.entityId || 'global'),
        ip,
        details: req.body?.details || { summary: req.body?.summary || 'Admin activity recorded' },
      });
      res.status(201).json({ entry });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to record activity log' });
    }
  });

  // Admin: Update Monetization & CPM Engine rules
  app.post('/api/admin/monetization', requireAdminVault, requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const adminId = (req as any).adminVaultSession?.adminId || ADMIN_VAULT_ID;
      const updated = await adminUpdateMonetizationRules(adminId, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Admin monetization update failed:', error);
      res.status(400).json({ error: error.message || 'Failed to update rules' });
    }
  });

  // Admin: Update Custom Codes, VAST Ad Tags, Integration Endpoints & Dynamic CPM Tiers
  app.post('/api/admin/platform-codes', requireAdminVault, requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const adminId = (req as any).adminVaultSession?.adminId || ADMIN_VAULT_ID;
      const updated = await adminUpdatePlatformCustomCodes(adminId, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Admin platform custom codes update failed:', error);
      res.status(400).json({ error: error.message || 'Failed to update platform codes' });
    }
  });

  // Admin: Review & settle/reject UPI withdrawal requests
  app.post('/api/admin/withdrawals/review', requireAdminVault, requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const adminId = (req as any).adminVaultSession?.adminId || ADMIN_VAULT_ID;
      const updated = await adminReviewWithdrawal(adminId, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Admin withdrawal review failed:', error);
      res.status(400).json({ error: error.message || 'Withdrawal review failed' });
    }
  });

  // Admin: Moderate content / users / reports / tickets
  app.post('/api/admin/moderate', requireAdminVault, requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const adminId = (req as any).adminVaultSession?.adminId || ADMIN_VAULT_ID;
      const result = await adminModerateFileOrUser(adminId, req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Admin moderation failed:', error);
      res.status(400).json({ error: error.message || 'Moderation action failed' });
    }
  });

  // Admin: Direct User Wallet Credit/Debit, Role Change & KYC Verification
  app.post('/api/admin/users/action', requireAdminVault, requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const adminId = (req as any).adminVaultSession?.adminId || ADMIN_VAULT_ID;
      const result = await adminAdjustUserWalletAndRole(adminId, req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Admin user action failed:', error);
      res.status(400).json({ error: error.message || 'User administration action failed' });
    }
  });

  // Admin: Broadcast Global Notification to All Creators
  app.post('/api/admin/broadcast', requireAdminVault, requireAuth, requireSuperAdmin, async (req: AuthRequest, res) => {
    try {
      const adminId = (req as any).adminVaultSession?.adminId || ADMIN_VAULT_ID;
      const result = await adminBroadcastNotification(adminId, req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Admin broadcast failed:', error);
      res.status(400).json({ error: error.message || 'Broadcast failed' });
    }
  });

  // ==========================================================================
  // ANDROID APP LINKS (/.well-known/assetlinks.json) & NATIVE ANDROID API v1
  // ==========================================================================
  app.get('/.well-known/assetlinks.json', (_req, res) => {
    const packageName = process.env.ANDROID_PACKAGE_NAME || 'com.sharedabba.app';
    const rawFingerprints =
      process.env.ANDROID_SHA256_CERT_FINGERPRINTS ||
      'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C';
    const fingerprints = rawFingerprints
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    res.json([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ]);
  });

  // 1. Android API: Authentication & Account Information
  app.get('/api/v1/account', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getCreatorDashboardData(req.user!.uid, req.user!.email);
      res.json({
        user: data.user,
        storage: {
          usedBytes: data.user.storageUsedBytes,
          limitBytes: data.user.storageLimitBytes,
        },
        sessions: data.sessions,
        notifications: data.notifications,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch account profile' });
    }
  });

  // 2. Android API: Video Metadata & Playback Configuration
  app.get('/api/v1/videos/:slug', async (req, res) => {
    try {
      const resolved = await getFileBySlugForShare(req.params.slug);
      if (!resolved) {
        res.status(404).json({ error: 'Video or file not found' });
        return;
      }
      res.json(resolved);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to resolve video metadata' });
    }
  });

  // 3. Android API: Canonical Share-Link Resolution (/v/:slug & /?v=:slug compatible)
  app.get('/api/v1/share/:slug', async (req, res) => {
    try {
      const resolved = await getFileBySlugForShare(req.params.slug);
      if (!resolved) {
        res.status(404).json({ error: 'Shared link not found or quarantined' });
        return;
      }
      const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
      const packageName = process.env.ANDROID_PACKAGE_NAME || 'com.sharedabba.app';
      const slug = resolved.file.slug;
      res.json({
        canonicalWebUrl: `${appUrl}/v/${slug}`,
        legacyQueryUrl: `${appUrl}/?v=${slug}`,
        androidAppLinkUrl: `${appUrl}/v/${slug}`,
        androidIntentUri: `intent://v/${slug}#Intent;scheme=https;package=${packageName};S.browser_fallback_url=${encodeURIComponent(
          `${appUrl}/v/${slug}`
        )};end`,
        ...resolved,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to resolve share link' });
    }
  });

  // 4. Android API: Upload Initiation & Quota Pre-Check
  app.post('/api/v1/uploads/init', createRateLimiter(60_000, 20), requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getCreatorDashboardData(req.user!.uid, req.user!.email);
      const filename = String(req.body?.filename || '').trim();
      const sizeBytes = Number(req.body?.sizeBytes || 0);
      if (!filename || sizeBytes <= 0) {
        res.status(400).json({ error: 'filename and positive sizeBytes are required' });
        return;
      }
      if (data.user.storageUsedBytes + sizeBytes > data.user.storageLimitBytes) {
        res.status(400).json({ error: 'Upload exceeds available account storage quota' });
        return;
      }
      const uploadSessionId = `ups_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      res.status(201).json({
        uploadSessionId,
        storageMode:
          process.env.S3_ACCESS_KEY_ID && process.env.S3_ACCESS_KEY_ID !== 'YOUR_S3_ACCESS_KEY_ID'
            ? 's3_presigned_multipart'
            : 'metadata_and_managed_stream',
        completeEndpoint: '/api/v1/uploads/complete',
        maxChunkSizeBytes: 16 * 1024 * 1024,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to initialize upload' });
    }
  });

  // 5. Android API: Upload Completion
  app.post('/api/v1/uploads/complete', createRateLimiter(60_000, 20), requireAuth, async (req: AuthRequest, res) => {
    try {
      const created = await createUploadedFileRecord(req.user!.uid, req.user!.email, req.body);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Upload completion failed' });
    }
  });

  // 6. Android API: View-Event Reporting
  app.post('/api/v1/views/report', createRateLimiter(60_000, 60), async (req, res) => {
    try {
      const result = await recordVerifiedPlaybackAndAdImpression(req.body);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'View-event verification failed' });
    }
  });

  // 7. Android API: User Analytics
  app.get('/api/v1/analytics', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getCreatorDashboardData(req.user!.uid, req.user!.email);
      const totalViews = data.files.reduce((sum: number, f: any) => sum + (f.viewsCount || 0), 0);
      const monetizedViews = data.files.reduce((sum: number, f: any) => sum + (f.monetizedViewsCount || 0), 0);
      const estimatedEarningsUsd = data.files
        .reduce((sum: number, f: any) => sum + Number(f.estimatedEarningsUsd || 0), 0)
        .toFixed(4);
      res.json({
        totalFiles: data.files.length,
        totalViews,
        monetizedViews,
        estimatedEarningsUsd,
        files: data.files,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load creator analytics' });
    }
  });

  // 8. Android API: Referral Tracking
  app.get('/api/v1/referrals', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getCreatorDashboardData(req.user!.uid, req.user!.email);
      res.json({
        referralCode: data.referralCode,
        referralEvents: data.referralEvents,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load referrals' });
    }
  });

  // 9. Android API: Wallet Balances, Ledger & Withdrawal Requests
  app.get('/api/v1/wallet', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getCreatorDashboardData(req.user!.uid, req.user!.email);
      const razorpayConfigured = Boolean(
        process.env.RAZORPAYX_KEY_ID &&
          process.env.RAZORPAYX_KEY_ID !== 'YOUR_RAZORPAYX_KEY_ID' &&
          process.env.RAZORPAYX_KEY_SECRET &&
          process.env.RAZORPAYX_KEY_SECRET !== 'YOUR_RAZORPAYX_KEY_SECRET'
      );
      res.json({
        wallet: data.wallet,
        ledger: data.ledger,
        withdrawals: data.withdrawals,
        payoutProviderStatus: {
          upiGatewayConfigured: razorpayConfigured,
          settlementMode: razorpayConfigured ? 'provider_webhook_verified' : 'admin_manual_review_queue',
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load wallet data' });
    }
  });

  app.post('/api/v1/wallet/withdraw', createRateLimiter(60_000, 10), requireAuth, async (req: AuthRequest, res) => {
    try {
      const withdrawal = await createUpiWithdrawalRequest(req.user!.uid, req.user!.email, req.body);
      res.status(201).json(withdrawal);
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Withdrawal request failed' });
    }
  });

  // 10. UPI Payout Provider Webhook Verification Endpoint (Never exposes secrets to frontend/Android)
  app.post('/api/webhooks/upi-payout', async (req, res) => {
    try {
      const webhookSecret = process.env.RAZORPAYX_WEBHOOK_SECRET || '';
      if (!webhookSecret || webhookSecret === 'YOUR_RAZORPAYX_WEBHOOK_SECRET') {
        res.status(503).json({
          error: 'UPI payout webhook secret is not configured on the server.',
        });
        return;
      }
      const signature = String(req.headers['x-razorpay-signature'] || '');
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (!signature || !timingSafeStringMatch(signature, expectedSig)) {
        res.status(401).json({ error: 'Invalid webhook HMAC signature' });
        return;
      }

      const withdrawalId = Number(req.body?.withdrawalId || 0);
      const statusEvent = String(req.body?.event || '');
      const utr = String(req.body?.utr || '');

      if (!withdrawalId) {
        res.status(400).json({ error: 'Missing withdrawalId in webhook payload' });
        return;
      }

      if (statusEvent === 'payout.processed') {
        const updated = await adminReviewWithdrawal('razorpayx_webhook', {
          withdrawalId,
          action: 'approve_and_settle',
          adminNote: 'Provider webhook confirmed payout.processed settlement.',
          providerUtr: utr,
        });
        res.json({ settled: true, withdrawal: updated });
      } else if (statusEvent === 'payout.failed' || statusEvent === 'payout.reversed') {
        const updated = await adminReviewWithdrawal('razorpayx_webhook', {
          withdrawalId,
          action: 'mark_failed',
          adminNote: `Provider webhook reported ${statusEvent}; funds returned to available balance.`,
        });
        res.json({ settled: false, withdrawal: updated });
      } else {
        res.json({ received: true });
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Webhook processing failed' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ShareDabba Full-Stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
