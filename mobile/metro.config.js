const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Forces Metro to use the browser-compatible version of dependencies
// This fixes the "Unable to resolve module crypto from axios" error
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// If any native module is still looking for Node.js built-ins, 
// we can provide empty shims for them
config.resolver.extraNodeModules = {
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer'),
};

module.exports = config;
