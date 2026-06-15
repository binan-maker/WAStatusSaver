import { Tabs, useFocusEffect } from 'expo-router';
import { Platform, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useCallback, useMemo } from 'react';
import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';

function TabBarIcon({ name, color, size }: { name: keyof typeof Ionicons.glyphMap; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

// ANDROID TAB DOUBLE-TAP FIX:
// expo-router v4 / react-navigation v7 switched the default tab button from
// TouchableWithoutFeedback to Pressable. On Android, Pressable requires an
// extra gesture-recognition pass before firing onPress — when the parent
// re-renders mid-touch (MediaContext SAF scanning / status list updates),
// Pressable silently drops the press and the user has to tap again.
// TouchableOpacity fires onPress synchronously on ACTION_UP with no extra
// recognition delay, so it never drops a tap regardless of re-render timing.
// Defined at module level (outside any component) so it is a permanent
// singleton — react-navigation compares tabBarButton by reference on every
// render; a new function identity forces a tab button remount, which is
// exactly the remount-during-touch that drops the first tap.
function StableTabButton(props: any) {
  return (
    <TouchableOpacity
      {...props}
      activeOpacity={0.7}
      style={props.style}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    />
  );
}

export default function TabLayout() {
  const { bottom } = useSafeAreaInsets();
  const { colors: COLORS, resolved } = useTheme();
  const isAndroid = Platform.OS === 'android';
  const isWeb = Platform.OS === 'web';
  const isIOS = Platform.OS === 'ios';

  // Re-apply the correct status bar + nav bar every time the tabs screen comes
  // back into focus — this fires after the viewer modal fully dismisses and
  // ensures the bars are always in sync with the active theme (light or dark).
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const isDark = resolved === 'dark';
      const bg = COLORS.BACKGROUND;
      const sdkVersion = Platform.Version as number;

      StatusBar.setHidden(false, 'none');
      StatusBar.setTranslucent(false);
      StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
      StatusBar.setBackgroundColor(isDark ? '#05070A' : '#FFFFFF', true);

      NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark').catch(() => {});
      if (sdkVersion < 35) {
        NavigationBar.setBackgroundColorAsync(bg).catch(() => {});
        NavigationBar.setBehaviorAsync('inset-swipe').catch(() => {});
      }

      SystemUI.setBackgroundColorAsync(isDark ? '#05070A' : '#FFFFFF').catch(() => {});
    }, [resolved, COLORS.BACKGROUND])
  );

  const TAB_HEIGHT = 64;
  const tabBarHeight = isWeb ? 84 : TAB_HEIGHT + bottom;

  // Memoize the background renderer so the Tabs component never sees a new
  // function identity on a re-render — a new identity forces react-navigation
  // to re-render the tab bar, which can drop in-flight touch events on Android.
  const tabBarBackground = useCallback(() =>
    isIOS ? (
      <BlurView
        intensity={95}
        tint={resolved === 'dark' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
    ) : (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.TAB_BAR }]} />
    ),
  [isIOS, resolved, COLORS.TAB_BAR]);

  // Memoize screenOptions so passing it to <Tabs> doesn't produce a new object
  // on every render of TabLayout. react-navigation does a shallow-equals check
  // on screenOptions — a new object reference triggers a tab bar re-render even
  // when the values are identical, which is the second path to dropped taps.
  const screenOptions = useMemo(() => ({
    headerShown: false,
    tabBarActiveTintColor: COLORS.PRIMARY,
    tabBarInactiveTintColor: COLORS.TEXT_MUTED,
    tabBarStyle: {
      backgroundColor: isIOS ? 'transparent' : COLORS.TAB_BAR,
      borderTopWidth: 0,
      // elevation: 0 was removed — Android uses elevation for native z-order in
      // the touch dispatch system. With elevation=0 any content view with a
      // higher elevation (e.g. FlashList cells) was sitting "above" the tab bar
      // in the native touch layer, intercepting the first tap. Setting elevation=8
      // ensures the tab bar always wins the touch hit-test on Android.
      elevation: isAndroid ? 8 : 0,
      shadowOpacity: 0,
      height: tabBarHeight,
      paddingBottom: isWeb ? 34 : bottom + 4,
      paddingTop: 8,
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
    },
    tabBarBackground,
    tabBarLabelStyle: {
      fontFamily: 'Nunito_700Bold',
      fontSize: 10,
      letterSpacing: 0.3,
    },
    tabBarIconStyle: {
      marginBottom: 0,
    },
  }), [
    COLORS.PRIMARY,
    COLORS.TEXT_MUTED,
    COLORS.TAB_BAR,
    isIOS,
    isAndroid,
    isWeb,
    bottom,
    tabBarHeight,
    tabBarBackground,
  ]);

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Statuses',
          tabBarButton: StableTabButton,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'images' : 'images-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarButton: StableTabButton,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'bookmark' : 'bookmark-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarButton: StableTabButton,
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'settings' : 'settings-outline'}
              color={color}
              size={22}
            />
          ),
        }}
      />
    </Tabs>
  );
}
