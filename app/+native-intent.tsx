import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_REF_KEY = 'pending_referral_code';

/**
 * Capture the `?ref=CODE` query param from any inbound deep link
 * (e.g. `statusvault://invite?ref=ABC123`) so the app can attribute
 * the install to the referrer once the user signs in.
 *
 * Runs synchronously at app boot — we fire-and-forget the AsyncStorage
 * write, then return the redirect path.
 */
export function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }) {
  try {
    if (typeof path === 'string' && path) {
      // path may look like "/invite?ref=ABC" OR a full URL.
      const qIndex = path.indexOf('?');
      if (qIndex >= 0) {
        const query = path.slice(qIndex + 1);
        const params = new URLSearchParams(query);
        const ref = params.get('ref');
        if (ref) {
          // Fire-and-forget — by the time the user finishes sign-in,
          // this will have committed.
          AsyncStorage.setItem(PENDING_REF_KEY, ref.trim().toUpperCase()).catch(() => {});
          return '/invite';
        }
      }
      // Bare /invite deep link with no ref — still route to invite screen.
      if (path.replace(/^\/+/, '').startsWith('invite')) return '/invite';
    }
  } catch {
    // swallow — never break boot for a bad deep link
  }
  return '/';
}
