[x] 1. Install the required packages
[x] 2. Restart the workflow to see if the project is working
[x] 3. Verify the project is working using the feedback tool
[x] 4. Inform user the import is completed and they can start building, mark the import as completed using the complete_project_import tool
[x] FIX 1 - SESSION CACHE BLOAT: cleanupCacheFiles now accepts a maxAgeMs param; onImageSwipe runs a 30-min light cleanup every 10 swipes in the background
[x] FIX 2 - WORK PROFILE BLINDSPOT: requestSAF accepts manual=true param; permissions screen shows "Using dual WhatsApp or Work Profile? Browse manually" dashed button that opens SAF picker at storage root
[x] FIX 3 - DUPLICATE SAVE WASTE: saveStatus checks savedItems for matching id OR filename before copying; returns true immediately if file already exists, preventing gallery duplicates
[x] FIX 4 - ZOMBIE VIDEO DECODER: ViewerItem unmount useEffect calls player.replaceAsync(null) to explicitly release the hardware decoder when the viewer closes
[x] PAYMENT HARDENING - ALL 4 CRITICAL BUGS FIXED
[x] CHAMPION'S ROADMAP - Firebase optimization, ProGuard, Rating Prompt, Push Notifications
[x] ROUND 3 - ALL 4 FIXES DONE:
  - expo-video-thumbnails REMOVED: The package had a missing build file (VideoThumbnails.js). Removed the dependency entirely from MediaCard.tsx. expo-image (Glide on Android) now renders the video URI directly — Glide natively extracts the first video frame for file:// and most content:// URIs. No extra native library needed.
  - Video black screen FIXED: VideoView is now ALWAYS mounted for video items (no more {isNearActive && <VideoView />} conditional). Conditionally mounting the SurfaceView while the decoder was active detached the output surface causing audio to play but screen to be black. The thumbnail Image overlay still covers it until isVideoReady.
  - Image zoom REBUILT: Replaced the broken native responder system (onMoveShouldSetResponder only fired when scale>1, making initial pinch impossible) with GestureDetector from react-native-gesture-handler + Reanimated shared values. Features: smooth pinch-to-zoom (up to 6×), pan when zoomed (fails automatically when not zoomed so FlatList swipe still works), double-tap to zoom in/out 2.5×, single-tap to toggle controls. Zoom resets on item change.
  - Firebase cost SLASHED: Added smart cache TTL check in refresh() — Pro users skip API call if cache < 6 hours old, Free users skip if < 30 min old. Polling interval extended from 5 min to 30 min (but is almost always a no-op now due to cache). Force=true used after payments and right after app foreground. Estimated reduction: 95%+ fewer Firestore reads for typical users.
