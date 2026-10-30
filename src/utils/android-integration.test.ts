import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCreatorEarnings,
  computeWithdrawalQuote,
  validateUploadFile,
  getDynamicCpmForAdPlan,
  MonetizationConfig,
} from './monetization.ts';
import {
  createSignedPlaybackToken,
  verifySignedPlaybackToken,
  toCanonicalVideoDto,
} from './playback-security.ts';

const baseConfig: MonetizationConfig = {
  activeMode: 'fixed_cpm',
  targetCpmUsd: 3.0,
  revenueSharePercent: 65,
  minWatchSeconds: 5,
  minWithdrawalUsd: 5.0,
  usdToInrRate: 84.2,
  upiPayoutFeePercent: 0,
  referralCommissionPercent: 10,
};

describe('ShareDabba Monetization & Shared Earnings Engine', () => {
  it('credits $0.0030 USD per verified view under the Official $3.00 CPM Plan', () => {
    const res = calculateCreatorEarnings(
      {
        eligibleViews: 1,
        watchDurationSeconds: 12,
        verifiedAdImpression: true,
        grossAdRevenueUsd: 0.0045,
        viewerCountry: 'IN',
      },
      baseConfig
    );
    assert.equal(res.qualified, true);
    assert.equal(res.modeApplied, 'fixed_cpm');
    assert.equal(res.appliedCpmUsd, 3.0);
    assert.equal(res.creatorEarnedUsd, 0.003);
  });

  it('rejects playback below minimum watch duration or without verified ad impression', () => {
    const shortWatch = calculateCreatorEarnings(
      {
        eligibleViews: 1,
        watchDurationSeconds: 2,
        verifiedAdImpression: true,
        grossAdRevenueUsd: 0.0045,
        viewerCountry: 'IN',
      },
      baseConfig
    );
    assert.equal(shortWatch.qualified, false);
    assert.equal(shortWatch.creatorEarnedUsd, 0);
    assert.equal(shortWatch.rejectionReason, 'below_minimum_watch_threshold');

    const unverifiedAd = calculateCreatorEarnings(
      {
        eligibleViews: 1,
        watchDurationSeconds: 15,
        verifiedAdImpression: false,
        grossAdRevenueUsd: 0,
        viewerCountry: 'IN',
      },
      baseConfig
    );
    assert.equal(unverifiedAd.qualified, false);
    assert.equal(unverifiedAd.rejectionReason, 'unverified_ad_impression');
  });

  it('enforces the unified Official $3.00 CPM Plan across all preference inputs', () => {
    const plan = getDynamicCpmForAdPlan('balanced');
    assert.equal(plan.planName, 'Official $3.00 CPM Plan');
    assert.equal(plan.cpmUsd, 3.0);
  });

  it('validates UPI and USDT withdrawal quotes and rejects over-balance or below-minimum requests', () => {
    const validUpi = computeWithdrawalQuote({
      requestedUsd: 10,
      availableBalanceUsd: 25,
      minWithdrawalUsd: 5,
      usdtMinWithdrawalUsd: 20,
      usdToInrRate: 84.2,
      feePercent: 0,
      usdtFeePercent: 1.5,
      upiPayoutEnabled: true,
      usdtPayoutEnabled: true,
      upiId: 'creator@okaxis',
      upiVerified: true,
      kycVerified: true,
    });
    assert.equal(validUpi.eligible, true);
    assert.equal(validUpi.payoutMethod, 'UPI');
    assert.equal(validUpi.netPayoutInr, 842);

    const overBalance = computeWithdrawalQuote({
      requestedUsd: 50,
      availableBalanceUsd: 25,
      minWithdrawalUsd: 5,
      usdToInrRate: 84.2,
      feePercent: 0,
      upiId: 'creator@okaxis',
      upiVerified: true,
      kycVerified: true,
    });
    assert.equal(overBalance.eligible, false);
    assert.match(overBalance.errorReason || '', /exceeds available payable balance/i);
  });

  it('validates uploaded file extensions and size limits', () => {
    const validMp4 = validateUploadFile('episode-01.mp4', 50 * 1024 * 1024, 2048 * 1024 * 1024);
    assert.equal(validMp4.permitted, true);
    assert.equal(validMp4.fileType, 'video');

    const badExe = validateUploadFile('malware.exe', 1024, 2048 * 1024 * 1024);
    assert.equal(badExe.permitted, false);
  });
});

