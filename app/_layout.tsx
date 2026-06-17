import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState, AppStateStatus } from 'react-native';
import { useStableStatusBar } from '@/hooks/useStableStatusBar';
import { useFonts } from 'expo-font';
import * as NavigationBar from 'expo-navigation-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { MediaProvider } from '@/contexts/MediaContext';
import { AppLoadingScreen } from '@/components/common/AppLoadingScreen';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

// ── Production console hygiene ───────────────────────────────────────────
if (!__DEV__) {
  const noop = () => {};
  console.log   = noop;
  console.debug = noop;
  console.info  = noop;
  console.warn  = noop;
}

SplashScreen.preventAutoHideAsync();

async function applyImmersiveMode(isDark: boolean) {
  if (Platform.OS !== 'android') return;
  try {
    const sdkVersion = Platform.Version as number;
    if (sdkVersion < 30) {
      await NavigationBar.setVisibilityAsync('visible');
    }
    // setBackgroundColorAsync / setBehaviorAsync are no-ops when edge-to-edge
    // is enabled (they generate WARN spam). Button style still works and is
    // the only thing that matters for icon visibility.
    await NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
  } catch {}
}

function AppNavigator({ showOnboarding }: { showOnboarding: boolean }) {
  const { colors: COLORS } = useTheme();
  const router = useRouter();
  const onboardingNavigatedRef = useRef(false);

  useEffect(() => {
    if (showOnboarding && !onboardingNavigatedRef.current) {
      onboardingNavigatedRef.current = true;
      router.replace('/onboarding');
    }
  }, [showOnboarding]);

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
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="viewer"
        options={{
          headerShown: false,
          animation: 'fade',
          // DO NOT use presentation:'fullScreenModal' on Android 11+.
          // fullScreenModal registers a native-layer dismiss handler that
          // intercepts the first back press at the Activity level BEFORE
          // React Native's BackHandler sees it. The user has to press back
          // TWICE to actually dismiss the screen (first press is eaten by
          // the native modal, second finally reaches RN). Default 'card'
          // presentation routes all back events through RN's BackHandler as
          // expected.
          //
          // gestureEnabled:false prevents the stack's swipe-to-go-back gesture
          // from competing with the viewer's horizontal FlatList pager — they
          // both want to own left-edge horizontal swipes on Android 11+, and
          // without this the stack gesture wins, cancels the FlatList scroll,
          // and leaves the user confused.
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="guide"
        options={{ title: 'Setup Guide', headerStyle: { backgroundColor: COLORS.SURFACE } }}
      />
      <Stack.Screen
        name="privacy"
        options={{ title: 'Privacy', headerStyle: { backgroundColor: COLORS.SURFACE } }}
      />
      <Stack.Screen name="permissions" options={{ headerShown: false }} />
      <Stack.Screen name="terms" options={{ headerShown: false }} />
    </Stack>
  );
}

function AppContentBody({ showOnboarding }: { showOnboarding: boolean }) {
  const { colors, resolved } = useTheme();

  useStableStatusBar({
    backgroundColor: resolved === 'dark' ? '#05070A' : '#FFFFFF',
    barStyle: resolved === 'dark' ? 'light-content' : 'dark-content',
    translucent: false,
  });

  useEffect(() => {
    applyImmersiveMode(resolved === 'dark');
  // `colors` is intentionally excluded — it's an object reference that can
  // change identity on re-renders without the actual theme changing.
  // Including it would re-fire NavigationBar.setButtonStyleAsync() on every
  // render, causing Android window-focus oscillation (FOCUS→BLUR→FOCUS) that
  // React Native translates into rapid AppState active→background→active events.
  // `resolved` ('dark' | 'light') is the only value that actually matters here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved]);

  return (
    <MediaProvider>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      <AppNavigator showOnboarding={showOnboarding} />
    </MediaProvider>
  );
}

function AppContent({ showOnboarding }: { showOnboarding: boolean }) {
  return <AppContentBody showOnboarding={showOnboarding} />;
}

const RootLayout = () => {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular: require('../assets/fonts/Nunito_400Regular.ttf'),
    Nunito_600SemiBold: require('../assets/fonts/Nunito_600SemiBold.ttf'),
    Nunito_700Bold: require('../assets/fonts/Nunito_700Bold.ttf'),
    Nunito_800ExtraBold: require('../assets/fonts/Nunito_800ExtraBold.ttf'),
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
      if (completed === null) setShowOnboarding(true);
    } catch {
      setShowOnboarding(true);
    }
  };

  if (!fontsLoaded || !splashHidden) return null;

  if (!loadingDone) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <StatusBar style="auto" />
          <AppLoadingScreen onDone={() => setLoadingDone(true)} />
        </ThemeProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <AppContent showOnboarding={showOnboarding} />
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
};

export default RootLayout;
