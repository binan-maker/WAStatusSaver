import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { DARK_COLORS, LIGHT_COLORS, ThemePalette } from '@/constants/colors';

export type { ThemePalette } from '@/constants/colors';

// Theme is ALWAYS driven by the OS. We keep the `ThemeMode` type around for
// API compatibility with older imports, but the only valid runtime value is
// `'system'` — there is no in-app override anymore.
export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  colors: ThemePalette;
  /** No-op kept for backward compatibility with any leftover callers. */
  setMode: (m: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveSystem(scheme: ColorSchemeName): ResolvedTheme {
  return scheme === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const resolved = resolveSystem(systemScheme);
    const colors = resolved === 'light' ? LIGHT_COLORS : DARK_COLORS;
    return {
      mode: 'system',
      resolved,
      colors,
      setMode: async () => {},
    };
  }, [systemScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      mode: 'system',
      resolved: 'dark',
      colors: DARK_COLORS,
      setMode: async () => {},
    };
  }
  return ctx;
}

/** Convenience hook that returns just the active palette. */
export function useThemeColors(): ThemePalette {
  return useTheme().colors;
}
