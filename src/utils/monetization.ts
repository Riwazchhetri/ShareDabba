export type CalculationMode = 'fixed_cpm' | 'revenue_share';
export type AdPreferenceMode = 'reduced' | 'balanced' | 'more';

export interface MonetizationConfig {
  activeMode: CalculationMode;
  targetCpmUsd: number;
  revenueSharePercent: number;
  minWatchSeconds: number;
  minWithdrawalUsd: number;
  usdToInrRate: number;
  upiPayoutFeePercent: number;
  referralCommissionPercent: number;
  countryRates?: Record<string, number>;
}

export interface EarningCalculationInput {
  eligibleViews: number;
  watchDurationSeconds: number;
  verifiedAdImpression: boolean;
  grossAdRevenueUsd: number;
  viewerCountry: string;
  isInvalidTraffic?: boolean;
}

export interface EarningCalculationResult {
  qualified: boolean;
  modeApplied: CalculationMode;
  appliedCpmUsd: number;
  creatorEarnedUsd: number;
  platformShareUsd: number;
  rejectionReason?: string;
}

/**
 * Calculates creator earnings for a playback/ad event using EITHER Fixed Creator CPM OR Revenue Share.
 * Never applies both formulas to the same earning event.
 */
export function calculateCreatorEarnings(
  input: EarningCalculationInput,
  config: MonetizationConfig
): EarningCalculationResult {
  if (input.isInvalidTraffic) {
    return {
      qualified: false,
      modeApplied: config.activeMode,
      appliedCpmUsd: 0,
      creatorEarnedUsd: 0,
      platformShareUsd: 0,
      rejectionReason: 'invalid_or_bot_traffic',
    };
  }

  if (!input.verifiedAdImpression) {
    return {
      qualified: false,
      modeApplied: config.activeMode,
      appliedCpmUsd: 0,
      creatorEarnedUsd: 0,
      platformShareUsd: 0,
      rejectionReason: 'unverified_ad_impression',
    };
  }

  if (input.watchDurationSeconds < config.minWatchSeconds || input.eligibleViews <= 0) {
    return {
      qualified: false,
      modeApplied: config.activeMode,
      appliedCpmUsd: 0,
      creatorEarnedUsd: 0,
      platformShareUsd: 0,
      rejectionReason: 'below_minimum_watch_threshold',
    };
  }

  if (config.activeMode === 'fixed_cpm') {
    const countryRate =
      config.countryRates && config.countryRates[input.viewerCountry] !== undefined
        ? config.countryRates[input.viewerCountry]
        : config.targetCpmUsd;

    const appliedCpm = Math.max(0, countryRate);
    const creatorEarned = Number(((input.eligibleViews / 1000) * appliedCpm).toFixed(4));
    const platformShare = Number(Math.max(0, input.grossAdRevenueUsd - creatorEarned).toFixed(4));

    return {
      qualified: true,
      modeApplied: 'fixed_cpm',
      appliedCpmUsd: appliedCpm,
      creatorEarnedUsd: creatorEarned,
      platformShareUsd: platformShare,
    };
  } else {
    // Mode B: Revenue Share
    const shareRatio = Math.min(100, Math.max(0, config.revenueSharePercent)) / 100;
    const creatorEarned = Number((input.grossAdRevenueUsd * shareRatio).toFixed(4));
    const platformShare = Number((input.grossAdRevenueUsd - creatorEarned).toFixed(4));
    const effectiveCpm =
      input.eligibleViews > 0
        ? Number(((creatorEarned / input.eligibleViews) * 1000).toFixed(4))
        : 0;

    return {
      qualified: true,
      modeApplied: 'revenue_share',
      appliedCpmUsd: effectiveCpm,
      creatorEarnedUsd: creatorEarned,
      platformShareUsd: platformShare,
    };
  }
}

export function validateUsdtAddress(address: string): { valid: boolean; network?: 'TRC20' | 'ERC20'; reason?: string } {
  const trimmed = address.trim().replace(/^usdt:/i, '');
  if (!trimmed) {
    return { valid: false, reason: 'USDT wallet address is required.' };
  }
  const trc20Regex = /^T[a-zA-Z0-9]{25,35}$/;
  const evmRegex = /^0x[a-fA-F0-9]{40}$/;
  if (trc20Regex.test(trimmed)) {
    return { valid: true, network: 'TRC20' };
  }
  if (evmRegex.test(trimmed)) {
    return { valid: true, network: 'ERC20' };
  }
  return {
    valid: false,
    reason: 'Invalid USDT address. Expected TRC-20 (starts with T) or ERC-20/Polygon (starts with 0x).',
  };
}

