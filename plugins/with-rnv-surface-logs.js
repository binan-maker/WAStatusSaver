/**
 * Expo config plugin — injects Android surface-lifecycle Log.d() calls into
 * react-native-video's ReactExoplayerView during `expo prebuild` / EAS build.
 *
 * WHY THIS EXISTS
 * ───────────────
 * onReadyForDisplay fires 40-50× per playback session in react-native-video
 * 6.x despite only 1-2 React renders and 1 Video mount. The root cause is
 * native Android surface recreation inside ExoPlayer. Surface lifecycle
 * callbacks (surfaceCreated/Destroyed, onSurfaceTextureAvailable/Destroyed)
 * are only visible from Java/Kotlin — there is no JS-level callback for them.
 *
 * This plugin patches ReactExoplayerView.java (or .kt) in node_modules at
 * prebuild time to emit Logcat lines filtered by "RNV-SURFACE". Those lines
 * will show exactly when and how often the surface is being destroyed and
 * recreated, pinpointing whether the trigger is:
 *   • ExoPlayer internally cycling the renderer (e.g. repeat seek)
 *   • Android visibility/lifecycle events (onWindowFocusChanged, etc.)
 *   • The Animated thumbnail overlay interfering with the Z-order
 *   • Audio focus causing a suspend/resume cycle
 *
 * USAGE
 * ─────
 * Build with EAS (or `expo prebuild`) then filter Logcat:
 *   adb logcat -s RNV-SURFACE
 *   adb logcat -s RNV-SURFACE ExoPlayer
 *
 * The plugin is idempotent — re-running prebuild will not double-insert logs.
 *
 * SUPPORTED VERSIONS
 * ──────────────────
 * react-native-video 6.x (Java or Kotlin ReactExoplayerView).
 * Handles both file extensions; silently no-ops if neither is found.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const GUARD = '// [RNV-SURFACE-LOGS patched]';

// ─── Java patches ─────────────────────────────────────────────────────────────
const JAVA_PATCHES = [
  // Import guard
  {
    find: /^(package com\.brentvatne\.exoplayer;)/m,
    replace: `$1\nimport android.util.Log; ${GUARD}`,
    guard: 'import android.util.Log;',
  },
  // SurfaceView — surfaceCreated
  {
    find: /public void surfaceCreated\(@NonNull SurfaceHolder holder\)\s*\{/,
    replace: `public void surfaceCreated(@NonNull SurfaceHolder holder) {\n        Log.d("RNV-SURFACE", "surfaceCreated — SurfaceView surface born"); ${GUARD}`,
    guard: 'surfaceCreated — SurfaceView',
  },
  // SurfaceView — surfaceCreated (no @NonNull variant)
  {
    find: /public void surfaceCreated\(SurfaceHolder holder\)\s*\{/,
    replace: `public void surfaceCreated(SurfaceHolder holder) {\n        Log.d("RNV-SURFACE", "surfaceCreated — SurfaceView surface born"); ${GUARD}`,
    guard: 'surfaceCreated — SurfaceView',
  },
  // SurfaceView — surfaceDestroyed
  {
    find: /public void surfaceDestroyed\(@NonNull SurfaceHolder holder\)\s*\{/,
    replace: `public void surfaceDestroyed(@NonNull SurfaceHolder holder) {\n        Log.d("RNV-SURFACE", "surfaceDestroyed \u26a0\ufe0f SurfaceView surface lost"); ${GUARD}`,
    guard: 'surfaceDestroyed \u26a0',
  },
  {
    find: /public void surfaceDestroyed\(SurfaceHolder holder\)\s*\{/,
    replace: `public void surfaceDestroyed(SurfaceHolder holder) {\n        Log.d("RNV-SURFACE", "surfaceDestroyed \u26a0\ufe0f SurfaceView surface lost"); ${GUARD}`,
    guard: 'surfaceDestroyed \u26a0',
  },
  // SurfaceView — surfaceChanged
  {
    find: /public void surfaceChanged\(@NonNull SurfaceHolder holder, int format, int width, int height\)\s*\{/,
    replace: `public void surfaceChanged(@NonNull SurfaceHolder holder, int format, int width, int height) {\n        Log.d("RNV-SURFACE", "surfaceChanged " + width + "x" + height); ${GUARD}`,
    guard: 'surfaceChanged — SurfaceView',
  },
  {
    find: /public void surfaceChanged\(SurfaceHolder holder, int format, int width, int height\)\s*\{/,
    replace: `public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) {\n        Log.d("RNV-SURFACE", "surfaceChanged " + width + "x" + height); ${GUARD}`,
    guard: 'surfaceChanged — SurfaceView',
  },
  // TextureView — onSurfaceTextureAvailable
  {
    find: /public void onSurfaceTextureAvailable\(@NonNull SurfaceTexture surface, int width, int height\)\s*\{/,
    replace: `public void onSurfaceTextureAvailable(@NonNull SurfaceTexture surface, int width, int height) {\n        Log.d("RNV-SURFACE", "onSurfaceTextureAvailable " + width + "x" + height + " \u2014 TextureView ready"); ${GUARD}`,
    guard: 'onSurfaceTextureAvailable',
  },
  {
    find: /public void onSurfaceTextureAvailable\(SurfaceTexture surface, int width, int height\)\s*\{/,
    replace: `public void onSurfaceTextureAvailable(SurfaceTexture surface, int width, int height) {\n        Log.d("RNV-SURFACE", "onSurfaceTextureAvailable " + width + "x" + height + " \u2014 TextureView ready"); ${GUARD}`,
    guard: 'onSurfaceTextureAvailable',
  },
  // TextureView — onSurfaceTextureDestroyed
  {
    find: /public boolean onSurfaceTextureDestroyed\(@NonNull SurfaceTexture surface\)\s*\{/,
    replace: `public boolean onSurfaceTextureDestroyed(@NonNull SurfaceTexture surface) {\n        Log.d("RNV-SURFACE", "onSurfaceTextureDestroyed \u26a0\ufe0f TextureView surface lost"); ${GUARD}`,
    guard: 'onSurfaceTextureDestroyed',
  },
  {
    find: /public boolean onSurfaceTextureDestroyed\(SurfaceTexture surface\)\s*\{/,
    replace: `public boolean onSurfaceTextureDestroyed(SurfaceTexture surface) {\n        Log.d("RNV-SURFACE", "onSurfaceTextureDestroyed \u26a0\ufe0f TextureView surface lost"); ${GUARD}`,
    guard: 'onSurfaceTextureDestroyed',
  },
  // TextureView — onSurfaceTextureSizeChanged
  {
    find: /public void onSurfaceTextureSizeChanged\(@NonNull SurfaceTexture surface, int width, int height\)\s*\{/,
    replace: `public void onSurfaceTextureSizeChanged(@NonNull SurfaceTexture surface, int width, int height) {\n        Log.d("RNV-SURFACE", "onSurfaceTextureSizeChanged " + width + "x" + height); ${GUARD}`,
    guard: 'onSurfaceTextureSizeChanged',
  },
  {
    find: /public void onSurfaceTextureSizeChanged\(SurfaceTexture surface, int width, int height\)\s*\{/,
    replace: `public void onSurfaceTextureSizeChanged(SurfaceTexture surface, int width, int height) {\n        Log.d("RNV-SURFACE", "onSurfaceTextureSizeChanged " + width + "x" + height); ${GUARD}`,
    guard: 'onSurfaceTextureSizeChanged',
  },
];

// ─── Kotlin patches ───────────────────────────────────────────────────────────
const KOTLIN_PATCHES = [
  // Import guard
  {
    find: /^(package com\.brentvatne\.exoplayer)/m,
    replace: `$1\nimport android.util.Log ${GUARD}`,
    guard: 'import android.util.Log',
  },
  // SurfaceView — surfaceCreated
  {
    find: /override fun surfaceCreated\(holder: SurfaceHolder\)\s*\{/,
    replace: `override fun surfaceCreated(holder: SurfaceHolder) {\n        Log.d("RNV-SURFACE", "surfaceCreated — SurfaceView surface born") ${GUARD}`,
    guard: 'surfaceCreated — SurfaceView',
  },
  // SurfaceView — surfaceDestroyed
  {
    find: /override fun surfaceDestroyed\(holder: SurfaceHolder\)\s*\{/,
    replace: `override fun surfaceDestroyed(holder: SurfaceHolder) {\n        Log.d("RNV-SURFACE", "surfaceDestroyed \u26a0\ufe0f SurfaceView surface lost") ${GUARD}`,
    guard: 'surfaceDestroyed \u26a0',
  },
  // SurfaceView — surfaceChanged
  {
    find: /override fun surfaceChanged\(holder: SurfaceHolder, format: Int, width: Int, height: Int\)\s*\{/,
    replace: `override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {\n        Log.d("RNV-SURFACE", "surfaceChanged \${width}x\${height}") ${GUARD}`,
    guard: 'surfaceChanged — SurfaceView',
  },
  // TextureView — onSurfaceTextureAvailable
  {
    find: /override fun onSurfaceTextureAvailable\(surface: SurfaceTexture, width: Int, height: Int\)\s*\{/,
    replace: `override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) {\n        Log.d("RNV-SURFACE", "onSurfaceTextureAvailable \${width}x\${height} \u2014 TextureView ready") ${GUARD}`,
    guard: 'onSurfaceTextureAvailable',
  },
  // TextureView — onSurfaceTextureDestroyed
  {
    find: /override fun onSurfaceTextureDestroyed\(surface: SurfaceTexture\): Boolean\s*\{/,
    replace: `override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean {\n        Log.d("RNV-SURFACE", "onSurfaceTextureDestroyed \u26a0\ufe0f TextureView surface lost") ${GUARD}`,
    guard: 'onSurfaceTextureDestroyed',
  },
  // TextureView — onSurfaceTextureSizeChanged
  {
    find: /override fun onSurfaceTextureSizeChanged\(surface: SurfaceTexture, width: Int, height: Int\)\s*\{/,
    replace: `override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) {\n        Log.d("RNV-SURFACE", "onSurfaceTextureSizeChanged \${width}x\${height}") ${GUARD}`,
    guard: 'onSurfaceTextureSizeChanged',
  },
];

function applyPatches(src, patches) {
  let result = src;
  let patchCount = 0;
  for (const { find, replace, guard } of patches) {
    if (result.includes(guard)) {
      continue; // already patched — idempotent
    }
    const next = result.replace(find, replace);
    if (next !== result) {
      result = next;
      patchCount++;
    }
  }
  return { src: result, patchCount };
}

function withRnvSurfaceLogs(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const projectRoot = config.modRequest.projectRoot;

      const candidates = [
        // Flat src layout (v6.x Java)
        path.join(
          projectRoot, 'node_modules', 'react-native-video', 'android',
          'src', 'main', 'java', 'com', 'brentvatne', 'exoplayer',
          'ReactExoplayerView.java',
        ),
        // Flat src layout (v6.x Kotlin)
        path.join(
          projectRoot, 'node_modules', 'react-native-video', 'android',
          'src', 'main', 'java', 'com', 'brentvatne', 'exoplayer',
          'ReactExoplayerView.kt',
        ),
        // Some builds use a lib sub-module
        path.join(
          projectRoot, 'node_modules', 'react-native-video', 'android',
          'lib', 'src', 'main', 'java', 'com', 'brentvatne', 'exoplayer',
          'ReactExoplayerView.java',
        ),
        path.join(
          projectRoot, 'node_modules', 'react-native-video', 'android',
          'lib', 'src', 'main', 'java', 'com', 'brentvatne', 'exoplayer',
          'ReactExoplayerView.kt',
        ),
      ];

      let patched = false;
      for (const filePath of candidates) {
        if (!fs.existsSync(filePath)) continue;

        const isKotlin = filePath.endsWith('.kt');
        const patches = isKotlin ? KOTLIN_PATCHES : JAVA_PATCHES;
        const raw = fs.readFileSync(filePath, 'utf8');
        const { src: patched_src, patchCount } = applyPatches(raw, patches);

        if (patchCount > 0) {
          fs.writeFileSync(filePath, patched_src, 'utf8');
          console.log(
            `[with-rnv-surface-logs] Patched ${path.basename(filePath)} — ${patchCount} injection(s). Filter Logcat by "RNV-SURFACE".`,
          );
        } else {
          console.log(
            `[with-rnv-surface-logs] ${path.basename(filePath)} already patched — no changes needed.`,
          );
        }

        patched = true;
        break; // only patch the first match
      }

      if (!patched) {
        console.warn(
          '[with-rnv-surface-logs] ReactExoplayerView not found in node_modules. ' +
          'Run `npm install` or `expo install` before prebuild.',
        );
      }

      return config;
    },
  ]);
}

module.exports = withRnvSurfaceLogs;
