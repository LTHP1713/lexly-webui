import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import * as authApi from '@/api/auth';
import { sessionStore, type SessionSnapshot } from '@/auth/session-store';

interface AuthContextValue extends SessionSnapshot {
  register: (input: authApi.RegisterInput) => Promise<void>;
  login: (input: authApi.LoginInput) => Promise<void>;
  changePassword: (input: authApi.ChangePasswordInput) => Promise<void>;
  logout: () => Promise<void>;
  /** The login screen has shown why the last session ended; don't show it again. */
  acknowledgeEndReason: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot);

  // Restore the session from the refresh cookie; status stays `loading` until it settles.
  useEffect(() => {
    void authApi.bootstrapSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...snapshot,
        register: authApi.register,
        login: authApi.login,
        changePassword: authApi.changePassword,
        logout: authApi.logout,
        acknowledgeEndReason: sessionStore.acknowledgeEndReason,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
