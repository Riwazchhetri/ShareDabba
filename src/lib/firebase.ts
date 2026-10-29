import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection();
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
      balancedAdsCpmUsd: Math.min(100, Math.max(0.1, Number(params.balancedAdsCpmUsd) || 2.0)),
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
  user: { uid: string; email?: string | null; displayName?: string | null; emailVerified?: boolean },
  options?: { adPreference?: 'more' | 'balanced' }
) {
  if (!user?.uid || !user.emailVerified) {
    return;
  }
  const cleanUid = user.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  if (!cleanUid) return;
  const path = `creatorProfiles/${cleanUid}`;
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
      plan: existingSnap.exists() ? existingSnap.data().plan : 'creator',
      createdAt: existingSnap.exists() ? existingSnap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

