import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pawlypocket.app',
  appName: 'Pawly Pocket',
  webDir: 'dist',
  plugins: {\n    SystemBars: {\n      insetsHandling: 'css',\n      initialViewportFitValueHint: 'cover'\n    }\n  },\n  server: {
    androidScheme: 'https'
  }
};

export default config;
