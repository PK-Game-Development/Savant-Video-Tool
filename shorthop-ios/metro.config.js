const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Prevent Metro from watching node_modules subdirectories,
// which causes EMFILE (too many open files) on macOS.
config.resolver.blockList = [
  /node_modules\/.*\/node_modules\/.*/,
];

// Only watch the project source, not the entire filesystem
config.watchFolders = [__dirname];

module.exports = config;
