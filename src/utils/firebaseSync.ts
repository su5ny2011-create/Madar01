import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import type { AppState } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with experimentalForceLongPolling and multi-tab persistent cache
// This prevents GrpcConnection RPC 'Listen' stream RST_STREAM errors in web/proxy environments
function initFirestoreInstance(): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
        localCache:
          typeof window !== 'undefined'
            ? persistentLocalCache({
                tabManager: persistentMultipleTabManager(),
              })
            : undefined,
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db: Firestore = initFirestoreInstance();

// Active clean document key in Firestore
const LIVE_STATE_DOC_ID = 'live_state_v3';

export interface SyncPayload {
  state: AppState;
  updatedAt: number;
  clientId: string;
  deletedIds?: string[];
  forceReplace?: boolean;
  resetEpoch?: number;
}

/**
 * Subscribes to real-time state changes in Firestore.
 * Ensures instant synchronization across mobile phones, tablets, and desktops
 * with resilient auto-recovery on network interruptions.
 */
export function subscribeToLiveState(
  onUpdate: (payload: SyncPayload) => void,
  onError?: (err: unknown) => void
): () => void {
  const stateDocRef = doc(db, 'system', LIVE_STATE_DOC_ID);
  let isUnsubscribed = false;
  let activeUnsubscribe: (() => void) | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function attachListener() {
    if (isUnsubscribed) return;

    activeUnsubscribe = onSnapshot(
      stateDocRef,
      { includeMetadataChanges: false },
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (
            data &&
            data.state &&
            typeof data.state === 'object' &&
            Array.isArray(data.state.users) &&
            typeof data.updatedAt === 'number'
          ) {
            onUpdate({
              state: data.state as AppState,
              updatedAt: data.updatedAt,
              clientId: data.clientId || 'unknown',
              deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds : undefined,
              forceReplace: Boolean(data.forceReplace),
              resetEpoch: typeof data.resetEpoch === 'number' ? data.resetEpoch : undefined,
            });
          }
        }
      },
      (err) => {
        console.warn('Firestore live state snapshot warning (auto-recovering):', err);
        if (onError) onError(err);
        // Automatically re-establish listener if stream gets reset or connection drops
        if (!isUnsubscribed) {
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(() => {
            if (!isUnsubscribed) {
              if (activeUnsubscribe) {
                try {
                  activeUnsubscribe();
                } catch {
                  // ignore
                }
              }
              attachListener();
            }
          }, 2500);
        }
      }
    );
  }

  attachListener();

  return () => {
    isUnsubscribed = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (activeUnsubscribe) {
      try {
        activeUnsubscribe();
      } catch {
        // ignore
      }
    }
  };
}

/**
 * Directly pushes latest state to Firestore with a fresh timestamp.
 * Sanitizes large attachments to stay safely below Firestore 1MB limit.
 */
export async function pushStateToFirestore(
  state: AppState,
  clientId: string,
  deletedIds?: string[],
  options?: { forceReplace?: boolean; resetEpoch?: number }
): Promise<number> {
  const updatedAt = Date.now();

  const sanitizedPurchases = (state.purchases || []).map((p) => {
    if (p.invoiceImageUrl && p.invoiceImageUrl.length > 70000) {
      return { ...p, invoiceImageUrl: undefined };
    }
    return p;
  });

  const sanitizedParts = (state.parts || []).map((pt) => {
    if (pt.invoiceImageUrl && pt.invoiceImageUrl.length > 70000) {
      return { ...pt, invoiceImageUrl: undefined };
    }
    return pt;
  });

  const sanitizedState: AppState = {
    ...state,
    purchases: sanitizedPurchases,
    parts: sanitizedParts,
  };

  const payload: SyncPayload = {
    state: sanitizedState,
    updatedAt,
    clientId,
    deletedIds: deletedIds || [],
    forceReplace: Boolean(options?.forceReplace),
    resetEpoch: options?.resetEpoch,
  };

  // Strip any undefined fields recursively so Firestore setDoc never rejects the document
  const cleanPayload = JSON.parse(JSON.stringify(payload));

  const stateDocRef = doc(db, 'system', LIVE_STATE_DOC_ID);
  await setDoc(stateDocRef, cleanPayload);
  return updatedAt;
}

/**
 * Loads current state from Firestore.
 */
export async function fetchStateFromFirestore(): Promise<SyncPayload | null> {
  try {
    const stateDocRef = doc(db, 'system', LIVE_STATE_DOC_ID);
    const snap = await getDoc(stateDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (
        data &&
        data.state &&
        typeof data.state === 'object' &&
        Array.isArray(data.state.users) &&
        typeof data.updatedAt === 'number'
      ) {
        return {
          state: data.state as AppState,
          updatedAt: data.updatedAt,
          clientId: data.clientId || 'unknown',
          deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds : undefined,
          forceReplace: Boolean(data.forceReplace),
          resetEpoch: typeof data.resetEpoch === 'number' ? data.resetEpoch : undefined,
        };
      }
    }
  } catch (err) {
    console.warn('Error fetching state from Firestore:', err);
  }
  return null;
}
