const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Fix: Disable Hermes for web to avoid import.meta issues
config.transformer = config.transformer || {}
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
})

// Force disable Hermes for web platform
config.resolver = config.resolver || {}
config.resolver.platforms = ['ios', 'android', 'native', 'web']

module.exports = config
