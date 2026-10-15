/** F3.1–F3.4, F3.8: the professor's list, editor, publish checklist and confirm, remove and grid (F3.10). */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { API, apiError, http, json, server } from '@/test/server';
import { renderApp, signedInAs } from '@/test/renderApp';

const college = { id: 'c1', code: 'NLSIU', name: 'National Law School' };
const subjectDto = {
  id: 's1',
  code: 'CON-101',
  name: 'Constitutional Law I',
  description: null,
  professors: [{ id: 'p1', fullName: 'Dr. K. Menon' }],
  assessmentCount: 1,
  createdAt: '2026-10-14T09:00:00Z',
  updatedAt: '2026-10-14T09:00:00Z',
};

function assessment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    subject: { id: 's1', code: 'CON-101', name: 'Constitutional Law I' },
    title: 'Moot problem',
    instructions: 'Answer all.\nCite cases.',
    status: 'PUBLISHED',
    dueAt: '2099-11-02T12:00:00Z',
    publishedAt: '2026-10-15T09:00:00Z',
    closedAt: null,
    removedAt: null,
    createdAt: '2026-10-14T09:00:00Z',
    updatedAt: '2026-10-15T09:00:00Z',
    createdBy: { id: 'p1', fullName: 'Dr. K. Menon' },
    totalMarks: 15,
    questionCount: 2,
    counts: { students: 3, answerSlots: 6, submitted: 2, pendingEvaluation: 0, aiEvaluated: 0, published: 0, notAttempted: 0 },
    questions: [
      { id: 'q1', position: 1, text: 'Discuss Article 21.', maxMarks: 10, wordLimit: 500 },
      { id: 'q2', position: 2, text: 'Define a writ.', maxMarks: 5, wordLimit: 200 },
    ],
    ...overrides,
  };
}

const page = <T,>(content: T[]) => ({ content, page: 0, size: 20, totalElements: content.length, totalPages: 1 });

beforeEach(() => {
  signedInAs({ id: 'p1', role: 'C_PROFESSOR', loginId: 'EMP1', college });
  server.use(http.get(`${API}/college/subjects`, () => json([subjectDto])));
});

describe('professor assessments list (F3.1)', () => {
  it('shows counts, the deadline and links drafts to the editor', async () => {
    server.use(
      http.get(`${API}/professor/assessments`, () =>
        json(page([assessment(), assessment({ id: 'a2', title: 'Draft one', status: 'DRAFT', dueAt: null })])),
      ),
    );
    await renderApp('/professor');
    expect(await screen.findByRole('link', { name: 'Moot problem' })).toHaveAttribute('href', '/professor/assessments/a1');
    expect(screen.getByRole('link', { name: 'Draft one' })).toHaveAttribute('href', '/professor/assessments/a2/edit');
    expect(screen.getByText('2 assessments')).toBeInTheDocument();
    expect(screen.getByText('No due date yet')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '2 of 6' })).toBeInTheDocument();
  });

  it('disables New assessment without subjects', async () => {
    server.use(
      http.get(`${API}/college/subjects`, () => json([])),
      http.get(`${API}/professor/assessments`, () => json(page([]))),
    );
    await renderApp('/professor');
    expect(await screen.findByText(/You haven.t been assigned any subjects yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New assessment' })).toBeDisabled();
  });
});