export function detectPayoutMethod(destination: string): 'UPI' | 'USDT' {
  return validateUsdtAddress(destination).valid ? 'USDT' : 'UPI';
}

export function validateUpiId(upiId: string): { valid: boolean; reason?: string } {
  const trimmed = upiId.trim();
  if (!trimmed) {
    return { valid: false, reason: 'Payout destination (UPI ID or USDT address) is required.' };
  }
  const upiRegex = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/;
  if (upiRegex.test(trimmed)) {
    return { valid: true };
  }
  const usdtCheck = validateUsdtAddress(trimmed);
  if (usdtCheck.valid) {
    return { valid: true };
  }
  return {
    valid: false,
    reason: 'Invalid payout destination. Expected UPI ID (e.g. creator@okaxis) or USDT wallet (TRC-20 / ERC-20).',
  };
}

export interface WithdrawalQuote {
  eligible: boolean;
  payoutMethod: 'UPI' | 'USDT';
  amountUsd: number;
  feePercentApplied: number;
  feeUsd: number;
  netUsd: number;
  conversionRateInr: number;
  netPayoutInr: number;
  initialStatus: 'under_review' | 'verification_required' | 'approved';
  errorReason?: string;
}

export function computeWithdrawalQuote(params: {
  requestedUsd: number;
  availableBalanceUsd: number;
  minWithdrawalUsd: number;
  usdtMinWithdrawalUsd?: number;
  usdToInrRate: number;
  feePercent: number;
  usdtFeePercent?: number;
  upiPayoutEnabled?: boolean;
  usdtPayoutEnabled?: boolean;
  upiId: string;
  upiVerified: boolean;
  kycVerified: boolean;
}): WithdrawalQuote {
  const isUsdt = validateUsdtAddress(params.upiId).valid;
  const payoutMethod: 'UPI' | 'USDT' = isUsdt ? 'USDT' : 'UPI';

  const upiCheck = validateUpiId(params.upiId);
  if (!upiCheck.valid) {
    return {
      eligible: false,
      payoutMethod,
      amountUsd: params.requestedUsd,
      feePercentApplied: 0,
      feeUsd: 0,
      netUsd: 0,
      conversionRateInr: params.usdToInrRate,
      netPayoutInr: 0,
      initialStatus: 'verification_required',
      errorReason: upiCheck.reason,
    };
  }

  if (payoutMethod === 'UPI' && params.upiPayoutEnabled === false) {
    return {
      eligible: false,
      payoutMethod,
      amountUsd: params.requestedUsd,
      feePercentApplied: 0,
      feeUsd: 0,
      netUsd: 0,
      conversionRateInr: params.usdToInrRate,
      netPayoutInr: 0,
      initialStatus: 'under_review',
      errorReason: 'India UPI payouts are temporarily paused by platform administration.',
    };
  }

  if (payoutMethod === 'USDT' && params.usdtPayoutEnabled === false) {
    return {
      eligible: false,
      payoutMethod,
      amountUsd: params.requestedUsd,
      feePercentApplied: 0,
      feeUsd: 0,
      netUsd: 0,
      conversionRateInr: params.usdToInrRate,
      netPayoutInr: 0,
      initialStatus: 'under_review',
      errorReason: 'Global USDT payouts are temporarily paused by platform administration.',
    };
  }

  const requiredMinUsd =
    payoutMethod === 'USDT'
      ? params.usdtMinWithdrawalUsd ?? 20.0
      : params.minWithdrawalUsd;

  if (params.requestedUsd < requiredMinUsd) {
    return {
      eligible: false,
      payoutMethod,
      amountUsd: params.requestedUsd,
      feePercentApplied: 0,
      feeUsd: 0,
      netUsd: 0,
      conversionRateInr: params.usdToInrRate,
      netPayoutInr: 0,
      initialStatus: 'under_review',
      errorReason: `Minimum ${payoutMethod} withdrawal is $${requiredMinUsd.toFixed(2)} USD.`,
    };
  }

  if (params.requestedUsd > params.availableBalanceUsd) {
    return {
      eligible: false,
      payoutMethod,
      amountUsd: params.requestedUsd,
      feePercentApplied: 0,
      feeUsd: 0,
      netUsd: 0,
      conversionRateInr: params.usdToInrRate,
      netPayoutInr: 0,
      initialStatus: 'under_review',
      errorReason: 'Requested amount exceeds available payable balance.',
    };
  }

  const feePercentApplied =
    payoutMethod === 'USDT'
      ? params.usdtFeePercent ?? params.feePercent
      : params.feePercent;

  const feeUsd = Number(((params.requestedUsd * feePercentApplied) / 100).toFixed(4));
  const netUsd = Number((params.requestedUsd - feeUsd).toFixed(4));
  const netPayoutInr = Number((netUsd * params.usdToInrRate).toFixed(2));

  const initialStatus = !params.upiVerified
    ? 'verification_required'
    : params.requestedUsd <= 50 && params.kycVerified
    ? 'approved'
    : 'under_review';

  return {
    eligible: true,
    payoutMethod,
    amountUsd: params.requestedUsd,
    feePercentApplied,
    feeUsd,
    netUsd,
    conversionRateInr: params.usdToInrRate,
    netPayoutInr,
    initialStatus,
  };
}

