import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
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
  createSupportTicketOrReport,
  getSupportTicketsList,
  fetchLiveMarketUsdtInrRates,
  syncOrAdjustLiveUsdtInrRates,
  recordReferralSignupOrSettleBonus,
} from './src/db/repository.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  // Protected Admin Panel Overview
  app.get('/api/admin/overview', requireAuth, async (_req: AuthRequest, res) => {
    try {
      const data = await getAdminOverviewData();
      res.json(data);
    } catch (error: any) {
      console.error('Failed to load admin overview:', error);
      res.status(500).json({ error: error.message || 'Failed to load admin overview' });
    }
  });

  // Admin: Update Monetization & CPM Engine rules
  app.post('/api/admin/monetization', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await adminUpdateMonetizationRules(req.user!.uid, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Admin monetization update failed:', error);
      res.status(400).json({ error: error.message || 'Failed to update rules' });
    }
  });

  // Admin: Update Custom Codes, VAST Ad Tags, Integration Endpoints & Dynamic CPM Tiers
  app.post('/api/admin/platform-codes', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await adminUpdatePlatformCustomCodes(req.user!.uid, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Admin platform custom codes update failed:', error);
      res.status(400).json({ error: error.message || 'Failed to update platform codes' });
    }
  });

  // Admin: Review & settle/reject UPI withdrawal requests
  app.post('/api/admin/withdrawals/review', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await adminReviewWithdrawal(req.user!.uid, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Admin withdrawal review failed:', error);
      res.status(400).json({ error: error.message || 'Withdrawal review failed' });
    }
  });

  // Admin: Moderate content / users / reports
  app.post('/api/admin/moderate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await adminModerateFileOrUser(req.user!.uid, req.body);
      res.json(result);
    } catch (error: any) {
      console.error('Admin moderation failed:', error);
      res.status(400).json({ error: error.message || 'Moderation action failed' });
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
