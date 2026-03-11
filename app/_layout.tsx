import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import { useAppOpenAd } from '@/hooks/useAppOpenAd';
import { useInterstitialAd } from '@/components/AdInterstitial';
import { useNotifications } from '@/hooks/useNotifications';
import { useReferralVerification } from '@/hooks/useReferralVerification';
import COLORS from '@/constants/colors';
import { v4 as uuidv4 } from 'uuid';

SplashScreen.preventAutoHideAsync();

// Initialize Google Mobile Ads
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
    // Check if edge-to-edge is already handled by Expo (modern versions do this)
    // We only apply these if they don't cause warnings on modern Android
    const sdkVersion = Platform.Version as number;
    if (sdkVersion < 30) {
      await NavigationBar.setVisibilityAsync('visible');
      await NavigationBar.setBehaviorAsync('inset-touch');
      await NavigationBar.setBackgroundColorAsync(COLORS.BACKGROUND);
    }
    await NavigationBar.setButtonStyleAsync('light');
  } catch {}
}

function RootLayoutNav({ showOnboarding }: { showOnboarding: boolean }) {
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
    </Stack>
  );
}

export default function RootLayout() {
  // Initialize app open ads, notifications, and referral system
  useAppOpenAd();
  useNotifications();
  useReferralVerification();

  const { showAd: showInterstitial } = useInterstitialAd();
  const [interstitialShown, setInterstitialShown] = useState(false);

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

  // Initialize device ID and referral code
  useEffect(() => {
    const initializeApp = async () => {
      try {
        let deviceId = await AsyncStorage.getItem('deviceId');
        if (!deviceId) {
          deviceId = uuidv4();
          await AsyncStorage.setItem('deviceId', deviceId);
        }

        let referralCode = await AsyncStorage.getItem('referralCode');
        if (!referralCode) {
          referralCode = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
          await AsyncStorage.setItem('referralCode', referralCode);
        }
      } catch (e) {
        console.error('App initialization error:', e);
      }
    };

    initializeApp();
  }, []);

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

  useEffect(() => {
    if (fontsLoaded && loadingDone && !interstitialShown) {
      setTimeout(() => {
        showInterstitial();
      }, 500);
      setInterstitialShown(true);
    }
  }, [fontsLoaded, loadingDone, interstitialShown]);

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
            <MediaProvider>
              <StatusBar style="light" translucent backgroundColor="transparent" />
              <RootLayoutNav showOnboarding={showOnboarding} />
            </MediaProvider>
          </LanguageProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
