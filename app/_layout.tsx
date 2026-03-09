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
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { queryClient } from '@/lib/query-client';
import { MediaProvider } from '@/contexts/MediaContext';
import { AppLoadingScreen } from '@/components/AppLoadingScreen';
import COLORS from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

// Initialize Google Mobile Ads
if (Platform.OS !== 'web') {
  mobileAds()
    .initialize()
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

function RootLayoutNav() {
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
          title: 'How to Use',
          headerStyle: { backgroundColor: COLORS.SURFACE },
        }}
      />
      <Stack.Screen
        name="privacy"
        options={{
          title: 'Privacy Policy',
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
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const [loadingDone, setLoadingDone] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      setSplashHidden(true);
    }
  }, [fontsLoaded]);

  useEffect(() => {
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
          <MediaProvider>
            <StatusBar style="light" translucent backgroundColor="transparent" />
            <RootLayoutNav />
          </MediaProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
