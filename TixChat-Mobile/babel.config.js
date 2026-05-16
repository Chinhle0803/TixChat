module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Ensure import.meta works on web
      require.resolve('babel-plugin-transform-import-meta'),
    ],
  }
}
