import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Clipboard,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';
import { REFERRAL_TIERS, getRewardForInvites, getNextTier } from '@/constants/referral';

export function ReferralCard() {
  const [referralCode, setReferralCode] = useState<string>('');
  const [inviteCount, setInviteCount] = useState(0);

  useEffect(() => {
    const initReferralCode = async () => {
      try {
        let code = await AsyncStorage.getItem('referralCode');
        if (!code) {
          code = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
          await AsyncStorage.setItem('referralCode', code);
        }
        setReferralCode(code);

        const count = await AsyncStorage.getItem('inviteCount');
        setInviteCount(count ? parseInt(count, 10) : 0);
      } catch (e) {
        console.log('Failed to load referral data:', e);
      }
    };
    initReferralCode();
  }, []);

  const referralLink = `https://play.google.com/store/apps/details?id=com.binan.statussaver&referrer=${referralCode}`;
  const currentReward = getRewardForInvites(inviteCount);
  const nextTier = getNextTier(inviteCount);

  const handleShare = async () => {
    try {
      const message = currentReward
        ? `Join me on StatusVault! 📱 I'm inviting you to get ${currentReward.label} of ad-free access!\n\nUse my code: ${referralCode}\n\n${referralLink}`
        : `Join me on StatusVault - the best WhatsApp Status Saver! 📱\n\nUse my code: ${referralCode}\n\n${referralLink}`;

      await Share.share({
        message,
        title: 'StatusVault - Invite Friends',
        url: Platform.OS === 'ios' ? referralLink : undefined,
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  const handleCopyLink = async () => {
    try {
      await Clipboard.setString(referralLink);
      Alert.alert('Copied!', 'Referral link copied to clipboard');
    } catch (e) {
      console.log('Copy error:', e);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="people" size={24} color={COLORS.PRIMARY} />
            <View style={styles.headerText}>
              <Text style={styles.title}>Invite Friends</Text>
              <Text style={styles.inviteCount}>{inviteCount} invites</Text>
            </View>
          </View>
          {currentReward && <Text style={styles.badge}>{currentReward.icon}</Text>}
        </View>

        <View style={styles.content}>
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Your Code</Text>
            <Text style={styles.code}>{referralCode}</Text>
          </View>

          {nextTier ? (
            <View style={styles.nextRewardBox}>
              <Text style={styles.nextRewardLabel}>Next Tier</Text>
              <Text style={styles.nextRewardValue}>
                {nextTier.icon} {nextTier.label}
              </Text>
              <Text style={styles.nextRewardTarget}>
                Invite {nextTier.invites - inviteCount} more
              </Text>
            </View>
          ) : (
            <View style={styles.maxedBox}>
              <Text style={styles.maxedText}>🏆 Maximum Tier!</Text>
              <Text style={styles.maxedSubtext}>You've unlocked all rewards</Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.shareButton]}
              onPress={handleShare}
            >
              <Ionicons name="share-social" size={18} color="#fff" />
              <Text style={styles.buttonText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.copyButton]}
              onPress={handleCopyLink}
            >
              <Ionicons name="link" size={18} color={COLORS.PRIMARY} />
              <Text style={[styles.buttonText, { color: COLORS.PRIMARY }]}>Link</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tiers}>
            {REFERRAL_TIERS.map((tier) => {
              const unlocked = inviteCount >= tier.invites;
              return (
                <View key={tier.invites} style={[styles.tierBadge, unlocked && styles.tierBadgeUnlocked]}>
                  <Text style={styles.tierBadgeText}>{tier.icon}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.PADDING,
    marginVertical: SPACING.PADDING,
  },
  card: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.CARD,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '22',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.PADDING,
    paddingHorizontal: SPACING.PADDING,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.PRIMARY + '11',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: SPACING.PADDING,
  },
  title: {
    fontSize: FONT_SIZE.LARGE,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  inviteCount: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  badge: {
    fontSize: 24,
  },
  content: {
    paddingHorizontal: SPACING.PADDING,
    paddingVertical: SPACING.PADDING,
  },
  codeBox: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: RADIUS.BUTTON,
    paddingVertical: 12,
    paddingHorizontal: SPACING.PADDING,
    marginBottom: SPACING.PADDING,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '22',
  },
  codeLabel: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 4,
  },
  code: {
    fontSize: FONT_SIZE.LARGE,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
  },
  nextRewardBox: {
    backgroundColor: COLORS.PRIMARY + '11',
    borderRadius: RADIUS.BUTTON,
    paddingVertical: 12,
    paddingHorizontal: SPACING.PADDING,
    marginBottom: SPACING.PADDING,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '33',
  },
  nextRewardLabel: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 4,
  },
  nextRewardValue: {
    fontSize: FONT_SIZE.MEDIUM,
    fontWeight: '700',
    color: COLORS.PRIMARY,
    marginBottom: 4,
  },
  nextRewardTarget: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
  },
  maxedBox: {
    backgroundColor: '#4CAF50' + '11',
    borderRadius: RADIUS.BUTTON,
    paddingVertical: 12,
    paddingHorizontal: SPACING.PADDING,
    marginBottom: SPACING.PADDING,
    borderWidth: 1,
    borderColor: '#4CAF50' + '33',
  },
  maxedText: {
    fontSize: FONT_SIZE.MEDIUM,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 4,
  },
  maxedSubtext: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.PADDING,
    marginBottom: SPACING.PADDING,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: RADIUS.BUTTON,
    gap: 6,
  },
  shareButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  copyButton: {
    backgroundColor: COLORS.PRIMARY + '22',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '44',
  },
  buttonText: {
    fontSize: FONT_SIZE.MEDIUM,
    fontWeight: '600',
    color: '#fff',
  },
  tiers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: RADIUS.BUTTON,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tierBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.TEXT_SECONDARY + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierBadgeUnlocked: {
    backgroundColor: COLORS.PRIMARY,
  },
  tierBadgeText: {
    fontSize: 16,
  },
});
