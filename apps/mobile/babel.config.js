module.exports = function (api) {
  api.cache.using(() => process.env.NODE_ENV);
  const isTest = process.env.NODE_ENV === 'test';

  return {
    presets: [
      "babel-preset-expo",
    ],
    plugins: isTest
      ? []
      : [
          [
            "@tamagui/babel-plugin",
            {
              components: ["tamagui"],
              config: "../../packages/ui/tamagui.config.ts",
              logTimings: true,
            },
          ],
        ],
  };
};
