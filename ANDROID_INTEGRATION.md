# ShareDabba — Native Android App Integration Guide (`v1`)

This document specifies the production backend API foundation, authentication protocol, canonical video model, playback authorization flow, and wallet/monetization contracts connecting the **ShareDabba Website** and the **ShareDabba Native Android Application** (`com.sharedabba.app`).

---

## 1. Unified Platform Architecture

ShareDabba operates as a single integrated ecosystem:
- **One Backend**: Express + TypeScript (`server.ts`)
- **One Database**: Cloud SQL PostgreSQL (28 relational tables defined in `src/db/schema.ts`)
- **One Authentication System**: Firebase Authentication (`ai-studio-sharedabba-205e86e5-34da-4e56-9325-c22ba569c0cd`) verified server-side via Google JWKS / RSA-256 (`src/middleware/auth.ts`)
- **One Canonical Video & Storage System**: `files` + `videos` + `upload_sessions` + `playback_sessions`
- **One Shared Wallet & Earnings Ledger**: `wallet_accounts` + `wallet_ledger` + `earning_events` + `withdrawal_requests`
- **One Centrally Controlled Monetization Engine**: **Official `$3.00` CPM Plan** (`monetization_rules` + `platform_settings`)

---

## 2. Authentication & Session Protocol

### How the Native Android App Authenticates
1. Sign the user in on Android using the **Firebase Authentication Android SDK** (Google Sign-In or Email/Password) against Firebase project `ai-studio-sharedabba-205e86e5-34da-4e56-9325-c22ba569c0cd`.
2. Retrieve the user's fresh Firebase ID Token (`FirebaseUser.getIdToken(false)`).
3. Attach the token in the HTTP `Authorization` header on every protected API call:
   ```http
   Authorization: Bearer <FIREBASE_ID_TOKEN>
   Content-Type: application/json
   ```
4. The backend middleware (`src/middleware/auth.ts`) cryptographically verifies the RS256 JWT signature, issuer, audience, and expiration against Google's SecureToken X.509 certificates.
5. Super Admin role (`super_admin`) is strictly bound to `rudraxsikkim@gmail.com` on the server. All other authenticated accounts are assigned the `creator` role.

---

## 3. Canonical Share Links & Android App Links

- **Digital Asset Links Manifest**: `GET /.well-known/assetlinks.json`
  - Configured via `ANDROID_PACKAGE_NAME` (default `com.sharedabba.app`) and `ANDROID_SHA256_CERT_FINGERPRINTS`.
- **Canonical Share URL**: `https://<domain>/v/<slug>`
- **Legacy Query Share URL**: `https://<domain>/?v=<slug>`
- **Resolution Endpoint**: `GET /api/v1/share/:slug` resolves any canonical `slug` into video metadata, uploader details, VAST monetization rules, and an Android Intent fallback URI.

---

## 4. Complete Android API Reference (`/api/v1/*`)

### 4.1 User Registration, Login, Logout & Session Management

#### `POST /api/v1/auth/register` (Protected)
Synchronizes a newly registered Firebase user into PostgreSQL (`users`, `user_profiles`, `wallet_accounts`) and records a tracked device session in `sessions`.
- **Request Body**:
  ```json
  {
    "displayName": "Aarav Sharma",
    "deviceName": "Pixel 9 Pro (Android 15)",
    "referralCode": "SD-101REF"
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "user": {
      "id": 1,
      "uid": "firebase_uid_123",
      "email": "aarav@example.com",
      "username": "aarav_123",
      "displayName": "Aarav Sharma",
      "role": "creator",
      "planTier": "Free",
      "status": "active",
      "kycVerified": false,
      "upiId": "",
      "upiVerified": false,
      "referralCode": "SD-123ABC",
      "storageUsedBytes": 0,
      "storageLimitBytes": 10737418240,
      "adPreference": "more"
    },
    "profile": {
      "bio": "ShareDabba Creator",
      "country": "IN",
      "preferredCurrency": "INR"
    },
    "wallet": {
      "availableBalanceUsd": "0.0000",
      "pendingBalanceUsd": "0.0000",
      "lifetimeEarnedUsd": "0.0000",
      "lifetimeWithdrawnUsd": "0.0000"
    },
    "session": {
      "id": 12,
      "sessionToken": "sds_1730000000000_abcd1234",
      "deviceName": "Pixel 9 Pro (Android 15)",
      "expiresAt": "2026-11-29T00:00:00.000Z"
    }
  }
  ```

#### `POST /api/v1/auth/login` (Protected)
Synchronizes an existing user login and issues a tracked device session in `sessions`.
- **Request Body**: `{ "deviceName": "Samsung S24 Ultra (Android 15)" }`
- **Response (`200 OK`)**: Same structure as `/api/v1/auth/register`.

#### `POST /api/v1/auth/logout` (Protected)
Revokes the current device session (or all sessions).
- **Request Body**: `{ "sessionId": 12, "revokeAll": false }`
- **Response (`200 OK`)**: `{ "success": true, "revokedCount": 1 }`

