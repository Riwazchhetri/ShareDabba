import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCreatorEarnings,
  validateUpiId,
  computeWithdrawalQuote,
  validateUploadFile,
  getAdFrequencyCapForPreference,
  getDynamicCpmForAdPlan,
  MonetizationConfig,
} from './monetization';

const baseConfig: MonetizationConfig = {
  activeMode: 'fixed_cpm',
  targetCpmUsd: 2.0,
  revenueSharePercent: 65,
  minWatchSeconds: 5,
  minWithdrawalUsd: 5.0,
  usdToInrRate: 84.2,
  upiPayoutFeePercent: 0,
  referralCommissionPercent: 10,
  countryRates: {
    US: 3.4,
    IN: 2.0,
  },
};

test('Fixed CPM calculation credits exact $2.00 per 1,000 eligible views in IN', () => {
  const result = calculateCreatorEarnings(
    {
      eligibleViews: 1000,
      watchDurationSeconds: 12,
      verifiedAdImpression: true,
      grossAdRevenueUsd: 3.1,
      viewerCountry: 'IN',
    },
    baseConfig
  );

  assert.equal(result.qualified, true);
  assert.equal(result.modeApplied, 'fixed_cpm');
  assert.equal(result.appliedCpmUsd, 2.0);
  assert.equal(result.creatorEarnedUsd, 2.0);
  assert.equal(result.platformShareUsd, 1.1);
});

test('Revenue share mode calculates creator percentage without duplicating fixed CPM', () => {
  const revShareConfig: MonetizationConfig = {
    ...baseConfig,
    activeMode: 'revenue_share',
  };

  const result = calculateCreatorEarnings(
    {
      eligibleViews: 1000,
      watchDurationSeconds: 20,
      verifiedAdImpression: true,
      grossAdRevenueUsd: 4.0,
      viewerCountry: 'US',
    },
    revShareConfig
  );

  assert.equal(result.qualified, true);
  assert.equal(result.modeApplied, 'revenue_share');
  assert.equal(result.creatorEarnedUsd, 2.6);
  assert.equal(result.platformShareUsd, 1.4);
});

test('Rejects unverified ad impressions and invalid traffic with zero earnings', () => {
  const unverified = calculateCreatorEarnings(
    {
      eligibleViews: 1,
      watchDurationSeconds: 30,
      verifiedAdImpression: false,
      grossAdRevenueUsd: 0.005,
      viewerCountry: 'IN',
    },
    baseConfig
  );
  assert.equal(unverified.qualified, false);
  assert.equal(unverified.creatorEarnedUsd, 0);

  const botTraffic = calculateCreatorEarnings(
    {
      eligibleViews: 1,
      watchDurationSeconds: 30,
      verifiedAdImpression: true,
      grossAdRevenueUsd: 0.005,
      viewerCountry: 'IN',
      isInvalidTraffic: true,
    },
    baseConfig
  );
  assert.equal(botTraffic.qualified, false);
  assert.equal(botTraffic.rejectionReason, 'invalid_or_bot_traffic');
});

test('UPI VPA, USDT wallet validation, and minimum $5 withdrawal enforcement', () => {
  assert.equal(validateUpiId('rudra@okaxis').valid, true);
  assert.equal(validateUpiId('TX8k9mShareDabbaTetherWallet99A2pL').valid, true);
  assert.equal(validateUpiId('0x71C7656EC7ab88b098defB751B7401B5f6d8976F').valid, true);
  assert.equal(validateUpiId('invalid-upi').valid, false);

  const maxPlan = getDynamicCpmForAdPlan('more');
  assert.equal(maxPlan.cpmUsd, 3.0);
  const balancedPlan = getDynamicCpmForAdPlan('balanced');
  assert.equal(balancedPlan.cpmUsd, 2.0);

  const belowMinimum = computeWithdrawalQuote({
    requestedUsd: 3.5,
    availableBalanceUsd: 25.0,
    minWithdrawalUsd: 5.0,
    usdToInrRate: 84.2,
    feePercent: 0,
    upiId: 'rudra@okaxis',
    upiVerified: true,
    kycVerified: true,
  });
  assert.equal(belowMinimum.eligible, false);

  const validQuote = computeWithdrawalQuote({
    requestedUsd: 10.0,
    availableBalanceUsd: 25.0,
    minWithdrawalUsd: 5.0,
    usdtMinWithdrawalUsd: 20.0,
    usdToInrRate: 84.2,
    feePercent: 0,
    usdtFeePercent: 1.5,
    upiId: 'rudra@okaxis',
    upiVerified: true,
    kycVerified: true,
  });
  assert.equal(validQuote.eligible, true);
  assert.equal(validQuote.payoutMethod, 'UPI');
  assert.equal(validQuote.netPayoutInr, 842.0);

  // USDT below $20 threshold should be rejected
  const usdtBelowMin = computeWithdrawalQuote({
    requestedUsd: 12.0,
    availableBalanceUsd: 50.0,
    minWithdrawalUsd: 5.0,
    usdtMinWithdrawalUsd: 20.0,
    usdToInrRate: 84.2,
    feePercent: 0,
    usdtFeePercent: 1.5,
    upiId: 'TX8k9mShareDabbaTetherWallet99A2pL',
    upiVerified: true,
    kycVerified: true,
  });
  assert.equal(usdtBelowMin.eligible, false);
  assert.equal(usdtBelowMin.payoutMethod, 'USDT');

  // USDT >= $20 threshold with 2% global fee should pass
  const usdtValid = computeWithdrawalQuote({
    requestedUsd: 25.0,
    availableBalanceUsd: 50.0,
    minWithdrawalUsd: 5.0,
    usdtMinWithdrawalUsd: 20.0,
    usdToInrRate: 84.2,
    feePercent: 0,
    usdtFeePercent: 2.0,
    upiId: 'TX8k9mShareDabbaTetherWallet99A2pL',
    upiVerified: true,
    kycVerified: true,
  });
  assert.equal(usdtValid.eligible, true);
  assert.equal(usdtValid.payoutMethod, 'USDT');
  assert.equal(usdtValid.feeUsd, 0.5);
  assert.equal(usdtValid.netUsd, 24.5);
});

test('File upload validation checks extensions and flags APK for malware scan', () => {
  const mp4Check = validateUploadFile('architecture-reel.mp4', 25 * 1024 * 1024, 500 * 1024 * 1024);
  assert.equal(mp4Check.permitted, true);
  assert.equal(mp4Check.fileType, 'video');
  assert.equal(mp4Check.requiresExtendedMalwareScan, false);

  const apkCheck = validateUploadFile('sharedabba-companion.apk', 15 * 1024 * 1024, 500 * 1024 * 1024);
  assert.equal(apkCheck.permitted, true);
  assert.equal(apkCheck.fileType, 'apk');
  assert.equal(apkCheck.requiresExtendedMalwareScan, true);

  const exeCheck = validateUploadFile('trojan.exe', 1024, 500 * 1024 * 1024);
  assert.equal(exeCheck.permitted, false);

  const prefCap = getAdFrequencyCapForPreference('balanced');
  assert.equal(prefCap.maxAdsPerSession, 2);
  assert.equal(prefCap.midRollEnabled, false);
  assert.equal(prefCap.targetCpmUsd, 2.0);
});
