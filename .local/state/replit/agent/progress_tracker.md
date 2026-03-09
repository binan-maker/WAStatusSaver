[x] 1. Install the required packages
[x] 2. Restart the workflow to see if the project is working
[x] 3. Verify the project is working using the feedback tool
[x] 4. Inform user the import is completed and they can start building, mark the import as completed using the complete_project_import tool
[x] 5. Fixed blank media issue on Android 11+ and swiping in saved page by improving SAF caching and viewer item URI handling.
[x] 6. Simplified video player controls: removed progress bar and skip buttons, leaving only a central play/pause toggle. Verified swipe functionality remains intact.
[x] 7. Implemented direct SAF folder selection for Android 11+ by using a specially encoded initial URI for WhatsApp Media.
[x] 8. Updated permission screen to guide users to click "Use this folder" directly without manual navigation.
[x] 9. Auto-load images and videos on app start - removed dependency on permission state to trigger loading
[x] 10. Memoized filtered image/video lists to prevent unnecessary re-renders during scrolling
[x] 11. Added double-tap prevention (300ms debounce) to prevent duplicate opening of same image/video
[x] 12. Fixed blank screen issue when opening images/videos by improving state management in ViewerItem
[x] 13. Optimized memory management - only prepares items near the active item, prevents loading all items
[x] 14. Fixed scrolling flicker - counter updates now smooth with proper state tracking
[x] 15. Initialized Google Mobile Ads in layout.tsx - ads now initialize properly on app launch
[x] 16. Removed all vibration feedback from the app - disabled all Haptics calls from buttons, saves, and interactions
[x] 17. Optimized video loading and playback - improved state management and caching to prevent glitches
[x] 18. **Fixed SAF Friction** - Improved permission screen with step-by-step navigation instructions (Android → media → com.whatsapp → WhatsApp → Media)
[x] 19. **Reduced Ad Frequency** - Video ads: 3→10 views, Image swipes: 7→15 swipes (less intrusive user experience)
[x] 20. **Optimized Resource Intensity** - Reduced FlatList batch rendering (8 items), narrowed viewport (windowSize=4), switched to disk-only caching for memory efficiency
[x] 21. **FIXED ALL 6 FRICTION POINTS:**
  - **#1 Performance Bottlenecks** - Optimized SAF folder enumeration to reduce directory read redundancy
  - **#2 Video Resource Exhaustion** - Video player now only initializes for active item (prevents multi-decoder memory drain)
  - **#3 Jarring Media Transitions** - Cache checks prevent redundant file copies on repeated views
  - **#4 Video Thumbnail Inconsistency** - Using expo-image caching with recyclingKey for smooth scrolling
  - **#5 UX Friction in Viewer** - Controls now properly toggle with smooth animation (immersive mode enabled)
  - **#6 Storage Ghost Files** - Added aggressive 24-hour cache cleanup to prevent disk bloat
