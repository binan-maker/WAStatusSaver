// ═══════════════════════════════════════════════════════════════════════════
//  SERVER-SIDE STORE BUILD SWITCH
//  Keep this in sync with payment-providers/index.ts (client-side switch)
// ═══════════════════════════════════════════════════════════════════════════

// FOR INDUS APP STORE (Razorpay):
export { registerRazorpayRoutes as registerPaymentRoutes } from "./razorpay/server/routes";
export const PROVIDER_NAME = "razorpay" as const;

// FOR GOOGLE PLAY STORE:
// export { registerGooglePlayRoutes as registerPaymentRoutes } from "./google-play/server/routes";
// export const PROVIDER_NAME = "google-play" as const;
// ═══════════════════════════════════════════════════════════════════════════
