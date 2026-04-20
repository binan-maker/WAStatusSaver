// ═══════════════════════════════════════════════════════════════════════════
//  CLIENT-SIDE PAYMENT PROVIDER SWITCH
//  ─────────────────────────────────────────────────────────────────────────
//  Activate ONE store target by uncommenting the correct export line.
//  Keep the other line commented out. Then delete the unused folder before
//  uploading to the store.
//
//  Also update payment-providers/server.ts to match this choice.
//
//  ┌─ INDUS APP STORE / OTHER STORES ──────────────────────────────────────
//  │  Payment provider: Razorpay (INR direct payment — NO Google Play code)
//  │  Step 1: Keep the razorpay line below ACTIVE (uncommented)
//  │  Step 2: Comment out the google-play line below
//  │  Step 3: Delete payment-providers/google-play/ before uploading
//  │  Env vars needed: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
//  │                   RAZORPAY_WEBHOOK_SECRET, FIREBASE_SERVICE_ACCOUNT_JSON
//  └────────────────────────────────────────────────────────────────────────
export * from "./razorpay";

//  ┌─ GOOGLE PLAY STORE ────────────────────────────────────────────────────
//  │  Payment provider: Google Play Billing (NO Razorpay code)
//  │  Step 1: Comment out the razorpay line above
//  │  Step 2: Uncomment the google-play line below
//  │  Step 3: Delete payment-providers/razorpay/ before uploading
//  │  Env vars needed: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON,
//  │                   GOOGLE_PLAY_PACKAGE_NAME, FIREBASE_SERVICE_ACCOUNT_JSON
//  │  Setup: Add product IDs in Google Play Console:
//  │    statusvault_pro_monthly, statusvault_pro_quarterly, statusvault_pro_yearly
//  └────────────────────────────────────────────────────────────────────────
// export * from "./google-play";
// ═══════════════════════════════════════════════════════════════════════════
