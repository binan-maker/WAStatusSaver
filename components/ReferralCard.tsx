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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

export function ReferralCard() {
  const [referralCode, setReferralCode] = useState<string>('');

  useEffect(() => {
    const initReferralCode = async () => {
      try {
        let code = await AsyncStorage.getItem('referralCode');
        if (!code) {
          // Generate unique code (first 6 chars of random UUID)
          code = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
          await AsyncStorage.setItem('referralCode', code);
        }
        setReferralCode(code);
      } catch (e) {
        console.log('Failed to load referral code:', e);
      }
    };
    initReferralCode();
  }, []);

  const referralLink = `https://play.google.com/store/apps/details?id=com.binan.statussaver&referrer=${referralCode}`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on StatusVault - the best WhatsApp Status Saver! 📱\n\nInvite Code: ${referralCode}\nGet 30 Days of FREE ADS! 🎁\n\nDownload: ${referralLink}`,
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
          <Ionicons name="people" size={24} color={COLORS.PRIMARY} />
          <Text style={styles.title}>Invite Friends</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.subtitle}>Share and Earn</Text>
          <Text style={styles.description}>
            Each friend you invite gets 30 days of free ads. You get 30 days free too!
          </Text>

          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Your Referral Code</Text>
            <Text style={styles.code}>{referralCode}</Text>
          </View>

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
              <Text style={[styles.buttonText, { color: COLORS.PRIMARY }]}>Copy Link</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Friends Invited</Text>
              <Text style={styles.statValue}>0</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Free Ads Earned</Text>
              <Text style={styles.statValue}>0 days</Text>
            </View>
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
    paddingVertical: SPACING.PADDING,
    paddingHorizontal: SPACING.PADDING,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.PRIMARY + '11',
  },
  title: {
    fontSize: FONT_SIZE.LARGE,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginLeft: SPACING.PADDING,
  },
  content: {
    paddingHorizontal: SPACING.PADDING,
    paddingVertical: SPACING.PADDING,
  },
  subtitle: {
    fontSize: FONT_SIZE.MEDIUM,
    fontWeight: '600',
    color: COLORS.PRIMARY,
    marginBottom: 4,
  },
  description: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.PADDING,
    lineHeight: 20,
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
  stats: {
    flexDirection: 'row',
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: RADIUS.BUTTON,
    paddingVertical: 12,
    paddingHorizontal: SPACING.PADDING,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: COLORS.TEXT_SECONDARY + '22',
  },
  statLabel: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 4,
  },
  statValue: {
    fontSize: FONT_SIZE.MEDIUM,
    fontWeight: '700',
    color: COLORS.PRIMARY,
  },
});
