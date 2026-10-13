import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { homeFor, type Role } from '@/auth/roles';

/**
 * Client-side gate for a role area, nested inside `RequireAuth` (so the session has settled). A
 * user who opens another role's URL goes to their own home, with no message (plan §3.2). This only
 * hides UI; the server still answers `403 FORBIDDEN` to a stale role.
 */
export function RequireRole({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  const { user } = useAuth();
  const role = user?.role ?? null;
  if (!role || !roles.includes(role)) {
    return <Navigate to={homeFor(role)} replace />;
  }
  return <>{children}</>;
}
