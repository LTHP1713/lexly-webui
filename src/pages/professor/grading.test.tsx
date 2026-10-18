/** F4.1–F4.5: the answer review, grade panel, navigation, history and counts refresh (F4.7). */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API, HttpResponse, apiError, http, json, server } from '@/test/server';
import { renderApp, signedInAs } from '@/test/renderApp';

const college = { id: 'c1', code: 'NLSIU', name: 'National Law School' };

function grade(overrides: Record<string, unknown> = {}) {
  return { status: 'PENDING', finalMarks: null, finalFeedback: null, gradedBy: null, publishedAt: null, ai: null, ...overrides };
}

function review(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ans1',
    assessment: { id: 'a1', title: 'Moot problem', status: 'CLOSED' },
    question: { id: 'q1', position: 2, text: 'Discuss Article 21.', maxMarks: 10, wordLimit: 500 },
    student: { id: 'u1', fullName: 'Asha Rao', loginId: 'R001' },
    file: { originalFilename: 'q2.pdf', sizeBytes: 1_834_221, pageCount: 4 },
    submittedAt: '2026-10-16T09:00:00Z',
    professorDownloadedAt: null,
    grade: grade(),
    history: [],
    navigation: { previousAnswerId: null, nextAnswerId: 'ans2', nextUngradedAnswerId: 'ans2' },
    ...overrides,
  };
}

const realCreate = URL.createObjectURL;
const realRevoke = URL.revokeObjectURL;

beforeEach(() => {
  signedInAs({ id: 'p1', role: 'C_PROFESSOR', loginId: 'EMP1', college });
  // jsdom has no object URLs; the PDF frame only needs a string.
  URL.createObjectURL = () => 'blob:answer';
  URL.revokeObjectURL = () => undefined;
  server.use(
    http.get(
      `${API}/professor/answers/:id/file`,
      () => new HttpResponse('%PDF-1.7', { headers: { 'Content-Type': 'application/pdf' } }),
    ),
  );
});

afterEach(() => {
  URL.createObjectURL = realCreate;
  URL.revokeObjectURL = realRevoke;
});

/** Serves the review; `current` can be swapped by a test to change what refetches return. */
function serveReview(body: () => Record<string, unknown>, seen: string[] = []) {
  server.use(
    http.get(`${API}/professor/answers/:id`, ({ request }) => {
      seen.push(new URL(request.url).search);
      return json(body());
    }),
  );
  return seen;
}

