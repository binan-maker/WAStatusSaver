/**
 * Expo config plugin — wires the native SafReaderModule into the Android build.
 *
 * What it does during `expo prebuild` (or EAS build):
 *   1. Copies SafReaderModule.java + SafReaderPackage.java into
 *      android/app/src/main/java/expo/modules/safreader/
 *   2. Adds `import expo.modules.safreader.SafReaderPackage;` to MainApplication
 *   3. Adds `packages.add(new SafReaderPackage());` to getPackages()
 *
 * React Native's autolinking does NOT pick up local Java modules unless they
 * have an expo-module.config.json wired through expo-modules-core, so we
 * register the package manually here.
 */
const { withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const JAVA_SRC_DIR = path.join(__dirname, '..', 'modules', 'saf-reader', 'android', 'src', 'main', 'java');

const JAVA_FILES = [
  'expo/modules/safreader/SafReaderModule.java',
  'expo/modules/safreader/SafReaderPackage.java',
];

/**
 * Copy the Java source files into the generated android project.
 */
function withSafReaderJavaSources(config) {
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
        const src  = path.join(JAVA_SRC_DIR, relPath);
        const dest = path.join(androidJavaSrcDir, relPath);
        const destDir = path.dirname(dest);

        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        } else {
          console.warn(`[with-saf-reader] Source file not found: ${src}`);
        }
      }

      return config;
    },
  ]);
}

/**
 * Register SafReaderPackage in MainApplication.java/kt so React Native loads it.
 *
 * Handles both Java (.java) and Kotlin (.kt) MainApplication files, which
 * Expo generates depending on the template version.
 */
function withSafReaderMainApplication(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    // Idempotent — don't add twice.
    if (contents.includes('SafReaderPackage')) return config;

    const isKotlin = config.modResults.language === 'kt';

    if (isKotlin) {
      // Kotlin MainApplication
      contents = contents.replace(
        /(import com\.facebook\.react\.ReactApplication)/,
        'import expo.modules.safreader.SafReaderPackage\n$1',
      );
      // Kotlin getPackages(): add before `return packages`
      contents = contents.replace(
        /(val packages = PackageList\(this\)\.packages)/,
        '$1\n      packages.add(SafReaderPackage())',
      );
      // Fallback pattern used by newer Expo Kotlin templates
      if (!contents.includes('SafReaderPackage()')) {
        contents = contents.replace(
          /(return packages)/,
          'packages.add(SafReaderPackage())\n      $1',
        );
      }
    } else {
      // Java MainApplication
      contents = contents.replace(
        /(import com\.facebook\.react\.ReactApplication;)/,
        '$1\nimport expo.modules.safreader.SafReaderPackage;',
      );
      // Standard Expo Java template pattern
      contents = contents.replace(
        /(List<ReactPackage> packages = new PackageList\(this\)\.getPackages\(\);)/,
        '$1\n      packages.add(new SafReaderPackage());',
      );
      // Fallback: older templates use `return packages;` directly
      if (!contents.includes('new SafReaderPackage()')) {
        contents = contents.replace(
          /(return packages;)/,
          'packages.add(new SafReaderPackage());\n      $1',
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });
}

function withSafReader(config) {
  config = withSafReaderJavaSources(config);
  config = withSafReaderMainApplication(config);
  return config;
}

module.exports = withSafReader;
