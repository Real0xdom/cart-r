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

// Keep Metro scoped to the driver app, with a narrow exception for the shared package.
// Watching the entire monorepo can exceed watcher startup limits and
// cause "Failed to start watch mode" before the dev server finishes booting.
config.watchFolders = [sharedPackageRoot];

// Resolve dependencies from the app first, with the workspace root as a fallback.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Ignore generated folders and repo metadata even if Metro is asked to crawl wider paths.
// We use a more aggressive regex for Windows performance.
// FIXED: Commented blockList to prevent expo-router/entry.js exclusion
// config.resolver.blockList = ignoredPaths.map(
//   (filePath) => new RegExp(`^${pathToPattern(filePath)}(?:[\\\\/].*)?$`)
// );

// REMOVED: unblockFile doesn't exist in Metro API

// Allow hierarchical lookup for monorepo fallback resolution
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
