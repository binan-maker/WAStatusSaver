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
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { queryClient } from '@/lib/query-client';
import { MediaProvider } from '@/contexts/MediaContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider, useFirebaseAuth } from '@/contexts/AuthContext';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { GoogleSignInModal } from '@/components/GoogleSignInModal';
import { useAppOpenAd } from '@/hooks/useAppOpenAd';
import { useInterstitialAd } from '@/components/AdInterstitial';
import COLORS from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

if (Platform.OS !== 'web') {
  mobileAds()
    .initialize()
    .then((adapterStatuses) => {
      console.log('Ads initialized:', adapterStatuses);
    })
    .catch((e) => console.log('Google Mobile Ads initialization error:', e));
}

async function applyImmersiveMode() {
  if (Platform.OS !== 'android') return;
  try {
    const sdkVersion = Platform.Version as number;
    if (sdkVersion < 30) {
      await NavigationBar.setVisibilityAsync('visible');
      await NavigationBar.setBackgroundColorAsync(COLORS.BACKGROUND);
    }
    await NavigationBar.setButtonStyleAsync('light');
  } catch {}
}

function AuthGate({ showOnboarding }: { showOnboarding: boolean }) {
  const { user, loading, configured } = useFirebaseAuth();
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
    </Stack>
  );
}

function AppContent({ showOnboarding }: { showOnboarding: boolean }) {
  useAppOpenAd();
  const { showAd: showInterstitial } = useInterstitialAd();
  const [interstitialShown, setInterstitialShown] = useState(false);
  const { user, loading, signingIn } = useFirebaseAuth();

  useEffect(() => {
    if (!loading && user && !interstitialShown) {
      setTimeout(() => {
        showInterstitial();
      }, 500);
      setInterstitialShown(true);
    }
  }, [loading, user, interstitialShown]);

  return (
    <MediaProvider>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <AuthGate showOnboarding={showOnboarding} />
      <GoogleSignInModal visible={signingIn} />
    </MediaProvider>
  );
}

export default function RootLayout() {
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
    applyImmersiveMode();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        next === 'active'
      ) {
        applyImmersiveMode();
      }
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
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <AppLoadingScreen onDone={() => setLoadingDone(true)} />
      </GestureHandlerRootView>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <LanguageProvider>
            <AuthProvider>
              <AppContent showOnboarding={showOnboarding} />
            </AuthProvider>
          </LanguageProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
