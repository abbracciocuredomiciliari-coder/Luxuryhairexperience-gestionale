import { createContext, useContext, useState, ReactNode } from 'react';

interface User { id: string; name: string; email: string; role: string }

interface AuthCtx {
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({ user: null, login: () => {}, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('lux_user') || 'null'); } catch { return null; }
  });
  const login = (token: string, u: User) => {
    localStorage.setItem('lux_token', token);
    localStorage.setItem('lux_user', JSON.stringify(u));
    setUser(u);
  };
  const logout = () => {
    localStorage.removeItem('lux_token');
    localStorage.removeItem('lux_user');
    setUser(null);
  };
  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