#### `GET /api/v1/auth/sessions` (Protected)
Lists all active and historical device sessions for the authenticated user.

#### `DELETE /api/v1/auth/sessions/:sessionId` (Protected)
Revokes a specific device session by ID.

---

### 4.2 User Profile & Account Information

#### `GET /api/v1/account` (Protected)
Returns the authenticated user's account record, extended profile (`user_profiles`), wallet summary, storage quota usage, active sessions, and notifications.

#### `PATCH /api/v1/account` (Protected)
Updates user profile and payout settings. Validates UPI ID (`name@bank`) or USDT wallet address (`TRC-20` / `ERC-20`) server-side.
- **Request Body**:
  ```json
  {
    "displayName": "Aarav Studio",
    "upiId": "aarav@okaxis",
    "bio": "4K Travel & Tech Creator",
    "website": "https://aarav.studio",
    "country": "IN"
  }
  ```

---

### 4.3 Home Video Feed, Featured, Latest, Categories & Search

#### `GET /api/v1/feed/home?limit=20` (Public)
Returns the unified home feed containing `featured` videos, `latest` videos, and `categories` with video counts. Only `status = 'ready'`, `visibility = 'public'`, and `malwareScanStatus != 'infected'` videos are returned. Private storage keys (`storageKey`) and `passwordHash` are never exposed.

#### `GET /api/v1/videos/featured?limit=20&offset=0` (Public)
Returns paginated featured public videos ranked by verified monetized views and total views.

#### `GET /api/v1/videos/latest?limit=20&offset=0` (Public)
Returns paginated latest public videos ordered by `createdAt DESC`.

#### `GET /api/v1/categories` (Public)
Returns all active video categories with public video counts:
```json
{
  "categories": [
    { "name": "Education", "slug": "education", "count": 4 }
  ]
}
```

#### `GET /api/v1/videos/search?q=monsoon&category=Education&fileType=video&sort=popular&limit=20&offset=0` (Public)
Searches and filters public `ready` videos by keyword, category, file type, and sort order (`latest` or `popular`).

---

### 4.4 Shared Video System, Playback Authorization & Recently Watched

#### `GET /api/v1/videos/:slug` (Public / Optional Auth)
Returns canonical video details, technical metadata (`codec`, `bitrateKbps`, `fps`, `qualities`, `captionsAvailable`), uploader info, and monetization config.
- If the video is `private`, only the authenticated owner (or Super Admin) receives `200 OK`; other callers receive `403 Forbidden`.
- If the video has been removed or quarantined, returns `410 Gone`.

#### `PATCH /api/v1/videos/:slug` (Protected — Owner Only)
Updates video `title`, `description`, `visibility` (`public` | `unlisted` | `private`), `category`, `tags`, `allowDownload`, or link `password`. Enforces strict server-side ownership (`file.userId === user.id`).

#### `DELETE /api/v1/videos/:slug` (Protected — Owner Only)
Soft-deletes a video (`status = 'removed'`, `visibility = 'private'`) after verifying uploader ownership.

#### `POST /api/v1/videos/:slug/playback-authorize` (Public / Optional Auth)
Validates video availability, privacy permissions, and optional link password, then issues a short-lived HMAC-SHA256 signed `playbackToken` and `authorizedStreamUrl`.
- **Request Body**:
  ```json
  {
    "password": "optional_link_password"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "authorized": true,
    "httpStatus": 200,
    "videoId": "mumbai-monsoon-4k",
    "playback": {
      "playbackToken": "<base64url_payload>.<hmac_sha256_signature>",
      "expiresAt": "2026-10-30T05:00:00.000Z",
      "authorizedStreamUrl": "/api/stream/mumbai-monsoon-4k?token=...",
      "mimeType": "video/mp4",
      "durationSeconds": 245,
      "resolution": "1080p",
      "allowDownload": true,
      "qualities": ["1080p", "720p", "480p"],
      "vast": {
        "enabled": true,
        "preRollTagUrl": "https://pubads.g.doubleclick.net/...",
        "midRollTagUrl": "https://pubads.g.doubleclick.net/...",
        "minWatchSecondsForCredit": 5,
        "targetCpmUsd": 3.0
      }
    }
  }
  ```

#### `GET /api/stream/:slug?token=<playbackToken>` (Token-Verified Stream Endpoint)
Verifies the signed `playbackToken` before authorizing stream delivery.

#### `POST /api/v1/views/report` (Public / Optional Auth)
Reports a completed playback and VAST ad impression. Credits the uploader's wallet under the **Official `$3.00` CPM Plan** when `watchDurationSeconds >= minWatchSeconds` and `verifiedAdImpression === true`. When called with an `Authorization: Bearer <token>` header, also records `viewerUid` in `playback_sessions` to populate the viewer's Recently Watched history.
- **Request Body**:
  ```json
  {
    "slug": "mumbai-monsoon-4k",
    "watchDurationSeconds": 18,
    "verifiedAdImpression": true,
    "placement": "pre_roll",
    "viewerCountry": "IN",
    "adPreference": "more",
    "deviceCategory": "Android"
  }
  ```

