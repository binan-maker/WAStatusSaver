import { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseClientApp } from '@/lib/firebase-client';

export interface AppNotice {
  id: string;
  title: string;
  message: string;
}

// Key format: @notice_dismissed_{noticeId}
// Value: "1" means the user tapped X and dismissed this specific notice.
// Changing the `id` field in Firestore resets the counter and shows the notice again.
function dismissedKey(noticeId: string) {
  return `@notice_dismissed_${noticeId}`;
}

export function useAppNotice() {
  const [notice, setNotice] = useState<AppNotice | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const app = getFirebaseClientApp();
        if (!app) return;

        const db = getFirestore(app);
        const snap = await getDoc(doc(db, 'appConfig', 'notice'));
        if (!snap.exists()) return;

        const data = snap.data();
        // Skip if notice is inactive or has no message
        if (!data.active || !data.message?.trim()) return;

        const noticeId: string = (data.id || 'default').trim();

        // If the user already dismissed this exact notice id — don't show it again
        const dismissed = await AsyncStorage.getItem(dismissedKey(noticeId));
        if (dismissed === '1') return;

        if (mounted) {
          setNotice({
            id: noticeId,
            title: (data.title || 'Notice').trim(),
            message: data.message.trim(),
          });
          setVisible(true);
        }
      } catch {
        // Non-critical — silent fail
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  const dismiss = async () => {
    setVisible(false);
    if (notice?.id) {
      await AsyncStorage.setItem(dismissedKey(notice.id), '1').catch(() => {});
    }
  };

  return { notice, visible, dismiss };
}
