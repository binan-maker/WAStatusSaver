[x] 1. Install the required packages
[x] 2. Restart the workflow to see if the project is working
[x] 3. Verify the project is working using the feedback tool
[x] 4. Inform user the import is completed and they can start building, mark the import as completed using the complete_project_import tool
[x] FIX 1 - SESSION CACHE BLOAT: cleanupCacheFiles now accepts a maxAgeMs param; onImageSwipe runs a 30-min light cleanup every 10 swipes in the background
[x] FIX 2 - WORK PROFILE BLINDSPOT: requestSAF accepts manual=true param; permissions screen shows "Using dual WhatsApp or Work Profile? Browse manually" dashed button that opens SAF picker at storage root
[x] FIX 3 - DUPLICATE SAVE WASTE: saveStatus checks savedItems for matching id OR filename before copying; returns true immediately if file already exists, preventing gallery duplicates
[x] FIX 4 - ZOMBIE VIDEO DECODER: ViewerItem unmount useEffect calls player.replaceAsync(null) to explicitly release the hardware decoder when the viewer closes
[x] PAYMENT HARDENING - ALL 4 CRITICAL BUGS FIXED:
  - Internet Drop Trap: payment_id saved to AsyncStorage (PENDING_PAYMENT_KEY) immediately after Razorpay closes, before /verify API call; auto-retried on next app open
  - Order Creation Panic: isolated try/catch for order creation phase — shows "Server Busy. No money charged." instead of scary "money may have been taken" message
  - Unmounted State Crash: isMountedRef guards all setStatus/setLoading/setPayingPlanId calls in useSubscriptionStatus hook
  - Stale Token: getIdToken(true) force-refreshes Firebase token right before /verify call; AuthContext updated to pass forceRefresh param
  - Server idempotency guard: /verify endpoint returns existing subscription immediately if order already verified, with paymentId mismatch check to block fraudulent re-use
