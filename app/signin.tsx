import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useFirebaseAuth } from "@/contexts/AuthContext";
import { useThemeColors, type ThemePalette } from "@/contexts/ThemeContext";
import { FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";

export default function SignInScreen() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const { loading, signInWithGoogle, configured } = useFirebaseAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup" | null>(null);

  const handleGoogle = async (selectedMode: "signin" | "signup") => {
    setMode(selectedMode);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setSigningIn(false);
      setMode(null);
    }
  };

  const canGoBack = router.canGoBack();

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + SPACING.LG }]}>
      <LinearGradient
        colors={["#05070A", "#0A1020", "#05070A"]}
        style={StyleSheet.absoluteFill}
      />

      <TouchableOpacity
        style={[styles.skipBtn, { top: insets.top + 8 }]}
        onPress={() => {
          if (canGoBack) router.back();
          else router.replace('/(tabs)');
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="close" size={20} color={COLORS.TEXT_SECONDARY} />
      </TouchableOpacity>

      <View style={styles.top}>
        <View style={styles.logoWrap}>
          <LinearGradient
            colors={["#00FFA322", "#7000FF22"]}
            style={styles.logoGlow}
          />
          <View style={styles.logoIcon}>
            <MaterialCommunityIcons name="cloud-download" size={38} color={COLORS.PRIMARY} />
          </View>
        </View>
        <Text style={styles.appName}>StatusVault</Text>
        <Text style={styles.tagline}>Save & share WhatsApp statuses instantly</Text>
      </View>

      <View style={styles.middle}>
        <View style={styles.featureRow}>
          <FeatureItem icon="image-multiple" label="Save images & videos" styles={styles} COLORS={COLORS} />
          <FeatureItem icon="translate" label="10 languages supported" styles={styles} COLORS={COLORS} />
          <FeatureItem icon="shield-check" label="Private & secure" styles={styles} COLORS={COLORS} />
        </View>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.ctaTitle}>Continue with Google</Text>
        <Text style={styles.ctaSubtitle}>
          Your saved content and subscription are linked to your Google account
        </Text>

        <TouchableOpacity
          style={styles.googleBtn}
          activeOpacity={0.85}
          disabled={signingIn || loading}
          onPress={() => handleGoogle("signin")}
        >
          {signingIn && mode === "signin" ? (
            <ActivityIndicator color="#06100C" size="small" />
          ) : (
            <>
              <GoogleIcon styles={styles} />
              <Text style={styles.googleBtnText}>Sign in with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signupBtn}
          activeOpacity={0.85}
          disabled={signingIn || loading}
          onPress={() => handleGoogle("signup")}
        >
          {signingIn && mode === "signup" ? (
            <ActivityIndicator color={COLORS.PRIMARY} size="small" />
          ) : (
            <>
              <GoogleIcon color={COLORS.PRIMARY} styles={styles} />
              <Text style={styles.signupBtnText}>Sign up with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {!configured && (
          <View style={styles.warningBox}>
            <MaterialCommunityIcons name="alert-circle-outline" size={15} color={COLORS.WARNING} />
            <Text style={styles.warningText}>
              Firebase credentials are not configured. Google sign-in requires Firebase setup.
            </Text>
          </View>
        )}

        <Text style={styles.privacy}>
          By continuing you agree to our{" "}
          <Text style={styles.privacyLink}>Privacy Policy</Text>. We only collect your email and profile photo.
        </Text>
      </View>
    </View>
  );
}

type SignInStyles = ReturnType<typeof createStyles>;

function GoogleIcon({ color = "#06100C", styles }: { color?: string; styles: SignInStyles }) {
  return (
    <View style={styles.gIconWrap}>
      <Text style={[styles.gLetter, { color }]}>G</Text>
    </View>
  );
}

function FeatureItem({ icon, label, styles, COLORS }: { icon: string; label: string; styles: SignInStyles; COLORS: ThemePalette }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconWrap}>
        <MaterialCommunityIcons name={icon as any} size={18} color={COLORS.PRIMARY} />
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    paddingHorizontal: SPACING.XL,
    justifyContent: "space-between",
  },
  skipBtn: {
    position: "absolute",
    top: 16,
    right: SPACING.XL,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: "center",
    justifyContent: "center",
  },
  top: {
    alignItems: "center",
    paddingTop: SPACING.XXL * 1.5,
    gap: SPACING.SM,
  },
  logoWrap: {
    width: 90,
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.SM,
  },
  logoGlow: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1.5,
    borderColor: COLORS.PRIMARY + "55",
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: FONT_SIZE.DISPLAY,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.TEXT,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: "Nunito_400Regular",
    textAlign: "center",
  },
  middle: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  featureRow: {
    flexDirection: "column",
    gap: SPACING.MD,
    width: "100%",
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.MD,
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.MD,
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.PRIMARY + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT,
    fontFamily: "Nunito_600SemiBold",
  },
  bottom: {
    gap: SPACING.MD,
  },
  ctaTitle: {
    fontSize: FONT_SIZE.XL,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.TEXT,
    textAlign: "center",
  },
  ctaSubtitle: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: "Nunito_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.SM,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: RADIUS.FULL,
    paddingVertical: SPACING.LG,
  },
  googleBtnText: {
    fontSize: FONT_SIZE.MD,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
    color: "#06100C",
  },
  signupBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.SM,
    backgroundColor: "transparent",
    borderRadius: RADIUS.FULL,
    paddingVertical: SPACING.LG,
    borderWidth: 1.5,
    borderColor: COLORS.PRIMARY + "66",
  },
  signupBtnText: {
    fontSize: FONT_SIZE.MD,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
    color: COLORS.PRIMARY,
  },
  gIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  gLetter: {
    fontSize: 13,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
  warningBox: {
    flexDirection: "row",
    gap: SPACING.SM,
    alignItems: "flex-start",
    backgroundColor: COLORS.WARNING + "12",
    borderRadius: RADIUS.MD,
    padding: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.WARNING + "33",
  },
  warningText: {
    flex: 1,
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: "Nunito_400Regular",
    lineHeight: 17,
  },
  privacy: {
    fontSize: 10,
    color: COLORS.TEXT_MUTED,
    fontFamily: "Nunito_400Regular",
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: SPACING.LG,
  },
  privacyLink: {
    color: COLORS.PRIMARY,
    textDecorationLine: "underline",
  },
});
