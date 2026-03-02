import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import COLORS from '@/constants/colors';

function TabBarIcon({ name, color, size }: { name: keyof typeof Ionicons.glyphMap; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabLayout() {
  const { bottom } = useSafeAreaInsets();
  const isAndroid = Platform.OS === 'android';
  const isWeb = Platform.OS === 'web';
  const isIOS = Platform.OS === 'ios';

  const TAB_HEIGHT = 54;
  const tabBarHeight = isWeb ? 84 : TAB_HEIGHT + bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.PRIMARY,
        tabBarInactiveTintColor: COLORS.TEXT_MUTED,
        tabBarStyle: {
          backgroundColor: isIOS ? 'transparent' : isWeb ? COLORS.TAB_BAR : COLORS.TAB_BAR,
          borderTopWidth: 1,
          borderTopColor: COLORS.BORDER,
          elevation: 0,
          shadowOpacity: 0,
          height: tabBarHeight,
          paddingBottom: isWeb ? 34 : bottom,
          paddingTop: 6,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={95}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.TAB_BAR }]} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.TAB_BAR }]} />
          ),
        tabBarLabelStyle: {
          fontFamily: 'Nunito_700Bold',
          fontSize: 10,
          letterSpacing: 0.3,
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Statuses',
          tabBarIcon: ({ color, size, focused }) => (
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
