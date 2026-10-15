/** F2.7: subjects, professor mapping and delete when in use. (The F2.8 cards became the F3 list filters.) */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { API, apiError, http, json, server } from '@/test/server';
import { renderApp, signedInAs } from '@/test/renderApp';

const college = { id: 'c1', code: 'NLSIU', name: 'National Law School' };

function subject(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    code: 'CON-101',
    name: 'Constitutional Law I',
    description: 'Fundamental rights.\nDirective principles.',
    professors: [] as { id: string; fullName: string }[],
    assessmentCount: 0,
    createdAt: '2026-10-14T09:00:00Z',
    updatedAt: '2026-10-14T09:00:00Z',
    ...overrides,
  };
}

const professors = [
  { id: 'p1', fullName: 'Dr. K. Menon', email: 'k@x.in', role: 'C_PROFESSOR', loginId: 'EMP1', mustChangePassword: false, createdAt: '' },
  { id: 'p2', fullName: 'Prof. L. Iyer', email: 'l@x.in', role: 'C_PROFESSOR', loginId: 'EMP2', mustChangePassword: false, createdAt: '' },
];

describe('subjects (C_ADMIN)', () => {
  it('adds a subject (code upper-cased) and opens it', async () => {
    signedInAs({ role: 'C_ADMIN', college });
    let sent: unknown = null;
    server.use(
      http.get(`${API}/college/subjects`, () => json([])),
      http.post(`${API}/college/subjects`, async ({ request }) => {
        sent = await request.json();
        return json(subject(), 201);
      }),
      http.get(`${API}/college/subjects/s1`, () => json(subject())),
    );
    const router = await renderApp('/college/subjects');
    expect(
      await screen.findByText('No subjects yet. Add the subjects your college teaches, then assign professors to them.'),
    ).toBeInTheDocument();
    const ui = userEvent.setup();
    await ui.click(screen.getAllByRole('button', { name: 'Add subject' })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Add subject' });
    await ui.type(within(dialog).getByLabelText(/Subject code/), 'con-101');
    await ui.type(within(dialog).getByLabelText(/Subject name/), 'Constitutional Law I');
    await ui.click(within(dialog).getByRole('button', { name: 'Add subject' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/college/subjects/s1'));
    expect(sent).toEqual({ code: 'CON-101', name: 'Constitutional Law I', description: null });
    expect(await screen.findByRole('heading', { level: 1, name: 'Constitutional Law I' })).toBeInTheDocument();
    expect(screen.getByText('Subject added. Next, assign its professors.')).toBeInTheDocument();
  });

  it('maps a duplicate code to the code field', async () => {
    signedInAs({ role: 'C_ADMIN', college });
    server.use(
      http.get(`${API}/college/subjects`, () => json([subject()])),
      http.post(`${API}/college/subjects`, () => apiError(409, 'SUBJECT_CODE_ALREADY_EXISTS')),
    );
    await renderApp('/college/subjects');
    expect(await screen.findByRole('cell', { name: /None/ })).toBeInTheDocument();
    const ui = userEvent.setup();
    await ui.click(screen.getByRole('button', { name: 'Add subject' }));
    const dialog = await screen.findByRole('dialog');
    await ui.type(within(dialog).getByLabelText(/Subject code/), 'CON-101');
    await ui.type(within(dialog).getByLabelText(/Subject name/), 'Again');
    await ui.click(within(dialog).getByRole('button', { name: 'Add subject' }));
    expect(await within(dialog).findByText('Another subject at your college already uses this code.')).toBeInTheDocument();
  });

  it('keeps the professor selection across searches and saves every selected id', async () => {
    signedInAs({ role: 'C_ADMIN', college });
    let sent: unknown = null;
    server.use(
      http.get(`${API}/college/subjects/s1`, () => json(subject({ professors: [{ id: 'p1', fullName: 'Dr. K. Menon' }] }))),
      http.get(`${API}/college/users`, ({ request }) => {
        const q = new URL(request.url).searchParams.get('q');
        const content = q ? professors.filter((p) => p.fullName.toLowerCase().includes(q.toLowerCase())) : professors;
        return json({ content, page: 0, size: 50, totalElements: content.length, totalPages: 1 });
      }),
      http.put(`${API}/college/subjects/s1/professors`, async ({ request }) => {
        sent = await request.json();
        return json(subject({ professors: [{ id: 'p1', fullName: 'Dr. K. Menon' }, { id: 'p2', fullName: 'Prof. L. Iyer' }] }));
      }),
    );
    await renderApp('/college/subjects/s1');
    const ui = userEvent.setup();
    await ui.click(await screen.findByRole('button', { name: 'Manage professors' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('1 selected')).toBeInTheDocument();
    await ui.type(within(dialog).getByLabelText('Search professors'), 'iyer');
    // The search is debounced; once it lands, only Iyer is listed but Menon stays selected.
    await waitFor(() => expect(within(dialog).queryByRole('checkbox', { name: /Dr. K. Menon/ })).not.toBeInTheDocument());
    await ui.click(within(dialog).getByRole('checkbox', { name: /Prof. L. Iyer/ }));
    expect(within(dialog).getByRole('button', { name: 'Remove Dr. K. Menon' })).toBeInTheDocument();
    expect(within(dialog).getByText('2 selected')).toBeInTheDocument();
    await ui.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Professors updated.')).toBeInTheDocument();
    expect(sent).toEqual({ professorIds: ['p1', 'p2'] });
  });

  it('explains SUBJECT_IN_USE and offers Rename instead', async () => {
    signedInAs({ role: 'C_ADMIN', college });
    server.use(
      http.get(`${API}/college/subjects/s1`, () => json(subject())),
      http.delete(`${API}/college/subjects/s1`, () => apiError(409, 'SUBJECT_IN_USE')),
    );
    await renderApp('/college/subjects/s1');
    const ui = userEvent.setup();
    await ui.click(await screen.findByRole('button', { name: 'Delete' }));
    await ui.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete subject' }));
    const blocked = await screen.findByRole('dialog', { name: "Constitutional Law I can't be deleted" });
    await ui.click(within(blocked).getByRole('button', { name: 'Rename' }));
    expect(await screen.findByRole('dialog', { name: 'Edit subject' })).toBeInTheDocument();
  });

  it("shows Not Found for another college's subject", async () => {
    signedInAs({ role: 'C_ADMIN', college });
    server.use(http.get(`${API}/college/subjects/x`, () => apiError(404, 'NOT_FOUND')));
    await renderApp('/college/subjects/x');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
