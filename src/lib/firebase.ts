import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Clean up any stale cached Firebase Auth tokens in browser storage that could trigger
// background STS token refresh calls when securetoken.googleapis.com is disabled.
if (typeof window !== 'undefined') {
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      if (!storage) continue;
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith('firebase:')) {
          keysToRemove.push(key);
        }
      }
      for (const k of keysToRemove) {
        storage.removeItem(k);
      }
    }
    if (window.indexedDB && typeof window.indexedDB.deleteDatabase === 'function') {
      window.indexedDB.deleteDatabase('firebaseLocalStorageDb');
    }
  } catch {
    // Ignore storage access restrictions in sandboxed iframes
  }
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

function createSafeAuth(): Auth {
  try {
    return initializeAuth(app, {
      persistence: inMemoryPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    return getAuth(app);
  }
}

export const auth = createSafeAuth();
export const googleAuthProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isStsTokenServiceDisabledError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || '');
  return (
    msg.includes('token-service-api-has-not-been-used') ||
    msg.includes('securetoken.googleapis.com') ||
    msg.includes('Fetching auth token failed') ||
    msg.includes('the client is offline')
  );
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  if (isStsTokenServiceDisabledError(error)) {
    // Primary persistence is handled by Cloud SQL PostgreSQL; suppress noisy STS disabled warnings.
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore operation warning:', JSON.stringify(errInfo));
}

export async function safeGetIdToken(
  user: { getIdToken?: (forceRefresh?: boolean) => Promise<string> } | null | undefined
): Promise<string | null> {
  if (!user || typeof user.getIdToken !== 'function') {
    return null;
  }
  try {
    return await user.getIdToken(false);
  } catch {
    return null;
  }
}

export async function syncPayoutConfigToFirestore(params: {
  upiPayoutEnabled: boolean;
  usdtPayoutEnabled: boolean;
  upiMinWithdrawalUsd: number;
  usdtMinWithdrawalUsd: number;
  upiFeePercent: number;
  usdtFeePercent: number;
  maxAdsCpmUsd: number;
  balancedAdsCpmUsd: number;
}) {
  if (!auth.currentUser?.uid || !auth.currentUser?.emailVerified) {
    return;
  }
  const token = await safeGetIdToken(auth.currentUser);
  if (!token) {
    return;
  }
  const path = 'payoutConfigs/global';
  try {
    const ref = doc(db, 'payoutConfigs', 'global');
    const existingSnap = await getDoc(ref);
    const payload = {
      configId: 'global',
      updatedByUid: auth.currentUser.uid.slice(0, 128),
      upiPayoutEnabled: Boolean(params.upiPayoutEnabled),
      usdtPayoutEnabled: Boolean(params.usdtPayoutEnabled),
      upiMinWithdrawalUsd: Math.min(10000, Math.max(1, Number(params.upiMinWithdrawalUsd) || 5)),
      usdtMinWithdrawalUsd: Math.min(50000, Math.max(5, Number(params.usdtMinWithdrawalUsd) || 20)),
      upiFeePercent: Math.min(25, Math.max(0, Number(params.upiFeePercent) || 0)),
      usdtFeePercent: Math.min(25, Math.max(0, Number(params.usdtFeePercent) || 1.5)),
      maxAdsCpmUsd: Math.min(100, Math.max(0.1, Number(params.maxAdsCpmUsd) || 3.0)),
      balancedAdsCpmUsd: Math.min(100, Math.max(0.1, Number(params.balancedAdsCpmUsd) || 3.0)),
      createdAt: existingSnap.exists() ? existingSnap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToGlobalPayoutConfig(
  onUpdate: (data: Record<string, unknown>) => void
) {
  const path = 'payoutConfigs/global';
  const ref = doc(db, 'payoutConfigs', 'global');
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data());
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function syncCreatorProfileToFirestore(
  user: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    emailVerified?: boolean;
    getIdToken?: (forceRefresh?: boolean) => Promise<string>;
  },
  options?: { adPreference?: 'more' | 'balanced' }
) {
  if (!user?.uid || !user.emailVerified) {
    return;
  }
  const token = await safeGetIdToken(user);
  if (!token) {
    return;
  }
  const cleanUid = user.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  if (!cleanUid) return;
  try {
    const ref = doc(db, 'creatorProfiles', cleanUid);
    const existingSnap = await getDoc(ref);
    const rawUsername = (user.email?.split('@')[0] || user.displayName || 'creator')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);
    const username = rawUsername.length >= 2 ? rawUsername : 'creator_user';
    const displayName = (user.displayName || user.email?.split('@')[0] || 'Creator').slice(0, 120);
    const adPreference = options?.adPreference === 'more' ? 'more' : 'balanced';

    await setDoc(ref, {
      userId: cleanUid,
      username: existingSnap.exists() ? existingSnap.data().username : username,
      displayName,
      adPreference,
      plan: existingSnap.exists() ? existingSnap.data().plan : 'free',
      createdAt: existingSnap.exists() ? existingSnap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal: PostgreSQL is the primary source of truth
  }
}
