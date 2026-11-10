import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pawlypocket.app',
  appName: 'Pawly Pocket',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
