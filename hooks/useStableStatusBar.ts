import { useEffect } from 'react';
import { Platform, StatusBar } from 'react-native';
import * as SystemUI from 'expo-system-ui';

export const useStableStatusBar = (options?: {
  backgroundColor?: string;
  barStyle?: 'light-content' | 'dark-content';
  translucent?: boolean;
}) => {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const {
      backgroundColor = '#000000',
      barStyle = 'light-content',
      translucent = false,
    } = options || {};

    StatusBar.setBarStyle(barStyle, true);
    StatusBar.setBackgroundColor(backgroundColor, true);
    StatusBar.setTranslucent(translucent);

    SystemUI.setBackgroundColorAsync(backgroundColor).catch(() => {});
  }, []);
};
