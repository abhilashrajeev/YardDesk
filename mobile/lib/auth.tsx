import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';
import { tokens } from './tokens';
import { storage } from './storage';
import type { User } from './types';

interface AuthCtx {
  user: User | null;
  ready: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

const K_USER = 'auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await tokens.load();
      const u = await storage.get<User | null>(K_USER, null);
      if (u && tokens.access) setUser(u);
      setReady(true);
    })();
  }, []);

  async function login(phone: string, password: string) {
    const { data } = await api.post('/auth/login', { phone, password });
    await tokens.set(data.accessToken, data.refreshToken);
    await storage.set(K_USER, data.user);
    setUser(data.user);
  }

  async function logout() {
    await tokens.clear();
    await storage.remove(K_USER);
    setUser(null);
  }

  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}