describe('ShareDabba Playback Authorization & Canonical Video Security', () => {
  const testSecret = 'unit-test-hmac-secret-key-2026';

  it('signs and verifies short-lived HMAC-SHA256 playback tokens for matching video slugs', () => {
    const nowMs = 1_750_000_000_000;
    const signed = createSignedPlaybackToken(
      {
        slug: 'dabba-4k-demo',
        fileId: 42,
        viewerUid: 'uid_creator_1',
        visibility: 'public',
        ttlSeconds: 3600,
        nowMs,
      },
      testSecret
    );

    const verified = verifySignedPlaybackToken(signed.token, 'dabba-4k-demo', {
      secretOverride: testSecret,
      nowMs: nowMs + 60_000,
    });
    assert.equal(verified.valid, true);
    assert.equal(verified.payload?.slug, 'dabba-4k-demo');
    assert.equal(verified.payload?.fileId, 42);
    assert.equal(verified.payload?.viewerUid, 'uid_creator_1');
  });

  it('rejects playback tokens used for a different video slug or after expiration', () => {
    const nowMs = 1_750_000_000_000;
    const signed = createSignedPlaybackToken(
      {
        slug: 'video-alpha',
        fileId: 10,
        ttlSeconds: 300,
        nowMs,
      },
      testSecret
    );

    const wrongSlug = verifySignedPlaybackToken(signed.token, 'video-beta', {
      secretOverride: testSecret,
      nowMs: nowMs + 10_000,
    });
    assert.equal(wrongSlug.valid, false);

    const expired = verifySignedPlaybackToken(signed.token, 'video-alpha', {
      secretOverride: testSecret,
      nowMs: nowMs + 400_000,
    });
    assert.equal(expired.valid, false);
    assert.match(expired.reason || '', /expired/i);
  });

  it('sanitizes canonical video DTOs and never exposes private storageKey, passwordHash, or uploader email/UPI', () => {
    const dto = toCanonicalVideoDto({
      file: {
        id: 7,
        slug: 'mumbai-monsoon-4k',
        title: 'Mumbai Monsoon 4K HDR',
        description: 'Shot on cinema camera',
        filename: 'monsoon.mp4',
        mimeType: 'video/mp4',
        fileType: 'video',
        sizeBytes: 104857600,
        durationSeconds: 245,
        resolution: '4K',
        storageKey: 'r2://private-bucket/uploads/7/monsoon.mp4',
        passwordHash: 'secretPass123',
        visibility: 'public',
        allowDownload: true,
        category: 'Education',
        tags: '4k,cinema,india',
        status: 'ready',
        malwareScanStatus: 'clean',
        thumbnailType: 'cyber',
        viewsCount: 1200,
        monetizedViewsCount: 950,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      videoMeta: {
        codec: 'H.264 / AAC',
        bitrateKbps: 6500,
        fps: 60,
        qualitiesJson: JSON.stringify(['4K', '1080p', '720p']),
        captionsAvailable: true,
        vastEnabled: true,
      },
      owner: {
        uid: 'uid_77',
        username: 'arjun_cinema',
        displayName: 'Arjun Cinema',
        email: 'private_email@example.com',
        upiId: 'private_upi@okaxis',
        kycVerified: true,
      },
    });

    assert.equal(dto.videoId, 'mumbai-monsoon-4k');
    assert.equal(dto.passwordProtected, true);
    assert.equal(dto.shareLinks.canonicalPath, '/v/mumbai-monsoon-4k');
    assert.equal((dto as any).storageKey, undefined);
    assert.equal((dto as any).passwordHash, undefined);
    assert.equal((dto.uploader as any).email, undefined);
    assert.equal((dto.uploader as any).upiId, undefined);
  });
});
