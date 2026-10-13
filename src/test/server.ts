/**
 * MSW for unit and component tests: one Node server for the whole run, reset after each test.
 * Tests register the handlers they need with `server.use(...)`; any unhandled request fails the
 * test, so a screen can't quietly call an endpoint nobody mocked.
 */
import { http, HttpResponse, type JsonBodyType } from 'msw';
import { setupServer } from 'msw/node';

export const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1';

export const server = setupServer();

/** `{ error, message }` with a status, the backend's error shape (contract §0.3). */
export function apiError(status: number, error: string, message = error) {
  return HttpResponse.json({ error, message }, { status });
}

export function json(body: JsonBodyType, status = 200) {
  return HttpResponse.json(body, { status });
}

/** A `GET /users/me` body (contract §2.1) with overrides. */
export function me(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'priya@example.com',
    firstName: 'Priya',
    fullName: 'Priya Sharma',
    role: 'S_STUDENT',
    mustChangePassword: false,
    loginId: null,
    college: null,
    createdAt: '2026-10-13T09:15:00Z',
    ...overrides,
  };
}

export { http, HttpResponse };
