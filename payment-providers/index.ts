// ═══════════════════════════════════════════════════════════════════════════
//  STORE BUILD SWITCH
//  ─────────────────────────────────────────────────────────────────────────
//  Choose ONE store target. Comment out the other line, then DELETE the
//  folder you are NOT building for before submitting to the store.
//
//  ┌─ INDUS APP STORE BUILD ────────────────────────────────────────────────
//  │  Active provider: Razorpay (INR, direct payment)
//  │  Delete before build: payment-providers/google-play/
//  │  Required env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
//  │                     RAZORPAY_WEBHOOK_SECRET, FIREBASE_SERVICE_ACCOUNT_JSON
//  └────────────────────────────────────────────────────────────────────────
export * from "./razorpay";

//  ┌─ GOOGLE PLAY STORE BUILD ──────────────────────────────────────────────
//  │  Active provider: Google Play Billing (INR, managed by Play Store)
//  │  Delete before build: payment-providers/razorpay/
//  │  Required env vars: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON,
//  │                     GOOGLE_PLAY_PACKAGE_NAME, FIREBASE_SERVICE_ACCOUNT_JSON
//  │  Required setup: Add product IDs in Google Play Console:
//  │    statusvault_pro_monthly, statusvault_pro_quarterly, statusvault_pro_yearly
//  └────────────────────────────────────────────────────────────────────────
// export * from "./google-play";
// ═══════════════════════════════════════════════════════════════════════════