describe('draft editor and publish (F3.2, F3.3)', () => {
  it('blocks Publish with the failing checklist lines and sends no request', async () => {
    let calls = 0;
    server.use(
      http.post(`${API}/professor/assessments`, () => {
        calls += 1;
        return json(assessment({ status: 'DRAFT' }), 201);
      }),
    );
    await renderApp('/professor/assessments/new');
    expect(await screen.findByRole('heading', { level: 1, name: 'New assessment' })).toBeInTheDocument();
    const ui = userEvent.setup();
    await ui.type(screen.getByLabelText(/^Title/), 'Moot problem');
    await ui.click(screen.getByRole('button', { name: 'Publish…' }));

    expect(screen.getByText(/Fix these \d things first:/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Due date: Set a due date.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Question 1 · Question: Question 1 needs its text, max marks and a word limit.' })).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it('saves a new draft first, then confirms and publishes', async () => {
    let created: unknown = null;
    let published = false;
    server.use(
      http.post(`${API}/professor/assessments`, async ({ request }) => {
        created = await request.json();
        return json(assessment({ status: 'DRAFT', questions: [{ id: 'q1', position: 1, text: 'Discuss.', maxMarks: 10, wordLimit: 500 }] }), 201);
      }),
      http.post(`${API}/professor/assessments/a1/publish`, () => {
        published = true;
        return json(assessment());
      }),
      http.get(`${API}/professor/assessments/a1`, () => json(assessment())),
      http.get(`${API}/professor/assessments/a1/answers`, () => json(page([]))),
      http.get(`${API}/professor/assessments`, () => json(page([assessment()]))),
    );
    const router = await renderApp('/professor/assessments/new');
    await screen.findByRole('heading', { level: 1, name: 'New assessment' });
    const ui = userEvent.setup();
    // The only subject is chosen already.
    expect(screen.getByLabelText(/^Subject/)).toHaveValue('s1');
    await ui.type(screen.getByLabelText(/^Title/), 'Moot problem');
    await ui.type(screen.getByLabelText(/^Due date and time/), '2099-11-02T17:30');
    await ui.type(screen.getByLabelText(/^Question/, { selector: 'textarea' }), 'Discuss.');
    await ui.type(screen.getByLabelText(/^Max marks/), '10');
    await ui.type(screen.getByLabelText(/^Word limit/), '500');
    expect(screen.getByText('Total: 10 marks')).toBeInTheDocument();
    expect(screen.getByText('Ready to publish.')).toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: 'Publish…' }));

    const dialog = await screen.findByRole('dialog', { name: 'Publish “Moot problem”?' });
    expect(created).toMatchObject({ subjectId: 's1', title: 'Moot problem', questions: [{ id: null, text: 'Discuss.', maxMarks: 10, wordLimit: 500 }] });
    expect(router.state.location.pathname).toBe('/professor/assessments/a1/edit');
    expect(within(dialog).getByText(/nothing can be edited and the due date can.t be extended/)).toBeInTheDocument();
    expect(within(dialog).getByText('1 question · 10 marks.')).toBeInTheDocument();
    await ui.click(within(dialog).getByRole('button', { name: 'Publish' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/professor/assessments/a1'));
    expect(published).toBe(true);
    expect(await screen.findByText('Assessment published.')).toBeInTheDocument();
  });

  it('puts publish VALIDATION_ERROR paths on the fields', async () => {
    const draft = assessment({ status: 'DRAFT' });
    server.use(
      http.get(`${API}/professor/assessments/a1`, () => json(draft)),
      http.post(`${API}/professor/assessments/a1/publish`, () =>
        apiError(400, 'VALIDATION_ERROR', 'dueAt: must be in the future'),
      ),
    );
    await renderApp('/professor/assessments/a1/edit');
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit draft' })).toBeInTheDocument();
    const ui = userEvent.setup();
    await ui.click(screen.getByRole('button', { name: 'Publish…' }));
    await ui.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publish' }));
    expect(await screen.findByRole('link', { name: 'Due date: Must be in the future.' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sends a published assessment from /edit to its detail', async () => {
    server.use(
      http.get(`${API}/professor/assessments/a1`, () => json(assessment())),
      http.get(`${API}/professor/assessments/a1/answers`, () => json(page([]))),
    );
    const router = await renderApp('/professor/assessments/a1/edit');
    await waitFor(() => expect(router.state.location.pathname).toBe('/professor/assessments/a1'));
  });

  it('shows ASSESSMENT_NOT_EDITABLE on save as a banner with a link', async () => {
    server.use(
      http.get(`${API}/professor/assessments/a1`, () => json(assessment({ status: 'DRAFT' }))),
      http.put(`${API}/professor/assessments/a1`, () => apiError(409, 'ASSESSMENT_NOT_EDITABLE')),
    );
    await renderApp('/professor/assessments/a1/edit');
    await screen.findByRole('heading', { level: 1, name: 'Edit draft' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText(/has been published or removed, so it can.t be edited any more/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open assessment' })).toHaveAttribute('href', '/professor/assessments/a1');
  });
});

describe('failed background refreshes (review fixes)', () => {
  it('keeps the editor and what was typed when the refresh after a save fails', async () => {
    let subjectCalls = 0;
    server.use(
      http.get(`${API}/college/subjects`, () => {
        subjectCalls += 1;
        return subjectCalls === 1 ? json([subjectDto]) : apiError(500, 'INTERNAL_ERROR');
      }),
      http.get(`${API}/professor/assessments/a1`, () => json(assessment({ status: 'DRAFT' }))),
      http.put(`${API}/professor/assessments/a1`, () => json(assessment({ status: 'DRAFT' }))),
      http.get(`${API}/professor/assessments`, () => json(page([]))),
    );
    await renderApp('/professor/assessments/a1/edit');
    await screen.findByRole('heading', { level: 1, name: 'Edit draft' });
    const ui = userEvent.setup();
    await ui.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Draft saved.')).toBeInTheDocument();
    await ui.type(screen.getByLabelText(/^Title/), ' (v2)');
    await waitFor(() => expect(subjectCalls).toBeGreaterThan(1));
    expect(screen.getByRole('heading', { level: 1, name: 'Edit draft' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Moot problem (v2)');
  });

  it('says so when the subject filter cannot load, with Try again', async () => {
    server.use(
      http.get(`${API}/college/subjects`, () => apiError(500, 'INTERNAL_ERROR')),
      http.get(`${API}/professor/assessments`, () => json(page([assessment()]))),
    );
    await renderApp('/professor');
    expect(await screen.findByText(/Subjects couldn.t be loaded\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Moot problem' })).toBeInTheDocument();
  });
});

describe('assessment detail (F3.4, F3.8)', () => {
  it("shows another professor's assessment as Not Found", async () => {
    server.use(http.get(`${API}/professor/assessments/x`, () => apiError(404, 'NOT_FOUND')));
    await renderApp('/professor/assessments/x');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('shows the grid with icon + text cells, and filters by question', async () => {
    const queries: string[] = [];
    server.use(
      http.get(`${API}/professor/assessments/a1`, () => json(assessment())),
      http.get(`${API}/professor/assessments/a1/answers`, ({ request }) => {
        queries.push(new URL(request.url).search);
        return json({
          ...page([
            {
              student: { id: 'u1', fullName: 'Asha Rao', loginId: 'R001' },
              cells: [
                { questionId: 'q1', position: 1, answerId: 'ans1', cellStatus: 'SUBMITTED', submittedAt: '2026-10-16T09:00:00Z' },
                { questionId: 'q2', position: 2, answerId: null, cellStatus: 'UPLOADED', submittedAt: null },
              ],
            },
          ]),
          size: 50,
        });
      }),
    );
    const router = await renderApp('/professor/assessments/a1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Moot problem' })).toBeInTheDocument();
    const grid = await screen.findByRole('table', { name: 'Submissions' });
    expect(within(grid).getByRole('rowheader', { name: /Asha Rao/ })).toBeInTheDocument();
    expect(within(grid).getByText('Submitted')).toBeInTheDocument();
    expect(within(grid).getByText('Uploaded')).toBeInTheDocument();
    expect(screen.getByText('1 student')).toBeInTheDocument();
    // Not attempted is "—" while published.
    expect(screen.getByText('Not attempted', { selector: 'dt' }).nextElementSibling).toHaveTextContent('—');
    // The status filter offers Not attempted only once closed.
    expect(within(screen.getByLabelText('Status')).queryByRole('option', { name: 'Not attempted' })).toBeNull();

    await userEvent.setup().selectOptions(screen.getByLabelText('Question'), '2');
    await waitFor(() => expect(router.state.location.search).toBe('?question=2'));
    await waitFor(() => expect(queries.at(-1)).toContain('questionId=q2'));
  });

  it('removes a published assessment after the confirm', async () => {
    let removed = false;
    server.use(
      http.get(`${API}/professor/assessments/a1`, () =>
        json(removed ? assessment({ status: 'REMOVED', removedAt: '2026-10-16T09:00:00Z' }) : assessment()),
      ),
      http.get(`${API}/professor/assessments/a1/answers`, () => json(page([]))),
      http.get(`${API}/professor/assessments`, () => json(page([]))),
      http.post(`${API}/professor/assessments/a1/remove`, () => {
        removed = true;
        return json(assessment({ status: 'REMOVED' }));
      }),
    );
    await renderApp('/professor/assessments/a1');
    const ui = userEvent.setup();
    await ui.click(await screen.findByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove “Moot problem”?' });
    expect(within(dialog).getByText(/left out of rankings/)).toBeInTheDocument();
    await ui.click(within(dialog).getByRole('button', { name: 'Remove assessment' }));
    expect(await screen.findByText('Assessment removed.')).toBeInTheDocument();
    expect(await screen.findByText(/Students no longer see this assessment\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });
});
