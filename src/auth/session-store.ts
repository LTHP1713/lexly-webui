/**
 * Holds the auth session in plain module memory (not React state, not any Web Storage) so
 * `src/api/client.ts` can read/write it from outside React — interceptor, silent refresh —
 * without a React import, and so `AuthContext` can mirror it into component state via
 * `useSyncExternalStore`.
 *
 * Only the access token lives here, in memory. The refresh token never reaches JavaScript: the
 * backend sets it as an HttpOnly `lexly_refresh_token` cookie (`Path=/api/v1/auth`) on
 * register/login/refresh/change-password, and `POST /auth/refresh` reads it from there. The
 * `refreshToken` field in those response bodies is ignored (it is kept for mobile).
 *
 * A page load therefore starts in `loading`: `bootstrapSession()` in `src/api/auth.ts` calls
 * `/auth/refresh` once, and the cookie decides between `authenticated` and `anonymous`.
 */
import type { Role } from '@/auth/roles';

export interface SessionCollege {
  id: string;
  code: string;
  name: string;
}

/** Mirrors `GET /users/me` (contract §2.1), which is the source of truth after every sign-in. */
export interface SessionUser {
  id: string;
  email: string;
  /** Null when the account has no name. */
  fullName: string | null;
  firstName: string | null;
  /** Null for a role this build doesn't know. UI gating only — the server enforces roles. */
  role: Role | null;
  /** While true, every route except `/change-password` redirects there (contract §1.6). */
  mustChangePassword: boolean;
  /** Roll no / employee ID for C_STUDENT and C_PROFESSOR; null otherwise. */
  loginId: string | null;
  /** For the three college roles; null otherwise. */
  college: SessionCollege | null;
}

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

/**
 * Why a session that existed ended without a logout, so the login screen can say so (UI spec F1
 * "Session and routing rules"). Null after a deliberate logout or when there never was a session.
 */
export type SessionEndReason = 'expired' | 'college-inactive' | null;

export interface SessionSnapshot {
  status: SessionStatus;
  user: SessionUser | null;
  endReason: SessionEndReason;
}

let accessToken: string | null = null;
let snapshot: SessionSnapshot = { status: 'loading', user: null, endReason: null };

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

  /** After sign-in, or once the bootstrap refresh has loaded the user. */
  setAuthenticated(next: { accessToken: string; user: SessionUser }) {
    accessToken = next.accessToken;
    publish({ status: 'authenticated', user: next.user, endReason: null });
  },

  /**
   * A new access token with the same status and user: a silent refresh rotation, or the token
   * from a sign-in response while `/users/me` is still being fetched.
   */
  setAccessToken(next: string) {
    accessToken = next;
  },

  /** A `403 PASSWORD_CHANGE_REQUIRED` arrived: the guards send the user to `/change-password`. */
  requirePasswordChange() {
    if (snapshot.user && !snapshot.user.mustChangePassword) {
      publish({ ...snapshot, user: { ...snapshot.user, mustChangePassword: true } });
    }
  },

  /** Logout, or a failed refresh: drop everything and show the login screen. */
  clear(endReason: SessionEndReason = null) {
    accessToken = null;
    publish({ status: 'anonymous', user: null, endReason });
  },

  /** The login screen has shown the reason; don't show it again. */
  acknowledgeEndReason() {
    if (snapshot.endReason !== null) publish({ ...snapshot, endReason: null });
  },
};
