import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";
import { getFirestore, collection, addDoc, serverTimestamp, type Firestore } from "firebase/firestore";

export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;
let db: Firestore | null = null;
let isInitialized = false;

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

export async function initFirebase(): Promise<{
  app: FirebaseApp | null;
  analytics: Analytics | null;
  db: Firestore | null;
}> {
  if (isInitialized) {
    return { app, analytics, db };
  }

  if (!isFirebaseConfigured()) {
    // In dev or without env variables, gracefully skip Firebase
    isInitialized = true;
    return { app: null, analytics: null, db: null };
  }

  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig as Record<string, string>);
    } else {
      app = getApps()[0];
    }

    try {
      db = getFirestore(app);
    } catch (err) {
      console.warn("[Firebase] Failed to initialize Firestore:", err);
    }

    try {
      const analyticsSupported = await isSupported();
      if (analyticsSupported && app) {
        analytics = getAnalytics(app);
      }
    } catch (err) {
      console.warn("[Firebase] Analytics not supported in this environment:", err);
    }
  } catch (err) {
    console.warn("[Firebase] Initialization error:", err);
  }

  isInitialized = true;
  return { app, analytics, db };
}

export function getFirebaseApp(): FirebaseApp | null {
  return app;
}

export function getFirebaseAnalytics(): Analytics | null {
  return analytics;
}

export function getFirebaseDb(): Firestore | null {
  return db;
}

export { logEvent, collection, addDoc, serverTimestamp };
