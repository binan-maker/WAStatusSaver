import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { SPACING, FONT_SIZE } from '@/constants/theme';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={52} color={COLORS.TEXT_MUTED} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.action} onPress={onAction} activeOpacity={0.8}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.XXL,
    gap: SPACING.MD,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.SM,
  },
  title: {
    fontSize: FONT_SIZE.XL,
    fontWeight: '700',
    color: COLORS.TEXT,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
  },
  subtitle: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Nunito_400Regular',
  },
  action: {
    marginTop: SPACING.LG,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.XXL,
    paddingVertical: SPACING.MD,
    borderRadius: 25,
  },
  actionText: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
});
