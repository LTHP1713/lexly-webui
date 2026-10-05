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
 * `skipAuthHandling`: the auth endpoints themselves (register/login/refresh) must not carry a
 * stale access token and a 401 from them is a real auth failure, not a signal to try refreshing.
 */
export interface RequestOptions extends RequestInit {
  skipAuthHandling?: boolean;
}

interface RefreshedTokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Dedupes concurrent 401s into a single in-flight /auth/refresh call. */
let inFlightRefresh: Promise<boolean> | null = null;

/** Attempts one silent token rotation using the stored refresh token. Resolves false if it can't. */
export function refreshSession(): Promise<boolean> {
  if (!inFlightRefresh) {
    inFlightRefresh = performRefresh().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

async function performRefresh(): Promise<boolean> {
  const refreshToken = sessionStore.getRefreshToken();
  if (!refreshToken) {
    sessionStore.clear();
    return false;
  }
  try {
    const tokens = await request<RefreshedTokenPair>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
      skipAuthHandling: true,
    });
    sessionStore.setRefreshedTokens(tokens);
    return true;
  } catch {
    sessionStore.clear();
    return false;
  }
}

async function request<T>(path: string, init: RequestOptions = {}, isRetry = false): Promise<T> {
  const { skipAuthHandling, headers, ...rest } = init;
  const accessToken = skipAuthHandling ? null : sessionStore.getAccessToken();

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
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
    const refreshed = await refreshSession();
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
};
