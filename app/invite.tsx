import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { useFirebaseAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/query-client';
import { getPaymentDeviceId } from '@/lib/device-identity';
import { cacheShareLink } from '@/lib/share-link';
import { FONT_SIZE, RADIUS, SPACING } from '@/constants/theme';
import {
  REWARD_LADDER,
  normalizeReferralCode,
  type AttributeInstallResponse,
  type MyReferralResponse,
  type RewardLadderTier,
} from '@/shared/referral-types';

export default function InviteScreen() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { user, signInWithGoogle, getIdToken } = useFirebaseAuth();

  const [data, setData] = useState<MyReferralResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Friend-code attribution input (shown when user wasn't deep-linked)
  const [friendCode, setFriendCode] = useState('');
  const [submittingFriend, setSubmittingFriend] = useState(false);
  const [friendBanner, setFriendBanner] = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchMine = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const token = await getIdToken();
      if (!token) throw new Error('Sign-in required');
      const res = await apiRequest('GET', '/api/referrals/me', undefined, {
        Authorization: `Bearer ${token}`,
      });
      const body = (await res.json()) as MyReferralResponse;
      setData(body);
      // Mirror to AsyncStorage so MediaContext.shareStatus can pre-copy the
      // viral caption with the user's personal short link.
      if (body?.shareUrl && body?.code) {
        cacheShareLink(body.shareUrl, body.code).catch(() => {});
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Could not load';
      const looksLikeHtml = /<!DOCTYPE|<html/i.test(raw);
      setError(looksLikeHtml ? 'Could not reach server. Try again in a moment.' : raw);
    } finally {
      setLoading(false);
    }
  }, [user, getIdToken]);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  const handleCopy = async () => {
    if (!data) return;
    await Clipboard.setStringAsync(data.code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert('Copied!', `Your invite code "${data.code}" is on the clipboard.`);
  };

  const handleShare = async () => {
    if (!data) return;
    const message =
`Hey! I'm using StatusVault to save WhatsApp statuses without screenshots. 📥

Install with my invite link below — when you sign in, my code "${data.code}" is auto-applied so I get a step closer to free Pro 🎁

${data.shareUrl}`;
    try {
      await Share.share({ message, title: 'Try StatusVault' });
      Haptics.selectionAsync().catch(() => {});
    } catch {}
  };

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch {
      Alert.alert('Sign-in failed', 'Please try again.');
    }
  };

  const handleSubmitFriendCode = async () => {
    const code = normalizeReferralCode(friendCode);
    if (code.length < 3) {
      setFriendBanner({ ok: false, msg: 'Code is too short.' });
      return;
    }
    if (!user) {
      handleSignIn();
      return;
    }
    setSubmittingFriend(true);
    setFriendBanner(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Sign-in required');
      const deviceId = await getPaymentDeviceId();
      const res = await apiRequest(
        'POST',
        '/api/referrals/attribute-install',
        { code, deviceId },
        { Authorization: `Bearer ${token}` },
      );
      const body = (await res.json()) as AttributeInstallResponse;
      if (body.success) {
        setFriendBanner({ ok: true, msg: body.message });
        setFriendCode('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        setFriendBanner({ ok: false, msg: body.message });
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'Could not submit';
      const looksLikeHtml = /<!DOCTYPE|<html/i.test(raw);
      let msg = looksLikeHtml ? 'Could not reach server. Try again in a moment.' : raw;
      const jsonStart = raw.indexOf('{');
      if (!looksLikeHtml && jsonStart > -1) {
        try {
          const parsed = JSON.parse(raw.slice(jsonStart)) as AttributeInstallResponse;
          if (!parsed.success) msg = parsed.message;
        } catch {}
      }
      setFriendBanner({ ok: false, msg });
    } finally {
      setSubmittingFriend(false);
    }
  };

  // ─── Renders ────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.BACKGROUND }]}>
        <Stack.Screen options={{ title: 'Invite & Earn' }} />
        <ActivityIndicator color={COLORS.PRIMARY} size="large" />
      </View>
    );
  }

  // Signed-out state — explain the program and let them sign in
  if (!user) {
    return (
      <ScrollView style={{ backgroundColor: COLORS.BACKGROUND }} contentContainerStyle={styles.scroll}>
        <Stack.Screen options={{ title: 'Invite & Earn' }} />
        <LinearGradient
          colors={[COLORS.PRIMARY + '26', COLORS.PRIMARY + '14', COLORS.SURFACE]}
          style={styles.hero}
        >
          <MaterialCommunityIcons name="gift-open-outline" size={48} color={COLORS.PRIMARY} />
          <Text style={styles.heroTitle}>Earn Free Pro</Text>
          <Text style={styles.heroSub}>
            Sign in to get your personal invite code and start unlocking rewards.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSignIn} activeOpacity={0.85}>
            <MaterialCommunityIcons name="google" size={18} color="#04140C" />
            <Text style={styles.primaryBtnText}>Continue with Google</Text>
          </TouchableOpacity>
        </LinearGradient>
        <LadderTable ladder={REWARD_LADDER} count={0} claimed={[]} COLORS={COLORS} />
      </ScrollView>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.BACKGROUND }]}>
        <Stack.Screen options={{ title: 'Invite & Earn' }} />
        <Ionicons name="cloud-offline-outline" size={42} color={COLORS.TEXT_MUTED} />
        <Text style={[styles.errorText, { color: COLORS.TEXT }]}>{error || 'Could not load'}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={fetchMine}>
          <Text style={styles.primaryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progressPct = data.nextTier
    ? Math.min(100, Math.round((data.referralCount / data.nextTier.threshold) * 100))
    : 100;

  return (
    <ScrollView style={{ backgroundColor: COLORS.BACKGROUND }} contentContainerStyle={styles.scroll}>
      <Stack.Screen options={{ title: 'Invite & Earn' }} />

      {/* Reward-active banner */}
      {data.rewardActive && (
        <View style={styles.rewardBanner}>
          <MaterialCommunityIcons name="crown" size={18} color={COLORS.PRIMARY} />
          <Text style={styles.rewardBannerText}>
            {data.rewardLifetime
              ? 'Lifetime Pro unlocked from referrals 🎉'
              : `Pro active${data.rewardPaidUntil ? ` until ${new Date(data.rewardPaidUntil).toLocaleDateString()}` : ''}`}
          </Text>
        </View>
      )}

      {/* Personal code hero */}
      <LinearGradient
        colors={[COLORS.PRIMARY + '26', COLORS.PRIMARY + '14', COLORS.SURFACE]}
        style={styles.hero}
      >
        <Text style={styles.heroLabel}>YOUR INVITE CODE</Text>
        <Text style={styles.heroCode} selectable>{data.code}</Text>

        <View style={styles.heroBtnRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleShare} activeOpacity={0.85}>
            <Ionicons name="share-social" size={16} color="#04140C" />
            <Text style={styles.primaryBtnText}>Share Invite Link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleCopy} activeOpacity={0.85}>
            <Ionicons name="copy-outline" size={16} color={COLORS.PRIMARY} />
            <Text style={styles.secondaryBtnText}>Copy</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Progress card */}
      <View style={styles.card}>
        <View style={styles.progressTopRow}>
          <View>
            <Text style={styles.cardLabel}>FRIENDS JOINED</Text>
            <Text style={styles.bigNum}>{data.referralCount}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {data.nextTier ? (
              <>
                <Text style={styles.cardLabel}>NEXT REWARD</Text>
                <Text style={styles.nextRewardLabel}>{data.nextTier.label}</Text>
                <Text style={styles.nextRewardSub}>
                  {data.remainingForNext} more to go
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.cardLabel}>STATUS</Text>
                <Text style={styles.nextRewardLabel}>All tiers unlocked!</Text>
              </>
            )}
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
      </View>

      {/* Ladder list */}
      <Text style={styles.sectionHeader}>Reward Ladder</Text>
      <LadderTable
        ladder={data.ladder}
        count={data.referralCount}
        claimed={data.rewardsClaimed}
        COLORS={COLORS}
      />

      {/* Friend's code input */}
      <Text style={styles.sectionHeader}>Got a friend&apos;s code?</Text>
      <View style={styles.card}>
        <Text style={styles.helpText}>
          Enter the code your friend shared with you. They&apos;ll get one step closer to a free reward.
        </Text>
        <View style={styles.codeInputRow}>
          <TextInput
            style={styles.codeInput}
            placeholder="ABC123"
            placeholderTextColor={COLORS.TEXT_MUTED}
            autoCapitalize="characters"
            autoCorrect={false}
            value={friendCode}
            onChangeText={(t) => setFriendCode(t.toUpperCase())}
            maxLength={16}
          />
          <TouchableOpacity
            style={[styles.applyBtn, (submittingFriend || friendCode.length < 3) && { opacity: 0.5 }]}
            onPress={handleSubmitFriendCode}
            disabled={submittingFriend || friendCode.length < 3}
            activeOpacity={0.85}
          >
            {submittingFriend
              ? <ActivityIndicator size="small" color="#04140C" />
              : <Text style={styles.applyBtnText}>Apply</Text>}
          </TouchableOpacity>
        </View>
        {friendBanner && (
          <Text style={[styles.bannerLine, { color: friendBanner.ok ? COLORS.PRIMARY : COLORS.ERROR }]}>
            {friendBanner.msg}
          </Text>
        )}
      </View>

      {/* How it works */}
      <Text style={styles.sectionHeader}>How it works</Text>
      <View style={styles.card}>
        {[
          { icon: 'share-social-outline', text: 'Share your invite link with friends.' },
          { icon: 'cloud-download-outline', text: 'They install StatusVault and sign in.' },
          { icon: 'gift-outline', text: 'You hit the next tier — Pro time stacks on top of any active plan.' },
          { icon: 'shield-checkmark-outline', text: 'One reward per device. Self-referrals are not counted.' },
        ].map((row, idx) => (
          <View key={idx} style={styles.howRow}>
            <Ionicons name={row.icon as any} size={18} color={COLORS.PRIMARY} />
            <Text style={styles.howText}>{row.text}</Text>
          </View>
        ))}
      </View>

      <View style={{ height: SPACING.XXL }} />
    </ScrollView>
  );
}

