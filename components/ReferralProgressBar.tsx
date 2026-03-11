import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';
import { REFERRAL_TIERS, getProgressToNextTier, getNextTier, getRewardForInvites } from '@/constants/referral';

interface ReferralProgressBarProps {
  inviteCount: number;
  compact?: boolean;
}

export function ReferralProgressBar({ inviteCount, compact = false }: ReferralProgressBarProps) {
  const progress = getProgressToNextTier(inviteCount);
  const nextTier = getNextTier(inviteCount);
  const currentReward = getRewardForInvites(inviteCount);

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <Text style={styles.compactTitle}>Your Invites: {inviteCount}</Text>
          {nextTier && (
            <Text style={styles.compactSubtitle}>
              {nextTier.invites - inviteCount} more to unlock {nextTier.label}
            </Text>
          )}
        </View>
        <View style={styles.progressTrackCompact}>
          <Animated.View
            style={[
              styles.progressFillCompact,
              { width: `${progress}%` },
            ]}
          />
        </View>
        {currentReward && (
          <Text style={styles.currentRewardCompact}>
            {currentReward.icon} {currentReward.label} ad-free unlocked
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Referral Progress</Text>
          <Text style={styles.subtitle}>Your Invites: {inviteCount}</Text>
        </View>
        {currentReward && (
          <Text style={styles.badge}>{currentReward.icon}</Text>
        )}
      </View>

      <View style={styles.tiersList}>
        {REFERRAL_TIERS.map((tier) => {
          const unlocked = inviteCount >= tier.invites;
          const active = inviteCount >= tier.invites && !getNextTier(inviteCount);

          return (
            <View key={tier.invites} style={styles.tierItem}>
              <View style={[
                styles.tierDot,
                unlocked && styles.tierDotUnlocked,
                active && styles.tierDotActive,
              ]} />
              <View style={styles.tierInfo}>
                <Text style={[
                  styles.tierLabel,
                  unlocked && styles.tierLabelUnlocked,
                ]}>
                  {tier.invites} invites → {tier.label}
                </Text>
              </View>
              {unlocked && (
                <Text style={styles.tierCheck}>✓</Text>
              )}
            </View>
          );
        })}
      </View>

      {nextTier && (
        <View style={styles.nextRewardBox}>
          <Text style={styles.nextRewardLabel}>Next Reward</Text>
          <Text style={styles.nextRewardValue}>
            {nextTier.icon} {nextTier.label}
          </Text>
          <Text style={styles.nextRewardProgress}>
            {inviteCount} / {nextTier.invites} invites
          </Text>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: `${progress}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(progress)}%
          </Text>
        </View>
      )}

      {!nextTier && currentReward && (
        <View style={styles.maxedBox}>
          <Text style={styles.maxedText}>🎉 Maximum Tier Unlocked!</Text>
          <Text style={styles.maxedSubtext}>
            {currentReward.icon} {currentReward.label} ad-free access
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.PADDING,
    marginVertical: SPACING.PADDING,
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.CARD,
    paddingVertical: SPACING.PADDING,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.PADDING,
  },
  title: {
    fontSize: FONT_SIZE.LARGE,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  subtitle: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 4,
  },
  badge: {
    fontSize: 28,
  },
  tiersList: {
    marginBottom: SPACING.PADDING,
  },
  tierItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: RADIUS.BUTTON,
  },
  tierDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.TEXT_SECONDARY + '44',
    marginRight: 12,
  },
  tierDotUnlocked: {
    backgroundColor: COLORS.PRIMARY,
  },
  tierDotActive: {
    backgroundColor: '#4CAF50',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  tierInfo: {
    flex: 1,
  },
  tierLabel: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
  },
  tierLabelUnlocked: {
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
  tierCheck: {
    color: COLORS.PRIMARY,
    fontSize: FONT_SIZE.LARGE,
    fontWeight: '700',
  },
  nextRewardBox: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: RADIUS.BUTTON,
    padding: SPACING.PADDING,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '33',
  },
  nextRewardLabel: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 4,
  },
  nextRewardValue: {
    fontSize: FONT_SIZE.LARGE,
    fontWeight: '700',
    color: COLORS.PRIMARY,
    marginBottom: 4,
  },
  nextRewardProgress: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
  progressTrack: {
    height: 6,
    backgroundColor: COLORS.TEXT_SECONDARY + '22',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  progressText: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'right',
  },
  maxedBox: {
    backgroundColor: '#4CAF50' + '22',
    borderRadius: RADIUS.BUTTON,
    padding: SPACING.PADDING,
    borderWidth: 1,
    borderColor: '#4CAF50' + '44',
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
  // Compact styles
  compactContainer: {
    paddingHorizontal: SPACING.PADDING,
    marginVertical: 8,
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.BUTTON,
    paddingVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  compactHeader: {
    marginBottom: 8,
  },
  compactTitle: {
    fontSize: FONT_SIZE.MEDIUM,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  compactSubtitle: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  progressTrackCompact: {
    height: 4,
    backgroundColor: COLORS.TEXT_SECONDARY + '22',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFillCompact: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  currentRewardCompact: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
});
