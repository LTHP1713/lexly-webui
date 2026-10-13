import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { SessionPending } from '@/auth/SessionPending';

/**
 * Wraps the login/register screens. A signed-in user is always sent to the Dashboard — both when
 * they open these screens directly and the moment a login or registration succeeds — so the pages
 * themselves never navigate after authenticating. While the session is still being restored from
 * the refresh cookie, neither the form nor a redirect is shown.
 */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return <SessionPending />;
  }
  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
