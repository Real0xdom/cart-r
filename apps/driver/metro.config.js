// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const sharedPackageRoot = path.resolve(workspaceRoot, 'packages', 'shared');

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
  path.resolve(projectRoot, 'node_modules', '.cache'),
  path.resolve(workspaceRoot, '.git'),
  path.resolve(workspaceRoot, '.next'),
  path.resolve(workspaceRoot, '.npm-cache'),
  path.resolve(workspaceRoot, 'dist_test'),
  path.resolve(workspaceRoot, 'docs'),
  path.resolve(workspaceRoot, '.qoder'),
  path.resolve(workspaceRoot, '.maestro'),
  path.resolve(workspaceRoot, 'node_modules', '.cache'),
];

// Enable package exports resolution - fixes SHA-1 computation issues
config.resolver.unstable_enablePackageExports = true;

// Keep Metro scoped to the driver app, with exceptions for shared package and root node_modules (for hoisted deps)
config.watchFolders = [sharedPackageRoot, path.resolve(workspaceRoot, 'node_modules')];

// Resolve dependencies from the app first, with the workspace root as a fallback.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Ignore generated folders and repo metadata
config.resolver.blockList = ignoredPaths.map(
  (filePath) => new RegExp(`^${pathToPattern(filePath)}(?:[\\\\/].*)?$`)
);

// Use hierarchical lookup for monorepo fallback resolution
config.resolver.disableHierarchicalLookup = true;

// Fix for react-native-cashfree-pg-sdk unable to resolve ../package.json
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '../package.json' &&
    context.originModulePath.includes('react-native-cashfree-pg-sdk')
  ) {
    return {
      filePath: path.resolve(
        workspaceRoot,
        'node_modules/react-native-cashfree-pg-sdk/package.json'
      ),
      type: 'sourceFile',
    };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
