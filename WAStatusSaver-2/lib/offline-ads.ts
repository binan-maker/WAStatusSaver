import NetInfo from '@react-native-async-storage/async-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AdState {
  isOnline: boolean;
  lastAdTimestamp: number;
}

const AD_CHECK_INTERVAL = 300000; // 5 minutes
let adState: AdState = { isOnline: true, lastAdTimestamp: 0 };

export async function checkConnectivity(): Promise<boolean> {
  try {
    const response = await fetch('https://www.google.com/generate_204', {
      method: 'HEAD',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function initializeAdState(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem('AD_STATE');
    if (stored) {
      adState = JSON.parse(stored);
    }
  } catch {}
}

export function getAdState(): AdState {
  return adState;
}

export async function updateAdState(online: boolean): Promise<void> {
  adState = {
    isOnline: online,
    lastAdTimestamp: Date.now(),
  };
  try {
    await AsyncStorage.setItem('AD_STATE', JSON.stringify(adState));
  } catch {}
}

export async function shouldShowAd(): Promise<boolean> {
  try {
    const isOnline = await checkConnectivity();
    await updateAdState(isOnline);
    return isOnline;
  } catch {
    return adState.isOnline;
  }
}
