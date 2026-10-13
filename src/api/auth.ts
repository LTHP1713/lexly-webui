import { apiClient, logoutSession, refreshSession } from '@/api/client';
import { getCurrentUser } from '@/api/users';
import { sessionStore, type SessionUser } from '@/auth/session-store';

/**
 * Also carries `refreshToken`, which the web app ignores: the backend sets the same token as an
 * HttpOnly cookie, and only that cookie is used (see `src/auth/session-store.ts`).
 */
export interface AuthResponse {
  userId: string;
  email: string;
  /** As entered at registration; may be null for accounts without one. */
  fullName: string | null;
  accessToken: string;
}

export function toSessionUser(res: {
  id: string;
  email: string;
  fullName: string | null;
  role?: string | null;
}): SessionUser {
  return { id: res.id, email: res.email, fullName: res.fullName?.trim() || null, role: res.role ?? null };
}

/**
 * The login/register body has no role, but the access token carries it as a `role` claim. Only
 * used to decide what UI to show — the server enforces the role on every admin call.
 */
export function roleFromAccessToken(accessToken: string): string | null {
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload)) as { role?: unknown };
    return typeof claims.role === 'string' ? claims.role : null;
  } catch {
    return null;
  }
}

/** `credentials: 'include'` so the browser stores the cross-origin refresh cookie. */
export function register(input: { email: string; password: string; fullName: string }) {
  return apiClient.post<AuthResponse>('/auth/register', input, { skipAuthHandling: true, credentials: 'include' });
}

export function login(input: { email: string; password: string }) {
  return apiClient.post<AuthResponse>('/auth/login', input, { skipAuthHandling: true, credentials: 'include' });
}

export const logout = logoutSession;

let bootstrap: Promise<void> | null = null;

/**
 * Runs once per page load, before the app decides the visitor is anonymous: one cookie-based
 * `/auth/refresh` (shared with any 401-triggered refresh via `refreshSession()`), then
 * `GET /users/me` for the user, since the refresh response has no user. A 400/401 refresh ends
 * in `anonymous` with no error UI. Memoized at module level so StrictMode's doubled effects and
 * remounts never start a second refresh.
 */
export function bootstrapSession(): Promise<void> {
  bootstrap ??= (async () => {
    if (sessionStore.getSnapshot().status !== 'loading') return;
    if (!(await refreshSession())) return; // refreshSession already cleared the session.
    try {
      const me = await getCurrentUser();
      const accessToken = sessionStore.getAccessToken();
      if (accessToken) sessionStore.setAuthenticated({ accessToken, user: toSessionUser(me) });
      else sessionStore.clear();
    } catch {
      // 401 already cleared it; on any other failure fall back to the login screen. The cookie
      // is still valid, so the next reload restores the session.
      sessionStore.clear();
    }
  })();
  return bootstrap;
}
