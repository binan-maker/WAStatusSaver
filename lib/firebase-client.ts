import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { appConfig, isFirebaseClientConfigured } from "@/lib/app-config";

export function getFirebaseClientApp() {
  if (!isFirebaseClientConfigured()) return null;
  if (getApps().length) return getApps()[0];
  return initializeApp(appConfig.firebase);
}

export function getFirebaseClientAuth() {
  const app = getFirebaseClientApp();
  if (!app) return null;
  return getAuth(app);
}