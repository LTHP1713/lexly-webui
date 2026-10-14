/**
 * Sign-in always takes the user from GET /users/me (F0.2), never from the JWT; the bootstrap
 * restores a session from the cookie; change password swaps in the returned token (F1.2).
 * Each test re-imports the modules so the bootstrap memo and the session start fresh.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API, apiError, http, json, me, server } from '@/test/server';

async function load() {
  vi.resetModules();
  const auth = await import('@/api/auth');
  const { sessionStore } = await import('@/auth/session-store');
  return { auth, sessionStore };
}

beforeEach(() => {
  vi.resetModules();
});

function authResponse(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    email: 'admin@lexly.local',
    fullName: 'Super Admin',
    role: 'SUPERADMIN',
    mustChangePassword: true,
    accessToken: 'login-token',
    refreshToken: 'ignored',
    ...overrides,
  };
}

describe('login', () => {
  it('sends exactly the college shape and takes the user from /users/me', async () => {
    const { auth, sessionStore } = await load();
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        expect(await request.json()).toEqual({ collegeCode: 'NLSIU', loginId: '21BAL042', password: 'pw' });
        expect(request.credentials).toBe('include');
        return json(authResponse({ role: 'C_STUDENT', email: 'arjun@nlsiu.ac.in' }));
      }),
      http.get(`${API}/users/me`, ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer login-token');
        return json(
          me({
            role: 'C_STUDENT',
            mustChangePassword: true,
            loginId: '21BAL042',
            college: { id: 'col-1', code: 'NLSIU', name: 'National Law School' },
          }),
        );
      }),
    );
    await auth.login({ collegeCode: 'NLSIU', loginId: '21BAL042', password: 'pw' });
    expect(sessionStore.getSnapshot()).toMatchObject({
      status: 'authenticated',
      user: { role: 'C_STUDENT', mustChangePassword: true, loginId: '21BAL042', college: { code: 'NLSIU' } },
    });
    expect(sessionStore.getAccessToken()).toBe('login-token');
  });

  it('falls back to the login response if /users/me fails', async () => {
    const { auth, sessionStore } = await load();
    server.use(
      http.post(`${API}/auth/login`, () => json(authResponse())),
      http.get(`${API}/users/me`, () => apiError(500, 'INTERNAL_ERROR')),
    );
    await auth.login({ email: 'admin@lexly.local', password: 'pw' });
    expect(sessionStore.getSnapshot().user).toMatchObject({ role: 'SUPERADMIN', mustChangePassword: true, college: null });
  });

  it('maps an unknown role to null rather than guessing', async () => {
    const { auth, sessionStore } = await load();
    server.use(
      http.post(`${API}/auth/login`, () => json(authResponse({ role: 'ADMIN' }))),
      http.get(`${API}/users/me`, () => json(me({ role: 'ADMIN' }))),
    );
    await auth.login({ email: 'x@y.z', password: 'pw' });
    expect(sessionStore.getSnapshot().user?.role).toBeNull();
  });

  it('leaves the session anonymous on a 401', async () => {
    const { auth, sessionStore } = await load();
    server.use(http.post(`${API}/auth/login`, () => apiError(401, 'UNAUTHORIZED', 'Invalid credentials')));
    await expect(auth.login({ email: 'x@y.z', password: 'bad' })).rejects.toMatchObject({ status: 401 });
    expect(sessionStore.getSnapshot().status).not.toBe('authenticated');
  });
});

describe('bootstrapSession', () => {
  it('refreshes from the cookie, then loads /users/me', async () => {
    const { auth, sessionStore } = await load();
    server.use(
      http.post(`${API}/auth/refresh`, () => json({ accessToken: 'cookie-token' })),
      http.get(`${API}/users/me`, () => json(me({ role: 'C_ADMIN', firstName: 'Meera', fullName: 'Meera Iyer' }))),
    );
    await auth.bootstrapSession();
    expect(sessionStore.getSnapshot()).toMatchObject({
      status: 'authenticated',
      user: { role: 'C_ADMIN', firstName: 'Meera' },
    });
  });

  it('ends anonymous, with no message, without a cookie', async () => {
    const { auth, sessionStore } = await load();
    server.use(http.post(`${API}/auth/refresh`, () => apiError(400, 'VALIDATION_ERROR')));
    await auth.bootstrapSession();
    expect(sessionStore.getSnapshot()).toMatchObject({ status: 'anonymous', endReason: null });
  });

  it('runs one refresh however often it is called', async () => {
    const { auth } = await load();
    let refreshes = 0;
    server.use(
      http.post(`${API}/auth/refresh`, () => {
        refreshes += 1;
        return json({ accessToken: 't' });
      }),
      http.get(`${API}/users/me`, () => json(me())),
    );
    await Promise.all([auth.bootstrapSession(), auth.bootstrapSession()]);
    await auth.bootstrapSession();
    expect(refreshes).toBe(1);
  });
});

describe('changePassword', () => {
  it('uses the returned token before refetching /users/me', async () => {
    const { auth, sessionStore } = await load();
    sessionStore.setAuthenticated({
      accessToken: 'gated-token',
      user: {
        id: 'user-1',
        email: 'admin@lexly.local',
        fullName: null,
        firstName: null,
        role: 'SUPERADMIN',
        mustChangePassword: true,
        loginId: null,
        college: null,
      },
    });
    server.use(
      http.post(`${API}/auth/change-password`, async ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer gated-token');
        expect(await request.json()).toEqual({ currentPassword: 'old-pass-1', newPassword: 'new-pass-1' });
        return json({ accessToken: 'fresh-token', refreshToken: 'x', mustChangePassword: false });
      }),
      http.get(`${API}/users/me`, ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer fresh-token');
        return json(me({ role: 'SUPERADMIN', mustChangePassword: false }));
      }),
    );
    await auth.changePassword({ currentPassword: 'old-pass-1', newPassword: 'new-pass-1' });
    expect(sessionStore.getAccessToken()).toBe('fresh-token');
    expect(sessionStore.getSnapshot().user?.mustChangePassword).toBe(false);
  });

  it('keeps the session and the gate on a wrong current password', async () => {
    const { auth, sessionStore } = await load();
    sessionStore.setAuthenticated({
      accessToken: 'gated-token',
      user: {
        id: 'u',
        email: 'e',
        fullName: null,
        firstName: null,
        role: 'C_ADMIN',
        mustChangePassword: true,
        loginId: null,
        college: null,
      },
    });
    server.use(
      http.post(`${API}/auth/change-password`, () => apiError(400, 'VALIDATION_ERROR', 'currentPassword: is incorrect')),
    );
    await expect(auth.changePassword({ currentPassword: 'x', newPassword: 'new-pass-1' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(sessionStore.getSnapshot()).toMatchObject({ status: 'authenticated', user: { mustChangePassword: true } });
  });
});
