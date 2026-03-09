import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRewardedAd } from '@/components/AdReward';
import { useFreeAdsState } from '@/hooks/useFreeAdsState';
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

interface RewardAdButtonProps {
  variant?: 'grid' | 'row' | 'full';
}

export function RewardAdButton({ variant = 'grid' }: RewardAdButtonProps) {
  const { loaded, showAd } = useRewardedAd();
  const { isFreeAds, setFreeAdsFor24Hours, timeRemaining, formatTimeRemaining } = useFreeAdsState();
  const [isLoading, setIsLoading] = useState(false);

  const handleWatchAd = async () => {
    if (isFreeAds || isLoading || !loaded) return;
    
    setIsLoading(true);
    try {
      const rewarded = await showAd();
      if (rewarded) {
        await setFreeAdsFor24Hours();
      }
    } catch (error) {
      console.error('Error showing reward ad:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === 'grid') {
    // Grid card variant - for use in FlatList
    return (
      <View style={styles.gridCard}>
        {isFreeAds ? (
          <LinearGradient colors={[COLORS.PRIMARY + '30', COLORS.PRIMARY + '10']} style={styles.freeContent}>
            <MaterialCommunityIcons name="star-circle" size={32} color={COLORS.PRIMARY} />
            <Text style={styles.freeTitle}>Free Ads Active</Text>
            <Text style={styles.timeRemaining}>{formatTimeRemaining(timeRemaining)} left</Text>
          </LinearGradient>
        ) : (
          <>
            <LinearGradient
              colors={[COLORS.PRIMARY, COLORS.PRIMARY + 'dd']}
              style={styles.gradient}
            >
              <MaterialCommunityIcons name="play-circle" size={32} color="#fff" />
            </LinearGradient>
            <View style={styles.content}>
              <Text style={styles.title}>Watch Ads</Text>
              <Text style={styles.subtitle}>Free Ads for One Day</Text>
              {isLoading && <ActivityIndicator color={COLORS.PRIMARY} size="small" style={styles.loader} />}
              {!isLoading && (
                <TouchableOpacity
                  onPress={handleWatchAd}
                  disabled={!loaded || isLoading}
                  style={[styles.button, !loaded && styles.buttonDisabled]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buttonText}>
                    {loaded ? 'Watch Now' : 'Loading...'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    );
  }

  if (variant === 'row') {
    // Row variant - for settings page
    return (
      <TouchableOpacity
        onPress={handleWatchAd}
        disabled={isFreeAds || isLoading || !loaded}
        style={[styles.rowContainer, isFreeAds && styles.rowDisabled]}
        activeOpacity={0.7}
      >
        <View style={[styles.rowIcon, isFreeAds && styles.rowIconFree]}>
          <MaterialCommunityIcons
            name={isFreeAds ? 'check-circle' : 'play-circle'}
            size={20}
            color={isFreeAds ? COLORS.PRIMARY : '#fff'}
          />
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle}>
            {isFreeAds ? 'Ads-Free Active' : 'Watch Ads for Free Access'}
          </Text>
          <Text style={styles.rowSubtitle}>
            {isFreeAds ? `${formatTimeRemaining(timeRemaining)} remaining` : 'Get 24 hours ad-free'}
          </Text>
        </View>
        {isLoading && <ActivityIndicator color={COLORS.TEXT} size="small" />}
        {!isLoading && !isFreeAds && (
          <Text style={styles.rowCta}>{loaded ? 'Watch' : 'Loading'}</Text>
        )}
      </TouchableOpacity>
    );
  }

  // Full width variant - for saved page
  return (
    <TouchableOpacity
      onPress={handleWatchAd}
      disabled={isFreeAds || isLoading || !loaded}
      activeOpacity={0.75}
      style={{ marginHorizontal: SPACING.md, marginVertical: SPACING.sm }}
    >
      <LinearGradient
        colors={
          isFreeAds
            ? [COLORS.PRIMARY + '30', COLORS.PRIMARY + '15']
            : [COLORS.PRIMARY, COLORS.PRIMARY + 'dd']
        }
        style={styles.fullCard}
      >
        <View style={styles.fullContent}>
          <MaterialCommunityIcons
            name={isFreeAds ? 'check-circle' : 'play-circle'}
            size={28}
            color={isFreeAds ? COLORS.PRIMARY : '#fff'}
          />
          <View style={styles.fullText}>
            <Text style={[styles.fullTitle, isFreeAds && { color: COLORS.PRIMARY }]}>
              {isFreeAds ? 'Ads-Free for One Day' : 'Watch Ads - Free for One Day'}
            </Text>
            <Text style={[styles.fullSubtitle, isFreeAds && { color: COLORS.TEXT_SECONDARY }]}>
              {isFreeAds ? `${formatTimeRemaining(timeRemaining)} left` : 'Watch one reward ad to remove all ads for 24 hours'}
            </Text>
          </View>
        </View>
        {isLoading && <ActivityIndicator color={isFreeAds ? COLORS.PRIMARY : '#fff'} />}
        {!isLoading && !isFreeAds && (
          <Text style={styles.fullCta}>{loaded ? 'Watch Now' : 'Loading'}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Grid variant
  gridCard: {
    backgroundColor: COLORS.SURFACE_2,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    aspectRatio: 1,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.SURFACE,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  subtitle: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.TEXT_SECONDARY,
  },
  button: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
  },
  loader: {
    marginTop: SPACING.xs,
  },
  freeContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  freeTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },
  timeRemaining: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.TEXT_SECONDARY,
  },

  // Row variant
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.SURFACE_2,
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    gap: SPACING.md,
  },
  rowDisabled: {
    opacity: 0.7,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowIconFree: {
    backgroundColor: 'transparent',
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  rowSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  rowCta: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },

  // Full width variant
  fullCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.md,
  },
  fullContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  fullText: {
    flex: 1,
  },
  fullTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#fff',
  },
  fullSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  fullCta: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: '#fff',
  },
});
