import type { Request } from "express";
import { getFirebaseAuth } from "../../server/config/firebase-admin";

export type AuthenticatedUser = {
  uid: string;
  email?: string;
  name?: string;
};

export function normalizeDeviceId(deviceId: unknown): string {
  if (typeof deviceId !== "string") return "";
  return deviceId.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

export async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  const auth = getFirebaseAuth();
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!auth || !token) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : undefined,
      name: typeof decoded.name === "string" ? decoded.name : undefined,
    };
  } catch {
    return null;
  }
}
