/** F3.5–F3.7: the student list, the answer card states, uploads, submits and each 409 (F3.10). */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { API, apiError, http, json, server } from '@/test/server';
import { renderApp, signedInAs } from '@/test/renderApp';

const college = { id: 'c1', code: 'NLSIU', name: 'National Law School' };
const subject = { id: 's1', code: 'CON-101', name: 'Constitutional Law I' };
const FUTURE = '2099-11-02T12:00:00Z';
const PAST = '2020-11-02T12:00:00Z';

const uploaded = {
  status: 'UPLOADED',
  originalFilename: 'q1.pdf',
  sizeBytes: 1_258_291,
  pageCount: 3,
  uploadedAt: '2026-10-16T09:00:00Z',
  submittedAt: null,
};
const submitted = { ...uploaded, status: 'SUBMITTED', submittedAt: '2026-10-16T10:00:00Z' };

function detail(overrides: Record<string, unknown> = {}, answers: (object | null)[] = [null, null]) {
  return {
    id: 'a1',
    subject,
    title: 'Moot problem',
    instructions: 'Answer all.',
    professorName: 'Dr. K. Menon',
    status: 'PUBLISHED',
    state: 'OPEN',
    dueAt: FUTURE,
    totalMarks: 15,
    serverTime: new Date().toISOString(),
    uploadLimits: { maxFileMb: 5, maxPages: 10 },
    questions: answers.map((answer, i) => ({
      id: `q${i + 1}`,
      position: i + 1,
      text: `Question text ${i + 1}`,
      maxMarks: i === 0 ? 10 : 5,
      wordLimit: 500,
      answer,
      resultPublished: false,
    })),
    ...overrides,
  };
}

function summary(id: string, state: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    subject,
    title: `Assessment ${id}`,
    professorName: null,
    status: state === 'CLOSED' ? 'CLOSED' : 'PUBLISHED',
    state,
    dueAt: FUTURE,
    questionCount: 2,
    totalMarks: 15,
    progress: { uploaded: 0, submitted: 0, resultsPublished: 0 },
    ...overrides,
  };
}

const page = <T,>(content: T[]) => ({ content, page: 0, size: 50, totalElements: content.length, totalPages: 1 });
const pdf = (name = 'answer.pdf') => new File(['%PDF-1.4\n%fake'], name, { type: 'application/pdf' });

beforeEach(() => {
  signedInAs({ id: 'u1', role: 'C_STUDENT', loginId: 'R001', college });
  server.use(
    http.get(`${API}/college/subjects`, () => json([])),
    http.get(`${API}/student/assessments`, () => json(page([]))),
  );
});

/** The card of a question, found by its heading. */
async function card(position: number) {
  const heading = await screen.findByRole('heading', { level: 2, name: `Question ${position}` });
  return heading.closest('article') as HTMLElement;
}

describe('student list (F3.5)', () => {
  it('groups by state in server order, with progress and the college name', async () => {
    server.use(
      http.get(`${API}/student/assessments`, () =>
        json(
          page([
            summary('a1', 'PARTIALLY_SUBMITTED', { progress: { uploaded: 1, submitted: 1, resultsPublished: 0 } }),
            summary('a2', 'OPEN'),
            summary('a3', 'CLOSED', { dueAt: PAST }),
          ]),
        ),
      ),
    );
    await renderApp('/student');
    expect(await screen.findByText('National Law School')).toBeInTheDocument();
    const todo = (await screen.findByRole('heading', { level: 2, name: 'To do' })).closest('section') as HTMLElement;
    expect(within(todo).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/student/assessments/a1',
      '/student/assessments/a2',
    ]);
    expect(within(todo).getByText('1 of 2 submitted · 1 uploaded, not submitted')).toBeInTheDocument();
    expect(within(todo).getByText('In progress')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Submitted' })).not.toBeInTheDocument();
    const closed = screen.getByRole('heading', { level: 2, name: 'Closed' }).closest('section') as HTMLElement;
    expect(within(closed).getByText(/· closed$/)).toBeInTheDocument();
    expect(within(closed).getByText(/Former professor/)).toBeInTheDocument();
  });

  it('shows the empty state', async () => {
    await renderApp('/student');
    expect(await screen.findByText('No assessments yet. When your professors publish one, it appears here.')).toBeInTheDocument();
  });
});

