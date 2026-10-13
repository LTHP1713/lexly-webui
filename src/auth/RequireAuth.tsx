import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { SessionPending } from '@/auth/SessionPending';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  // Wait for the bootstrap refresh: a reload or deep link must not bounce to /login.
  if (status === 'loading') {
    return <SessionPending />;
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
