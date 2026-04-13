import { initializeApp, getApps } from "firebase/app";
import { initializeAuth, getAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { appConfig, isFirebaseClientConfigured } from "@/lib/app-config";

export function getFirebaseClientApp() {
  if (!isFirebaseClientConfigured()) return null;
  if (getApps().length) return getApps()[0];
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