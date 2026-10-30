const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The P0 domain model is shared with the existing Next.js app and lives
// outside this workspace package. Expo's automatic workspace detection watches
// dependencies, but not the repository's root src/ directory.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../src')];

// Expo SQLite loads its web database from a bundled WebAssembly asset.
config.resolver.assetExts.push('wasm');

const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, metroServer) => {
  const enhanced = enhanceMiddleware ? enhanceMiddleware(middleware, metroServer) : middleware;
  return (request, response, next) => {
    response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return enhanced(request, response, next);
  };
};

module.exports = config;
