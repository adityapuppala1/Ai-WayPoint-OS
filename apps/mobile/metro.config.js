// Expo configures Metro for pnpm workspaces itself (SDK 52+); workspace packages ship
// TypeScript source, which Metro compiles like the app's own files.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
