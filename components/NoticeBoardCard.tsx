import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';
import type { AppNotice } from '@/hooks/useAppNotice';

interface Props {
  notice: AppNotice | null;
  loading?: boolean;
}

export function NoticeBoardCard({ notice, loading }: Props) {
  if (loading || !notice) return null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <LinearGradient
          colors={['#021A10', '#042A1A', '#0a0e1a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.accentBar} />

        <View style={styles.topRow}>
          <View style={styles.iconRing}>
            <MaterialCommunityIcons name="bullhorn-variant" size={16} color={COLORS.PRIMARY} />
          </View>
          <View style={styles.labelGroup}>
            <Text style={styles.sectionLabel}>ANNOUNCEMENT</Text>
            <View style={styles.liveDot} />
          </View>
        </View>

        <Text style={styles.title}>{notice.title}</Text>
        <Text style={styles.message}>{notice.message}</Text>

        <View style={styles.divider} />
        <View style={styles.footer}>
          <Ionicons name="shield-checkmark-outline" size={12} color={COLORS.PRIMARY} style={{ opacity: 0.6 }} />
          <Text style={styles.footerText}>From StatusVault · Official Update</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.SM,
    paddingBottom: SPACING.XS,
  },
  card: {
    borderRadius: RADIUS.XL,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '35',
    overflow: 'hidden',
    padding: SPACING.LG,
    paddingLeft: SPACING.LG + 4,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: COLORS.PRIMARY,
    borderTopLeftRadius: RADIUS.XL,
    borderBottomLeftRadius: RADIUS.XL,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: SPACING.MD,
  },
  iconRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY + '1A',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.PRIMARY,
    letterSpacing: 1.2,
    fontFamily: 'Nunito_800ExtraBold',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.PRIMARY,
    opacity: 0.85,
  },
  title: {
    fontSize: FONT_SIZE.LG,
    fontWeight: '900',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
    marginBottom: 6,
    lineHeight: 22,
  },
  message: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
    lineHeight: 20,
    marginBottom: SPACING.MD,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.PRIMARY + '18',
    marginBottom: SPACING.SM,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    fontSize: 11,
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_400Regular',
    opacity: 0.75,
  },
});
