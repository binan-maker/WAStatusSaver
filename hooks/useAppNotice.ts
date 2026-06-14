export interface AppNotice {
  id: string;
  title: string;
  message: string;
}

export function useAppNotice() {
  return { notice: null as AppNotice | null, visible: false, dismiss: async () => {} };
}

export function useAppNoticeDirect() {
  return { notice: null as AppNotice | null, loading: false };
}
