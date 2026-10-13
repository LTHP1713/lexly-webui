import { sessionStore } from '@/auth/session-store';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1';

/** Shape of an error response body returned by the Lexly backend. */
interface ApiErrorBody {
  error?: string;
  message?: string;
}

/** A failed backend call, normalized from the `{ error, message }` body on non-2xx responses. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * `skipAuthHandling`: the auth endpoints themselves (register/login/refresh/logout) must not carry
 * a stale access token and a 401 from them is a real auth failure, not a signal to try refreshing.
 *
 * Only the auth endpoints send `credentials: 'include'` (the refresh cookie is scoped to
 * `/api/v1/auth`, so other requests would carry nothing); see `src/api/auth.ts`.
 */
export interface RequestOptions extends RequestInit {
  skipAuthHandling?: boolean;
}

// ---------- HTTP cache after a user change ----------

/**
 * Content GETs are cached by the browser for up to 5 minutes (`Cache-Control: private,
 * max-age=300`), keyed by URL rather than by user. After a logout or an expired session, the
 * next user on this browser must not be served the previous user's responses (e.g. their
 * learning progress), so for one max-age window every GET bypasses the cache with `cache: 'reload'` —
 * which also overwrites the stale entries. Kept in localStorage (just a timestamp) so it
 * survives a reload and applies to every tab sharing the cache.
 */
const CACHE_BYPASS_KEY = 'lexly.httpCacheBypassUntil';
const CONTENT_MAX_AGE_MS = 5 * 60 * 1000;
let cacheBypassUntil = 0;

function bypassHttpCacheForNextUser() {
  cacheBypassUntil = Date.now() + CONTENT_MAX_AGE_MS;
  try {
    localStorage.setItem(CACHE_BYPASS_KEY, String(cacheBypassUntil));
  } catch {
    // Storage unavailable (private mode, blocked); the in-memory value still covers this tab.
  }
}

function httpCacheBypassed(): boolean {
  let until = cacheBypassUntil;
  try {
    until = Math.max(until, Number(localStorage.getItem(CACHE_BYPASS_KEY)) || 0);
  } catch {
    // Fall back to the in-memory value.
  }
  return Date.now() < until;
}

/**
 * Cache mode for a GET that didn't set its own. Right after a user change: `reload` (see above).
 * In development: `no-cache`, so every GET revalidates with the server (a cheap 304 via the ETag
 * when nothing changed) and backend edits show up at once instead of after up to 5 minutes.
 * Otherwise the browser's normal caching applies.
 */
function getCacheMode(): { cache?: RequestCache } {
  if (httpCacheBypassed()) return { cache: 'reload' };
  if (import.meta.env.DEV) return { cache: 'no-cache' };
  return {};
}

/** Drops the local session; a session that belonged to someone also starts the cache bypass. */
function endSession() {
  if (sessionStore.getSnapshot().status === 'authenticated') bypassHttpCacheForNextUser();
  sessionStore.clear();
}

// ---------- Refresh ----------

/** `refreshToken` is also in the body but deliberately ignored: the HttpOnly cookie carries it. */
interface RefreshedTokens {
  accessToken: string;
}

/**
 * The single in-flight /auth/refresh call. Every refresh rotates the cookie and invalidates the
 * previous token, so a second parallel call would fail with 401: the bootstrap refresh, 401
 * retries and React StrictMode's doubled effects must all share this promise.
 */
let inFlightRefresh: Promise<boolean> | null = null;

/**
 * Attempts one silent token rotation using the refresh cookie. Resolves false (and clears the
 * session) if it can't — 400 without a cookie, 401 for a revoked/expired/rotated one.
 */
export function refreshSession(): Promise<boolean> {
  if (!inFlightRefresh) {
    inFlightRefresh = withRefreshLock(performRefresh).finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

/**
 * Tabs share the cookie, so two tabs refreshing at once would race on the rotation and the loser
 * would be logged out. A Web Lock serializes refreshes across tabs: the second one runs after the
 * first's `Set-Cookie` has landed and sends the new token.
 */
function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('lexly-auth-refresh', task)
    : task();
}

async function performRefresh(): Promise<boolean> {
  try {
    const tokens = await request<RefreshedTokens>('/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      skipAuthHandling: true,
    });
    sessionStore.setAccessToken(tokens.accessToken);
    return true;
  } catch {
    endSession();
    return false;
  }
}

/**
 * Revokes the refresh cookie server-side (always 204) and clears the local session — even when
 * the request fails, so the user is never stuck signed in.
 */
export async function logoutSession(): Promise<void> {
  try {
    // A refresh finishing after logout would set a fresh cookie again.
    await inFlightRefresh;
    await request<void>('/auth/logout', { method: 'POST', credentials: 'include', skipAuthHandling: true });
  } catch {
    // Ignored: the local session is cleared regardless.
  } finally {
    bypassHttpCacheForNextUser();
    sessionStore.clear();
  }
}

async function request<T>(path: string, init: RequestOptions = {}, isRetry = false): Promise<T> {
  const { skipAuthHandling, headers, ...rest } = init;
  const accessToken = skipAuthHandling ? null : sessionStore.getAccessToken();
  const isGet = (rest.method ?? 'GET') === 'GET';

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      ...(isGet && rest.cache === undefined ? getCacheMode() : {}),
      headers: {
        Accept: 'application/json',
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.', 0);
  }

  if (response.status === 401 && !skipAuthHandling && !isRetry) {
    // Another request may already have rotated the token while this one was in flight.
    const current = sessionStore.getAccessToken();
    const refreshed = (current !== null && current !== accessToken) || (await refreshSession());
    if (refreshed) {
      return request<T>(path, init, true);
    }
  }

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      // Response body wasn't JSON; fall back to defaults below.
    }
    throw new ApiError(body.error ?? 'UNKNOWN_ERROR', body.message ?? response.statusText, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/**
 * Thin typed wrapper around fetch for talking to the Lexly backend. Reads the base URL from
 * `VITE_API_BASE_URL`, attaches `Authorization: Bearer <accessToken>` automatically, and
 * centrally handles the `{ error, message }` error shape plus one silent 401 retry.
 */
export const apiClient = {
  get: <T>(path: string, init?: RequestOptions) => request<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>(path, { ...init, method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>(path, { ...init, method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, init?: RequestOptions) => request<T>(path, { ...init, method: 'DELETE' }),
};
