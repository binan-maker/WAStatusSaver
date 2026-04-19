import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';
import type { AppNotice } from '@/hooks/feedback/useAppNotice';

interface Props {
  notice: AppNotice;
  visible: boolean;
  onDismiss: () => void;
}

export function AppNoticeCard({ notice, visible, onDismiss }: Props) {
  if (!visible || !notice) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <LinearGradient
          colors={[COLORS.PRIMARY + '22', COLORS.PRIMARY + '08']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="megaphone-outline" size={15} color={COLORS.PRIMARY} />
            </View>
            <Text style={styles.title}>{notice.title}</Text>
          </View>
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.closeBtn}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Ionicons name="close" size={18} color={COLORS.TEXT_MUTED} />
          </TouchableOpacity>
        </View>
        <Text style={styles.message}>{notice.message}</Text>
        <View style={styles.border} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.SM,
    paddingBottom: SPACING.XS,
  },
  card: {
    borderRadius: RADIUS.LG,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '40',
    overflow: 'hidden',
    padding: SPACING.MD,
    backgroundColor: COLORS.SURFACE,
  },
  border: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: COLORS.PRIMARY,
    borderTopLeftRadius: RADIUS.LG,
    borderBottomLeftRadius: RADIUS.LG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.SM,
    paddingLeft: SPACING.SM,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '700',
    color: COLORS.PRIMARY,
    fontFamily: 'Nunito_700Bold',
    flex: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
    lineHeight: 20,
    paddingLeft: SPACING.SM,
  },
});
