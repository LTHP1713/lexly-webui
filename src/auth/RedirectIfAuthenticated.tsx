import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import type { LoginLocationState } from '@/auth/RequireAuth';
import { CHANGE_PASSWORD_PATH, canOpen, homeFor } from '@/auth/roles';
import { SessionPending } from '@/auth/SessionPending';

/**
 * Wraps the login/register screens. A signed-in user is sent on — both when they open these
 * screens directly and the moment a sign-in succeeds — so the pages never navigate themselves:
 * to `/change-password` if the password must change, else back to the page that sent them to
 * login (when their role may open it), else to their role's home.
 */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <SessionPending />;
  }
  if (status === 'authenticated') {
    if (user?.mustChangePassword) return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
    const role = user?.role ?? null;
    const from = (location.state as LoginLocationState | null)?.from;
    const back = from && from.pathname !== CHANGE_PASSWORD_PATH && canOpen(role, from.pathname) ? from : null;
    return <Navigate to={back ?? homeFor(role)} replace />;
  }
  return <>{children}</>;
}

/** `/`: the role's home when signed in, else the login screen. */
export function RootRedirect() {
  const { status, user } = useAuth();
  if (status === 'loading') return <SessionPending />;
  return <Navigate to={status === 'authenticated' ? homeFor(user?.role ?? null) : '/login'} replace />;
}
