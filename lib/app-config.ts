export const appConfig = {
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "",
  },
  google: {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "",
  },
};

export function isDummyValue(value: string) {
  return !value || value.includes("dummy") || value.includes("your_") || value.includes("replace");
}

export function isFirebaseClientConfigured() {
  return Boolean(
    appConfig.firebase.apiKey &&
      appConfig.firebase.projectId &&
      appConfig.firebase.appId &&
      !isDummyValue(appConfig.firebase.apiKey) &&
      !isDummyValue(appConfig.firebase.projectId) &&
      !isDummyValue(appConfig.firebase.appId),
  );
}

export function isGoogleAuthConfigured() {
  return Boolean(
    appConfig.google.webClientId &&
      appConfig.google.androidClientId &&
      !isDummyValue(appConfig.google.webClientId) &&
      !isDummyValue(appConfig.google.androidClientId),
  );
}