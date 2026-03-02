const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix Firebase auth "Component auth has not been registered yet" error.
// Metro must use the 'react-native' conditional export from firebase/auth
// so the auth component registration side-effect runs correctly.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'require', 'default'];

module.exports = config;
