import { apiClient, logoutSession, refreshSession } from '@/api/client';
import { getCurrentUser, type CurrentUserDto } from '@/api/users';
import { toRole } from '@/auth/roles';
import { firstNameFrom } from '@/auth/firstName';
import { sessionStore, type SessionUser } from '@/auth/session-store';

/**
 * Register and login response (contract §1.1–§1.2). Also carries `refreshToken`, which the web
 * app ignores: the backend sets the same token as an HttpOnly cookie, and only that is used.
 */
export interface AuthResponse {
  userId: string;
  email: string;
  /** As entered at registration; may be null for accounts without one. */
  fullName: string | null;
  role: string;
  mustChangePassword: boolean;
  accessToken: string;
}

/** Exactly one login mode per request (contract §1.2); sending both or neither is a 400. */
export type LoginInput =
  | { email: string; password: string }
  | { collegeCode: string; loginId: string; password: string };

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export function toSessionUser(me: CurrentUserDto): SessionUser {
  const fullName = me.fullName?.trim() || null;
  return {
    id: me.id,
    email: me.email,
    fullName,
    firstName: firstNameFrom({ firstName: me.firstName, fullName }),
    role: toRole(me.role),
    mustChangePassword: me.mustChangePassword === true,
    loginId: me.loginId?.trim() || null,
    college: me.college ?? null,
  };
}

/** Only if `/users/me` fails right after sign-in: the response has enough to route. */
function userFromAuthResponse(res: AuthResponse): SessionUser {
  const fullName = res.fullName?.trim() || null;
  return {
    id: res.userId,
    email: res.email,
    fullName,
    firstName: firstNameFrom({ fullName }),
    role: toRole(res.role),
    mustChangePassword: res.mustChangePassword === true,
    loginId: null,
    college: null,
  };
}

/**
 * The role and flags always come from `GET /users/me` after a sign-in (plan F0.2), never from
 * decoding the JWT. The access token is stored first so that call is authorised.
 */
async function completeSignIn(res: AuthResponse): Promise<void> {
  sessionStore.setAccessToken(res.accessToken);
  let user: SessionUser;
  try {
    user = toSessionUser(await getCurrentUser());
  } catch {
    user = userFromAuthResponse(res);
  }
  sessionStore.setAuthenticated({ accessToken: sessionStore.getAccessToken() ?? res.accessToken, user });
}

/** `credentials: 'include'` so the browser stores the cross-origin refresh cookie. */
export async function register(input: RegisterInput): Promise<void> {
  await completeSignIn(
    await apiClient.post<AuthResponse>('/auth/register', input, { skipAuthHandling: true, credentials: 'include' }),
  );
}

export async function login(input: LoginInput): Promise<void> {
  await completeSignIn(
    await apiClient.post<AuthResponse>('/auth/login', input, { skipAuthHandling: true, credentials: 'include' }),
  );
}

/**
 * `POST /auth/change-password` (contract §1.5). The server rotates the refresh cookie and revokes
 * every other session. The gate is read from the access token, so the returned token must replace
 * the old one before anything else is called; then `/users/me` is refetched.
 */
export async function changePassword(input: ChangePasswordInput): Promise<void> {
  const res = await apiClient.post<{ accessToken: string; mustChangePassword: boolean }>(
    '/auth/change-password',
    input,
    { credentials: 'include' },
  );
  sessionStore.setAccessToken(res.accessToken);
  const current = sessionStore.getSnapshot().user;
  let user: SessionUser | null;
  try {
    user = toSessionUser(await getCurrentUser());
  } catch {
    user = current && { ...current, mustChangePassword: res.mustChangePassword === true };
  }
  if (user) sessionStore.setAuthenticated({ accessToken: sessionStore.getAccessToken() ?? res.accessToken, user });
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
