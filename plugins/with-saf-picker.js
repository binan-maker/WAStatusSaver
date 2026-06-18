/**
 * with-saf-picker.js
 *
 * Expo config plugin that wires SafPickerModule into the Android build.
 * This module bypasses OEM file managers and forces Android's built-in
 * DocumentsUI so the SAF folder picker always opens at Android/media.
 *
 * During `expo prebuild` / EAS build this plugin:
 *   1. Copies SafPickerModule.java + SafPickerPackage.java into the Android project
 *   2. Registers SafPickerPackage in MainApplication (Java or Kotlin)
 *   3. Adds a <queries> block to AndroidManifest so Android 11+ allows the app
 *      to detect and directly launch com.android.documentsui
 */

const { withMainApplication, withDangerousMod, withAndroidManifest } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

const JAVA_SRC_DIR = path.join(
  __dirname,
  '..',
  'modules',
  'saf-picker',
  'android',
  'src',
  'main',
  'java',
);

const JAVA_FILES = [
  'expo/modules/safpicker/SafPickerModule.java',
  'expo/modules/safpicker/SafPickerPackage.java',
];

// ── Step 1: Copy Java sources ─────────────────────────────────────────────────

function withSafPickerJavaSources(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const androidJavaSrcDir = path.join(
        config.modRequest.projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
      );

      for (const relPath of JAVA_FILES) {
        const src     = path.join(JAVA_SRC_DIR, relPath);
        const dest    = path.join(androidJavaSrcDir, relPath);
        const destDir = path.dirname(dest);

        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        } else {
          console.warn(`[with-saf-picker] Source file not found: ${src}`);
        }
      }

      return config;
    },
  ]);
}

// ── Step 2: Register SafPickerPackage in MainApplication ──────────────────────

function withSafPickerMainApplication(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes('SafPickerPackage')) return config; // idempotent

    const isKotlin = config.modResults.language === 'kt';

    if (isKotlin) {
      contents = contents.replace(
        /(import com\.facebook\.react\.ReactApplication)/,
        'import expo.modules.safpicker.SafPickerPackage\n$1',
      );
      contents = contents.replace(
        /(val packages = PackageList\(this\)\.packages)/,
        '$1\n      packages.add(SafPickerPackage())',
      );
      if (!contents.includes('SafPickerPackage()')) {
        contents = contents.replace(
          /(return packages)/,
          'packages.add(SafPickerPackage())\n      $1',
        );
      }
    } else {
      contents = contents.replace(
        /(import com\.facebook\.react\.ReactApplication;)/,
        '$1\nimport expo.modules.safpicker.SafPickerPackage;',
      );
      contents = contents.replace(
        /(List<ReactPackage> packages = new PackageList\(this\)\.getPackages\(\);)/,
        '$1\n      packages.add(new SafPickerPackage());',
      );
      if (!contents.includes('new SafPickerPackage()')) {
        contents = contents.replace(
          /(return packages;)/,
          'packages.add(new SafPickerPackage());\n      $1',
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

// ── Step 3: Add <queries> block so Android 11+ allows detecting DocumentsUI ──

function withSafPickerManifestQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.queries) {
      manifest.queries = [];
    }

    // Check if already declared
    const alreadyDeclared = manifest.queries.some(
      (q) => q.package && q.package.some((p) => p.$?.['android:name'] === 'com.android.documentsui'),
    );

    if (!alreadyDeclared) {
      manifest.queries.push({
        package: [{ $: { 'android:name': 'com.android.documentsui' } }],
      });
    }

    return config;
  });
}

// ── Compose ───────────────────────────────────────────────────────────────────

function withSafPicker(config) {
  config = withSafPickerJavaSources(config);
  config = withSafPickerMainApplication(config);
  config = withSafPickerManifestQueries(config);
  return config;
}

module.exports = withSafPicker;
