import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Alert, Platform } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithCredential, signOut as firebaseSignOut } from "firebase/auth";
import { appConfig, isFirebaseClientConfigured, isGoogleAuthConfigured } from "@/lib/app-config";
import { getFirebaseClientAuth } from "@/lib/firebase-client";

WebBrowser.maybeCompleteAuthSession();

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
  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: appConfig.google.webClientId,
    androidClientId: appConfig.google.androidClientId,
  });

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

  useEffect(() => {
    if (!auth || response?.type !== "success") return;

    const idToken = response.params?.id_token;
    if (!idToken) {
      Alert.alert("Google sign-in failed", "Google did not return an ID token.");
      return;
    }

    const credential = GoogleAuthProvider.credential(idToken);
    signInWithCredential(auth, credential).catch((error) => {
      Alert.alert("Google sign-in failed", error instanceof Error ? error.message : "Please try again.");
    });
  }, [auth, response]);

  const value: AuthContextValue = {
    user,
    loading,
    configured,
    signInWithGoogle: async () => {
      if (!configured) {
        Alert.alert("Google sign-in not configured", "Add Firebase client config and Google OAuth client IDs from .env.example before using subscriptions.");
        return;
      }

      await promptAsync({
        useProxy: Platform.OS !== "web",
      });
    },
    signOut: async () => {
      if (auth) await firebaseSignOut(auth);
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