import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState, AppStateStatus, InteractionManager } from 'react-native';
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

// PERF: AdMob's native initialize() does heavy work on the JS+native bridge
// (mediation adapter discovery, consent state, etc). Running it at module
// load — before React even mounts — was contributing to the cold-launch
// freeze on Android 11+. We schedule it AFTER first paint and a short
// idle window so the user never waits on it.
let __adsInitStarted = false;
function initMobileAdsDeferred() {
  if (__adsInitStarted || Platform.OS === 'web') return;
  __adsInitStarted = true;
  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      mobileAds()
        .initialize()
        .then((adapterStatuses) => {
          console.log('Ads initialized:', adapterStatuses);
        })
        .catch((e) => console.log('Google Mobile Ads initialization error:', e));
    }, 1500);
  });
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
  // Tracks whether we already pushed the user to /onboarding this session so
  // subsequent segment changes (after the user completes onboarding and lands
  // on the tabs) don't re-trigger the redirect and loop them back.
  const onboardingNavigatedRef = useRef(false);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'signin';
    const inOnboarding = segments[0] === 'onboarding';

    // CASE 1: Fresh install / reinstall — take the user straight to onboarding
    // with zero friction. No Google sign-in required. The old flow required the
    // user to hit the signin screen first, which acted as an unintended gate.
    if (showOnboarding && !inOnboarding && !onboardingNavigatedRef.current) {
      onboardingNavigatedRef.current = true;
      router.replace('/onboarding');
      return;
    }

    // CASE 2: User signed in via the signin screen (e.g. from Settings →
    // account section). Redirect to the appropriate destination.
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
        options={{ headerShown: false }}
      />
    </Stack>
  );
}

function AppContent({ showOnboarding }: { showOnboarding: boolean }) {
  // PERF: Defer all non-critical mount-time work until AFTER first paint and
  // user-interaction settle. AdMob init, AppOpen-ad load, notification setup,
  // and referral attribution were ALL kicking off in the same render tick on
  // Android 11+, saturating the JS+native bridges and causing the device to
  // feel frozen for 2-4 seconds during cold launch. We gate them behind a
  // small "ready" flag that flips on after the first interactive frame.
  const [deferredReady, setDeferredReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    initMobileAdsDeferred();
    const handle = InteractionManager.runAfterInteractions(() => {
      const t = setTimeout(() => {
        if (!cancelled) setDeferredReady(true);
      }, 800);
      return () => clearTimeout(t);
    });
    return () => {
      cancelled = true;
      // @ts-ignore Cancellable
      handle?.cancel?.();
    };
  }, []);

  return (
    <>
      <AppContentBody showOnboarding={showOnboarding} />
      {deferredReady && <DeferredStartupTasks />}
    </>
  );
}

// All non-critical hooks live here, mounted only AFTER first paint.
function DeferredStartupTasks() {
  useAppOpenAd();
  useStatusReminder();
  usePendingReferralAttribution();
  return null;
}

function AppContentBody({ showOnboarding }: { showOnboarding: boolean }) {
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
      // The AppLoadingScreen takes ~2.5 s minimum, so AsyncStorage will always
      // resolve well before the loading animation finishes. The old approach
      // raced AsyncStorage against a 1.5 s timeout and treated a slow read the
      // same as "already completed onboarding" — silently skipping onboarding
      // on first launch on slow devices. Removed. If the read throws for any
      // reason we default to SHOWING onboarding (safe: better to see it once
      // extra than to never see it on a genuine fresh install).
      const completed = await AsyncStorage.getItem('onboarding_completed');
      if (completed === null) {
        setShowOnboarding(true);
      }
    } catch {
      // Storage read failed (extremely rare) — show onboarding as safe default.
      setShowOnboarding(true);
    }
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
