// ═══════════════════════════════════════════════════════════════════════════
//  SERVER-SIDE PAYMENT PROVIDER SWITCH  (must match payment-providers/index.ts)
//  ─────────────────────────────────────────────────────────────────────────
//  Activate ONE store target. Keep the other commented out.
//
//  ┌─ INDUS APP STORE / OTHER STORES (Razorpay) ───────────────────────────
export { registerRazorpayRoutes as registerPaymentRoutes } from "./razorpay/server/routes";
export const PROVIDER_NAME = "razorpay" as const;
//  └────────────────────────────────────────────────────────────────────────

//  ┌─ GOOGLE PLAY STORE ────────────────────────────────────────────────────
// export { registerGooglePlayRoutes as registerPaymentRoutes } from "./google-play/server/routes";
// export const PROVIDER_NAME = "google-play" as const;
//  └────────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
