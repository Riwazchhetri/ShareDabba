import crypto from 'crypto';

export interface PlaybackTokenPayload {
  slug: string;
  fileId: number;
  viewerUid: string | null;
  visibility: string;
  iat: number;
  exp: number;
}

export interface PlaybackTokenVerificationResult {
  valid: boolean;
  payload?: PlaybackTokenPayload;
  reason?: string;
}

function getPlaybackSigningSecret(overrideSecret?: string): string {
  return (
    overrideSecret ||
    process.env.PLAYBACK_TOKEN_SECRET ||
    process.env.VAST_VERIFICATION_SECRET ||
    'sharedabba-playback-hmac-v1-key'
  );
}

/**
 * Generates a short-lived HMAC-SHA256 signed playback authorization token
 * for native Android & Web players without exposing raw S3/R2 storage keys.
 */
export function createSignedPlaybackToken(
  input: {
    slug: string;
    fileId: number;
    viewerUid?: string | null;
    visibility?: string;
    ttlSeconds?: number;
    nowMs?: number;
  },
  secretOverride?: string
): { token: string; expiresAt: string; expiresAtMs: number } {
  const nowMs = input.nowMs ?? Date.now();
  const ttlMs = Math.max(60, Math.min(86400, input.ttlSeconds ?? 3600)) * 1000;
  const expMs = nowMs + ttlMs;

  const payload: PlaybackTokenPayload = {
    slug: String(input.slug || '').trim(),
    fileId: Number(input.fileId),
    viewerUid: input.viewerUid || null,
    visibility: input.visibility || 'public',
    iat: Math.floor(nowMs / 1000),
    exp: Math.floor(expMs / 1000),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getPlaybackSigningSecret(secretOverride))
    .update(encodedPayload)
    .digest('base64url');

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(expMs).toISOString(),
    expiresAtMs: expMs,
  };
}

/**
 * Verifies a signed playback token and ensures it matches the requested canonical video slug
 * and has not expired.
 */
export function verifySignedPlaybackToken(
  token: string,
  expectedSlug: string,
  options?: { secretOverride?: string; nowMs?: number }
): PlaybackTokenVerificationResult {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, reason: 'Malformed or missing playback token.' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'Invalid playback token structure.' };
  }

  const [encodedPayload, providedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getPlaybackSigningSecret(options?.secretOverride))
    .update(encodedPayload)
    .digest('base64url');

  const sigBufferA = Buffer.from(providedSig, 'utf8');
  const sigBufferB = Buffer.from(expectedSig, 'utf8');
  if (
    sigBufferA.length !== sigBufferB.length ||
    !crypto.timingSafeEqual(sigBufferA, sigBufferB)
  ) {
    return { valid: false, reason: 'Invalid playback token signature.' };
  }

  try {
    const decodedJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const payload = JSON.parse(decodedJson) as PlaybackTokenPayload;

    if (!payload || payload.slug !== expectedSlug) {
      return { valid: false, reason: 'Playback token does not match requested video ID.' };
    }

    const nowSec = Math.floor((options?.nowMs ?? Date.now()) / 1000);
    if (payload.exp < nowSec) {
      return { valid: false, reason: 'Playback token has expired.' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, reason: 'Failed to decode playback token payload.' };
  }
}

/**
 * Sanitizes a database file + video + owner record into a canonical shared video DTO
 * for both Website and Native Android clients.
 * Strictly strips private storage keys (`storageKey`), `passwordHash`, and private owner PII.
 */
export function toCanonicalVideoDto(params: {
  file: Record<string, any>;
  videoMeta?: Record<string, any> | null;
  owner?: Record<string, any> | null;
}) {
  const { file, videoMeta, owner } = params;
  const slug = String(file.slug || '');
  const isAvailable = file.status === 'ready' && file.malwareScanStatus !== 'infected';
  const passwordProtected = Boolean(file.passwordHash && String(file.passwordHash).trim() !== '');

  let parsedQualities: string[] = ['1080p', '720p', '480p'];
  if (videoMeta?.qualitiesJson) {
    try {
      const q = JSON.parse(videoMeta.qualitiesJson);
      if (Array.isArray(q)) parsedQualities = q;
    } catch {
      // keep default
    }
  }

  let parsedTags: string[] = [];
  if (typeof file.tags === 'string' && file.tags.trim()) {
    parsedTags = file.tags
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);
  }

  return {
    videoId: slug, // Canonical unique video ID shared across Web & Android
    id: file.id,
    slug,
    title: file.title,
    description: file.description || '',
    filename: file.filename,
    mimeType: file.mimeType,
    fileType: file.fileType,
    sizeBytes: Number(file.sizeBytes || 0),
    durationSeconds: Number(file.durationSeconds || 0),
    resolution: file.resolution || '1080p',
    category: file.category || 'General',
    tags: parsedTags,
    visibility: file.visibility || 'public',
    passwordProtected,
    allowDownload: Boolean(file.allowDownload),
    status: file.status,
    available: isAvailable,
    unavailableReason: !isAvailable
      ? file.status === 'quarantined' || file.status === 'removed'
        ? 'This video has been removed or restricted by moderation policy.'
        : 'Video is currently processing.'
      : null,
    thumbnail: {
      type: file.thumbnailType || 'cyber',
      aspectRatio: '16:9',
    },
    metadata: {
      codec: videoMeta?.codec || 'H.264 / AAC',
      bitrateKbps: Number(videoMeta?.bitrateKbps || 4800),
      fps: Number(videoMeta?.fps || 60),
      qualities: parsedQualities,
      captionsAvailable: Boolean(videoMeta?.captionsAvailable ?? true),
      vastEnabled: Boolean(videoMeta?.vastEnabled ?? true),
    },
    stats: {
      viewsCount: Number(file.viewsCount || 0),
      monetizedViewsCount: Number(file.monetizedViewsCount || 0),
    },
    shareLinks: {
      canonicalPath: `/v/${slug}`,
      webPlayerPath: `/?v=${slug}`,
      androidAppLinkPath: `/v/${slug}`,
    },
    uploader: owner
      ? {
          uid: owner.uid,
          username: owner.username,
          displayName: owner.displayName,
          avatarUrl: owner.avatarUrl || '',
          kycVerified: Boolean(owner.kycVerified),
        }
      : null,
    createdAt: file.createdAt,
  };
}
