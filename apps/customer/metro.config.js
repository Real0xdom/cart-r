// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix for react-native-cashfree-pg-sdk unable to resolve ../package.json
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '../package.json' &&
    context.originModulePath.includes('react-native-cashfree-pg-sdk')
  ) {
    return {
      filePath: path.resolve(
        __dirname,
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

