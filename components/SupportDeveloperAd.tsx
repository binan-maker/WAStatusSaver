import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRewardedAd } from '@/components/AdReward';
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

export function SupportDeveloperAd() {
  const { loaded, showAd } = useRewardedAd('ca-app-pub-8785278012936203/8714198841');
  const [isLoading, setIsLoading] = useState(false);
  const [watchCompleted, setWatchCompleted] = useState(false);

  const handleWatchAd = async () => {
    if (isLoading || !loaded || watchCompleted) return;
    
    setIsLoading(true);
    try {
      const rewarded = await showAd();
      if (rewarded) {
        setWatchCompleted(true);
        // Show emotional thank you message ONLY after watching
        Alert.alert(
          '🙏 Thank You!',
          'Your support means so much to us! This helps us keep building amazing features for StatusVault.\n\nYou\'ve made a real difference today.',
          [
            {
              text: 'Close',
              style: 'default',
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error showing support ad:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.ACCENT_GOLD + '20', COLORS.ACCENT_GOLD + '08']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <MaterialCommunityIcons name="heart" size={24} color={COLORS.ACCENT_GOLD} />
          </View>
          <View style={styles.titleBox}>
            <Text style={styles.title}>Support App Development</Text>
            <Text style={styles.subtitle}>Watch an ad & help us grow</Text>
          </View>
        </View>

        <Text style={styles.message}>
          Your support helps us maintain StatusVault and add new features. Thank you for being part of our community! 💪
        </Text>

        <TouchableOpacity
          onPress={handleWatchAd}
          disabled={!loaded || isLoading || watchCompleted}
          style={[styles.button, (isLoading || watchCompleted) && styles.buttonDisabled]}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={
              watchCompleted
                ? [COLORS.PRIMARY + '44', COLORS.PRIMARY + '33']
                : [COLORS.ACCENT_GOLD, COLORS.ACCENT_GOLD + 'dd']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.buttonGradient}
          >
            {isLoading && <ActivityIndicator color="#fff" size="small" style={styles.loader} />}
            {!isLoading && (
              <>
                <MaterialCommunityIcons name={watchCompleted ? 'check-circle' : 'play-circle'} size={18} color="#fff" />
                <Text style={styles.buttonText}>
                  {watchCompleted ? 'Thank You!' : loaded ? 'Watch Ad' : 'Loading...'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {watchCompleted && (
          <View style={styles.thankYouBox}>
            <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.PRIMARY} />
            <Text style={styles.thankYouText}>Thanks for supporting us!</Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.PADDING,
    marginVertical: 12,
  },
  card: {
    borderRadius: RADIUS.CARD,
    padding: SPACING.PADDING,
    borderWidth: 1,
    borderColor: COLORS.ACCENT_GOLD + '33',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.ACCENT_GOLD + '25',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleBox: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZE.MEDIUM,
    fontWeight: '700',
    color: COLORS.TEXT,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
  },
  message: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 18,
    marginBottom: 14,
  },
  button: {
    borderRadius: RADIUS.BUTTON,
    overflow: 'hidden',
    marginBottom: 12,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loader: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: FONT_SIZE.MEDIUM,
    fontWeight: '700',
  },
  thankYouBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.PRIMARY + '15',
    borderRadius: RADIUS.BUTTON,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  thankYouText: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
});