describe('student assessment (F3.6, F3.7)', () => {
  it('goes not uploaded → uploaded → submitted', async () => {
    let answer: object | null = null;
    let uploadedSize = 0;
    server.use(
      http.get(`${API}/student/assessments/a1`, () => json(detail({}, [answer, null]))),
      http.put(`${API}/student/questions/q1/answer`, async ({ request }) => {
        const file = (await request.formData()).get('file') as File;
        // jsdom's XHR drops multipart filenames, so check the part's bytes instead.
        uploadedSize = file.size;
        answer = { ...uploaded, originalFilename: 'answer.pdf' };
        return json(answer);
      }),
      http.post(`${API}/student/questions/q1/answer/submit`, () => {
        answer = { ...submitted, originalFilename: 'answer.pdf' };
        return json(answer);
      }),
    );
    await renderApp('/student/assessments/a1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Moot problem' })).toBeInTheDocument();
    expect(screen.getByText(/Upload one PDF per question: at most 5 MB and 10 pages/)).toBeInTheDocument();
    expect(screen.getByText('0 of 2 answers submitted')).toBeInTheDocument();

    let first = await card(1);
    expect(within(first).getByText('Not uploaded')).toBeInTheDocument();
    const ui = userEvent.setup();
    await ui.upload(first.querySelector<HTMLInputElement>('input[type=file]')!, pdf());

    first = await card(1);
    expect(await within(first).findByText('Uploaded, not submitted')).toBeInTheDocument();
    expect(uploadedSize).toBe(pdf().size);
    // The second copy is in the (closed) submit dialog.
    expect(within(first).getAllByText(/1\.2 MB · 3 pages · uploaded/)).toHaveLength(2);
    expect(screen.getByText("Answer uploaded. Submit it when you're ready.")).toBeInTheDocument();

    await ui.click(within(first).getByRole('button', { name: 'Submit answer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Submit your answer to question 1?' });
    expect(within(dialog).getByText(/You can.t change this answer after submitting./)).toBeInTheDocument();
    await ui.click(within(dialog).getByRole('button', { name: 'Submit answer' }));

    expect(await within(first).findByText('Submitted')).toBeInTheDocument();
    expect(within(first).getByText(/Submitted answers can.t be changed./)).toBeInTheDocument();
    expect(within(first).queryByRole('button', { name: 'Replace' })).not.toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByText('Answer submitted.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('1 of 2 answers submitted')).toBeInTheDocument());
  });

  it('refuses a file that is not really a PDF without uploading it', async () => {
    let called = false;
    server.use(
      http.get(`${API}/student/assessments/a1`, () => json(detail())),
      http.put(`${API}/student/questions/q1/answer`, () => {
        called = true;
        return json(uploaded);
      }),
    );
    await renderApp('/student/assessments/a1');
    const first = await card(1);
    await userEvent
      .setup()
      .upload(first.querySelector<HTMLInputElement>('input[type=file]')!, new File(['hello'], 'fake.pdf', { type: 'application/pdf' }));
    expect(await within(first).findByText("This file isn't a readable PDF.")).toBeInTheDocument();
    expect(called).toBe(false);
  });

  it("shows the server's INVALID_FILE reason under the dropzone", async () => {
    server.use(
      http.get(`${API}/student/assessments/a1`, () => json(detail())),
      http.put(`${API}/student/questions/q1/answer`, () => apiError(400, 'INVALID_FILE', 'file: must have at most 10 pages')),
    );
    await renderApp('/student/assessments/a1');
    const first = await card(1);
    await userEvent.setup().upload(first.querySelector<HTMLInputElement>('input[type=file]')!, pdf());
    expect(await within(first).findByText("This PDF can't be used: Must have at most 10 pages.")).toBeInTheDocument();
    expect(within(first).getByText('Not uploaded')).toBeInTheDocument();
  });

  it('ANSWER_LOCKED on replace refetches and shows the answer as submitted', async () => {
    let answer: object = uploaded;
    server.use(
      http.get(`${API}/student/assessments/a1`, () => json(detail({}, [answer, null]))),
      http.put(`${API}/student/questions/q1/answer`, () => {
        answer = submitted;
        return apiError(409, 'ANSWER_LOCKED');
      }),
    );
    await renderApp('/student/assessments/a1');
    const first = await card(1);
    await within(first).findByRole('button', { name: 'Replace' });
    await userEvent.setup().upload(first.querySelector<HTMLInputElement>('input[type=file]')!, pdf());
    expect(await within(first).findByText('This answer was already submitted.')).toBeInTheDocument();
    expect(await within(first).findByText('Submitted')).toBeInTheDocument();
  });

  it('ASSESSMENT_CLOSED on submit refetches; the page is then closed', async () => {
    let closed = false;
    server.use(
      http.get(`${API}/student/assessments/a1`, () =>
        json(closed ? detail({ status: 'CLOSED', state: 'CLOSED', dueAt: PAST }, [uploaded, null]) : detail({}, [uploaded, null])),
      ),
      http.post(`${API}/student/questions/q1/answer/submit`, () => {
        closed = true;
        return apiError(409, 'ASSESSMENT_CLOSED');
      }),
    );
    await renderApp('/student/assessments/a1');
    const first = await card(1);
    const ui = userEvent.setup();
    await ui.click(await within(first).findByRole('button', { name: 'Submit answer' }));
    await ui.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Submit answer' }));
    expect(await within(first).findByText("The due date has passed, so this answer can't be changed.")).toBeInTheDocument();
    expect(await within(first).findByText(/uploaded but not submitted before the due date, so it doesn.t count/)).toBeInTheDocument();
    expect(within(first).getByText('Not attempted')).toBeInTheDocument();
    expect(within(first).queryByRole('button', { name: 'Submit answer' })).not.toBeInTheDocument();
  });

  it('VALIDATION_ERROR on answer asks for an upload first', async () => {
    server.use(
      http.get(`${API}/student/assessments/a1`, () => json(detail({}, [uploaded, null]))),
      http.post(`${API}/student/questions/q1/answer/submit`, () =>
        apiError(400, 'VALIDATION_ERROR', 'answer: upload a file before submitting'),
      ),
    );
    await renderApp('/student/assessments/a1');
    const first = await card(1);
    const ui = userEvent.setup();
    await ui.click(await within(first).findByRole('button', { name: 'Submit answer' }));
    await ui.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Submit answer' }));
    expect(await within(first).findByText('Upload a PDF before submitting.')).toBeInTheDocument();
  });

  it('after the due date, shows Not attempted and keeps submitted answers viewable', async () => {
    server.use(
      http.get(`${API}/student/assessments/a1`, () =>
        json(detail({ status: 'CLOSED', state: 'CLOSED', dueAt: PAST }, [submitted, null])),
      ),
    );
    await renderApp('/student/assessments/a1');
    const first = await card(1);
    expect(within(first).getByText('Submitted')).toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'View' })).toBeInTheDocument();
    const second = await card(2);
    expect(within(second).getByText('Not attempted')).toBeInTheDocument();
    expect(within(second).getByText('Nothing was submitted for this question before the due date.')).toBeInTheDocument();
    expect(second.querySelector('input[type=file]')).toBeNull();
    expect(screen.queryByText(/Upload one PDF per question/)).not.toBeInTheDocument();
  });

  it("uses the server's clock: a fast server means the due date has already passed", async () => {
    const dueAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const serverTime = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    server.use(http.get(`${API}/student/assessments/a1`, () => json(detail({ dueAt, serverTime }))));
    await renderApp('/student/assessments/a1');
    const first = await card(1);
    expect(within(first).getByText('Not attempted')).toBeInTheDocument();
    expect(screen.getByText(/· closed$/)).toBeInTheDocument();
  });

  it('shows a removed or unknown assessment as Not Found', async () => {
    server.use(http.get(`${API}/student/assessments/x`, () => apiError(404, 'NOT_FOUND')));
    await renderApp('/student/assessments/x');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
