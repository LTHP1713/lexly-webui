import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import * as authApi from '@/api/auth';
import { sessionStore, type SessionSnapshot } from '@/auth/session-store';

interface AuthContextValue extends SessionSnapshot {
  register: (input: { email: string; password: string; fullName: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot);

  async function register(input: { email: string; password: string; fullName: string }) {
    const res = await authApi.register(input);
    sessionStore.setAuthenticated({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      user: authApi.toSessionUser(res),
    });
  }

  async function login(input: { email: string; password: string }) {
    const res = await authApi.login(input);
    sessionStore.setAuthenticated({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      user: authApi.toSessionUser(res),
    });
  }

  function logout() {
    sessionStore.clear();
  }

  return (
    <AuthContext.Provider value={{ ...snapshot, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
