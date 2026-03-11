import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled';

export function NotificationToggle() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotificationState = async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
        if (stored !== null) {
          setEnabled(stored === 'true');
        } else {
          setEnabled(true);
          await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'true');
        }
      } catch (e) {
        console.log('Failed to load notification state:', e);
      } finally {
        setLoading(false);
      }
    };
    loadNotificationState();
  }, []);

  const handleToggle = async (value: boolean) => {
    try {
      setEnabled(value);
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, value.toString());
      
      Alert.alert(
        value ? 'Notifications Enabled' : 'Notifications Disabled',
        value
          ? 'You will now receive notifications about new statuses'
          : 'You will not receive notifications',
        [{ text: 'OK' }]
      );
    } catch (e) {
      console.error('Failed to toggle notifications:', e);
      setEnabled(!value);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={enabled ? 'notifications' : 'notifications-off'}
            size={20}
            color={enabled ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY}
          />
        </View>
        <View style={styles.info}>
          <Text style={styles.label}>Notifications</Text>
          <Text style={styles.sublabel}>
            {enabled ? 'Enabled - Get alerts for new statuses' : 'Disabled - No alerts'}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: COLORS.TEXT_SECONDARY + '33', true: COLORS.PRIMARY + '33' }}
          thumbColor={enabled ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY}
        />
      </View>
    </View>
  );
}

export async function isNotificationsEnabled(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY);
    return stored !== 'false';
  } catch (e) {
    console.log('Failed to check notifications:', e);
    return true;
  }
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.PADDING,
    marginVertical: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.BUTTON,
    paddingHorizontal: SPACING.PADDING,
    paddingVertical: 12,
  },
  iconContainer: {
    marginRight: SPACING.PADDING,
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: FONT_SIZE.MEDIUM,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 2,
  },
  sublabel: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
  },
});
