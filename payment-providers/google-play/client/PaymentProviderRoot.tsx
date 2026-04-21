import React from 'react';
import { IAPProvider } from 'react-native-iap';

export function PaymentProviderRoot({ children }: { children: React.ReactNode }) {
  return <IAPProvider>{children}</IAPProvider>;
}
