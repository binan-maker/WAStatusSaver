import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STEP = 10;

function k(type: string, suffix: string) {
  return `@milestone_${type}_${suffix}`;
}

export function useMilestoneRating(type: 'share' | 'save') {
  const [count, setCount] = useState(0);
  const [showCard, setShowCard] = useState(false);
  const loadedRef = useRef(false);
  const countRef = useRef(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [countStr, ratedStr, threshStr] = await Promise.all([
          AsyncStorage.getItem(k(type, 'count')),
          AsyncStorage.getItem(k(type, 'rated')),
          AsyncStorage.getItem(k(type, 'next_thresh')),
        ]);
        const c = parseInt(countStr || '0', 10);
        const rated = ratedStr === '1';
        const thresh = parseInt(threshStr || String(STEP), 10);
        countRef.current = c;
        setCount(c);
        if (!rated && c >= thresh) setShowCard(true);
      } catch {}
      loadedRef.current = true;
    };
    load();
  }, [type]);

  const increment = useCallback(async () => {
    if (!loadedRef.current) return;
    const [ratedStr, threshStr] = await Promise.all([
      AsyncStorage.getItem(k(type, 'rated')),
      AsyncStorage.getItem(k(type, 'next_thresh')),
    ]).catch(() => ['0', String(STEP)]) as [string | null, string | null];

    if (ratedStr === '1') return;

    const newCount = countRef.current + 1;
    countRef.current = newCount;
    setCount(newCount);
    await AsyncStorage.setItem(k(type, 'count'), String(newCount)).catch(() => {});

    const thresh = parseInt(threshStr || String(STEP), 10);
    if (newCount >= thresh) {
      setShowCard(true);
    }
  }, [type]);

  const onRate = useCallback(async () => {
    setShowCard(false);
    await AsyncStorage.setItem(k(type, 'rated'), '1').catch(() => {});
  }, [type]);

  const onDismiss = useCallback(async () => {
    setShowCard(false);
    const newThresh = countRef.current + STEP;
    await AsyncStorage.setItem(k(type, 'next_thresh'), String(newThresh)).catch(() => {});
  }, [type]);

  return { count, showCard, increment, onRate, onDismiss };
}
