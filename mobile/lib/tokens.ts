import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS = 'yard_access';
const REFRESH = 'yard_refresh';

// expo-secure-store has no reliable web implementation (it's a native-only
// keychain/keystore wrapper), so fall back to localStorage on web.
const secureGet = (key: string): Promise<string | null> =>
  Platform.OS === 'web'
    ? Promise.resolve(typeof localStorage === 'undefined' ? null : localStorage.getItem(key))
    : SecureStore.getItemAsync(key);
const secureSet = (key: string, value: string): Promise<void> => {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return Promise.resolve();
  }
  return SecureStore.setItemAsync(key, value);
};
const secureDelete = (key: string): Promise<void> => {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return Promise.resolve();
  }
  return SecureStore.deleteItemAsync(key);
};

// In-memory cache so the axios interceptor stays synchronous-friendly.
let accessToken: string | null = null;
let refreshToken: string | null = null;

export const tokens = {
  get access() {
    return accessToken;
  },
  get refresh() {
    return refreshToken;
  },
  async load() {
    accessToken = await secureGet(ACCESS);
    refreshToken = await secureGet(REFRESH);
  },
  async set(access: string, refresh: string) {
    accessToken = access;
    refreshToken = refresh;
    await secureSet(ACCESS, access);
    await secureSet(REFRESH, refresh);
  },
  async clear() {
    accessToken = null;
    refreshToken = null;
    await secureDelete(ACCESS);
    await secureDelete(REFRESH);
  },
};
