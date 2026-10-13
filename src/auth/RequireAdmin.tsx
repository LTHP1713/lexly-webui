import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';

/**
 * Client-side gate for `/admin/**`, nested inside `RequireAuth` (so the session has settled).
 * Only hides the admin UI from non-admins: the server still answers 403 `FORBIDDEN` to a stale
 * role, which the admin screens show as an error.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
