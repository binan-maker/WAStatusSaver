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

module.exports = config;
