# ShareDabba Zero-Trust Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants & Relational Master Gates
1. **Default-Deny Safety Net**: Every path not explicitly matched is denied (`match /{document=**} { allow read, write: if false; }`).
2. **PII Split-Collection Isolation**: Public creator profiles live in `/creatorProfiles/{userId}` (no email, phone, or payout destination). Private PII and UPI/USDT wallet destinations live exclusively in `/users/{userId}/private/{docId}` and are readable/writable only by the verified owner (`request.auth.uid == userId`) or a verified admin (`isAdmin()`).
3. **Verified Identity Enforcement**: All write operations require `request.auth != null && request.auth.token.email_verified == true`.
4. **Relational Master Gate on Subcollections**: Writing to `/users/{userId}/private/{docId}` requires `exists(/databases/$(database)/documents/creatorProfiles/$(userId))` so orphaned private records cannot exist without a parent creator profile.
5. **Temporal & Immutable Field Integrity**: `createdAt` must equal `request.time` on `create` and remain immutable (`incoming().createdAt == existing().createdAt`) on `update`. `updatedAt` must equal `request.time` on both `create` and `update`. `userId` and `ownerId` are strictly immutable after creation.
6. **Zero-Trust Admin Governance**: Only verified admins (`exists(/databases/$(database)/documents/admins/$(request.auth.uid))` or verified runtime bootstrap admin `rudraxsikkim@gmail.com` with `email_verified == true`) can create or update `/payoutConfigs/{configId}`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Payload 1 (Shadow Key Injection on CreatorProfile)**: Includes `"isSuperAdmin": true` alongside valid `CreatorProfile` fields. Rejected by `hasOnly()`.
2. **Payload 2 (Identity Spoofing on CreatorProfile)**: Authenticated user `uid_attacker` sets `userId: "uid_victim"` on `/creatorProfiles/uid_victim`. Rejected by `userId == request.auth.uid`.
3. **Payload 3 (Unverified Email Admin Spoof)**: Token has `email: "rudraxsikkim@gmail.com"` with `email_verified: false` attempting to update `/payoutConfigs/global`. Rejected by `request.auth.token.email_verified == true`.
4. **Payload 4 (PII Cross-Tenant Read)**: Authenticated user `uid_attacker` performs `get` on `/users/uid_victim/private/wallet`. Rejected by `isOwner(userId) || isAdmin()`.
5. **Payload 5 (Orphaned Subcollection Write)**: User writes to `/users/uid_1/private/wallet` before `/creatorProfiles/uid_1` exists. Rejected by `exists(/databases/$(database)/documents/creatorProfiles/$(userId))`.
6. **Payload 6 (Client Timestamp Forgery)**: Client passes a forged past/future timestamp instead of `request.time` for `createdAt` or `updatedAt`. Rejected by `incoming().createdAt == request.time`.
7. **Payload 7 (Immutable Owner Mutation)**: Updating `/sharedLinks/{linkId}` to change `ownerId` or `createdAt`. Rejected by `incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`.
8. **Payload 8 (Denial-of-Wallet Oversized String)**: Injecting a 100KB string into `displayName` or `title`. Rejected by strict `.size() <= 120` / `.size() <= 200` bounds.
9. **Payload 9 (ID Poisoning Attack)**: Creating a document with path ID containing spaces or special characters (`../admin`). Rejected by `isValidId()` regex `^[a-zA-Z0-9_\-]+$`.
10. **Payload 10 (Value Poisoning on Update)**: Updating `adPreference` on `/creatorProfiles/{userId}` to `"unlimited_free_money"`. Rejected by `isValidCreatorProfile(incoming())` enum check `['more', 'balanced', 'reduced']`.
11. **Payload 11 (Unbounded List / Unauthorized Blanket Query)**: Listing `/sharedLinks` without filtering by `visibility == 'public'` or `ownerId == request.auth.uid`. Rejected by rule-enforced `resource.data` predicates.
12. **Payload 12 (Negative Threshold Injection on PayoutConfig)**: Admin or attacker attempting to set `upiMinWithdrawalUsd: -50` or `usdtFeePercent: 999`. Rejected by numeric boundary checks (`upiMinWithdrawalUsd >= 1 && usdtMinWithdrawalUsd >= 5 && usdtFeePercent >= 0 && usdtFeePercent <= 25`).
