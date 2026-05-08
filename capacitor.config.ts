import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL;

// HTTP (cleartext) is only allowed for local development (localhost/10.x/192.168.x)
const isLocalUrl = serverUrl
  ? /^http:\/\/(localhost|127\.|10\.|192\.168\.)/.test(serverUrl)
  : false;

if (serverUrl && serverUrl.startsWith('http://') && !isLocalUrl) {
  throw new Error('CAPACITOR_SERVER_URL must use HTTPS in non-local environments.');
}

const config: CapacitorConfig = {
  appId: 'com.joluai.app',
  appName: 'JoluAI',
  webDir: '.next',
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: isLocalUrl,
      }
    : undefined,
};

export default config;
