import admin from "firebase-admin";

let initializationError: string | null = null;

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    initializationError = "FIREBASE_SERVICE_ACCOUNT_JSON is not configured";
    return null;
  }

  const normalized = raw.trim();
  const candidates = [
    normalized,
    Buffer.from(normalized, "base64").toString("utf8"),
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed.private_key === "string") {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      }
      return parsed;
    } catch {}
  }

  try {
    const parsed = JSON.parse(normalized.replace(/\\n/g, "\n"));
    return parsed;
  } catch {
    initializationError = "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON";
    return null;
  }
}

export function getFirestoreDb() {
  if (!admin.apps.length) {
    const serviceAccount = getServiceAccount();
    if (!serviceAccount) return null;

    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
      });
      initializationError = null;
    } catch (error) {
      initializationError = error instanceof Error ? error.message : "Firebase initialization failed";
      return null;
    }
  }

  return admin.firestore();
}

export function getFirebaseStatus() {
  return {
    configured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    ready: Boolean(getFirestoreDb()),
    error: initializationError,
  };
}

export const firestoreTimestamp = admin.firestore.Timestamp;
export const firestoreFieldValue = admin.firestore.FieldValue;