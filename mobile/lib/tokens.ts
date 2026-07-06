import * as SecureStore from 'expo-secure-store';

const ACCESS = 'yard_access';
const REFRESH = 'yard_refresh';

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
    accessToken = await SecureStore.getItemAsync(ACCESS);
    refreshToken = await SecureStore.getItemAsync(REFRESH);
  },
  async set(access: string, refresh: string) {
    accessToken = access;
    refreshToken = refresh;
    await SecureStore.setItemAsync(ACCESS, access);
    await SecureStore.setItemAsync(REFRESH, refresh);
  },
  async clear() {
    accessToken = null;
    refreshToken = null;
    await SecureStore.deleteItemAsync(ACCESS);
    await SecureStore.deleteItemAsync(REFRESH);
  },
};
