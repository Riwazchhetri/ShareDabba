import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  numeric,
  timestamp,
} from 'drizzle-orm/pg-core';

// 1. Users table (Firebase UID linked)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  username: text('username').notNull(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url').default(''),
  role: text('role').notNull().default('creator'), // visitor | user | creator | moderator | finance_admin | super_admin
  status: text('status').notNull().default('active'), // active | suspended | restricted
  plan: text('plan').notNull().default('free'), // free | creator | pro | enterprise
  emailVerified: boolean('email_verified').notNull().default(true),
  twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
  kycVerified: boolean('kyc_verified').notNull().default(false),
  upiId: text('upi_id').default(''),
  upiVerified: boolean('upi_verified').notNull().default(false),
  adPreference: text('ad_preference').notNull().default('balanced'), // reduced | balanced | more
  storageUsedBytes: bigint('storage_used_bytes', { mode: 'number' }).notNull().default(0),
  storageLimitBytes: bigint('storage_limit_bytes', { mode: 'number' }).notNull().default(10737418240), // 10 GB default
  referralCode: text('referral_code').notNull(),
  referredByCode: text('referred_by_code').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. User profiles
export const userProfiles = pgTable('user_profiles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  bio: text('bio').default(''),
  website: text('website').default(''),
  country: text('country').default('IN'),
  taxId: text('tax_id').default(''),
  ageVerified: boolean('age_verified').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. Roles
export const roles = pgTable('roles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Permissions
export const permissions = pgTable('permissions', {
  id: serial('id').primaryKey(),
  roleName: text('role_name').notNull(),
  permissionKey: text('permission_key').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Sessions
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  deviceInfo: text('device_info').notNull(),
  ipAddress: text('ip_address').notNull(),
  active: boolean('active').notNull().default(true),
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 6. Folders
export const folders = pgTable('folders', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  parentId: integer('parent_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Files
export const files = pgTable('files', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  userId: integer('user_id').references(() => users.id).notNull(),
  folderId: integer('folder_id'),
  title: text('title').notNull(),
  description: text('description').default(''),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  fileType: text('file_type').notNull().default('video'), // video | document | archive | apk
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  resolution: text('resolution').default('1080p'),
  visibility: text('visibility').notNull().default('public'), // public | unlisted | private
  passwordHash: text('password_hash').default(''),
  expiresAt: timestamp('expires_at'),
  allowDownload: boolean('allow_download').notNull().default(true),
  category: text('category').notNull().default('Technology'),
  tags: text('tags').default(''),
  status: text('status').notNull().default('ready'), // uploading | processing | ready | quarantined | removed
  malwareScanStatus: text('malware_scan_status').notNull().default('clean'), // pending | clean | flagged
  transcodeStatus: text('transcode_status').notNull().default('completed'), // queued | transcoding | completed | failed
  storageKey: text('storage_key').notNull(),
  cdnUrl: text('cdn_url').notNull(),
  thumbnailType: text('thumbnail_type').notNull().default('cinema'),
  viewsCount: integer('views_count').notNull().default(0),
  monetizedViewsCount: integer('monetized_views_count').notNull().default(0),
  estimatedEarningsUsd: numeric('estimated_earnings_usd', { precision: 12, scale: 4 }).notNull().default('0.0000'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 8. Videos metadata
export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  fileId: integer('file_id').references(() => files.id).notNull(),
  codec: text('codec').notNull().default('H.264 / AAC'),
  bitrateKbps: integer('bitrate_kbps').notNull().default(4500),
  fps: integer('fps').notNull().default(60),
  qualitiesJson: text('qualities_json').notNull().default('["1080p","720p","480p"]'),
  captionsAvailable: boolean('captions_available').notNull().default(true),
  vastEnabled: boolean('vast_enabled').notNull().default(true),
  preRollEnabled: boolean('pre_roll_enabled').notNull().default(true),
  midRollEnabled: boolean('mid_roll_enabled').notNull().default(false),
  postRollEnabled: boolean('post_roll_enabled').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Upload sessions
export const uploadSessions = pgTable('upload_sessions', {
  id: serial('id').primaryKey(),
  sessionToken: text('session_token').notNull().unique(),
  userId: integer('user_id').references(() => users.id).notNull(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  totalBytes: bigint('total_bytes', { mode: 'number' }).notNull(),
  uploadedBytes: bigint('uploaded_bytes', { mode: 'number' }).notNull().default(0),
  chunksCompleted: integer('chunks_completed').notNull().default(0),
  totalChunks: integer('total_chunks').notNull().default(1),
  status: text('status').notNull().default('in_progress'), // in_progress | completed | cancelled | failed
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 10. Video processing jobs
export const videoProcessingJobs = pgTable('video_processing_jobs', {
  id: serial('id').primaryKey(),
  fileId: integer('file_id').references(() => files.id).notNull(),
  jobType: text('job_type').notNull().default('transcode_hls'), // malware_scan | thumbnail_extract | transcode_hls
  status: text('status').notNull().default('completed'), // queued | processing | completed | failed
  progressPercent: integer('progress_percent').notNull().default(100),
  workerNode: text('worker_node').notNull().default('worker-asia-se1-01'),
  errorMessage: text('error_message').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at').defaultNow(),
});

// 11. Playback sessions
export const playbackSessions = pgTable('playback_sessions', {
  id: serial('id').primaryKey(),
  sessionToken: text('session_token').notNull().unique(),
  fileId: integer('file_id').references(() => files.id).notNull(),
  viewerUid: text('viewer_uid').default('anonymous'),
  viewerCountry: text('viewer_country').notNull().default('IN'),
  deviceCategory: text('device_category').notNull().default('Desktop'),
  referrer: text('referrer').notNull().default('Direct'),
  adPreference: text('ad_preference').notNull().default('balanced'),
  watchDurationSeconds: integer('watch_duration_seconds').notNull().default(0),
  qualifiedView: boolean('qualified_view').notNull().default(false),
  monetized: boolean('monetized').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Ad events
export const adEvents = pgTable('ad_events', {
  id: serial('id').primaryKey(),
  eventUuid: text('event_uuid').notNull().unique(),
  playbackSessionId: integer('playback_session_id').references(() => playbackSessions.id),
  fileId: integer('file_id').references(() => files.id).notNull(),
  creatorUserId: integer('creator_user_id').references(() => users.id).notNull(),
  placement: text('placement').notNull().default('pre_roll'), // pre_roll | mid_roll | post_roll
  vastProvider: text('vast_provider').notNull().default('ShareDabba Direct VAST 4.2'),
  status: text('status').notNull().default('impression_verified'), // impression_verified | skipped | blocked | failed
  cpmRateUsd: numeric('cpm_rate_usd', { precision: 10, scale: 4 }).notNull().default('2.0000'),
  grossRevenueUsd: numeric('gross_revenue_usd', { precision: 12, scale: 4 }).notNull().default('0.0031'),
  creatorShareUsd: numeric('creator_share_usd', { precision: 12, scale: 4 }).notNull().default('0.0020'),
  viewerCountry: text('viewer_country').notNull().default('IN'),
  verifiedServerSide: boolean('verified_server_side').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 13. Monetization rules
export const monetizationRules = pgTable('monetization_rules', {
  id: serial('id').primaryKey(),
  activeMode: text('active_mode').notNull().default('fixed_cpm'), // fixed_cpm | revenue_share
  targetCpmUsd: numeric('target_cpm_usd', { precision: 10, scale: 2 }).notNull().default('2.00'),
  revenueSharePercent: numeric('revenue_share_percent', { precision: 5, scale: 2 }).notNull().default('65.00'),
  minWatchSeconds: integer('min_watch_seconds').notNull().default(5),
  minWithdrawalUsd: numeric('min_withdrawal_usd', { precision: 10, scale: 2 }).notNull().default('5.00'),
  holdPeriodDays: integer('hold_period_days').notNull().default(7),
  usdToInrRate: numeric('usd_to_inr_rate', { precision: 10, scale: 2 }).notNull().default('84.20'),
  upiPayoutFeePercent: numeric('upi_payout_fee_percent', { precision: 5, scale: 2 }).notNull().default('0.00'),
  referralCommissionPercent: numeric('referral_commission_percent', { precision: 5, scale: 2 }).notNull().default('10.00'),
  countryRatesJson: text('country_rates_json').notNull().default('{"US":3.40,"GB":3.10,"DE":2.80,"IN":2.00,"SG":2.60,"CA":3.00}'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 14. Earning events (Immutable creator earning records)
export const earningEvents = pgTable('earning_events', {
  id: serial('id').primaryKey(),
  eventUuid: text('event_uuid').notNull().unique(),
  creatorUserId: integer('creator_user_id').references(() => users.id).notNull(),
  fileId: integer('file_id').references(() => files.id).notNull(),
  adEventId: integer('ad_event_id'),
  calculationMode: text('calculation_mode').notNull().default('fixed_cpm'), // fixed_cpm | revenue_share
  eligibleViews: integer('eligible_views').notNull().default(1),
  appliedCpmUsd: numeric('applied_cpm_usd', { precision: 10, scale: 4 }).notNull().default('2.0000'),
  grossAdRevenueUsd: numeric('gross_ad_revenue_usd', { precision: 12, scale: 4 }).notNull().default('0.0031'),
  creatorEarnedUsd: numeric('creator_earned_usd', { precision: 12, scale: 4 }).notNull().default('0.0020'),
  status: text('status').notNull().default('finalized'), // estimated | finalized | adjusted | rejected_invalid_traffic
  trafficSegment: text('traffic_segment').notNull().default('IN-Tier1'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 15. Wallet accounts
export const walletAccounts = pgTable('wallet_accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull().unique(),
  availableBalanceUsd: numeric('available_balance_usd', { precision: 12, scale: 4 }).notNull().default('0.0000'),
  pendingBalanceUsd: numeric('pending_balance_usd', { precision: 12, scale: 4 }).notNull().default('0.0000'),
  lifetimeEarnedUsd: numeric('lifetime_earned_usd', { precision: 12, scale: 4 }).notNull().default('0.0000'),
  lifetimeWithdrawnUsd: numeric('lifetime_withdrawn_usd', { precision: 12, scale: 4 }).notNull().default('0.0000'),
  currency: text('currency').notNull().default('USD'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 16. Wallet ledger (Immutable financial audit log)
export const walletLedger = pgTable('wallet_ledger', {
  id: serial('id').primaryKey(),
  ledgerUuid: text('ledger_uuid').notNull().unique(),
  userId: integer('user_id').references(() => users.id).notNull(),
  entryType: text('entry_type').notNull(), // ad_earning_credit | referral_bonus | withdrawal_hold | withdrawal_paid | withdrawal_reversal | invalid_traffic_adjustment
  amountUsd: numeric('amount_usd', { precision: 12, scale: 4 }).notNull(),
  balanceAfterUsd: numeric('balance_after_usd', { precision: 12, scale: 4 }).notNull(),
  balanceBucket: text('balance_bucket').notNull().default('available'), // available | pending
  referenceType: text('reference_type').notNull(),
  referenceId: text('reference_id').notNull(),
  description: text('description').notNull(),
  createdByUid: text('created_by_uid').notNull().default('system'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 17. Withdrawal requests
export const withdrawalRequests = pgTable('withdrawal_requests', {
  id: serial('id').primaryKey(),
  requestUuid: text('request_uuid').notNull().unique(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  userId: integer('user_id').references(() => users.id).notNull(),
  amountUsd: numeric('amount_usd', { precision: 12, scale: 4 }).notNull(),
  conversionRateInr: numeric('conversion_rate_inr', { precision: 10, scale: 2 }).notNull(),
  feeUsd: numeric('fee_usd', { precision: 10, scale: 4 }).notNull().default('0.0000'),
  netPayoutInr: numeric('net_payout_inr', { precision: 12, scale: 2 }).notNull(),
  payoutMethod: text('payout_method').notNull().default('UPI'),
  destinationUpiId: text('destination_upi_id').notNull(),
  status: text('status').notNull().default('under_review'), // requested | verification_required | under_review | approved | processing | paid | failed | reversed | rejected
  verificationStatus: text('verification_status').notNull().default('verified'),
  fraudRiskScore: integer('fraud_risk_score').notNull().default(4),
  adminReviewerUid: text('admin_reviewer_uid').default(''),
  adminNote: text('admin_note').default(''),
  providerReference: text('provider_reference').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 18. Payout transactions
export const payoutTransactions = pgTable('payout_transactions', {
  id: serial('id').primaryKey(),
  withdrawalRequestId: integer('withdrawal_request_id').references(() => withdrawalRequests.id).notNull(),
  providerName: text('provider_name').notNull().default('RazorpayX UPI Payouts'),
  providerTxId: text('provider_tx_id').notNull(),
  status: text('status').notNull(),
  webhookVerified: boolean('webhook_verified').notNull().default(false),
  rawResponseJson: text('raw_response_json').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 19. Referral codes
export const referralCodes = pgTable('referral_codes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  code: text('code').notNull().unique(),
  clicksCount: integer('clicks_count').notNull().default(0),
  registrationsCount: integer('registrations_count').notNull().default(0),
  eligibleReferralsCount: integer('eligible_referrals_count').notNull().default(0),
  totalEarnedUsd: numeric('total_earned_usd', { precision: 12, scale: 4 }).notNull().default('0.0000'),
  campaignName: text('campaign_name').notNull().default('Default Creator Partner'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 20. Referral events
export const referralEvents = pgTable('referral_events', {
  id: serial('id').primaryKey(),
  referralCodeId: integer('referral_code_id').references(() => referralCodes.id).notNull(),
  referrerUserId: integer('referrer_user_id').references(() => users.id).notNull(),
  referredUserEmail: text('referred_user_email').notNull(),
  eventType: text('event_type').notNull(), // click | registration | milestone_reward
  commissionUsd: numeric('commission_usd', { precision: 12, scale: 4 }).notNull().default('0.0000'),
  status: text('status').notNull().default('verified'), // verified | flagged_self_referral | pending
  ipHash: text('ip_hash').notNull().default('sha256:8f91e0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 21. Subscriptions
export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  planId: text('plan_id').notNull(), // free | creator | pro | enterprise
  planName: text('plan_name').notNull(),
  priceMonthlyUsd: numeric('price_monthly_usd', { precision: 10, scale: 2 }).notNull(),
  storageQuotaBytes: bigint('storage_quota_bytes', { mode: 'number' }).notNull(),
  status: text('status').notNull().default('active'), // active | pending_payment | cancelled
  gatewayReference: text('gateway_reference').default(''),
  currentPeriodEnd: timestamp('current_period_end').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 22. Payment events
export const paymentEvents = pgTable('payment_events', {
  id: serial('id').primaryKey(),
  eventUuid: text('event_uuid').notNull().unique(),
  userId: integer('user_id').references(() => users.id).notNull(),
  eventType: text('event_type').notNull(),
  provider: text('provider').notNull(),
  amountUsd: numeric('amount_usd', { precision: 10, scale: 2 }).notNull(),
  status: text('status').notNull(),
  verifiedWebhook: boolean('verified_webhook').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 23. Reports (Abuse & Copyright / DMCA)
export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  fileId: integer('file_id').references(() => files.id),
  reporterEmail: text('reporter_email').notNull(),
  reasonCategory: text('reason_category').notNull(), // copyright_dmca | malware | prohibited_content | spam
  details: text('details').notNull(),
  copyrightClaim: boolean('copyright_claim').notNull().default(false),
  status: text('status').notNull().default('open'), // open | investigating | resolved_removed | dismissed
  resolutionNote: text('resolution_note').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 24. Moderation actions
export const moderationActions = pgTable('moderation_actions', {
  id: serial('id').primaryKey(),
  adminUid: text('admin_uid').notNull(),
  targetType: text('target_type').notNull(), // file | user | report
  targetId: integer('target_id').notNull(),
  action: text('action').notNull(), // quarantine | reinstate | suspend_user | dismiss_report
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 25. Support tickets
export const supportTickets = pgTable('support_tickets', {
  id: serial('id').primaryKey(),
  ticketNumber: text('ticket_number').notNull().unique(),
  userId: integer('user_id'),
  email: text('email').notNull(),
  subject: text('subject').notNull(),
  category: text('category').notNull().default('Payouts & UPI'),
  priority: text('priority').notNull().default('normal'), // low | normal | high | urgent
  message: text('message').notNull(),
  status: text('status').notNull().default('open'), // open | in_progress | resolved
  adminReply: text('admin_reply').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 26. Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  category: text('category').notNull().default('system'), // earnings | payout | upload | security | system
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 27. Audit logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUid: text('actor_uid').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  metadataJson: text('metadata_json').notNull().default('{}'),
  ipAddress: text('ip_address').notNull().default('127.0.0.1'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 28. Platform settings
export const platformSettings = pgTable('platform_settings', {
  id: serial('id').primaryKey(),
  settingKey: text('setting_key').notNull().unique(),
  settingValueJson: text('setting_value_json').notNull(),
  updatedByUid: text('updated_by_uid').notNull().default('system'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
