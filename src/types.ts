export type PageRoute =
  | 'home'
  | 'explore'
  | 'features'
  | 'how-earnings-work'
  | 'pricing'
  | 'creator-program'
  | 'referral-program'
  | 'help-faq'
  | 'contact-support'
  | 'terms'
  | 'privacy'
  | 'copyright-dmca'
  | 'acceptable-use'
  | 'login'
  | 'register'
  | 'verify-email'
  | 'recover-password'
  | 'creator-profile'
  | 'shared-landing'
  | 'dashboard'
  | 'admin'
  | 'not-found';

export type DashboardSection =
  | 'overview'
  | 'videos'
  | 'files'
  | 'upload'
  | 'analytics'
  | 'earnings'
  | 'wallet'
  | 'withdraw'
  | 'referrals'
  | 'promotions'
  | 'notifications'
  | 'settings'
  | 'support';

export type AdminSection =
  | 'overview'
  | 'users'
  | 'content'
  | 'monetization'
  | 'payout-config'
  | 'finance'
  | 'advertising'
  | 'site-config'
  | 'activity-logs'
  | 'security-audit';

export interface UserRecord {
  id: number;
  uid: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: string;
  status: string;
  plan: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  kycVerified: boolean;
  upiId: string;
  upiVerified: boolean;
  adPreference: 'reduced' | 'balanced' | 'more';
  storageUsedBytes: number;
  storageLimitBytes: number;
  referralCode: string;
  createdAt: string;
}

export interface FileRecord {
  id: number;
  slug: string;
  userId: number;
  folderId: number | null;
  title: string;
  description: string;
  filename: string;
  mimeType: string;
  fileType: 'video' | 'document' | 'archive' | 'apk';
  sizeBytes: number;
  durationSeconds: number;
  resolution: string;
  visibility: 'public' | 'unlisted' | 'private';
  passwordHash: string;
  allowDownload: boolean;
  category: string;
  tags: string;
  status: string;
  malwareScanStatus: string;
  transcodeStatus: string;
  storageKey: string;
  cdnUrl: string;
  thumbnailType: string;
  viewsCount: number;
  monetizedViewsCount: number;
  estimatedEarningsUsd: string;
  createdAt: string;
}

export interface MonetizationRulesRecord {
  id: number;
  activeMode: 'fixed_cpm' | 'revenue_share';
  targetCpmUsd: string;
  revenueSharePercent: string;
  minWatchSeconds: number;
  minWithdrawalUsd: string;
  holdPeriodDays: number;
  usdToInrRate: string;
  upiPayoutFeePercent: string;
  referralCommissionPercent: string;
  countryRatesJson: string;
  updatedAt: string;
}

export interface WalletAccountRecord {
  id: number;
  userId: number;
  availableBalanceUsd: string;
  pendingBalanceUsd: string;
  lifetimeEarnedUsd: string;
  lifetimeWithdrawnUsd: string;
  currency: string;
  updatedAt: string;
}

export interface WalletLedgerRecord {
  id: number;
  ledgerUuid: string;
  userId: number;
  entryType: string;
  amountUsd: string;
  balanceAfterUsd: string;
  balanceBucket: string;
  referenceType: string;
  referenceId: string;
  description: string;
  createdByUid: string;
  createdAt: string;
}

export interface WithdrawalRequestRecord {
  id: number;
  requestUuid: string;
  idempotencyKey: string;
  userId: number;
  amountUsd: string;
  conversionRateInr: string;
  feeUsd: string;
  netPayoutInr: string;
  payoutMethod: string;
  destinationUpiId: string;
  status: string;
  verificationStatus: string;
  fraudRiskScore: number;
  adminReviewerUid: string;
  adminNote: string;
  providerReference: string;
  createdAt: string;
}

export interface PlatformCustomCodesConfig {
  maxAdsCpmUsd: number;
  balancedAdsCpmUsd: number;
  halfAdsCpmUsd: number;
  upiPayoutEnabled: boolean;
  usdtPayoutEnabled: boolean;
  upiMinWithdrawalUsd: number;
  usdtMinWithdrawalUsd: number;
  upiFeePercent: number;
  usdtFeePercent: number;
  usdToInrRate?: number;
  usdtToInrRate?: number;
  liveRateSource?: string;
  liveRateUpdatedAt?: string;
  usdtSupportedNetworks: string;
  usdtTreasuryWallet: string;
  vastPreRollTagUrl: string;
  vastMidRollTagUrl: string;
  vastPostRollTagUrl: string;
  customAdScriptCode: string;
  customHeaderScriptCode: string;
  customPlayerEmbedCode: string;
  upiProviderName: string;
  upiKeyId: string;
  upiWebhookEndpoint: string;
  s3EndpointUrl: string;
  s3BucketName: string;
  cdnCustomDomain: string;
  supportEmail: string;
  announcementBanner: string;
  announcementBannerEnabled?: boolean;
  customHeroHeadline?: string;
  customHeroSubheadline?: string;
  customFooterTagline?: string;
  officialTelegramUrl?: string;
  maxUploadSizeMb?: number;
  registrationEnabled?: boolean;
  maintenanceMode?: boolean;
  autoApproveKycPayouts?: boolean;
}



