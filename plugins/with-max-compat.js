/**
 * with-max-compat.js
 *
 * Expo config plugin that maximises Google Play device compatibility by:
 *
 *  1. Marking every hardware <uses-feature> as required="false" so Android
 *     does NOT filter the app out of devices that lack camera, GPS, telephony,
 *     microphone, Bluetooth, NFC, touchscreen, etc.
 *
 *  2. Adding <supports-screens> to explicitly cover all screen densities and
 *     sizes (small → xlarge), which unlocks tablets, foldables, and large-
 *     screen Android devices.
 *
 *  3. Removing the implicit touchscreen requirement — the single biggest
 *     source of TV / ChromeOS / Android-Go exclusions.
 *
 * This plugin runs during `expo prebuild` / EAS build and edits
 * android/app/src/main/AndroidManifest.xml directly.
 *
 * SAFE to apply to Status Saver: the app uses no camera, GPS, microphone,
 * NFC, or telephony APIs — those hardware features are never required.
 */

const { withAndroidManifest } = require('@expo/config-plugins');

const OPTIONAL_HARDWARE_FEATURES = [
  // Touch / input
  'android.hardware.touchscreen',
  'android.hardware.touchscreen.multitouch',
  'android.hardware.touchscreen.multitouch.distinct',
  'android.hardware.touchscreen.multitouch.jazzhand',
  'android.hardware.faketouch',

  // Telephony / SIM (tablets without SIM are filtered without this)
  'android.hardware.telephony',
  'android.hardware.telephony.cdma',
  'android.hardware.telephony.gsm',

  // Camera (we don't use it, but some deps imply it)
  'android.hardware.camera',
  'android.hardware.camera.any',
  'android.hardware.camera.autofocus',
  'android.hardware.camera.flash',
  'android.hardware.camera.front',

  // Location (expo-media-library with location enabled can imply GPS)
  'android.hardware.location',
  'android.hardware.location.gps',
  'android.hardware.location.network',

  // Audio / microphone
  'android.hardware.microphone',
  'android.hardware.audio.output',
  'android.hardware.audio.low_latency',
  'android.hardware.audio.pro',

  // Bluetooth
  'android.hardware.bluetooth',
  'android.hardware.bluetooth_le',

  // NFC
  'android.hardware.nfc',
  'android.hardware.nfc.hce',

  // Sensors (finance / AR apps commonly trigger these)
  'android.hardware.sensor.accelerometer',
  'android.hardware.sensor.barometer',
  'android.hardware.sensor.compass',
  'android.hardware.sensor.gyroscope',
  'android.hardware.sensor.heartrate',
  'android.hardware.sensor.light',
  'android.hardware.sensor.proximity',
  'android.hardware.sensor.stepcounter',
  'android.hardware.sensor.stepdetector',

  // Wi-Fi / networking
  'android.hardware.wifi',
  'android.hardware.wifi.direct',

  // USB
  'android.hardware.usb.host',
  'android.hardware.usb.accessory',

  // Fingerprint / biometrics
  'android.hardware.fingerprint',

  // VR / AR
  'android.hardware.vr.headtracking',
  'android.hardware.vr.high_performance',

  // Screen / display
  'android.hardware.screen.landscape',
  'android.hardware.screen.portrait',
];

function withMaxCompat(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const mainApp  = manifest.manifest;

    // ── 1. Ensure the top-level array exists ─────────────────────────────────
    if (!mainApp['uses-feature']) {
      mainApp['uses-feature'] = [];
    }

    // Build a set of features already declared (to avoid duplicates)
    const existing = new Set(
      mainApp['uses-feature'].map((f) => f.$?.['android:name']).filter(Boolean),
    );

    // ── 2. Add every hardware feature as required="false" ────────────────────
    for (const feature of OPTIONAL_HARDWARE_FEATURES) {
      if (existing.has(feature)) {
        // If already declared, ensure required is set to false
        const entry = mainApp['uses-feature'].find(
          (f) => f.$?.['android:name'] === feature,
        );
        if (entry) {
          entry.$['android:required'] = 'false';
        }
      } else {
        mainApp['uses-feature'].push({
          $: {
            'android:name': feature,
            'android:required': 'false',
          },
        });
      }
    }

    // ── 3. Add <supports-screens> for all screen sizes ───────────────────────
    // Only add once (idempotent)
    if (!mainApp['supports-screens']) {
      mainApp['supports-screens'] = [
        {
          $: {
            'android:smallScreens':  'true',
            'android:normalScreens': 'true',
            'android:largeScreens':  'true',
            'android:xlargeScreens': 'true',
            'android:anyDensity':    'true',
            'android:resizeable':    'true',
          },
        },
      ];
    }

    return config;
  });
}

module.exports = withMaxCompat;
