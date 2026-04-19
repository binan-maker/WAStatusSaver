import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const REMINDER_SECONDS = 24 * 60 * 60;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function setupAndSchedule() {
  if (Platform.OS === 'web') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('status-reminders', {
      name: 'Status Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00c48c',
      description: 'Reminds you when new WhatsApp statuses may be available',
    });
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'New statuses are waiting! 📸',
      body: 'Open StatusVault to save your WhatsApp statuses before they disappear.',
      sound: false,
      data: { type: 'status-reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: REMINDER_SECONDS,
      repeats: false,
    },
  });
}

export function useStatusReminder() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    setupAndSchedule().catch(() => {});

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        setupAndSchedule().catch(() => {});
      }
    });

    return () => sub.remove();
  }, []);
}
