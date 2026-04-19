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
import { useRewardedAd } from '@/components/ads/AdReward';
import { useFreeAdsState } from '@/hooks/ads/useFreeAdsState';
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

interface RewardAdButtonProps {
  variant?: 'grid' | 'row' | 'full';
}

export function RewardAdButton({ variant = 'grid' }: RewardAdButtonProps) {
  const { loaded, showAd } = useRewardedAd();
  const { isFreeAds, setFreeAdsFor5Hours, timeRemaining, formatTimeRemaining } = useFreeAdsState();
  const [isLoading, setIsLoading] = useState(false);

  const handleWatchAd = async () => {
    if (isFreeAds || isLoading) return;
    setIsLoading(true);
    try {
      const rewarded = await showAd();
      if (rewarded) {
        await setFreeAdsFor5Hours();
      }
    } catch (error) {
      console.error('Error showing reward ad:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Row variant (Settings page) ────────────────────────────────────────────
  if (variant === 'row') {
    if (isFreeAds) {
      return (
        <View style={styles.rowCard}>
          <LinearGradient
            colors={[COLORS.PRIMARY + '18', COLORS.PRIMARY + '08']}
            style={styles.rowCardInner}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.rowIconWrap, { backgroundColor: COLORS.PRIMARY + '22' }]}>
                <MaterialCommunityIcons name="check-circle" size={22} color={COLORS.PRIMARY} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowTitle}>Ads-Free Active</Text>
                <Text style={styles.rowSubtitle}>
                  {formatTimeRemaining(timeRemaining)} remaining
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      );
    }

    return (
      <View style={styles.rowCard}>
        <View style={styles.rowCardInner}>
          <View style={styles.rowLeft}>
            <View style={[styles.rowIconWrap, { backgroundColor: COLORS.PRIMARY + '18' }]}>
              <MaterialCommunityIcons name="play-circle" size={22} color={COLORS.PRIMARY} />
            </View>
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowTitle}>Watch Ad for Free Access</Text>
              <Text style={styles.rowSubtitle}>Get 2 hours completely ad-free</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleWatchAd}
            disabled={isLoading}
            style={styles.rowBtn}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#06100C" size="small" />
            ) : (
              <Text style={styles.rowBtnText}>Watch Ad</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Full variant ────────────────────────────────────────────────────────────
  if (variant === 'full') {
    return (
      <TouchableOpacity
        onPress={handleWatchAd}
        disabled={isFreeAds || isLoading}
        activeOpacity={0.8}
        style={styles.fullWrap}
      >
        <LinearGradient
          colors={isFreeAds ? [COLORS.PRIMARY + '30', COLORS.PRIMARY + '15'] : [COLORS.PRIMARY, COLORS.PRIMARY + 'dd']}
          style={styles.fullCard}
        >
          <MaterialCommunityIcons
            name={isFreeAds ? 'check-circle' : 'play-circle'}
            size={26}
            color={isFreeAds ? COLORS.PRIMARY : '#06100C'}
          />
          <View style={styles.fullText}>
            <Text style={[styles.fullTitle, isFreeAds && { color: COLORS.PRIMARY }]}>
              {isFreeAds ? 'Ads-Free Active' : 'Watch Ad — 2 Hours Free'}
            </Text>
            <Text style={[styles.fullSubtitle, isFreeAds && { color: COLORS.TEXT_SECONDARY }]}>
              {isFreeAds ? `${formatTimeRemaining(timeRemaining)} left` : 'Watch one reward ad to remove all ads'}
            </Text>
          </View>
          {isLoading
            ? <ActivityIndicator color={isFreeAds ? COLORS.PRIMARY : '#06100C'} />
            : !isFreeAds && <Text style={styles.fullCta}>Watch Now</Text>
          }
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // ── Grid variant ────────────────────────────────────────────────────────────
  return (
    <View style={styles.gridCard}>
      {isFreeAds ? (
        <LinearGradient colors={[COLORS.PRIMARY + '30', COLORS.PRIMARY + '10']} style={styles.gridFree}>
          <MaterialCommunityIcons name="star-circle" size={30} color={COLORS.PRIMARY} />
          <Text style={styles.gridFreeTitle}>Free Ads Active</Text>
          <Text style={styles.gridFreeTime}>{formatTimeRemaining(timeRemaining)} left</Text>
        </LinearGradient>
      ) : (
        <>
          <LinearGradient colors={[COLORS.PRIMARY, COLORS.PRIMARY + 'cc']} style={styles.gridTop}>
            <MaterialCommunityIcons name="play-circle" size={30} color="#06100C" />
          </LinearGradient>
          <View style={styles.gridBottom}>
            <Text style={styles.gridTitle}>Watch Ad</Text>
            <Text style={styles.gridSub}>2 Hours Free</Text>
            <TouchableOpacity
              onPress={handleWatchAd}
              disabled={isLoading}
              style={styles.gridBtn}
              activeOpacity={0.8}
            >
              {isLoading
                ? <ActivityIndicator color={COLORS.PRIMARY} size="small" />
                : <Text style={styles.gridBtnText}>Watch Now</Text>
              }
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Row variant ──────────────────────────────────────────────────────────
  rowCard: {
    marginHorizontal: 0,
    borderRadius: RADIUS.MD,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
  },
  rowCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    gap: SPACING.MD,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.MD,
  },
  rowIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: {
    flex: 1,
  },
  rowTitle: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  rowSubtitle: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
    marginTop: 2,
  },
  rowBtn: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.SM + 2,
    borderRadius: RADIUS.FULL,
    minWidth: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBtnText: {
    color: '#06100C',
    fontSize: FONT_SIZE.SM,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
  },

  // ── Full variant ─────────────────────────────────────────────────────────
  fullWrap: {
    marginHorizontal: SPACING.LG,
    marginVertical: SPACING.SM,
  },
  fullCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.MD,
    borderRadius: RADIUS.MD,
    gap: SPACING.MD,
  },
  fullText: {
    flex: 1,
  },
  fullTitle: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '700',
    color: '#06100C',
    fontFamily: 'Nunito_700Bold',
  },
  fullSubtitle: {
    fontSize: FONT_SIZE.XS,
    color: '#06100C',
    opacity: 0.75,
    marginTop: 2,
    fontFamily: 'Nunito_400Regular',
  },
  fullCta: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '800',
    color: '#06100C',
    fontFamily: 'Nunito_800ExtraBold',
  },

  // ── Grid variant ─────────────────────────────────────────────────────────
  gridCard: {
    backgroundColor: COLORS.SURFACE_2,
    borderRadius: RADIUS.MD,
    overflow: 'hidden',
    aspectRatio: 1,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  gridTop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridBottom: {
    padding: SPACING.SM,
    gap: 2,
  },
  gridTitle: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  gridSub: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
  },
  gridBtn: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: SPACING.XS,
    borderRadius: RADIUS.SM,
    alignItems: 'center',
    marginTop: SPACING.XS,
  },
  gridBtnText: {
    color: '#06100C',
    fontSize: FONT_SIZE.XS,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },
  gridFree: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.XS,
  },
  gridFreeTitle: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '700',
    color: COLORS.PRIMARY,
    fontFamily: 'Nunito_700Bold',
  },
  gridFreeTime: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
  },
});