describe('answer review (F4.1)', () => {
  it('shows the question, the student and the PDF, and asks for the requested order', async () => {
    const seen = serveReview(() => review());
    await renderApp('/professor/answers/ans1?order=byQuestion');
    expect(await screen.findByRole('heading', { level: 1, name: 'Asha Rao' })).toBeInTheDocument();
    expect(seen[0]).toBe('?order=byQuestion');
    expect(screen.getByText('R001')).toBeInTheDocument();
    expect(screen.getByText('Discuss Article 21.')).toBeInTheDocument();
    expect(screen.getByText('10 marks · up to 500 words')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Moot problem' })).toHaveAttribute('href', '/professor/assessments/a1');
    expect(await screen.findByTitle('PDF: q2.pdf')).toHaveAttribute('src', 'blob:answer');
  });

  it("shows an answer that isn't the professor's as Not Found", async () => {
    server.use(http.get(`${API}/professor/answers/x`, () => apiError(404, 'NOT_FOUND')));
    await renderApp('/professor/answers/x');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('grade panel (F4.2)', () => {
  it('blocks approve without feedback or with invalid marks, sending nothing', async () => {
    let calls = 0;
    serveReview(() => review());
    server.use(
      http.post(`${API}/professor/answers/ans1/approve`, () => {
        calls += 1;
        return json(grade({ status: 'PUBLISHED' }));
      }),
    );
    await renderApp('/professor/answers/ans1');
    const ui = userEvent.setup();
    const marks = await screen.findByLabelText('Marks (out of 10)');

    await ui.click(screen.getByRole('button', { name: 'Approve & publish…' }));
    expect(screen.getByText('Enter the marks.')).toBeInTheDocument();
    expect(screen.getByText('Write feedback for the student.')).toBeInTheDocument();
    await waitFor(() => expect(marks).toHaveFocus());

    await ui.type(marks, '7.3');
    await ui.type(screen.getByLabelText(/^Feedback for the student/), 'Good structure.');
    await ui.click(screen.getByRole('button', { name: 'Approve & publish…' }));
    expect(screen.getByText('Enter marks from 0 to 10, in whole or half marks.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it('saves a draft with both fields', async () => {
    let body: unknown = null;
    serveReview(() => review());
    server.use(
      http.put(`${API}/professor/answers/ans1/grade`, async ({ request }) => {
        body = await request.json();
        return json(grade({ finalMarks: 6.5, finalFeedback: null }));
      }),
      http.get(`${API}/professor/assessments`, () => json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 })),
    );
    await renderApp('/professor/answers/ans1');
    const ui = userEvent.setup();
    await ui.type(await screen.findByLabelText('Marks (out of 10)'), '6.5');
    await ui.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText("Draft saved. The student can't see it yet.")).toBeInTheDocument();
    expect(body).toEqual({ finalMarks: 6.5, finalFeedback: null });
  });

  it('shows INVALID_MARKS from the server on the marks field', async () => {
    serveReview(() => review());
    server.use(
      http.put(`${API}/professor/answers/ans1/grade`, () =>
        apiError(400, 'INVALID_MARKS', 'finalMarks: must be between 0 and 10.0 in steps of 0.5'),
      ),
    );
    await renderApp('/professor/answers/ans1');
    const ui = userEvent.setup();
    await ui.type(await screen.findByLabelText('Marks (out of 10)'), '5');
    await ui.click(screen.getByRole('button', { name: 'Save draft' }));
    const marks = screen.getByLabelText('Marks (out of 10)');
    await waitFor(() => expect(marks).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText('Enter marks from 0 to 10, in whole or half marks.')).toBeInTheDocument();
  });

  it('approves after the confirm, then is read-only and refreshes the counts', async () => {
    let approved: unknown = null;
    serveReview(() =>
      approved
        ? review({
            grade: grade({ status: 'PUBLISHED', finalMarks: 8, finalFeedback: 'Clear answer.', publishedAt: '2026-10-18T10:00:00Z', gradedBy: { id: 'p1', fullName: 'Dr. K. Menon' } }),
            history: [{ event: 'PUBLISHED', marks: 8, feedback: 'Clear answer.', actor: { id: 'p1', fullName: 'Dr. K. Menon', role: 'C_PROFESSOR' }, createdAt: '2026-10-18T10:00:00Z' }],
          })
        : review(),
    );
    server.use(
      http.post(`${API}/professor/answers/ans1/approve`, async ({ request }) => {
        approved = await request.json();
        return json(grade({ status: 'PUBLISHED', finalMarks: 8, finalFeedback: 'Clear answer.', publishedAt: '2026-10-18T10:00:00Z', gradedBy: { id: 'p1', fullName: 'Dr. K. Menon' } }));
      }),
    );
    await renderApp('/professor/answers/ans1');
    const ui = userEvent.setup();
    await ui.type(await screen.findByLabelText('Marks (out of 10)'), '8');
    await ui.type(screen.getByLabelText(/^Feedback for the student/), 'Clear answer.');
    await ui.click(screen.getByRole('button', { name: 'Approve & publish…' }));

    const dialog = await screen.findByRole('dialog', { name: 'Publish the grade for question 2?' });
    expect(within(dialog).getByText(/Asha Rao sees 8 \/ 10 and your feedback immediately\. A published grade can.t be changed\./)).toBeInTheDocument();
    await ui.click(within(dialog).getByRole('button', { name: 'Publish grade' }));

    expect(await screen.findByText('Grade published.')).toBeInTheDocument();
    expect(approved).toEqual({ finalMarks: 8, finalFeedback: 'Clear answer.' });
    expect(screen.queryByLabelText('Marks (out of 10)')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
    expect(screen.getByText('8 / 10')).toBeInTheDocument();
    expect(screen.getByText(/by Dr\. K\. Menon/)).toBeInTheDocument();
    // Next ungraded becomes the primary action and takes focus.
    await waitFor(() => expect(screen.getByRole('link', { name: 'Next ungraded →' })).toHaveFocus());
    // The refetched review carries the new history row.
    expect(await screen.findByText('Grade history (1)')).toBeInTheDocument();
  });

  it('is read-only for a published grade', async () => {
    serveReview(() =>
      review({ grade: grade({ status: 'PUBLISHED', finalMarks: 9.5, finalFeedback: 'Excellent.\nWell cited.', publishedAt: '2026-10-18T10:00:00Z', gradedBy: null }) }),
    );
    await renderApp('/professor/answers/ans1');
    expect(await screen.findByText('9.5 / 10')).toBeInTheDocument();
    expect(screen.getByText(/by a former professor/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument();
  });

  it('turns GRADE_PUBLISHED into a banner and shows the published grade', async () => {
    let published = false;
    serveReview(() =>
      published ? review({ grade: grade({ status: 'PUBLISHED', finalMarks: 4, finalFeedback: 'Thin.', publishedAt: '2026-10-18T10:00:00Z' }) }) : review(),
    );
    server.use(
      http.put(`${API}/professor/answers/ans1/grade`, () => {
        published = true;
        return apiError(409, 'GRADE_PUBLISHED');
      }),
    );
    await renderApp('/professor/answers/ans1');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText("This grade has already been published, so it can't be changed.")).toBeInTheDocument();
    expect(await screen.findByText('4 / 10')).toBeInTheDocument();
  });

  it('keeps a removed assessment readable but not gradable', async () => {
    serveReview(() =>
      review({ assessment: { id: 'a1', title: 'Moot problem', status: 'REMOVED' }, grade: grade({ finalMarks: 5, finalFeedback: 'Draft.' }) }),
    );
    await renderApp('/professor/answers/ans1');
    expect(await screen.findByText(/This assessment was removed, so its answers can.t be graded any more\./)).toBeInTheDocument();
    expect(screen.getByText('5 / 10')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
  });
});

describe('grading flow and history (F4.3, F4.4)', () => {
  it('links previous / next / next ungraded in the chosen order', async () => {
    const seen = serveReview(() =>
      review({ navigation: { previousAnswerId: null, nextAnswerId: 'ans2', nextUngradedAnswerId: null } }),
    );
    const router = await renderApp('/professor/answers/ans1?order=byQuestion');
    const nav = await screen.findByRole('navigation', { name: 'Answer navigation' });
    expect(within(nav).getByRole('button', { name: '← Previous' })).toBeDisabled();
    expect(within(nav).getByRole('link', { name: 'Next →' })).toHaveAttribute('href', '/professor/answers/ans2?order=byQuestion');
    expect(within(nav).getByRole('button', { name: 'Next ungraded →' })).toBeDisabled();
    expect(within(nav).getByText(/No ungraded answers after this one\./)).toBeInTheDocument();

    await userEvent.setup().selectOptions(within(nav).getByLabelText('Grading order'), 'byStudent');
    await waitFor(() => expect(router.state.location.search).toBe('?order=byStudent'));
    await waitFor(() => expect(seen.at(-1)).toBe('?order=byStudent'));
  });

  it('asks before moving on with unsaved changes', async () => {
    serveReview(() => review());
    await renderApp('/professor/answers/ans1');
    const ui = userEvent.setup();
    await ui.type(await screen.findByLabelText('Marks (out of 10)'), '3');
    await ui.click(screen.getByRole('link', { name: 'Next →' }));
    expect(await screen.findByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument();
  });

  it('lists the history oldest first, with AI and removed actors named', async () => {
    serveReview(() =>
      review({
        history: [
          { event: 'DRAFT_SAVED', marks: 6, feedback: 'First pass.', actor: { id: 'p1', fullName: 'Dr. K. Menon', role: 'C_PROFESSOR' }, createdAt: '2026-10-17T09:00:00Z' },
          { event: 'AI_EVALUATED', marks: 7, feedback: null, actor: null, createdAt: '2026-10-17T10:00:00Z' },
          { event: 'DRAFT_SAVED', marks: null, feedback: null, actor: null, createdAt: '2026-10-17T11:00:00Z' },
        ],
      }),
    );
    await renderApp('/professor/answers/ans1');
    expect(await screen.findByText('Grade history (3)')).toBeInTheDocument();
    const items = within(screen.getByRole('list', { name: 'Grade history (3)' })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Draft saved · 6 / 10');
    expect(items[0]).toHaveTextContent('First pass.');
    expect(items[1]).toHaveTextContent('AI evaluated · 7 / 10');
    expect(items[1]).toHaveTextContent('Lexly AI');
    expect(items[2]).toHaveTextContent('No marks');
    expect(items[2]).toHaveTextContent('Former user');
  });
});
