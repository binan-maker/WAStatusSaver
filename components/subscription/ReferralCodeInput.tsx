import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useThemeColors, type ThemePalette } from "@/contexts/ThemeContext";
import { FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";
import { useFirebaseAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { getPaymentDeviceId } from "@/lib/device-identity";
import {
  normalizeReferralCode,
  type ReferralRedeemResponse,
  type ReferralRedeemErrorCode,
} from "@/shared/referral-types";

type Props = {
  /** Already-active subscription? Used to disable the input proactively. */
  hasActiveSubscription: boolean;
  /** Called after a successful redeem so the parent can refresh subscription state. */
  onRedeemed?: () => void;
};

type Banner =
  | { kind: "success"; title: string; subtitle: string }
  | { kind: "error"; title: string; subtitle: string; errorCode?: ReferralRedeemErrorCode }
  | null;

export function ReferralCodeInput({ hasActiveSubscription, onRedeemed }: Props) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { user, signInWithGoogle, getIdToken } = useFirebaseAuth();

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);

  // Bug 2 fix — when the user becomes Pro (e.g. by signing in mid-flow), wipe
  // any stale code/banner so the input doesn't look "stuck".
  useEffect(() => {
    if (hasActiveSubscription) {
      setCode("");
      setBanner(null);
    }
  }, [hasActiveSubscription]);

  const cleanCode = normalizeReferralCode(code);
  const canSubmit = cleanCode.length >= 3 && !submitting && !hasActiveSubscription;

  const handleSubmit = async () => {
    if (!cleanCode || cleanCode.length < 3) {
      setBanner({ kind: "error", title: "Code too short", subtitle: "Referral codes are at least 3 characters" });
      return;
    }

    // Bug 1 fix — if user is already Pro, do NOT fire the request.
    // Just clear the field so nothing looks "stuck".
    if (hasActiveSubscription) {
      setCode("");
      setBanner(null);
      return;
    }

    // Auth gate — must be signed in before we even hit the server.
    if (!user) {
      Alert.alert(
        "Sign in required",
        "Sign in with Google to claim a referral reward. Your reward is locked to your account.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign in",
            onPress: async () => {
              try {
                await signInWithGoogle();
              } catch {}
            },
          },
        ],
      );
      return;
    }

    setSubmitting(true);
    setBanner(null);
    try {
      const deviceId = await getPaymentDeviceId();
      const token = await getIdToken();
      const response = await apiRequest(
        "POST",
        "/api/referrals/redeem",
        { code: cleanCode, deviceId },
        token ? { Authorization: `Bearer ${token}` } : undefined,
      );
      const body = (await response.json()) as ReferralRedeemResponse;
      if (body.success) {
        setBanner({
          kind: "success",
          title: `Pro activated · ${body.durationDays} days`,
          subtitle: body.influencerName
            ? `Thanks to ${body.influencerName}. Ads are now removed.`
            : "Ads are now removed.",
        });
        setCode("");
        onRedeemed?.();
      } else {
        setBanner({ kind: "error", title: "Could not redeem", subtitle: body.message });
      }
    } catch (err) {
      // apiRequest throws on non-2xx with body in the message.
      // Bug 1 fix — if the body is HTML (404 page, gateway error, etc.) we MUST
      // NOT splat the raw HTML into the banner. Detect it and show a clean msg.
      const raw = err instanceof Error ? err.message : "Unknown error";
      let title = "Could not redeem";
      let subtitle = "Please check your connection and try again.";
      let errorCode: ReferralRedeemErrorCode | undefined;

      const jsonStart = raw.indexOf("{");
      const looksLikeHtml = /<!DOCTYPE|<html|<\/html>/i.test(raw);

      if (!looksLikeHtml && jsonStart > -1) {
        try {
          const parsed = JSON.parse(raw.slice(jsonStart)) as ReferralRedeemResponse;
          if (!parsed.success) {
            subtitle = parsed.message;
            errorCode = parsed.errorCode;
            if (parsed.errorCode === "AUTH_REQUIRED") title = "Sign in required";
            if (parsed.errorCode === "ACTIVE_SUBSCRIPTION") title = "Pro already active";
            if (parsed.errorCode === "ALREADY_REDEEMED") title = "Already redeemed";
            if (parsed.errorCode === "DEVICE_ALREADY_USED") title = "Device already used";
            if (parsed.errorCode === "CODE_BANNED") title = "Code disabled";
            if (parsed.errorCode === "CODE_EXHAUSTED") title = "Code is full";
            if (parsed.errorCode === "INVALID_CODE") title = "Code not found";
            if (parsed.errorCode === "SELF_REDEEM_BLOCKED") title = "Cannot use your own code";
          }
        } catch {
          // Falls through to the generic friendly message above.
        }
      }
      setBanner({ kind: "error", title, subtitle, errorCode });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.iconBubble}>
          <MaterialCommunityIcons name="ticket-percent-outline" size={18} color={COLORS.PRIMARY} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Have a referral code?</Text>
          <Text style={styles.subtitle}>
            Redeem an influencer code to unlock 3 months of Pro for free
          </Text>
        </View>
      </View>

      <View style={styles.inputRow}>
        <View style={styles.inputWrap}>
          <Ionicons name="pricetag-outline" size={16} color={COLORS.TEXT_MUTED} style={{ marginRight: 8 }} />
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t)}
            placeholder="ENTER CODE"
            placeholderTextColor={COLORS.TEXT_MUTED}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={32}
            editable={!submitting && !hasActiveSubscription}
            style={styles.input}
          />
        </View>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
        >
          {submitting ? (
            <ActivityIndicator color="#06100C" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Submit</Text>
          )}
        </TouchableOpacity>
      </View>

      {hasActiveSubscription && (
        <Text style={styles.helperBlocked}>
          You already have an active Pro plan. Codes can be redeemed only when no Pro is active.
        </Text>
      )}

      {banner && (
        <View
          style={[
            styles.banner,
            banner.kind === "success" ? styles.bannerSuccess : styles.bannerError,
          ]}
        >
          <Ionicons
            name={banner.kind === "success" ? "checkmark-circle" : "alert-circle"}
            size={18}
            color={banner.kind === "success" ? COLORS.SUCCESS : COLORS.ERROR}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.bannerTitle,
                { color: banner.kind === "success" ? COLORS.SUCCESS : COLORS.ERROR },
              ]}
            >
              {banner.title}
            </Text>
            <Text style={styles.bannerSubtitle}>{banner.subtitle}</Text>

            {/* Influencer-to-Referral pivot: when a giveaway code hits its limit,
                turn disappointment into action by sending the user to /invite. */}
            {banner.kind === "error" && banner.errorCode === "CODE_EXHAUSTED" && (
              <TouchableOpacity
                onPress={() => router.push("/invite")}
                activeOpacity={0.85}
                style={styles.pivotBtn}
              >
                <MaterialCommunityIcons name="account-multiple-plus" size={14} color={COLORS.PRIMARY} />
                <Text style={styles.pivotBtnText}>
                  Invite 3 friends instead → Get 48 hours of Pro free
                </Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.PRIMARY} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.LG,
    padding: SPACING.LG,
    gap: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.MD,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.PRIMARY + "1A",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.MD,
    fontFamily: "Nunito_800ExtraBold",
  },
  subtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.XS,
    fontFamily: "Nunito_400Regular",
    marginTop: 1,
    lineHeight: 16,
  },
  inputRow: {
    flexDirection: "row",
    gap: SPACING.SM,
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.SURFACE_2,
    borderRadius: RADIUS.MD,
    paddingHorizontal: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  input: {
    flex: 1,
    color: COLORS.TEXT,
    fontFamily: "Nunito_700Bold",
    fontSize: FONT_SIZE.MD,
    paddingVertical: 10,
    letterSpacing: 1.2,
  },
  submitBtn: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: RADIUS.MD,
    paddingHorizontal: SPACING.LG,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 92,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: "#06100C",
    fontFamily: "Nunito_800ExtraBold",
    fontSize: FONT_SIZE.SM,
  },
  helperBlocked: {
    color: COLORS.TEXT_MUTED,
    fontSize: FONT_SIZE.XS,
    fontFamily: "Nunito_400Regular",
    lineHeight: 16,
  },
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.SM,
    padding: SPACING.MD,
    borderRadius: RADIUS.MD,
    borderWidth: 1,
  },
  bannerSuccess: {
    backgroundColor: COLORS.SUCCESS + "12",
    borderColor: COLORS.SUCCESS + "44",
  },
  bannerError: {
    backgroundColor: COLORS.ERROR + "12",
    borderColor: COLORS.ERROR + "44",
  },
  bannerTitle: {
    fontSize: FONT_SIZE.SM,
    fontFamily: "Nunito_800ExtraBold",
  },
  bannerSubtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.XS,
    fontFamily: "Nunito_400Regular",
    marginTop: 2,
    lineHeight: 16,
  },
  pivotBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: SPACING.SM,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADIUS.SM,
    backgroundColor: COLORS.PRIMARY + "15",
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "40",
    alignSelf: "flex-start",
  },
  pivotBtnText: {
    color: COLORS.PRIMARY,
    fontSize: FONT_SIZE.XS,
    fontFamily: "Nunito_700Bold",
    flexShrink: 1,
  },
});
