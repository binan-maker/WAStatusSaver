import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState, AppStateStatus } from 'react-native';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import * as NavigationBar from 'expo-navigation-bar';
import  mobileAds  from 'react-native-google-mobile-ads';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { queryClient } from '@/lib/query-client';
import { MediaProvider } from '@/contexts/MediaContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider, useFirebaseAuth } from '@/contexts/AuthContext';
import { PaymentProviderRoot } from '@/payment-providers';
import { AppLoadingScreen } from '@/components/common/AppLoadingScreen';
import { GoogleSignInModal } from '@/components/auth/GoogleSignInModal';
import { useAppOpenAd } from '@/hooks/ads/useAppOpenAd';
import { useInterstitialAd } from '@/components/ads/AdInterstitial';
import { useFreeAdsState } from '@/hooks/ads/useFreeAdsState';
import { useStatusReminder } from '@/hooks/media/useStatusReminder';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { usePendingReferralAttribution } from '@/hooks/referral/usePendingReferralAttribution';

SplashScreen.preventAutoHideAsync();

if (Platform.OS !== 'web') {
  mobileAds()
    .initialize()
    .then((adapterStatuses) => {
      console.log('Ads initialized:', adapterStatuses);
    })
    .catch((e) => console.log('Google Mobile Ads initialization error:', e));
}

async function applyImmersiveMode(bg: string, isDark: boolean) {
  if (Platform.OS !== 'android') return;
  try {
    const sdkVersion = Platform.Version as number;
    if (sdkVersion < 30) {
      await NavigationBar.setVisibilityAsync('visible');
    }
    await NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
    await NavigationBar.setBackgroundColorAsync(bg);
    await NavigationBar.setBehaviorAsync('inset-swipe');
  } catch {}
}

function AuthGate({ showOnboarding }: { showOnboarding: boolean }) {
  const { user, loading, configured } = useFirebaseAuth();
  const { colors: COLORS } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'signin';

    if (user && inAuthGroup) {
      if (showOnboarding) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [user, loading, configured, segments, showOnboarding]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.SURFACE },
        headerTintColor: COLORS.TEXT,
        headerTitleStyle: {
          fontFamily: 'Nunito_700Bold',
          fontSize: 17,
          color: COLORS.TEXT,
        },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.BACKGROUND },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="signin" options={{ headerShown: false, animation: 'fade' }} />
      {showOnboarding && <Stack.Screen name="onboarding" options={{ headerShown: false }} />}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="viewer"
        options={{
          headerShown: false,
          animation: 'fade',
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="guide"
        options={{
          title: 'Setup Guide',
          headerStyle: { backgroundColor: COLORS.SURFACE },
        }}
      />
      <Stack.Screen
        name="privacy"
        options={{
          title: 'Privacy',
          headerStyle: { backgroundColor: COLORS.SURFACE },
        }}
      />
      <Stack.Screen
        name="permissions"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="subscription"
        options={{
          title: 'Choose Subscription',
          headerStyle: { backgroundColor: COLORS.SURFACE },
        }}
      />
      <Stack.Screen
        name="invite"
        options={{
          title: 'Invite & Earn',
          headerStyle: { backgroundColor: COLORS.SURFACE },
        }}
      />
      <Stack.Screen
        name="contact"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="terms"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="languages"
        options={{
          title: 'Language',
          headerStyle: { backgroundColor: COLORS.SURFACE },
        }}
      />
    </Stack>
  );
}

function AppContent({ showOnboarding }: { showOnboarding: boolean }) {
  useAppOpenAd();
  useStatusReminder();
  usePendingReferralAttribution();
  const { colors, resolved } = useTheme();
  const { showAd: showInterstitial } = useInterstitialAd();

  // Re-apply Android nav bar background whenever the theme changes.
  useEffect(() => {
    applyImmersiveMode(colors.BACKGROUND, resolved === 'dark');
  }, [colors, resolved]);

  const [interstitialShown, setInterstitialShown] = useState(false);
  const { user, loading, signingIn } = useFirebaseAuth();
  const { isFreeAds, loading: adsLoading } = useFreeAdsState();

  const prevSigningInRef = useRef(false);
  const justSignedInRef = useRef(false);
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (prevSigningInRef.current && !signingIn && user) {
      justSignedInRef.current = true;
    }
    prevSigningInRef.current = signingIn;
  }, [signingIn, user]);

  useEffect(() => {
    const prevId = prevUserIdRef.current;
    const currId = user?.uid ?? null;

    if (prevId !== undefined && prevId !== null && currId !== null && prevId !== currId) {
      justSignedInRef.current = true;
    }

    prevUserIdRef.current = currId;

    if (!user) {
      setInterstitialShown(false);
      justSignedInRef.current = false;
    }
  }, [user]);

  // Neutralized: we no longer auto-show an interstitial right after sign-in
  // or on app entry. Interstitials are now driven only by deep usage triggers
  // (video opens / image swipes) and respect a 3-minute cooldown.
  useEffect(() => {
    if (justSignedInRef.current) {
      justSignedInRef.current = false;
    }
    if (!user) {
      setInterstitialShown(false);
    }
  }, [loading, adsLoading, user, interstitialShown, isFreeAds]);

  return (
    <MediaProvider>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <AuthGate showOnboarding={showOnboarding} />
      <GoogleSignInModal visible={signingIn} />
    </MediaProvider>
  );
}

const RootLayout = () => {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const [loadingDone, setLoadingDone] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      setSplashHidden(true);
    }
  }, [fontsLoaded]);

  useEffect(() => {
    checkOnboarding();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      appState.current = next;
    });

    return () => sub.remove();
  }, []);

  const checkOnboarding = async () => {
    try {
      const completed = await AsyncStorage.getItem('onboarding_completed');
      if (!completed) {
        setShowOnboarding(true);
      }
    } catch {}
  };

  if (!fontsLoaded || !splashHidden) return null;

  if (!loadingDone) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <StatusBar style="auto" translucent backgroundColor="transparent" />
          <AppLoadingScreen onDone={() => setLoadingDone(true)} />
        </ThemeProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeProvider>
            <LanguageProvider>
              <AuthProvider>
                <PaymentProviderRoot>
                  <AppContent showOnboarding={showOnboarding} />
                </PaymentProviderRoot>
              </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default RootLayout;
