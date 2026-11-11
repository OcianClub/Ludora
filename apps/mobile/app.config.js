const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = ({ config }) => {
  if (process.env.LUDORA_APK_LOCAL !== '1') return config;

  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
  if (!/^http:\/\/(?:\d{1,3}\.){3}\d{1,3}:\d+\/?$/.test(apiUrl)) {
    throw new Error('No perfil preview-local do eas.json, informe o IPv4 e a porta da API do notebook.');
  }
  new URL(apiUrl);

  // O Firebase do APK público está cadastrado para com.ludora.app.
  const { googleServicesFile, ...android } = config.android;
  return withAndroidManifest({
    ...config,
    name: 'Ludora Local',
    scheme: 'ludora-local',
    android: { ...android, package: 'com.ludora.app.local' },
  }, mod => {
    AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults).$['android:usesCleartextTraffic'] = 'true';
    return mod;
  });
};
