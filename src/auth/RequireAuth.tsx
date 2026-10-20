import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { CHANGE_PASSWORD_PATH } from '@/auth/roles';
import { SessionPending } from '@/auth/SessionPending';

/** Router state on `/login`: where to return after signing in. */
export interface LoginLocationState {
  from?: { pathname: string; search: string; hash: string };
}

/**
 * Gate for every signed-in route. While `mustChangePassword` is set, the only reachable route is
 * `/change-password` (contract §1.6), whatever URL is typed.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, user, signedOut } = useAuth();
  const location = useLocation();

  // Wait for the bootstrap refresh: a reload or deep link must not bounce to /login.
  if (status === 'loading') {
    return <SessionPending />;
  }
  if (status === 'anonymous') {
    // After a deliberate sign-out the page being left is the previous user's, not a destination.
    if (signedOut) return <Navigate to="/login" replace />;
    const { pathname, search, hash } = location;
    return <Navigate to="/login" replace state={{ from: { pathname, search, hash } } satisfies LoginLocationState} />;
  }
  if (user?.mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace />;
  }
  return <>{children}</>;
}
