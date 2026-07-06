import Constants from 'expo-constants';

/**
 * Backend API base URL. Defaults to the Android-emulator loopback (10.0.2.2)
 * which maps to the host's localhost. Override in app.json > expo.extra.apiUrl
 * (e.g. your LAN IP like http://192.168.1.5:3000/api for a physical device).
 */
export const API_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) ?? 'http://10.0.2.2:3000/api';
