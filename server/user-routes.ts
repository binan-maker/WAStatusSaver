import type { Express, Request, Response } from "express";
import { getFirebaseAuth, getFirestoreDb, firestoreFieldValue } from "./config/firebase-admin";

export function registerUserRoutes(app: Express) {
  app.post("/api/users/delete-account", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    const firebaseAuth = getFirebaseAuth();
    const db = getFirestoreDb();

    if (!firebaseAuth || !db) {
      return res.status(503).json({ error: "Firebase not configured on the server" });
    }

    let uid: string;
    try {
      const decoded = await firebaseAuth.verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return res.status(401).json({ error: "Invalid or expired ID token" });
    }

    try {
      const deletionScheduledAt = new Date();
      deletionScheduledAt.setDate(deletionScheduledAt.getDate() + 30);

      await db.collection("users").doc(uid).set(
        {
          pendingDeletion: true,
          deletionScheduledAt: deletionScheduledAt.toISOString(),
          deletionRequestedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await db.collection("deletionQueue").doc(uid).set({
        uid,
        scheduledAt: deletionScheduledAt.toISOString(),
        requestedAt: new Date().toISOString(),
        status: "pending",
      });

      return res.json({
        success: true,
        message: "Account scheduled for deletion in 30 days.",
        deletionScheduledAt: deletionScheduledAt.toISOString(),
      });
    } catch (err) {
      console.error("Error scheduling account deletion:", err);
      return res.status(500).json({ error: "Failed to schedule account deletion" });
    }
  });

  app.post("/api/users/cancel-deletion", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    const firebaseAuth = getFirebaseAuth();
    const db = getFirestoreDb();

    if (!firebaseAuth || !db) {
      return res.status(503).json({ error: "Firebase not configured on the server" });
    }

    let uid: string;
    try {
      const decoded = await firebaseAuth.verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return res.status(401).json({ error: "Invalid or expired ID token" });
    }

    try {
      await db.collection("users").doc(uid).set(
        {
          pendingDeletion: false,
          deletionScheduledAt: null,
          deletionRequestedAt: null,
        },
        { merge: true }
      );

      await db.collection("deletionQueue").doc(uid).delete();

      return res.json({ success: true, message: "Account deletion cancelled." });
    } catch (err) {
      console.error("Error cancelling account deletion:", err);
      return res.status(500).json({ error: "Failed to cancel account deletion" });
    }
  });
}
