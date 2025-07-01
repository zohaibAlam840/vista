// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 1️⃣ Allow Metro to resolve `.cjs` files (Firebase ships some CJS modules)
config.resolver.sourceExts.push('cjs');

// 2️⃣ Disable the new package‐exports enforcement so Metro falls back to index files
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