function LadderTable({
  ladder,
  count,
  claimed,
  COLORS,
}: {
  ladder: RewardLadderTier[];
  count: number;
  claimed: string[];
  COLORS: ThemePalette;
}) {
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <View style={styles.card}>
      {ladder.map((tier, i) => {
        const isClaimed = claimed.includes(String(tier.threshold));
        const isReached = count >= tier.threshold;
        const remaining = Math.max(0, tier.threshold - count);
        return (
          <View
            key={tier.threshold}
            style={[
              styles.tierRow,
              i < ladder.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.SURFACE_3 },
            ]}
          >
            <View style={[
              styles.tierIcon,
              { backgroundColor: isClaimed ? COLORS.PRIMARY + '22' : COLORS.SURFACE_2 },
            ]}>
              <MaterialCommunityIcons
                name={isClaimed ? 'check-decagram' : 'crown-outline'}
                size={20}
                color={isClaimed ? COLORS.PRIMARY : isReached ? COLORS.ACCENT_GOLD : COLORS.TEXT_MUTED}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tierLabel, { color: COLORS.TEXT }]}>{tier.label}</Text>
              <Text style={[styles.tierSub, { color: COLORS.TEXT_SECONDARY }]}>
                {tier.threshold} friend{tier.threshold === 1 ? '' : 's'}
              </Text>
            </View>
            <Text style={[
              styles.tierBadge,
              {
                color: isClaimed ? COLORS.PRIMARY : isReached ? COLORS.ACCENT_GOLD : COLORS.TEXT_MUTED,
                backgroundColor: (isClaimed ? COLORS.PRIMARY : isReached ? COLORS.ACCENT_GOLD : COLORS.TEXT_MUTED) + '18',
              },
            ]}>
              {isClaimed ? 'CLAIMED' : isReached ? 'READY' : `${remaining} to go`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  scroll: { padding: SPACING.LG, paddingBottom: SPACING.XXL },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.LG, gap: SPACING.MD },
  errorText: { fontSize: FONT_SIZE.MD, fontFamily: 'Nunito_600SemiBold', textAlign: 'center' },

  rewardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderRadius: RADIUS.MD,
    backgroundColor: COLORS.PRIMARY + '18',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '40',
    marginBottom: SPACING.MD,
  },
  rewardBannerText: {
    flex: 1,
    color: COLORS.PRIMARY,
    fontSize: FONT_SIZE.SM,
    fontFamily: 'Nunito_700Bold',
  },

  hero: {
    borderRadius: RADIUS.LG,
    padding: SPACING.XL,
    alignItems: 'center',
    marginBottom: SPACING.LG,
  },
  heroLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.XS,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  heroTitle: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.XXL,
    fontFamily: 'Nunito_800ExtraBold',
    marginTop: SPACING.SM,
  },
  heroSub: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: SPACING.LG,
  },
  heroCode: {
    color: COLORS.PRIMARY,
    fontSize: 36,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: 4,
    marginBottom: SPACING.LG,
  },
  heroBtnRow: { flexDirection: 'row', gap: SPACING.SM, width: '100%' },

  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 14,
    borderRadius: RADIUS.MD,
  },
  primaryBtnText: {
    color: '#04140C',
    fontSize: FONT_SIZE.MD,
    fontFamily: 'Nunito_800ExtraBold',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: SPACING.LG,
    paddingVertical: 14,
    borderRadius: RADIUS.MD,
    borderWidth: 1.5,
    borderColor: COLORS.PRIMARY,
  },
  secondaryBtnText: {
    color: COLORS.PRIMARY,
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: FONT_SIZE.SM,
  },

  card: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.LG,
    padding: SPACING.LG,
    marginBottom: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.SURFACE_3,
  },
  cardLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.XS,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 1,
  },

  progressTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.MD },
  bigNum: {
    color: COLORS.TEXT,
    fontSize: 40,
    fontFamily: 'Nunito_800ExtraBold',
    lineHeight: 44,
  },
  nextRewardLabel: {
    color: COLORS.PRIMARY,
    fontSize: FONT_SIZE.LG,
    fontFamily: 'Nunito_800ExtraBold',
    marginTop: 2,
  },
  nextRewardSub: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.XS,
    fontFamily: 'Nunito_600SemiBold',
    marginTop: 2,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.SURFACE_3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY,
  },

  sectionHeader: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: SPACING.LG,
    marginBottom: SPACING.SM,
    marginLeft: 4,
  },

  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.MD,
    gap: SPACING.MD,
  },
  tierIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  tierLabel: { fontSize: FONT_SIZE.MD, fontFamily: 'Nunito_700Bold' },
  tierSub: { fontSize: FONT_SIZE.XS, fontFamily: 'Nunito_400Regular', marginTop: 2 },
  tierBadge: {
    fontSize: FONT_SIZE.XS,
    fontFamily: 'Nunito_800ExtraBold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.SM,
    overflow: 'hidden',
  },

  helpText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    fontFamily: 'Nunito_400Regular',
    marginBottom: SPACING.MD,
    lineHeight: 20,
  },
  codeInputRow: { flexDirection: 'row', gap: SPACING.SM },
  codeInput: {
    flex: 1,
    backgroundColor: COLORS.SURFACE_2,
    borderRadius: RADIUS.MD,
    paddingHorizontal: SPACING.MD,
    paddingVertical: 12,
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.MD,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 2,
    borderWidth: 1,
    borderColor: COLORS.SURFACE_3,
  },
  applyBtn: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: RADIUS.MD,
    paddingHorizontal: SPACING.LG,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 84,
  },
  applyBtnText: {
    color: '#04140C',
    fontFamily: 'Nunito_800ExtraBold',
    fontSize: FONT_SIZE.MD,
  },
  bannerLine: {
    fontSize: FONT_SIZE.SM,
    fontFamily: 'Nunito_700Bold',
    marginTop: SPACING.SM,
  },

  howRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.SM,
    paddingVertical: SPACING.SM,
  },
  howText: {
    flex: 1,
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.SM,
    fontFamily: 'Nunito_400Regular',
    lineHeight: 20,
  },
});
