module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Strip Flow type annotations from react-native source files.
      // Required for Expo Go compatibility — RN's EventEmitter.js uses
      // Flow mapped-type syntax that Metro can't parse without this.
      '@babel/plugin-transform-flow-strip-types',
      "nativewind/babel",
      "react-native-reanimated/plugin", // Must be last
    ],
  };
};
