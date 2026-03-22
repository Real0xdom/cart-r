// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

const escapeRegex = (value) => value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&');

const pathToPattern = (filePath) =>
  filePath
    .split(/[\\/]+/)
    .map(escapeRegex)
    .join('[\\\\/]');

const ignoredPaths = [
  path.resolve(projectRoot, '.expo'),
  path.resolve(projectRoot, 'android', '.gradle'),
  path.resolve(projectRoot, 'android', 'app', 'build'),
  path.resolve(projectRoot, 'android', 'build'),
  path.resolve(projectRoot, 'android_backup'),
  path.resolve(projectRoot, 'dist'),
  path.resolve(projectRoot, 'coverage'),
  path.resolve(workspaceRoot, '.git'),
  path.resolve(workspaceRoot, '.next'),
  path.resolve(workspaceRoot, '.npm-cache'),
  path.resolve(workspaceRoot, 'dist_test'),
];

// Enable package exports resolution
config.resolver.unstable_enablePackageExports = true;

// Watch monorepo root so Metro can resolve root-level packages (expo-router, etc.)
// The blockList below ensures slow build folders are excluded for performance.
config.watchFolders = [workspaceRoot];

// Resolve dependencies from the app first, with the workspace root as a fallback.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Ignore generated folders and repo metadata even if Metro is asked to crawl wider paths.
config.resolver.blockList = ignoredPaths.map(
  (filePath) => new RegExp(`^${pathToPattern(filePath)}(?:[\\\\/].*)?$`)
);

config.resolver.disableHierarchicalLookup = true;

// ─── Expo Go compatibility ────────────────────────────────────────────────────
// When started with EXPO_GO=true, redirect packages that require custom native
// code (not bundled in Expo Go) to local mock implementations.
if (process.env.EXPO_GO === 'true') {
  console.log('[metro] Expo Go mode: using mocks for native-only packages');
  config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'react-native-maps': path.resolve(projectRoot, 'mocks/react-native-maps.js'),
    'react-native-cashfree-pg-sdk': path.resolve(projectRoot, 'mocks/react-native-cashfree-pg-sdk.js'),
  };
}
// ─────────────────────────────────────────────────────────────────────────────

// Fix for react-native-cashfree-pg-sdk unable to resolve ../package.json
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '../package.json' &&
    context.originModulePath.includes('react-native-cashfree-pg-sdk')
  ) {
    return {
      filePath: require.resolve('react-native-cashfree-pg-sdk/package.json', { paths: [projectRoot] }),
      type: 'sourceFile',
    };
  }
  
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
