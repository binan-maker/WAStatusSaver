import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Clipboard,
  Alert,
  LinearGradient,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

export function ReferralHeader() {
  const [inviteCount, setInviteCount] = useState(0);
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const code = await AsyncStorage.getItem('referralCode');
        const count = await AsyncStorage.getItem('inviteCount');
        if (code) setReferralCode(code);
        if (count) setInviteCount(parseInt(count, 10));
      } catch (e) {
        console.log('Failed to load referral data:', e);
      }
    };
    loadData();
  }, []);

  const referralLink = `https://play.google.com/store/apps/details?id=com.binan.statussaver&referrer=${referralCode}`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on StatusVault! 📱 Use my code: ${referralCode}\n\n${referralLink}`,
        title: 'StatusVault - Invite Friends',
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
      <LinearGradient
        colors={[COLORS.PRIMARY + '15', COLORS.PRIMARY + '08']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <Text style={styles.inviteCount}>{inviteCount}</Text>
            <Text style={styles.label}>Your Invites</Text>
          </View>
          <View style={styles.glowOrb} />
        </View>

        <Text style={styles.message}>Add A Friend to Enjoy 3 Days Ads Free</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity onPress={handleShare} style={[styles.button, styles.shareButton]}>
            <LinearGradient
              colors={[COLORS.PRIMARY, COLORS.PRIMARY + 'dd']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <Ionicons name="share-social" size={18} color="#fff" />
              <Text style={styles.buttonText}>Share</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleCopyLink} style={[styles.button, styles.linkButton]}>
            <Ionicons name="link" size={18} color={COLORS.PRIMARY} />
            <Text style={styles.linkText}>Copy Link</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.PADDING,
    paddingVertical: 16,
  },
  card: {
    borderRadius: RADIUS.CARD,
    paddingHorizontal: SPACING.PADDING,
    paddingVertical: SPACING.PADDING,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '22',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleSection: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  inviteCount: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.PRIMARY,
    lineHeight: 40,
  },
  label: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '500',
    marginTop: 2,
  },
  glowOrb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.PRIMARY + '22',
    opacity: 0.6,
  },
  message: {
    fontSize: FONT_SIZE.MEDIUM,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 16,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: RADIUS.BUTTON,
    overflow: 'hidden',
  },
  shareButton: {
    flex: 1.2,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: FONT_SIZE.MEDIUM,
    fontWeight: '700',
  },
  linkButton: {
    backgroundColor: COLORS.PRIMARY + '15',
    borderWidth: 1.5,
    borderColor: COLORS.PRIMARY + '44',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    color: COLORS.PRIMARY,
    fontSize: FONT_SIZE.MEDIUM,
    fontWeight: '700',
  },
});
