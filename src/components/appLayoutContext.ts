import { useAuth } from '@/auth/AuthContext';

/** What pages rendered inside `AppLayout` can rely on. */
export interface AppLayoutContext {
  /** Null when `GET /users/me` has no name for the user. */
  firstName: string | null;
}

/**
 * For pages inside `AppLayout` (e.g. the Home greeting). Read from the session, which holds the
 * `/users/me` user, rather than from outlet context, which nested guard routes would not forward.
 */
export function useAppLayout(): AppLayoutContext {
  const { user } = useAuth();
  return { firstName: user?.firstName ?? null };
}
