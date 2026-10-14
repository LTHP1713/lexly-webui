/** F2.2–F2.5: the users list, the add dialog's errors, removal's typed confirm and Not Found (F2.9). */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { API, apiError, http, json, server, HttpResponse } from '@/test/server';
import { renderApp, signedInAs } from '@/test/renderApp';

const college = { id: 'c1', code: 'NLSIU', name: 'National Law School' };

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    fullName: 'Asha Rao',
    email: 'asha@nlsiu.ac.in',
    role: 'C_STUDENT',
    loginId: '21BAL042',
    mustChangePassword: true,
    createdAt: '2026-10-14T09:00:00Z',
    ...overrides,
  };
}

function page(content: unknown[]) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0 };
}

beforeEach(() => {
  signedInAs({ role: 'C_ADMIN', college });
});

describe('users list', () => {
  it('lists students by default and sends the role; the Professors tab switches it', async () => {
    const roles: string[] = [];
    server.use(
      http.get(`${API}/college/users`, ({ request }) => {
        const role = new URL(request.url).searchParams.get('role')!;
        roles.push(role);
        return json(page(role === 'C_STUDENT' ? [user()] : [user({ id: 'p1', fullName: 'Dr. K. Menon', role: 'C_PROFESSOR', loginId: 'EMP7', mustChangePassword: false })]));
      }),
    );
    const router = await renderApp('/college/users');
    const table = await screen.findByRole('table', { name: 'Students' });
    expect(within(table).getByRole('link', { name: 'Asha Rao' })).toHaveAttribute('href', '/college/users/u1');
    expect(within(table).getByText('Must change password')).toBeInTheDocument();
    expect(screen.getByText('1 student')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Professors' }));
    expect(await screen.findByRole('table', { name: 'Professors' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Employee ID' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?role=professors');
    expect(roles).toEqual(['C_STUDENT', 'C_PROFESSOR']);
  });

  it('shows the empty state with Add and Import', async () => {
    server.use(http.get(`${API}/college/users`, () => json(page([]))));
    await renderApp('/college/users');
    expect(
      await screen.findByText('No students yet. Add them one at a time, or import a CSV or Excel file.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import students' })).toHaveAttribute('href', '/college/users/import');
  });

  it('maps a duplicate roll no and a solo email to their fields when adding a student', async () => {
    let attempt = 0;
    server.use(
      http.get(`${API}/college/users`, () => json(page([]))),
      http.post(`${API}/college/users`, () => {
        attempt += 1;
        return attempt === 1
          ? apiError(409, 'LOGIN_ID_ALREADY_EXISTS', 'Login ID R1 is already used in this college')
          : apiError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists');
      }),
    );
    await renderApp('/college/users');
    const ui = userEvent.setup();
    await ui.click((await screen.findAllByRole('button', { name: 'Add student' }))[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Add student' });
    expect(within(dialog).getByText(/They sign in with NLSIU and this ID/)).toBeInTheDocument();
    await ui.type(within(dialog).getByLabelText(/Full name/), 'Asha Rao');
    await ui.type(within(dialog).getByLabelText(/Email/), 'asha@example.com');
    await ui.type(within(dialog).getByLabelText(/Roll no/), 'R1');
    await ui.click(within(dialog).getByRole('button', { name: 'Add student' }));
    expect(
      await within(dialog).findByText('Another student or professor at your college already uses this ID.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Roll no/)).toHaveFocus();

    await ui.click(within(dialog).getByRole('button', { name: 'Add student' }));
    expect(
      await within(dialog).findByText(
        "This email is already used by another Lexly account. If it's their personal Lexly account, import them from a file to convert it.",
      ),
    ).toBeInTheDocument();
  });
});

describe('remove user', () => {
  it('enables Remove only once the exact login ID is typed, then deletes and returns to the list', async () => {
    let deleted = false;
    server.use(
      http.get(`${API}/college/users/u1`, () => json(user())),
      http.delete(`${API}/college/users/u1`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(`${API}/college/users`, () => json(page([]))),
    );
    const router = await renderApp('/college/users/u1');
    const ui = userEvent.setup();
    await ui.click(await screen.findByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove Asha Rao?' });
    expect(within(dialog).getByText(/together with all their answers, grades and ranking entries/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole('button', { name: 'Remove student' });
    const input = within(dialog).getByLabelText(/to confirm/);

    await ui.type(input, '21bal042');
    expect(confirm).toBeDisabled();
    await ui.clear(input);
    await ui.type(input, '21BAL04');
    expect(confirm).toBeDisabled();
    await ui.type(input, '2');
    expect(confirm).toBeEnabled();

    await ui.click(confirm);
    await waitFor(() => expect(router.state.location.pathname).toBe('/college/users'));
    expect(deleted).toBe(true);
    expect(await screen.findByText('Asha Rao removed.')).toBeInTheDocument();
  });

  it('explains what happens to a professor’s assessments', async () => {
    server.use(
      http.get(`${API}/college/users/p1`, () => json(user({ id: 'p1', role: 'C_PROFESSOR', loginId: 'EMP7' }))),
      http.get(`${API}/college/subjects`, () => json([])),
    );
    await renderApp('/college/users/p1');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/shown as “Former professor”/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Remove professor' })).toBeDisabled();
  });
});

describe('user detail', () => {
  it("shows Not Found for another college's user id", async () => {
    server.use(http.get(`${API}/college/users/other`, () => apiError(404, 'NOT_FOUND', 'User not found')));
    await renderApp('/college/users/other');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.queryByText("You don't have access to this page.")).not.toBeInTheDocument();
  });

  it("lists a professor's subjects", async () => {
    server.use(
      http.get(`${API}/college/users/p1`, () => json(user({ id: 'p1', role: 'C_PROFESSOR', loginId: 'EMP7' }))),
      http.get(`${API}/college/subjects`, () =>
        json([
          { id: 's1', code: 'CON-101', name: 'Constitutional Law I', description: null, professors: [{ id: 'p1', fullName: 'Asha Rao' }], assessmentCount: 0, createdAt: '', updatedAt: '' },
          { id: 's2', code: 'TOR-101', name: 'Torts', description: null, professors: [], assessmentCount: 0, createdAt: '', updatedAt: '' },
        ]),
      ),
    );
    await renderApp('/college/users/p1');
    expect(await screen.findByRole('link', { name: 'Constitutional Law I' })).toHaveAttribute('href', '/college/subjects/s1');
    expect(screen.queryByRole('link', { name: 'Torts' })).not.toBeInTheDocument();
  });
});
