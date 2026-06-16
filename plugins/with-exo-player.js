/**
 * Expo config plugin — wires the native ExoPlayerModule into the Android build.
 *
 * During `expo prebuild` (or EAS build) this plugin:
 *   1. Copies the four Java source files into
 *      android/app/src/main/java/expo/modules/exoplayer/
 *   2. Injects Media3 Gradle dependencies into android/app/build.gradle
 *   3. Registers ExoPlayerPackage in MainApplication so React Native loads it
 */
const {
  withMainApplication,
  withDangerousMod,
  withAppBuildGradle,
} = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

const JAVA_SRC_DIR = path.join(
  __dirname,
  '..',
  'modules',
  'exo-player',
  'android',
  'src',
  'main',
  'java',
);

const JAVA_FILES = [
  'expo/modules/exoplayer/ExoPlayerModule.java',
  'expo/modules/exoplayer/ExoPlayerPackage.java',
  'expo/modules/exoplayer/ExoPlayerView.java',
  'expo/modules/exoplayer/ExoPlayerViewManager.java',
];

const MEDIA3_VERSION = '1.3.1';
const MEDIA3_DEPS = [
  `    implementation "androidx.media3:media3-exoplayer:${MEDIA3_VERSION}"`,
  `    implementation "androidx.media3:media3-ui:${MEDIA3_VERSION}"`,
  `    implementation "androidx.media3:media3-common:${MEDIA3_VERSION}"`,
].join('\n');

// ── Step 1: Copy Java sources ─────────────────────────────────────────────────

function withExoPlayerJavaSources(config) {
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
          console.warn(`[with-exo-player] Source file not found: ${src}`);
        }
      }

      return config;
    },
  ]);
}

// ── Step 2: Inject Media3 Gradle deps ─────────────────────────────────────────

function withExoPlayerGradleDeps(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    // Idempotent — skip if already present
    if (contents.includes('media3-exoplayer')) return config;

    // Insert after the opening `dependencies {` line
    contents = contents.replace(
      /^(dependencies\s*\{)/m,
      `$1\n${MEDIA3_DEPS}`,
    );

    config.modResults.contents = contents;
    return config;
  });
}

// ── Step 3: Register ExoPlayerPackage in MainApplication ──────────────────────

function withExoPlayerMainApplication(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    // Idempotent — don't add twice
    if (contents.includes('ExoPlayerPackage')) return config;

    const isKotlin = config.modResults.language === 'kt';

    if (isKotlin) {
      contents = contents.replace(
        /(import com\.facebook\.react\.ReactApplication)/,
        'import expo.modules.exoplayer.ExoPlayerPackage\n$1',
      );
      contents = contents.replace(
        /(val packages = PackageList\(this\)\.packages)/,
        '$1\n      packages.add(ExoPlayerPackage())',
      );
      if (!contents.includes('ExoPlayerPackage()')) {
        contents = contents.replace(
          /(return packages)/,
          'packages.add(ExoPlayerPackage())\n      $1',
        );
      }
    } else {
      contents = contents.replace(
        /(import com\.facebook\.react\.ReactApplication;)/,
        '$1\nimport expo.modules.exoplayer.ExoPlayerPackage;',
      );
      contents = contents.replace(
        /(List<ReactPackage> packages = new PackageList\(this\)\.getPackages\(\);)/,
        '$1\n      packages.add(new ExoPlayerPackage());',
      );
      if (!contents.includes('new ExoPlayerPackage()')) {
        contents = contents.replace(
          /(return packages;)/,
          'packages.add(new ExoPlayerPackage());\n      $1',
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

// ── Compose all steps ─────────────────────────────────────────────────────────

function withExoPlayer(config) {
  config = withExoPlayerJavaSources(config);
  config = withExoPlayerGradleDeps(config);
  config = withExoPlayerMainApplication(config);
  return config;
}

module.exports = withExoPlayer;
