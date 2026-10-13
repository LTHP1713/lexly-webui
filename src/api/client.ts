import { sessionStore, type SessionEndReason } from '@/auth/session-store';

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
function endSession(reason: SessionEndReason) {
  if (sessionStore.getSnapshot().status === 'authenticated') bypassHttpCacheForNextUser();
  sessionStore.clear(reason);
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

/**
 * `keepalive` lets the request finish if the page navigates or reloads mid-flight (G10). The
 * server rotates the token as soon as it receives the call; an aborted response would never
 * store the new cookie, and the next refresh would send a revoked token and sign the user out.
 */
async function performRefresh(): Promise<boolean> {
  const wasSignedIn = sessionStore.getSnapshot().status === 'authenticated';
  try {
    const tokens = await request<RefreshedTokens>('/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      skipAuthHandling: true,
    });
    sessionStore.setAccessToken(tokens.accessToken);
    return true;
  } catch (err) {
    // On page load (no session yet) a missing or stale cookie just means "not signed in".
    const inactive = err instanceof ApiError && err.code === 'COLLEGE_INACTIVE';
    endSession(inactive ? 'college-inactive' : wasSignedIn ? 'expired' : null);
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

/** A non-2xx response → `ApiError`, from the `{ error, message }` body when it is JSON. */
function errorFromBody(status: number, text: string, statusText: string): ApiError {
  let body: ApiErrorBody = {};
  try {
    body = JSON.parse(text) as ApiErrorBody;
  } catch {
    // Not JSON; fall back to defaults below.
  }
  return new ApiError(body.error ?? 'UNKNOWN_ERROR', body.message ?? statusText, status);
}

function jsonBody(body: unknown): BodyInit | undefined {
  if (body === undefined) return undefined;
  return body instanceof FormData ? body : JSON.stringify(body);
}

/** True when a 401 should be answered with one silent refresh + retry. */
async function refreshAfter401(sentToken: string | null): Promise<boolean> {
  // Another request may already have rotated the token while this one was in flight.
  const current = sessionStore.getAccessToken();
  return (current !== null && current !== sentToken) || refreshSession();
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
        ...(rest.body && !(rest.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.', 0);
  }

  if (response.status === 401 && !skipAuthHandling && !isRetry && (await refreshAfter401(accessToken))) {
    return request<T>(path, init, true);
  }

  if (!response.ok) {
    const error = errorFromBody(response.status, await response.text().catch(() => ''), response.statusText);
    // Every endpoint but a few is gated until the password is changed (contract §1.6).
    if (error.code === 'PASSWORD_CHANGE_REQUIRED') sessionStore.requirePasswordChange();
    throw error;
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
  /** A `FormData` body is sent as multipart (the browser sets the boundary); anything else as JSON. */
  post: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>(path, { ...init, method: 'POST', body: jsonBody(body) }),
  put: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>(path, { ...init, method: 'PUT', body: jsonBody(body) }),
  patch: <T>(path: string, body?: unknown, init?: RequestOptions) =>
    request<T>(path, { ...init, method: 'PATCH', body: jsonBody(body) }),
  delete: <T>(path: string, init?: RequestOptions) => request<T>(path, { ...init, method: 'DELETE' }),
  upload,
  download,
};

// ---------- Files ----------

export interface UploadOptions {
  method?: 'POST' | 'PUT';
  /** 0–1, from the upload's `progress` events (only when the length is computable). */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * Multipart upload with progress, on `XMLHttpRequest` because `fetch` reports no upload progress.
 * No manual `Content-Type` (the browser adds the boundary). Same rules as `request`: bearer
 * header, one silent refresh + retry on a 401, `ApiError` on failure, and `ABORTED` on abort.
 */
async function upload<T>(path: string, body: FormData, options: UploadOptions = {}, isRetry = false): Promise<T> {
  const accessToken = sessionStore.getAccessToken();
  const result = await new Promise<{ status: number; text: string; statusText: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method ?? 'POST', `${API_BASE_URL}${path}`);
    xhr.setRequestHeader('Accept', 'application/json');
    if (accessToken) xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText, statusText: xhr.statusText });
    xhr.onerror = () =>
      reject(new ApiError('NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.', 0));
    xhr.onabort = () => reject(new ApiError('ABORTED', 'The upload was cancelled.', 0));
    if (options.signal) {
      if (options.signal.aborted) {
        xhr.abort();
        return;
      }
      options.signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send(body);
  });

  if (result.status === 401 && !isRetry && (await refreshAfter401(accessToken))) {
    return upload<T>(path, body, options, true);
  }
  if (result.status < 200 || result.status >= 300) {
    throw errorFromBody(result.status, result.text, result.statusText);
  }
  return (result.status === 204 || !result.text ? undefined : JSON.parse(result.text)) as T;
}

export interface Download {
  blob: Blob;
  /** From `Content-Disposition`; null when the server sent none. */
  filename: string | null;
}

/**
 * A file from an access-checked endpoint (a plain `<a href>` can't send the bearer header).
 * Never cached (`no-store`, plan §9.4).
 */
async function download(path: string, options: { signal?: AbortSignal } = {}, isRetry = false): Promise<Download> {
  const accessToken = sessionStore.getAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      cache: 'no-store',
      signal: options.signal,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('ABORTED', 'The download was cancelled.', 0);
    }
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.', 0);
  }
  if (response.status === 401 && !isRetry && (await refreshAfter401(accessToken))) {
    return download(path, options, true);
  }
  if (!response.ok) {
    throw errorFromBody(response.status, await response.text().catch(() => ''), response.statusText);
  }
  return { blob: await response.blob(), filename: filenameFrom(response.headers.get('Content-Disposition')) };
}

/** `inline; filename="a b.pdf"`, or RFC 5987 `filename*=UTF-8''a%20b.pdf` (preferred when both are sent). */
export function filenameFrom(disposition: string | null): string | null {
  if (!disposition) return null;
  const extended = /filename\*\s*=\s*[^']*'[^']*'([^;]+)/i.exec(disposition);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim());
    } catch {
      // Fall through to the plain parameter.
    }
  }
  const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(disposition);
  const name = (plain?.[1] ?? plain?.[2] ?? '').trim();
  return name || null;
}
