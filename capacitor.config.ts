import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pawlypocket.app',
  appName: 'Pawly Pocket',
  webDir: 'dist',
  plugins: {
    CapacitorUpdater: {
      autoUpdate: 'off',
      resetWhenUpdate: false,
      autoDeletePrevious: false,
      appReadyTimeout: 10000
    },
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover'
    }
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
