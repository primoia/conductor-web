import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.primoia.jarvis',
  appName: 'Jarvis',
  webDir: 'dist/conductor-app/browser',
  server: {
    // ADB reverse: localhost on tablet → computer's port
    url: 'http://localhost:11299/jarvis',
    cleartext: true,
  },
  android: {
    // Allow mic and audio permissions
    webContentsDebuggingEnabled: true,
  },
};

export default config;
