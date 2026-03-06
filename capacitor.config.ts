import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.primoia.jarvis',
  appName: 'Jarvis',
  webDir: 'dist/conductor-app/browser',
  server: {
    url: 'https://conductor.primoia.dev/jarvis',
    cleartext: true,
  },
  android: {
    // Allow mic and audio permissions
    webContentsDebuggingEnabled: true,
  },
};

export default config;
