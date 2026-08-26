require("dotenv").config({ quiet: true });

const appJson = require("./app.json");
const baseExpoConfig = appJson.expo;

const androidAppId = process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID?.trim();
const iosAppId = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID?.trim();
const testAppIds = new Set([
  "ca-app-pub-3940256099942544~3347511713",
  "ca-app-pub-3940256099942544~1458002511",
]);
const buildProfile = process.env.EAS_BUILD_PROFILE;
const buildPlatform = process.env.EAS_BUILD_PLATFORM;
const isProductionBuild =
  buildProfile === "production" ||
  process.env.EXPO_PUBLIC_BUILD_ENV === "production";

if (testAppIds.has(androidAppId) || testAppIds.has(iosAppId)) {
  throw new Error(
    "Google test AdMob app IDs are not allowed. Use real AdMob app IDs in the environment.",
  );
}

const requiresAndroidAppId =
  isProductionBuild && (!buildPlatform || buildPlatform === "android" || buildPlatform === "all");
const requiresIosAppId =
  isProductionBuild && (buildPlatform === "ios" || buildPlatform === "all");

if (requiresAndroidAppId && !androidAppId) {
  throw new Error(
    "Missing EXPO_PUBLIC_ADMOB_ANDROID_APP_ID for the production Android build.",
  );
}
if (requiresIosAppId && !iosAppId) {
  throw new Error(
    "Missing EXPO_PUBLIC_ADMOB_IOS_APP_ID for the production iOS build.",
  );
}

const plugins = baseExpoConfig.plugins.filter((plugin) => {
  const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
  return pluginName !== "react-native-google-mobile-ads";
});

if (androidAppId || iosAppId) {
  plugins.push([
    "react-native-google-mobile-ads",
    {
      ...(androidAppId ? { androidAppId } : {}),
      ...(iosAppId ? { iosAppId } : {}),
    },
  ]);
}

module.exports = {
  ...appJson,
  expo: {
    ...baseExpoConfig,
    plugins,
  },
};