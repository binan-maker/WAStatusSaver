import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { appConfig, isFirebaseClientConfigured } from "@/lib/app-config";

export function getFirebaseClientApp(): FirebaseApp | null {
  if (!isFirebaseClientConfigured()) return null;
  if (getApps().length) return getApps()[0]!;
  return initializeApp(appConfig.firebase);
}

export function getFirebaseClientAuth() {
  const app = getFirebaseClientApp();
  if (!app) return null;
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

let cachedDb: Firestore | null = null;

/**
 * Centralized Firestore client. Initializes once with long-polling fallback
 * (some Android devices / corporate networks fail with the streaming
 * transport) and subsequently returns the cached instance.
 */
export function getFirebaseClientDb(): Firestore | null {
  const app = getFirebaseClientApp();
  if (!app) return null;
  if (cachedDb) return cachedDb;
  try {
    cachedDb = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    cachedDb = getFirestore(app);
  }
  return cachedDb;
}