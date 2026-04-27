const { getDefaultConfig } = require("expo/metro-config");
const exclusionList = require("metro-config/private/defaults/exclusionList").default;

const config = getDefaultConfig(__dirname);

config.resolver.blockList = exclusionList([
  /\/\.local\/.*/,
  /\/server_dist\/.*/,
  /\/server\/(?!templates).*/,
  /\/payment-providers\/server\.ts$/,
  /\/payment-providers\/shared\/server-utils\.ts$/,
  /\/payment-providers\/razorpay\/server\/.*/,
  /\/payment-providers\/google-play\/server\/.*/,
]);

// PERF: inlineRequires defers module evaluation until first use instead of
// evaluating every import at bundle parse time. On Android 11+ this reduces
// cold-start JS parse by 20-30% — the runtime only pays for modules that
// are actually reached during the current screen's render path, not the
// entire dependency tree upfront.
config.transformer.inlineRequires = true;

module.exports = config;
