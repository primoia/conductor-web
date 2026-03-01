import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.primoia.jarvis',
  appName: 'Jarvis',
  webDir: 'dist/conductor-app/browser',
  server: {
    // Use the remote server instead of local files
    url: 'https://conductor.primoia.dev/jarvis',
    cleartext: false,
  },
  android: {
    // Allow mic and audio permissions
    webContentsDebuggingEnabled: true,
  },
};

export default config;
