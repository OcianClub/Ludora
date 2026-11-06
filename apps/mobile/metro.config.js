const { getDefaultConfig } = require("expo/metro-config");

module.exports = (() => {
  const config = getDefaultConfig(__dirname);

  // A URL pública é incorporada ao bundle. Trocar API local/Render precisa
  // invalidar os transforms antigos, inclusive no export/APK de teste.
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') || 'local-default';
  config.cacheVersion = `${config.cacheVersion || 'ludora'}:api=${apiUrl}`;

  const { transformer, resolver } = config;

  config.transformer = {
    ...transformer,
    babelTransformerPath: require.resolve("react-native-svg-transformer"),
  };
  
  // Essa é a parte mágica que impede o SVG de virar um "número"
  config.resolver = {
    ...resolver,
    assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
    sourceExts: [...resolver.sourceExts, "svg"],
  };

  return config;
})();