import AsyncStorage from "@react-native-async-storage/async-storage";

const SHARE_LINK_KEY = "@statusvault_share_link";
const SHARE_CODE_KEY = "@statusvault_share_code";

const FALLBACK_INSTALL_URL =
  "https://play.google.com/store/apps/details?id=com.binan.statussaver";

/**
 * Persist the user's personal short link (and code) so any screen can grab it
 * synchronously-ish without a network round-trip. Called by:
 *   - app/invite.tsx after /api/referrals/me succeeds
 *   - hooks/referral/usePrefetchShareLink on auth state change
 */
export async function cacheShareLink(shareUrl: string, code: string) {
  try {
    if (typeof shareUrl === "string" && shareUrl.startsWith("http")) {
      await AsyncStorage.setItem(SHARE_LINK_KEY, shareUrl);
    }
    if (typeof code === "string" && code.length > 0) {
      await AsyncStorage.setItem(SHARE_CODE_KEY, code);
    }
  } catch {
    // ignore — caching is best-effort
  }
}

/**
 * Returns the user's cached short link if available; otherwise the bare Play
 * Store install URL. Always resolves with a usable string — sharing should
 * never fail because we couldn't fetch a link.
 */
export async function getCachedShareLink(): Promise<string> {
  try {
    const cached = await AsyncStorage.getItem(SHARE_LINK_KEY);
    if (cached && cached.startsWith("http")) return cached;
  } catch {}
  return FALLBACK_INSTALL_URL;
}

export async function getCachedShareCode(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SHARE_CODE_KEY);
  } catch {
    return null;
  }
}

export async function clearCachedShareLink() {
  try {
    await AsyncStorage.multiRemove([SHARE_LINK_KEY, SHARE_CODE_KEY]);
  } catch {}
}

/**
 * Build the viral caption that gets pre-copied to the clipboard right before
 * the OS share sheet opens. Kept short on purpose — WhatsApp truncates very
 * long captions and people delete walls of text.
 */
export function buildShareCaption(shortLink: string): string {
  return `📥 Saved with StatusVault — get it: ${shortLink}`;
}
