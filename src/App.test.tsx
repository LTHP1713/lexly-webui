/**
 * The routing rules of F0.3 and F1.2 through the real `App`: the session comes from the mocked
 * cookie refresh + /users/me, exactly as on a page load. Modules are re-imported per test so the
 * bootstrap runs again.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API, apiError, http, json, me, server } from '@/test/server';
import { mockCollegeOverview, mockStudyHub } from '@/test/homes';

async function renderAt(path: string) {
  vi.resetModules();
  const { default: App } = await import('@/App');
  const router = createMemoryRouter([{ path: '*', element: <App /> }], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

function signedInAs(overrides: Record<string, unknown>) {
  server.use(
    http.post(`${API}/auth/refresh`, () => json({ accessToken: 'token' })),
    http.get(`${API}/users/me`, () => json(me(overrides))),
  );
}

function signedOut() {
  server.use(http.post(`${API}/auth/refresh`, () => apiError(400, 'VALIDATION_ERROR')));
}

beforeEach(() => {
  // Lists the admin and Library pages may load; their contents don't matter here.
  server.use(
    http.get(`${API}/caselaws`, () => json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 })),
    http.get(`${API}/acts`, () => json([])),
  );
});

describe('forced password change', () => {
  it('shows only the change form, whatever URL is opened', async () => {
    signedInAs({ role: 'SUPERADMIN', mustChangePassword: true });
    const router = await renderAt('/admin/caselaws');
    expect(await screen.findByRole('heading', { level: 1, name: 'Set a new password' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/change-password');
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('after a successful change, goes to the role home with a toast', async () => {
    signedInAs({ role: 'SUPERADMIN', mustChangePassword: true });
    server.use(
      http.post(`${API}/auth/change-password`, () => json({ accessToken: 'fresh', mustChangePassword: false })),
    );
    const router = await renderAt('/change-password');
    await screen.findByRole('heading', { name: 'Set a new password' });
    server.use(http.get(`${API}/users/me`, () => json(me({ role: 'SUPERADMIN', mustChangePassword: false }))));

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Current password'), 'lexly-superadmin-dev');
    await user.type(screen.getByLabelText('New password'), 'a-much-better-one');
    await user.type(screen.getByLabelText('Confirm new password'), 'a-much-better-one');
    await user.click(screen.getByRole('button', { name: 'Save password' }));

    expect(await screen.findByText('Password updated.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'));
    expect(screen.getAllByRole('navigation', { name: 'Primary' }).length).toBeGreaterThan(0);
  });

  it('a 403 PASSWORD_CHANGE_REQUIRED from any call sends the user to the form', async () => {
    signedInAs({ role: 'C_STUDENT', mustChangePassword: false });
    server.use(http.get(`${API}/acts`, () => apiError(403, 'PASSWORD_CHANGE_REQUIRED')));
    const router = await renderAt('/acts');
    expect(await screen.findByRole('heading', { name: 'Set a new password' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/change-password');
  });
});

describe('role areas', () => {
  it('sends a student who opens an admin URL to their own home', async () => {
    signedInAs({ role: 'S_STUDENT', firstName: 'Priya' });
    mockStudyHub();
    const router = await renderAt('/admin/caselaws');
    expect(await screen.findByRole('heading', { level: 1, name: 'Study hub' })).toBeInTheDocument();
    expect(screen.getByText(/, Priya$/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('gives the super admin Colleges, Content, Audit, Tutor and Library, plus Overview in the sidebar', async () => {
    signedInAs({ role: 'SUPERADMIN' });
    await renderAt('/');
    const [sidebar, tabs] = await screen.findAllByRole('navigation', { name: 'Primary' });
    expect(within(tabs).getAllByRole('link').map((l) => l.textContent)).toEqual(['Colleges', 'Content', 'Audit', 'Tutor', 'Library']);
    expect(within(sidebar).getAllByRole('listitem').map((l) => l.textContent)).toEqual([
      'Overview',
      'Colleges',
      'Content',
      'Audit',
      'Tutor',
      'Library',
    ]);
    expect(within(sidebar).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(within(sidebar).getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands and collapses the sidebar, and remembers the choice', async () => {
    signedInAs({ role: 'SUPERADMIN' });
    await renderAt('/');
    const [sidebar] = await screen.findAllByRole('navigation', { name: 'Primary' });
    const ui = userEvent.setup();
    await ui.click(within(sidebar).getByRole('button', { name: 'Expand sidebar' }));
    expect(within(sidebar).getByRole('button', { name: 'Collapse sidebar' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(sidebar).getByText('Lexly')).toBeInTheDocument();
    expect(localStorage.getItem('lexly.sidebar')).toBe('expanded');
    await ui.click(within(sidebar).getByRole('button', { name: 'Collapse sidebar' }));
    expect(localStorage.getItem('lexly.sidebar')).toBe('collapsed');
  });

  it.each([
    ['C_ADMIN', '/admin/colleges', '/college'],
    ['SUPERADMIN', '/college/audit', '/admin'],
    ['C_STUDENT', '/professor', '/student'],
    ['C_PROFESSOR', '/student', '/professor'],
    ['S_STUDENT', '/college', '/dashboard'],
  ])('%s opening %s goes to their home %s', async (role, path, home) => {
    signedInAs({ role, college: role.startsWith('C_') ? { id: 'c', code: 'NLSIU', name: 'NLS' } : null });
    const router = await renderAt(path);
    await waitFor(() => expect(router.state.location.pathname).toBe(home));
  });

  it('gives the college admin Users, Subjects, Audit, Tutor and Library, and an Overview under the college name', async () => {
    signedInAs({ role: 'C_ADMIN', college: { id: 'c', code: 'NLSIU', name: 'National Law School' } });
    mockCollegeOverview();
    await renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText('National Law School')).toBeInTheDocument();
    const [sidebar, tabs] = screen.getAllByRole('navigation', { name: 'Primary' });
    expect(within(tabs).getAllByRole('link').map((l) => l.textContent)).toEqual(['Users', 'Subjects', 'Audit', 'Tutor', 'Library']);
    expect(within(sidebar).getAllByRole('listitem').map((l) => l.textContent)).toEqual([
      'Overview',
      'Users',
      'Subjects',
      'Audit',
      'Tutor',
      'Library',
    ]);
  });

  it('shows the Library sub-nav to college roles only', async () => {
    signedInAs({ role: 'C_PROFESSOR', loginId: 'EMP7', college: { id: 'c', code: 'NLSIU', name: 'NLSIU' } });
    await renderAt('/acts');
    expect(await screen.findByRole('navigation', { name: 'Library' })).toBeInTheDocument();
  });
});

describe('not found', () => {
  it('signed out: inside the auth layout, with Sign in', async () => {
    signedOut();
    await renderAt('/no-such-page');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('signed in: inside the shell, with Go to my home', async () => {
    signedInAs({ role: 'C_STUDENT' });
    await renderAt('/no-such-page');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to my home' })).toHaveAttribute('href', '/student');
  });

  it('a protected URL while signed out goes to /login', async () => {
    signedOut();
    const router = await renderAt('/profile');
    await screen.findByRole('heading', { name: 'Welcome back' });
    expect(router.state.location.pathname).toBe('/login');
  });
});
