module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      "nativewind/babel",
      "@babel/plugin-transform-flow-strip-types",
      "react-native-reanimated/plugin", // Must be last
    ],
  };
};
