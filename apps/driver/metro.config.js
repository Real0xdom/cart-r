// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure Metro only looks in this app's node_modules
const projectRoot = __dirname;
config.watchFolders = [projectRoot];

// Block looking in parent directories for node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// Disable hierarchical lookup (prevent it from going up to root node_modules)
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
