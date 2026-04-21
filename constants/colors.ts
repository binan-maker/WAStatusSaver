// ── Theme palettes ────────────────────────────────────────────────────────
// Both palettes share the same KEYS so any component can use either.
// `useThemeColors()` (from contexts/ThemeContext) returns the active one.

export type ThemePalette = {
  PRIMARY: string;
  PRIMARY_DARK: string;
  PRIMARY_LIGHT: string;

  SECONDARY: string;
  ACCENT_BLUE: string;
  ACCENT_PINK: string;
  ACCENT_GOLD: string;

  BACKGROUND: string;
  SURFACE: string;
  SURFACE_2: string;
  SURFACE_3: string;

  TEXT: string;
  TEXT_SECONDARY: string;
  TEXT_MUTED: string;

  BORDER: string;
  BORDER_BRIGHT: string;

  SUCCESS: string;
  WARNING: string;
  ERROR: string;

  TAB_BAR: string;
  HEADER: string;

  GLASS: string;
  GLASS_STRONGER: string;

  GRADIENT_PRIMARY: readonly [string, string];
  GRADIENT_DARK: readonly [string, string];

  light: {
    text: string;
    background: string;
    tint: string;
    tabIconDefault: string;
    tabIconSelected: string;
  };
};

export const DARK_COLORS: ThemePalette = {
  PRIMARY: '#00FFA3',
  PRIMARY_DARK: '#00D185',
  PRIMARY_LIGHT: '#60FFC8',

  SECONDARY: '#7000FF',
  ACCENT_BLUE: '#00E0FF',
  ACCENT_PINK: '#FF00E5',
  ACCENT_GOLD: '#FFB800',

  BACKGROUND: '#05070A',
  SURFACE: '#0F131A',
  SURFACE_2: '#161D29',
  SURFACE_3: '#1F293B',

  TEXT: '#FFFFFF',
  TEXT_SECONDARY: '#94A3B8',
  TEXT_MUTED: '#475569',

  BORDER: 'rgba(255, 255, 255, 0.08)',
  BORDER_BRIGHT: 'rgba(0, 255, 163, 0.2)',

  SUCCESS: '#00FFA3',
  WARNING: '#FDE047',
  ERROR: '#FF4666',

  TAB_BAR: 'rgba(10, 15, 25, 0.85)',
  HEADER: '#05070A',

  GLASS: 'rgba(255, 255, 255, 0.03)',
  GLASS_STRONGER: 'rgba(255, 255, 255, 0.07)',

  GRADIENT_PRIMARY: ['#00FFA3', '#7000FF'] as const,
  GRADIENT_DARK: ['#0F131A', '#05070A'] as const,

  light: {
    text: '#FFFFFF',
    background: '#05070A',
    tint: '#00FFA3',
    tabIconDefault: '#475569',
    tabIconSelected: '#00FFA3',
  },
};

export const LIGHT_COLORS: ThemePalette = {
  PRIMARY: '#00B872',
  PRIMARY_DARK: '#008F5A',
  PRIMARY_LIGHT: '#5FE1A9',

  SECONDARY: '#6A1FE0',
  ACCENT_BLUE: '#00A6C7',
  ACCENT_PINK: '#D6009E',
  ACCENT_GOLD: '#E89A00',

  BACKGROUND: '#FFFFFF',
  SURFACE: '#F4F6F9',
  SURFACE_2: '#EBEFF4',
  SURFACE_3: '#DDE3EB',

  TEXT: '#0B1220',
  TEXT_SECONDARY: '#475569',
  TEXT_MUTED: '#94A3B8',

  BORDER: 'rgba(11, 18, 32, 0.10)',
  BORDER_BRIGHT: 'rgba(0, 184, 114, 0.30)',

  SUCCESS: '#00B872',
  WARNING: '#D97706',
  ERROR: '#DC2626',

  TAB_BAR: 'rgba(255, 255, 255, 0.92)',
  HEADER: '#FFFFFF',

  GLASS: 'rgba(11, 18, 32, 0.03)',
  GLASS_STRONGER: 'rgba(11, 18, 32, 0.06)',

  GRADIENT_PRIMARY: ['#00B872', '#6A1FE0'] as const,
  GRADIENT_DARK: ['#F4F6F9', '#FFFFFF'] as const,

  light: {
    text: '#0B1220',
    background: '#FFFFFF',
    tint: '#00B872',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#00B872',
  },
};

// Default export = DARK palette. Module-level access (e.g. inside
// StyleSheet.create at the file top) still resolves to dark, but every screen
// has been refactored to read the active palette via useThemeColors() so
// switching at runtime updates the whole UI.
const COLORS: ThemePalette = DARK_COLORS;
export default COLORS;
