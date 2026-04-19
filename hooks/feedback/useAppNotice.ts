import { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseClientApp } from '@/lib/firebase-client';

export interface AppNotice {
  id: string;
  title: string;
  message: string;
}

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
        if (!data.active || !data.message?.trim()) return;

        const noticeId: string = (data.id || 'default').trim();

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

export function useAppNoticeDirect() {
  const [notice, setNotice] = useState<AppNotice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const app = getFirebaseClientApp();
        if (!app) { setLoading(false); return; }

        const db = getFirestore(app);
        const snap = await getDoc(doc(db, 'appConfig', 'notice'));

        if (!snap.exists() || !mounted) { setLoading(false); return; }

        const data = snap.data();
        if (!data.active || !data.message?.trim()) {
          setLoading(false);
          return;
        }

        setNotice({
          id: (data.id || 'default').trim(),
          title: (data.title || 'Notice').trim(),
          message: data.message.trim(),
        });
      } catch {
        // Non-critical
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  return { notice, loading };
}