export interface FileValidationResult {
  permitted: boolean;
  fileType: 'video' | 'document' | 'archive' | 'apk';
  requiresExtendedMalwareScan: boolean;
  error?: string;
}

const PERMITTED_EXTENSIONS: Record<string, 'video' | 'document' | 'archive' | 'apk'> = {
  mp4: 'video',
  webm: 'video',
  mov: 'video',
  mkv: 'video',
  pdf: 'document',
  doc: 'document',
  docx: 'document',
  txt: 'document',
  md: 'document',
  zip: 'archive',
  tar: 'archive',
  gz: 'archive',
  apk: 'apk',
};

export function validateUploadFile(
  filename: string,
  sizeBytes: number,
  planMaxBytes: number
): FileValidationResult {
  const cleanName = filename.trim();
  const parts = cleanName.split('.');
  if (parts.length < 2) {
    return {
      permitted: false,
      fileType: 'document',
      requiresExtendedMalwareScan: false,
      error: 'File must have a valid extension.',
    };
  }

  const ext = parts[parts.length - 1].toLowerCase();
  const category = PERMITTED_EXTENSIONS[ext];
  if (!category) {
    return {
      permitted: false,
      fileType: 'document',
      requiresExtendedMalwareScan: false,
      error: `Extension .${ext} is not permitted by platform security policy.`,
    };
  }

  if (sizeBytes <= 0) {
    return {
      permitted: false,
      fileType: category,
      requiresExtendedMalwareScan: false,
      error: 'File size must be greater than 0 bytes.',
    };
  }

  if (sizeBytes > planMaxBytes) {
    return {
      permitted: false,
      fileType: category,
      requiresExtendedMalwareScan: false,
      error: `File size exceeds your plan upload limit (${Math.round(planMaxBytes / (1024 * 1024))} MB).`,
    };
  }

  return {
    permitted: true,
    fileType: category,
    requiresExtendedMalwareScan: category === 'apk' || category === 'archive',
  };
}

export interface DynamicCpmTiers {
  maxAdsCpmUsd: number;
  balancedAdsCpmUsd: number;
  halfAdsCpmUsd?: number;
}

export function getDynamicCpmForAdPlan(
  _pref: AdPreferenceMode,
  tiers: DynamicCpmTiers = {
    maxAdsCpmUsd: 3.0,
    balancedAdsCpmUsd: 3.0,
  }
): {
  planName: string;
  cpmUsd: number;
  headlineBenefit: string;
  detailBenefit: string;
} {
  return {
    planName: 'Official $3.00 CPM Plan',
    cpmUsd: tiers.maxAdsCpmUsd || 3.0,
    headlineBenefit: 'Maximum Creator Yield · $3.00 Per 1,000 Verified Views',
    detailBenefit:
      'Multi-slot VAST 4.2 delivery (skippable pre-roll + eligible mid-roll) engineered for maximum creator revenue yield per 1,000 verified views.',
  };
}

export function getAdFrequencyCapForPreference(_pref: AdPreferenceMode): {
  maxAdsPerSession: number;
  preRollProbability: number;
  midRollEnabled: boolean;
  countdownSeconds: number;
  targetCpmUsd: number;
  planTitle: string;
  description: string;
} {
  return {
    maxAdsPerSession: 4,
    preRollProbability: 1.0,
    midRollEnabled: true,
    countdownSeconds: 5,
    targetCpmUsd: 3.0,
    planTitle: 'Official $3.00 CPM Plan',
    description:
      'Official $3.00 CPM Plan: Maximum creator earning with VAST 4.2 pre-roll + mid-roll ad placements.',
  };
}

