const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude ALL node_modules from Metro's Haste file map to prevent
// EMFILE (too many open files) errors on macOS. Metro resolves npm
// packages via Node.js require() directly from disk, so this does
// not break bundling - it only stops Metro from watching those files
// for hot-reload changes (which aren't needed for node_modules anyway).
config.resolver.blockList = [/.*\/node_modules\/.*/];

module.exports = config;
