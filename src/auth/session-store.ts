/**
 * Holds the auth session in plain module memory (not React state, not any Web Storage) so
 * `src/api/client.ts` can read/write it from outside React — interceptor, silent refresh —
 * without a React import, and so `AuthContext` can mirror it into component state via
 * `useSyncExternalStore`.
 *
 * Only the access token lives here, in memory. The refresh token never reaches JavaScript: the
 * backend sets it as an HttpOnly `lexly_refresh_token` cookie (`Path=/api/v1/auth`) on
 * register/login/refresh, and `POST /auth/refresh` reads it from there. The `refreshToken` field
 * in those response bodies is ignored (it is kept for older clients and mobile).
 *
 * A page load therefore starts in `loading`: `bootstrapSession()` in `src/api/client.ts` calls
 * `/auth/refresh` once, and the cookie decides between `authenticated` and `anonymous`.
 */

export interface SessionUser {
  id: string;
  email: string;
  /** From the login/register response or `GET /users/me`; null when the account has no name. */
  fullName: string | null;
  /** `STUDENT` | `LAWYER` | `ADMIN`; null if unknown. UI gating only — the server enforces roles. */
  role: string | null;
}

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

export interface SessionSnapshot {
  status: SessionStatus;
  user: SessionUser | null;
}

let accessToken: string | null = null;
let snapshot: SessionSnapshot = { status: 'loading', user: null };

const listeners = new Set<() => void>();

function publish(next: SessionSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export const sessionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(): SessionSnapshot {
    return snapshot;
  },

  getAccessToken(): string | null {
    return accessToken;
  },

  /** After register/login, or once the bootstrap refresh has loaded the user. */
  setAuthenticated(next: { accessToken: string; user: SessionUser }) {
    accessToken = next.accessToken;
    publish({ status: 'authenticated', user: next.user });
  },

  /** After a silent /auth/refresh rotation: new access token, same status and user. */
  setAccessToken(next: string) {
    accessToken = next;
  },

  /** Logout, or a failed refresh: drop everything and force the login screen. */
  clear() {
    accessToken = null;
    publish({ status: 'anonymous', user: null });
  },
};
