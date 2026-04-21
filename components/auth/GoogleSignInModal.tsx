import React, { useMemo } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useThemeColors, type ThemePalette } from "@/contexts/ThemeContext";
import { FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";

interface Props {
  visible: boolean;
}

export function GoogleSignInModal({ visible }: Props) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LinearGradient
            colors={[COLORS.PRIMARY + "18", "transparent"]}
            style={styles.cardGlow}
          />
          <View style={styles.iconRow}>
            <View style={styles.googleCircle}>
              <MaterialCommunityIcons name="google" size={28} color={COLORS.PRIMARY} />
            </View>
            <View style={styles.arrowWrap}>
              <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.TEXT_MUTED} />
              <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.TEXT_MUTED} style={{ marginLeft: -10 }} />
            </View>
            <View style={styles.appCircle}>
              <MaterialCommunityIcons name="cloud-download" size={24} color={COLORS.PRIMARY} />
            </View>
          </View>
          <ActivityIndicator size="small" color={COLORS.PRIMARY} style={styles.spinner} />
          <Text style={styles.title}>Connecting to Google</Text>
          <Text style={styles.subtitle}>Choose your Google account in the popup</Text>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.LG,
    padding: SPACING.XXL,
    alignItems: "center",
    width: 280,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "33",
    overflow: "hidden",
  },
  cardGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.LG,
    gap: 4,
  },
  googleCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.SURFACE_2,
    borderWidth: 1.5,
    borderColor: COLORS.PRIMARY + "55",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 4,
  },
  appCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.SURFACE_2,
    borderWidth: 1.5,
    borderColor: COLORS.BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: {
    marginBottom: SPACING.SM,
  },
  title: {
    fontSize: FONT_SIZE.MD,
    fontWeight: "700",
    color: COLORS.TEXT,
    fontFamily: "Nunito_700Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: "Nunito_400Regular",
    textAlign: "center",
    lineHeight: 16,
  },
});
