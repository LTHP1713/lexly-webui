/** F1.1 two-mode login and F1 session rules, through the real routes (F1.11). */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { API, apiError, http, HttpResponse, json, me, server } from '@/test/server';
import { renderApp, signedOut } from '@/test/renderApp';

function authResponse(role: string, mustChangePassword = false) {
  return { userId: 'u1', email: 'x@y.in', fullName: 'X', role, mustChangePassword, accessToken: 'fresh' };
}

describe('login: email mode', () => {
  it('sends exactly { email, password } and goes to the role home', async () => {
    signedOut();
    let body: unknown = null;
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        body = await request.json();
        return json(authResponse('SUPERADMIN'));
      }),
      http.get(`${API}/users/me`, () => json(me({ role: 'SUPERADMIN' }))),
    );
    const router = await renderApp('/login');
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: 'Email' }), ' admin@lexly.local ');
    await user.type(screen.getByLabelText('Password'), 'secret-pass');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin'));
    expect(body).toEqual({ email: 'admin@lexly.local', password: 'secret-pass' });
  });

  it('shows one generic message on a 401', async () => {
    signedOut();
    server.use(http.post(`${API}/auth/login`, () => apiError(401, 'UNAUTHORIZED', 'Invalid credentials')));
    await renderApp('/login');
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: 'Email' }), 'a@b.in');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();
  });
});

describe('login: college mode', () => {
  it('upper-cases the code, trims the ID, and sends only the college shape', async () => {
    signedOut();
    let body: unknown = null;
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        body = await request.json();
        return json(authResponse('C_STUDENT', true));
      }),
      http.get(`${API}/users/me`, () =>
        json(me({ role: 'C_STUDENT', mustChangePassword: true, loginId: '21BAL042', college: { id: 'c', code: 'NLSIU', name: 'NLS' } })),
      ),
    );
    const router = await renderApp('/login');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'College' }));
    expect(screen.getByRole('tab', { name: 'College' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('textbox', { name: 'Email' })).not.toBeInTheDocument();
    expect(screen.getByText('First time? Your password is your roll no. or employee ID.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('College code'), 'nlsiu');
    expect(screen.getByLabelText('College code')).toHaveValue('NLSIU');
    await user.type(screen.getByLabelText('Roll no. or employee ID'), ' 21BAL042 ');
    await user.type(screen.getByLabelText('Password'), '21BAL042');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    // A first sign-in is held on the forced change (F1.2).
    await waitFor(() => expect(router.state.location.pathname).toBe('/change-password'));
    expect(body).toEqual({ collegeCode: 'NLSIU', loginId: '21BAL042', password: '21BAL042' });
    expect(localStorage.getItem('lexly.loginTab')).toBe('college');
  });

  it('words the 401 for the college tab, and COLLEGE_INACTIVE gets its own banner', async () => {
    signedOut();
    server.use(http.post(`${API}/auth/login`, () => apiError(401, 'UNAUTHORIZED')));
    await renderApp('/login');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: 'College' }));
    await user.type(screen.getByLabelText('College code'), 'X1');
    await user.type(screen.getByLabelText('Roll no. or employee ID'), 'R1');
    await user.type(screen.getByLabelText('Password'), 'pw');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByText('Incorrect college code, ID or password.')).toBeInTheDocument();

    server.use(http.post(`${API}/auth/login`, () => apiError(403, 'COLLEGE_INACTIVE')));
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(
      await screen.findByText("Your college's account is inactive. Contact your administrator."),
    ).toBeInTheDocument();
  });

  it('checks required fields on the client, keeps the password across tabs, and remembers the tab', async () => {
    signedOut();
    localStorage.setItem('lexly.loginTab', 'college');
    await renderApp('/login');
    const user = userEvent.setup();
    expect(await screen.findByRole('tab', { name: 'College' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(screen.getByText('College code is required.')).toBeInTheDocument();
    expect(screen.getByLabelText('College code')).toHaveFocus();

    await user.type(screen.getByLabelText('Password'), 'kept');
    // Arrow keys move between tabs (tablist pattern); field errors are cleared.
    screen.getByRole('tab', { name: 'College' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Email' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Email' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('College code is required.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveValue('kept');
  });
});

describe('session end reasons on the login screen', () => {
  it('a refresh refused with COLLEGE_INACTIVE shows the inactive banner', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => apiError(403, 'COLLEGE_INACTIVE')));
    await renderApp('/college');
    expect(
      await screen.findByText("Your college's account is inactive. Contact your administrator."),
    ).toBeInTheDocument();
  });

  it('an expired session says so', async () => {
    // Signed in, then every refresh fails: the next 401 ends the session as "expired".
    server.use(
      http.post(`${API}/auth/refresh`, () => json({ accessToken: 'token' }), { once: true }),
      http.get(`${API}/users/me`, () => json(me({ role: 'C_STUDENT' }))),
      http.post(`${API}/auth/refresh`, () => apiError(401, 'UNAUTHORIZED')),
      http.get(`${API}/acts`, () => new HttpResponse(null, { status: 401 })),
    );
    await renderApp('/acts');
    expect(await screen.findByText('Your session has ended. Please sign in again.')).toBeInTheDocument();
  });

  it('a plain signed-out visit says nothing', async () => {
    signedOut();
    await renderApp('/login');
    await screen.findByRole('heading', { name: 'Welcome back' });
    expect(screen.queryByText(/Your session has ended/)).not.toBeInTheDocument();
  });
});
