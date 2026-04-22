import { useEffect } from "react";
import type { User } from "firebase/auth";
import { apiRequest } from "@/lib/query-client";
import { cacheShareLink, clearCachedShareLink } from "@/lib/share-link";
import type { MyReferralResponse } from "@/shared/referral-types";

/**
 * One-shot prefetch of the user's personal short share link as soon as auth
 * stabilises. Runs in the background — failures are silently ignored because
 * `getCachedShareLink()` falls back to the bare Play Store URL.
 *
 * This is what guarantees that the first time the user taps "Share" on a
 * status, their personal link is already in the clipboard — even if they
 * never opened the Invite & Earn screen.
 */
export function usePrefetchShareLink(
  user: User | null,
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>,
) {
  useEffect(() => {
    if (!user) {
      // Signed out — drop the cached personal link so we don't leak it across
      // sessions. The fallback bare-install URL kicks in automatically.
      clearCachedShareLink();
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const token = await getIdToken();
        if (!token || cancelled) return;
        const res = await apiRequest("GET", "/api/referrals/me", undefined, {
          Authorization: `Bearer ${token}`,
        });
        if (cancelled) return;
        const body = (await res.json()) as MyReferralResponse;
        if (body?.shareUrl && body?.code) {
          await cacheShareLink(body.shareUrl, body.code);
        }
      } catch {
        // best-effort — fallback URL is always usable
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user, getIdToken]);
}
