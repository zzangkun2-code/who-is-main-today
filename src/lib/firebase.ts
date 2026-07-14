import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseEnvValues = [
  {
    key: "NEXT_PUBLIC_FIREBASE_API_KEY",
    value: process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  },
  {
    key: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    value: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  },
  {
    key: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    value: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  },
  {
    key: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    value: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  },
  {
    key: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    value: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  },
  {
    key: "NEXT_PUBLIC_FIREBASE_APP_ID",
    value: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  }
] as const;

const missingFirebaseEnvKeys = firebaseEnvValues
  .filter(({ value }) => !value)
  .map(({ key }) => key);

export const missingFirebaseConfigKeys = missingFirebaseEnvKeys;
export const firebaseProjectId =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";

if (missingFirebaseEnvKeys.length > 0) {
  console.error(
    "[who-is-main-today Firebase] Missing required environment variables:",
    missingFirebaseEnvKeys
  );
}

const firebaseConfig: FirebaseOptions = {
  apiKey: firebaseEnvValues[0].value,
  authDomain: firebaseEnvValues[1].value,
  projectId: firebaseEnvValues[2].value,
  storageBucket: firebaseEnvValues[3].value,
  messagingSenderId: firebaseEnvValues[4].value,
  appId: firebaseEnvValues[5].value
};

export const hasFirebaseConfig = missingFirebaseEnvKeys.length === 0;

export const firebaseApp: FirebaseApp | null = hasFirebaseConfig
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
export const db: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null;

export function requireAuth() {
  if (!auth) {
    throw new Error(
      `who-is-main-today Firebase Auth is not initialized. Missing env keys: ${
        missingFirebaseEnvKeys.join(", ") || "none"
      }`
    );
  }
  return auth;
}

export function requireDb() {
  if (!db) {
    throw new Error(
      `who-is-main-today Firebase Firestore is not initialized. Missing env keys: ${
        missingFirebaseEnvKeys.join(", ") || "none"
      }`
    );
  }
  return db;
}
