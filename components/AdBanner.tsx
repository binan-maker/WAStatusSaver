import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import COLORS from '@/constants/colors';
import { ADMOB } from '@/constants/theme';
import { ADS_ENABLED } from '@/constants/admob';

interface AdBannerProps {
  style?: object;
}

export function AdBanner({ style }: AdBannerProps) {
  if (!ADS_ENABLED || Platform.OS === 'web') return null;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.adLabel}>
        <Text style={styles.adLabelText}>AD</Text>
      </View>
      <TouchableOpacity activeOpacity={0.8} style={styles.inner}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={26}
            color={COLORS.PRIMARY}
          />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.headline} numberOfLines={1}>
            Protect your privacy online
          </Text>
          <Text style={styles.subtext} numberOfLines={1}>
            Replace with your AdMob unit ID in constants/admob.ts
          </Text>
        </View>
        <View style={styles.ctaBtn}>
          <Text style={styles.ctaText}>Install</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: ADMOB.BANNER_HEIGHT,
    backgroundColor: COLORS.SURFACE,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    overflow: 'hidden',
  },
  adLabel: {
    position: 'absolute',
    top: 4,
    left: 6,
    backgroundColor: COLORS.ACCENT_GOLD,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    zIndex: 1,
  },
  adLabelText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
    fontFamily: 'Nunito_700Bold',
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textWrap: {
    flex: 1,
    marginRight: 8,
  },
  headline: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  subtext: {
    fontSize: 10,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 1,
    fontFamily: 'Nunito_400Regular',
  },
  ctaBtn: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
});
