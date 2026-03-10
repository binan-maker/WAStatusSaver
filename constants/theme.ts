import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const SCREEN = {
  WIDTH: SCREEN_WIDTH,
  HEIGHT: SCREEN_HEIGHT,
};

export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 12,
  LG: 16,
  XL: 24,
  XXL: 32,
};

export const RADIUS = {
  XS: 6,
  SM: 10,
  MD: 16,
  LG: 24,
  XL: 32,
  FULL: 999,
};

export const FONT_SIZE = {
  XS: 11,
  SM: 13,
  MD: 15,
  LG: 17,
  XL: 20,
  XXL: 26,
  XXXL: 32,
  DISPLAY: 42,
};

export const HEADER_HEIGHT = Platform.OS === 'android' ? 56 : 44;
export const TAB_BAR_HEIGHT = Platform.OS === 'android' ? 60 : 50;

export const GRID_COLUMNS = SCREEN_WIDTH < 360 ? 2 : 3;
export const CARD_SIZE = (SCREEN_WIDTH - (GRID_COLUMNS + 1) * 2) / GRID_COLUMNS;

export const ADMOB = {
  BANNER_HEIGHT: 60,
};

export const SHADOW = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
};
