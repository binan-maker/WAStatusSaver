import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK_COLORS, LIGHT_COLORS, ThemePalette } from '@/constants/colors';

export type { ThemePalette } from '@/constants/colors';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'app_theme_mode';

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  colors: ThemePalette;
  setMode: (m: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(mode: ThemeMode, system: ColorSchemeName): ResolvedTheme {
  if (mode === 'system') return system === 'light' ? 'light' : 'dark';
  return mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());
  const [hydrated, setHydrated] = useState(false);

  // Load persisted choice
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  // Listen to system theme changes
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const setMode = useCallback(async (m: ThemeMode) => {
    setModeState(m);
    try { await AsyncStorage.setItem(STORAGE_KEY, m); } catch {}
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const resolved = resolveScheme(mode, systemScheme);
    const colors = resolved === 'light' ? LIGHT_COLORS : DARK_COLORS;
    return { mode, resolved, colors, setMode };
  }, [mode, systemScheme, setMode]);

  // Avoid flashing the wrong theme before async storage hydrates
  if (!hydrated) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback if used outside the provider (e.g. boot screens).
    return {
      mode: 'system',
      resolved: 'dark',
      colors: DARK_COLORS,
      setMode: async () => {},
    };
  }
  return ctx;
}

/** Convenience hook that returns just the active palette. Drop-in replacement
 *  for the old `import COLORS from '@/constants/colors'` usage. */
export function useThemeColors(): ThemePalette {
  return useTheme().colors;
}
