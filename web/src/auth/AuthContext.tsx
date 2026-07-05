import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, tokens } from '../api/client';
import type { User } from '../types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

const USER_KEY = 'yard_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If tokens were cleared elsewhere, drop the user.
    if (!tokens.access && user) setUser(null);
  }, []); // eslint-disable-line

  async function login(phone: string, password: string) {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { phone, password });
      tokens.set(data.accessToken, data.refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    tokens.clear();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
