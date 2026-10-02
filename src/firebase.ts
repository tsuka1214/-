import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, enableMultiTabIndexedDbPersistence, type Firestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db: Firestore = (() => {
  const customDbId = firebaseConfig.firestoreDatabaseId;
  let firestore: Firestore;
  if (customDbId && customDbId !== '(default)') {
    try {
      firestore = getFirestore(app, customDbId);
    } catch (err) {
      console.warn(`[Firebase] Initializing with custom databaseId "${customDbId}" failed, falling back to default:`, err);
      firestore = getFirestore(app);
    }
  } else {
    firestore = getFirestore(app);
  }

  // Enable persistence for offline support in PWA
  if (typeof window !== 'undefined') {
    enableMultiTabIndexedDbPersistence(firestore).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('[Firebase] Firestore persistence failed-precondition (multiple tabs open)');
      } else if (err.code === 'unimplemented') {
        console.warn('[Firebase] Firestore persistence unimplemented (browser not supported)');
      }
    });
  }

  return firestore;
})();
