/**
 * Renders the real `App` at a path, with the session coming from the mocked cookie refresh +
 * `/users/me`, exactly as on a page load. Modules are re-imported per call so the bootstrap runs
 * again and no session leaks between tests.
 */
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { vi } from 'vitest';
import { API, apiError, http, json, me, server } from './server';

export async function renderApp(path: string) {
  vi.resetModules();
  const { default: App } = await import('@/App');
  const router = createMemoryRouter([{ path: '*', element: <App /> }], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

export function signedInAs(overrides: Record<string, unknown>) {
  server.use(
    http.post(`${API}/auth/refresh`, () => json({ accessToken: 'token' })),
    http.get(`${API}/users/me`, () => json(me(overrides))),
  );
}

export function signedOut() {
  server.use(http.post(`${API}/auth/refresh`, () => apiError(400, 'VALIDATION_ERROR')));
}
