import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { reloadAppAsync } from 'expo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ErrorBoundaryProps } from 'expo-router';

// Per-screen error fallback used as expo-router's named ErrorBoundary export.
// Exporting this from a route file tells expo-router to use it as that
// segment's boundary — a crash on one tab no longer white-screens the
// whole app. Users can navigate to another tab while the broken one shows
// this recovery UI, then come back once they've tapped "Try Again".
//
// Usage in any route file:
//   export { ScreenErrorFallback as ErrorBoundary } from '@/components/common/ScreenErrorFallback';

export function ScreenErrorFallback({ error, retry }: ErrorBoundaryProps) {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';

  const bg = isDark ? '#0A0F1A' : '#F5F7FA';
  const surface = isDark ? '#141D2E' : '#FFFFFF';
  const text = isDark ? '#E8EDF5' : '#1A2030';
  const muted = isDark ? '#6B7A94' : '#8A96AA';
  const primary = '#00D98B';
  const border = isDark ? '#1E2D44' : '#DDE3ED';

  const handleReload = async () => {
    try {
      await reloadAppAsync();
    } catch {
      retry();
    }
  };

  return (
    <View
      style={[styles.root, { backgroundColor: bg, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
        <View style={[styles.iconWrap, { backgroundColor: primary + '18' }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={36} color={primary} />
        </View>

        <Text style={[styles.title, { color: text }]}>Something went wrong</Text>

        <Text style={[styles.message, { color: muted }]}>
          This screen ran into an unexpected error.{'\n'}
          Your saved statuses are safe.
        </Text>

        {__DEV__ && error?.message ? (
          <View style={[styles.devBox, { backgroundColor: isDark ? '#1E0A0A' : '#FFF0F0', borderColor: '#FF4444' + '44' }]}>
            <Text style={[styles.devText, { color: isDark ? '#FF8888' : '#CC2222' }]} numberOfLines={4}>
              {error.message}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: primary }]}
          onPress={retry}
          activeOpacity={0.8}
          accessibilityLabel="Try again"
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="refresh" size={18} color="#06100C" />
          <Text style={styles.btnText}>Try Again</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.reloadBtn, { borderColor: border }]}
          onPress={handleReload}
          activeOpacity={0.7}
          accessibilityLabel="Reload the entire app"
          accessibilityRole="button"
        >
          <Text style={[styles.reloadBtnText, { color: muted }]}>Reload App</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Nunito_400Regular',
  },
  devBox: {
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginTop: 4,
  },
  devText: {
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginTop: 8,
    minWidth: 160,
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#06100C',
    fontFamily: 'Nunito_700Bold',
  },
  reloadBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  reloadBtnText: {
    fontSize: 13,
    fontFamily: 'Nunito_600SemiBold',
  },
});
