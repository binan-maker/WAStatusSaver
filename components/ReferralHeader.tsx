import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Clipboard, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

interface ReferralHeaderProps {
  compact?: boolean;
}

export function ReferralHeader({ compact = false }: ReferralHeaderProps) {
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
      Alert.alert('Copied!', 'Referral link copied');
    } catch (e) {
      console.log('Copy error:', e);
    }
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactContent}>
          <View>
            <Text style={styles.compactInvites}>Your Invites: {inviteCount}</Text>
            <Text style={styles.compactText}>Add A Friend to Enjoy 3 Days Ads Free</Text>
          </View>
          <View style={styles.compactButtons}>
            <TouchableOpacity onPress={handleShare} style={styles.compactBtn}>
              <Ionicons name="share-social" size={16} color={COLORS.PRIMARY} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleCopyLink} style={styles.compactBtn}>
              <Ionicons name="link" size={16} color={COLORS.PRIMARY} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  compactContainer: {
    paddingHorizontal: SPACING.PADDING,
    paddingVertical: 12,
    backgroundColor: COLORS.SURFACE + '80',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.PRIMARY + '11',
  },
  compactContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactInvites: {
    fontSize: FONT_SIZE.MEDIUM,
    fontWeight: '700',
    color: COLORS.PRIMARY,
    marginBottom: 2,
  },
  compactText: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
  },
  compactButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  compactBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.PRIMARY + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
