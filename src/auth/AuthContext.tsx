import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import * as authApi from '@/api/auth';
import { sessionStore, type SessionSnapshot } from '@/auth/session-store';

interface AuthContextValue extends SessionSnapshot {
  register: (input: { email: string; password: string; fullName: string }) => Promise<void>;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot);

  // Restore the session from the refresh cookie; status stays `loading` until it settles.
  useEffect(() => {
    void authApi.bootstrapSession();
  }, []);

  async function register(input: { email: string; password: string; fullName: string }) {
    const res = await authApi.register(input);
    sessionStore.setAuthenticated({
      accessToken: res.accessToken,
      user: authApi.toSessionUser({
        id: res.userId,
        email: res.email,
        fullName: res.fullName,
        role: authApi.roleFromAccessToken(res.accessToken),
      }),
    });
  }

  async function login(input: { email: string; password: string }) {
    const res = await authApi.login(input);
    sessionStore.setAuthenticated({
      accessToken: res.accessToken,
      user: authApi.toSessionUser({
        id: res.userId,
        email: res.email,
        fullName: res.fullName,
        role: authApi.roleFromAccessToken(res.accessToken),
      }),
    });
  }

  return (
    <AuthContext.Provider value={{ ...snapshot, register, login, logout: authApi.logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
