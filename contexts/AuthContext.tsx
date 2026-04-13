import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Platform } from "react-native";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithCredential, signOut as firebaseSignOut } from "firebase/auth";
import { appConfig, isFirebaseClientConfigured, isGoogleAuthConfigured } from "@/lib/app-config";
import { getFirebaseClientAuth } from "@/lib/firebase-client";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useMemo(() => getFirebaseClientAuth(), []);
  const configured = Boolean(auth && isFirebaseClientConfigured() && isGoogleAuthConfigured());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(auth));

  useEffect(() => {
    if (configured && appConfig.google.webClientId) {
      GoogleSignin.configure({
        webClientId: appConfig.google.webClientId,
        scopes: ["email", "profile"],
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
    configured,
    signInWithGoogle: async () => {
      if (!configured) {
        Alert.alert("Google sign-in not configured", "Add Firebase client config and Google OAuth client IDs to your .env file before using subscriptions.");
        return;
      }

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
          return;
        } else if (error.code === statusCodes.IN_PROGRESS) {
          return;
        } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          Alert.alert("Google sign-in failed", "Google Play Services is not available on this device.");
        } else {
          Alert.alert("Google sign-in failed", error instanceof Error ? error.message : "Please try again.");
        }
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
    getIdToken: async () => {
      if (!user) return null;
      return user.getIdToken();
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
