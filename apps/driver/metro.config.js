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
config.resolver.blockList = ignoredPaths.map(
  (filePath) => new RegExp(`^${pathToPattern(filePath)}(?:[\\\\/].*)?$`)
);

// Optional: If you still face issues, you can try to exclude the entire node_modules from the watcher
// but keep it for resolution. This is tricky, but adding it here usually helps the crawler.
// config.resolver.blockList.push(/.*node_modules[\\/]((?!(@clerk|expo|react|shared|nativewind)).*)/);

// Avoid walking parent folders while resolving modules. This reduces unnecessary
// filesystem access on Windows and keeps Metro from probing outside the app.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
