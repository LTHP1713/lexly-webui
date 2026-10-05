/**
 * Holds the auth session in plain module memory (not React state, not any Web Storage) so
 * `src/api/client.ts` can read/write tokens from outside React — interceptor, silent refresh —
 * without a React import, and so `AuthContext` can mirror it into component state via
 * `useSyncExternalStore`.
 *
 * Both tokens live only in memory: nothing is written to localStorage or sessionStorage. That
 * means a full page reload always logs the user out — deliberate for now (see "Known gaps" in
 * docs/progress/frontend_progress.md) rather than defaulting to Web Storage for the refresh
 * token, which is readable by any injected script.
 */

export interface SessionUser {
  id: string;
  email: string;
}

export interface SessionSnapshot {
  status: 'authenticated' | 'anonymous';
  user: SessionUser | null;
}

let accessToken: string | null = null;
let refreshToken: string | null = null;
let user: SessionUser | null = null;
let snapshot: SessionSnapshot = { status: 'anonymous', user: null };

const listeners = new Set<() => void>();

function publish() {
  snapshot = { status: user ? 'authenticated' : 'anonymous', user };
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

  getRefreshToken(): string | null {
    return refreshToken;
  },

  /** After register/login: a fresh token pair and a known user. */
  setAuthenticated(next: { accessToken: string; refreshToken: string; user: SessionUser }) {
    accessToken = next.accessToken;
    refreshToken = next.refreshToken;
    user = next.user;
    publish();
  },

  /** After a silent /auth/refresh rotation: new token pair, same user. */
  setRefreshedTokens(next: { accessToken: string; refreshToken: string }) {
    accessToken = next.accessToken;
    refreshToken = next.refreshToken;
    publish();
  },

  /** Logout, or a failed refresh: drop everything and force the login screen. */
  clear() {
    accessToken = null;
    refreshToken = null;
    user = null;
    publish();
  },
};
