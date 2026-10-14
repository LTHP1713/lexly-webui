/**
 * The cookie-session rules from the 2026-10-09 progress entry, plus the P1 additions: one silent
 * refresh per 401, shared by concurrent requests; why a session ended; the
 * PASSWORD_CHANGE_REQUIRED gate; and the F0.5 multipart/download helpers.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { apiClient, ApiError, filenameFrom, refreshSession } from '@/api/client';
import { sessionStore, type SessionUser } from '@/auth/session-store';
import { API, apiError, http, HttpResponse, json, server } from '@/test/server';

const user: SessionUser = {
  id: 'u-1',
  email: 'priya@example.com',
  fullName: 'Priya Sharma',
  firstName: 'Priya',
  role: 'S_STUDENT',
  mustChangePassword: false,
  loginId: null,
  college: null,
};

function signIn(token = 'old-token') {
  sessionStore.setAuthenticated({ accessToken: token, user });
}

beforeEach(() => {
  sessionStore.clear();
});

describe('401 handling', () => {
  it('refreshes once and retries with the new token', async () => {
    signIn();
    let refreshes = 0;
    server.use(
      http.get(`${API}/acts`, ({ request }) =>
        request.headers.get('Authorization') === 'Bearer new-token' ? json([]) : apiError(401, 'UNAUTHORIZED'),
      ),
      http.post(`${API}/auth/refresh`, ({ request }) => {
        refreshes += 1;
        expect(request.credentials).toBe('include');
        return json({ accessToken: 'new-token', refreshToken: 'ignored' });
      }),
    );
    await expect(apiClient.get('/acts')).resolves.toEqual([]);
    expect(refreshes).toBe(1);
    expect(sessionStore.getAccessToken()).toBe('new-token');
  });

  it('shares one refresh between concurrent 401s', async () => {
    signIn();
    let refreshes = 0;
    server.use(
      http.get(`${API}/acts`, ({ request }) =>
        request.headers.get('Authorization') === 'Bearer new-token' ? json([]) : apiError(401, 'UNAUTHORIZED'),
      ),
      http.post(`${API}/auth/refresh`, async () => {
        refreshes += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return json({ accessToken: 'new-token' });
      }),
    );
    await Promise.all([apiClient.get('/acts'), apiClient.get('/acts'), apiClient.get('/acts')]);
    expect(refreshes).toBe(1);
  });

  it('ends a live session as "expired" when the refresh is rejected', async () => {
    signIn();
    server.use(
      http.get(`${API}/acts`, () => apiError(401, 'UNAUTHORIZED')),
      http.post(`${API}/auth/refresh`, () => apiError(401, 'UNAUTHORIZED')),
    );
    await expect(apiClient.get('/acts')).rejects.toMatchObject({ status: 401 });
    expect(sessionStore.getSnapshot()).toMatchObject({ status: 'anonymous', endReason: 'expired' });
  });

  it('ends the session as "college-inactive" on 403 COLLEGE_INACTIVE from refresh', async () => {
    signIn();
    server.use(http.post(`${API}/auth/refresh`, () => apiError(403, 'COLLEGE_INACTIVE')));
    expect(await refreshSession()).toBe(false);
    expect(sessionStore.getSnapshot()).toMatchObject({ status: 'anonymous', endReason: 'college-inactive' });
  });

  it('gives no reason when there was no session (first visit, no cookie)', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => apiError(400, 'VALIDATION_ERROR', 'refreshToken: must not be blank')));
    expect(await refreshSession()).toBe(false);
    expect(sessionStore.getSnapshot().endReason).toBeNull();
  });
});

describe('PASSWORD_CHANGE_REQUIRED', () => {
  it('flips the session into forced-change mode and still throws', async () => {
    signIn();
    server.use(http.get(`${API}/acts`, () => apiError(403, 'PASSWORD_CHANGE_REQUIRED')));
    await expect(apiClient.get('/acts')).rejects.toBeInstanceOf(ApiError);
    expect(sessionStore.getSnapshot().user?.mustChangePassword).toBe(true);
  });
});

describe('bodies', () => {
  it('sends JSON with a JSON content type', async () => {
    signIn();
    server.use(
      http.post(`${API}/things`, async ({ request }) => {
        expect(request.headers.get('Content-Type')).toBe('application/json');
        return json(await request.json(), 201);
      }),
    );
    await expect(apiClient.post('/things', { a: 1 })).resolves.toEqual({ a: 1 });
  });

  it('sends FormData as multipart, without a JSON content type', async () => {
    signIn();
    server.use(
      http.post(`${API}/files`, async ({ request }) => {
        expect(request.headers.get('Content-Type')).toMatch(/^multipart\/form-data; boundary=/);
        // jsdom's File loses its name through Node's fetch; the size proves the part arrived.
        const form = await request.formData();
        return json({ size: (form.get('file') as Blob).size });
      }),
    );
    const form = new FormData();
    form.append('file', new File(['%PDF-1.7'], 'answer.pdf', { type: 'application/pdf' }));
    await expect(apiClient.post('/files', form)).resolves.toEqual({ size: 8 });
  });

  it('supports PATCH', async () => {
    signIn();
    server.use(http.patch(`${API}/things/1`, () => json({ ok: true })));
    await expect(apiClient.patch('/things/1', { a: 2 })).resolves.toEqual({ ok: true });
  });

  it('maps a non-JSON error body to UNKNOWN_ERROR with the status', async () => {
    signIn();
    server.use(http.get(`${API}/broken`, () => new HttpResponse('<html>', { status: 502 })));
    await expect(apiClient.get('/broken')).rejects.toMatchObject({ code: 'UNKNOWN_ERROR', status: 502 });
  });
});

describe('upload', () => {
  it('posts multipart with the bearer header and parses the JSON reply', async () => {
    signIn('tok');
    server.use(
      http.put(`${API}/answer`, ({ request }) => {
        expect(request.headers.get('Authorization')).toBe('Bearer tok');
        return json({ status: 'UPLOADED' });
      }),
    );
    const form = new FormData();
    form.append('file', new File(['%PDF-'], 'a.pdf'));
    await expect(apiClient.upload('/answer', form, { method: 'PUT' })).resolves.toEqual({ status: 'UPLOADED' });
  });

  it('turns an error reply into ApiError', async () => {
    signIn();
    server.use(http.post(`${API}/answer`, () => apiError(400, 'INVALID_FILE', 'file: must be at most 10 MB')));
    await expect(apiClient.upload('/answer', new FormData())).rejects.toMatchObject({ code: 'INVALID_FILE', status: 400 });
  });
});

describe('download', () => {
  it('returns the blob and the filename from Content-Disposition', async () => {
    signIn();
    server.use(
      http.get(`${API}/file`, ({ request }) => {
        expect(request.cache).toBe('no-store');
        return new HttpResponse('%PDF-1.7', {
          headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="answer 3.pdf"' },
        });
      }),
    );
    const { blob, filename } = await apiClient.download('/file');
    expect(filename).toBe('answer 3.pdf');
    expect(await blob.text()).toBe('%PDF-1.7');
  });
});

describe('filenameFrom', () => {
  it.each([
    [null, null],
    ['inline', null],
    ['inline; filename="a b.pdf"', 'a b.pdf'],
    ['attachment; filename=plain.csv', 'plain.csv'],
    ["attachment; filename=\"fallback.pdf\"; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf", 'résumé.pdf'],
  ])('%s → %s', (header, expected) => {
    expect(filenameFrom(header)).toBe(expected);
  });
});
