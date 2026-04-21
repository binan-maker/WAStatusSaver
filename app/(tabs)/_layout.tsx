import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

function TabBarIcon({ name, color, size }: { name: keyof typeof Ionicons.glyphMap; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabLayout() {
  const { bottom } = useSafeAreaInsets();
  const { colors: COLORS, resolved } = useTheme();
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
          backgroundColor: isIOS ? 'transparent' : COLORS.TAB_BAR,
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: tabBarHeight,
          paddingBottom: isWeb ? 34 : bottom + 4,
          paddingTop: 8,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={95}
              tint={resolved === 'dark' ? 'dark' : 'light'}
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
