import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Platform } from "react-native";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithCredential, signOut as firebaseSignOut } from "firebase/auth";
import { appConfig, isFirebaseClientConfigured, isGoogleAuthConfigured } from "@/lib/app-config";
import { getFirebaseClientAuth } from "@/lib/firebase-client";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useMemo(() => getFirebaseClientAuth(), []);
  const configured = Boolean(auth && isFirebaseClientConfigured() && isGoogleAuthConfigured());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(auth));
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (configured && appConfig.google.webClientId) {
      GoogleSignin.configure({
        webClientId: appConfig.google.webClientId,
        scopes: ["openid", "email", "profile"],
        offlineAccess: false,
        forceCodeForRefreshToken: false,
      });
    }
  }, [configured]);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return unsubscribe;
  }, [auth]);

  const value: AuthContextValue = {
    user,
    loading,
    signingIn,
    configured,
    signInWithGoogle: async () => {
      if (!configured) {
        Alert.alert(
          "Google sign-in not configured",
          "Add Firebase client config and Google OAuth client IDs to your .env file before using subscriptions."
        );
        return;
      }

      setSigningIn(true);
      try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const signInResult = await GoogleSignin.signIn();
        const idToken = signInResult.data?.idToken;

        if (!idToken) {
          Alert.alert("Google sign-in failed", "Google did not return an ID token. Please try again.");
          return;
        }

        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth!, credential);
      } catch (error: any) {
        if (error.code === statusCodes.SIGN_IN_CANCELLED) {
          // user cancelled — no alert needed
        } else if (error.code === statusCodes.IN_PROGRESS) {
          // already in progress
        } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          Alert.alert(
            "Google Play Services required",
            "Please update Google Play Services on your device and try again."
          );
        } else if (error.code === "DEVELOPER_ERROR" || error.code === "10") {
          Alert.alert(
            "Configuration needed",
            "The app's SHA-1 fingerprint must be registered in the Firebase Console under Project Settings > Android App. Contact the developer to fix this."
          );
        } else {
          Alert.alert(
            "Google sign-in failed",
            error instanceof Error ? error.message : "Please try again."
          );
        }
      } finally {
        setSigningIn(false);
      }
    },
    signOut: async () => {
      if (auth) {
        await firebaseSignOut(auth);
        try {
          await GoogleSignin.signOut();
        } catch {}
      }
    },
    deleteAccount: async () => {
      if (!user || !auth) return;
      const idToken = await user.getIdToken();
      const baseUrl = process.env.EXPO_PUBLIC_DOMAIN
        ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
        : "http://localhost:5000";
      // SAFETY: only sign out AFTER the server confirms deletion.
      // If the network call fails, keep the user signed in and tell them to retry.
      let serverConfirmed = false;
      try {
        const res = await fetch(`${baseUrl}/api/users/delete-account`, {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` },
        });
        serverConfirmed = res.ok;
      } catch {
        // Network / server unreachable
      }
      if (!serverConfirmed) {
        Alert.alert(
          "Could Not Reach Server",
          "Please check your internet connection and try again. Your account has NOT been deleted to keep your data safe.",
        );
        return;
      }
      await firebaseSignOut(auth);
      try { await GoogleSignin.signOut(); } catch {}
    },
    getIdToken: async (forceRefresh = false) => {
      if (!user) return null;
      return user.getIdToken(forceRefresh);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useFirebaseAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useFirebaseAuth must be used inside AuthProvider");
  }
  return value;
}