#### `GET /api/v1/videos/recently-watched?limit=20` (Protected)
Returns the authenticated user's recently watched videos from `playback_sessions` with watch duration and timestamp.

---

### 4.5 Uploader Profile, Creator Dashboard & Upload Pipeline

#### `GET /api/v1/uploaders/:username` (Public)
Returns public creator profile (`uid`, `username`, `displayName`, `bio`, `website`, `country`, `kycVerified`, `stats`) and their public `ready` videos. Private PII (`email`, `upiId`, `wallet`) is strictly excluded.

#### `GET /api/v1/dashboard` (Protected)
Returns the complete creator dashboard dataset (user profile, uploaded files, wallet account, immutable wallet ledger, withdrawal requests, earning events, monetization rules, referrals, notifications, and active sessions).

#### `POST /api/v1/uploads/init` (Protected)
Pre-checks file extension and account storage quota and initializes an upload session (`uploadSessionId`).

#### `POST /api/v1/uploads/complete` (Protected)
Persists the uploaded video record in `files` and `videos`, updates `storageUsedBytes`, and returns the canonical `slug` and share link.

---

### 4.6 Shared Wallet, Earnings Ledger & Withdrawals

#### `GET /api/v1/wallet` (Protected)
Returns `wallet` balances (`availableBalanceUsd`, `pendingBalanceUsd`, `lifetimeEarnedUsd`, `lifetimeWithdrawnUsd`), `monetizationPlan` (**Official `$3.00` CPM Plan**), immutable `ledger` entries, `withdrawals`, and `payoutProviderStatus`.

#### `GET /api/v1/earnings` (Protected)
Returns detailed `earningEvents`, `wallet`, `ledger`, and `withdrawals` for the authenticated creator.

#### `GET /api/v1/wallet/withdrawals` (Protected)
Returns the authenticated creator's withdrawal request history (`under_review`, `processing`, `paid`, `rejected`, `failed`).

#### `POST /api/v1/wallet/withdraw` (Protected — Rate-Limited)
Submits a server-verified UPI or USDT withdrawal request. Requires a unique `idempotencyKey` (minimum 6 characters) to prevent duplicate/replay requests. Moves funds atomically from `availableBalanceUsd` to `pendingBalanceUsd` and writes an immutable `withdrawal_hold` entry in `wallet_ledger`.
- **Request Body**:
  ```json
  {
    "amountUsd": 10.0,
    "upiId": "aarav@okaxis",
    "idempotencyKey": "android_wd_1730000000_01"
  }
  ```

---

### 4.7 App Notifications & Android Remote Configuration

#### `GET /api/v1/notifications` (Protected)
Returns `{ "unreadCount": 2, "items": [...] }` for the authenticated user.

#### `PATCH /api/v1/notifications/:id/read` (Protected)
Marks a specific notification ID (or `"all"` via `/api/v1/notifications/all/read`) as read.

#### `GET /api/v1/config/android` (Public)
Returns the live server-controlled configuration for the Android application:
- Platform status (`maintenanceMode`, `registrationEnabled`, `announcementBanner`, `maxUploadSizeMb`)
- Monetization rules (`Official $3.00 CPM Plan`, `targetCpmUsd: 3.0`, `minWatchSeconds`, live `usdToInrRate` & `usdtToInrRate`, UPI & USDT minimum withdrawal thresholds and fee percentages)
- Advertising configuration (`vastPreRollTagUrl`, `vastMidRollTagUrl`)
- Android App Links metadata (`packageName`, `sha256CertFingerprints`, `canonicalSharePathPrefix`)
- External provider readiness flags (`s3ObjectStorageConfigured`, `razorpayxUpiGatewayConfigured`, `firebaseAuthConfigured`) — **never exposes any secret keys**.

---

## 5. Required Environment Variables (`.env.example`)

| Variable | Purpose | Status in Current Environment |
| :--- | :--- | :--- |
| `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD` | Cloud SQL PostgreSQL connection | **Configured & Active** |
| `ANDROID_PACKAGE_NAME` | Android application ID (`com.sharedabba.app`) | **Configured (Default Ready)** |
| `ANDROID_SHA256_CERT_FINGERPRINTS` | Signing certificate SHA-256 fingerprints for App Links | **Configured (Update with production release keystore SHA-256)** |
| `PLAYBACK_TOKEN_SECRET` | HMAC-SHA256 secret for signing video playback tokens | **Configured (Fallback active; set strong production secret)** |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Cloudflare R2 / AWS S3 binary object storage | **External Credential Needed for live binary multipart S3 uploads** |
| `RAZORPAYX_KEY_ID`, `RAZORPAYX_KEY_SECRET`, `RAZORPAYX_WEBHOOK_SECRET` | RazorpayX automated India UPI payout settlement | **External Credential Needed for automated bank settlement (Admin manual queue active)** |
| `VAST_AD_TAG_URL` | Google Ad Manager / VAST 4.2 ad tag URL | **Configured** |
