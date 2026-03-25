import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.primoia.jarvis',
  appName: 'Jarvis',
  webDir: 'dist/conductor-app/browser',
  server: {
    url: 'https://conductor.primoia.dev/jarvis',
    appendUserAgent: 'PrimoiaJarvis/1.0',
  },
  android: {
    webContentsDebuggingEnabled: true,
  },
};

export default config;
