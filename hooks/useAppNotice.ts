import { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseClientApp } from '@/lib/firebase-client';

export interface AppNotice {
  id: string;
  title: string;
  message: string;
}

const MAX_SHOWS = 2;

export function useAppNotice() {
  const [notice, setNotice] = useState<AppNotice | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const app = getFirebaseClientApp();
        if (!app) return;

        const db = getFirestore(app);
        const snap = await getDoc(doc(db, 'appConfig', 'notice'));
        if (!snap.exists()) return;

        const data = snap.data();
        if (!data.active || !data.message) return;

        const noticeId: string = data.id || 'default';
        const key = `@notice_shown_${noticeId}`;
        const stored = await AsyncStorage.getItem(key);
        const count = stored ? parseInt(stored, 10) : 0;

        if (count >= MAX_SHOWS) return;

        if (mounted) {
          setNotice({ id: noticeId, title: data.title || 'Notice', message: data.message });
          setVisible(true);
          await AsyncStorage.setItem(key, String(count + 1));
        }
      } catch {
        // Non-critical — silent fail
      }
    };

    fetch();
    return () => { mounted = false; };
  }, []);

  const dismiss = () => setVisible(false);

  return { notice, visible, dismiss };
}
