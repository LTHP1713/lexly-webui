/** F4.6: the student's results and the ways in (F4.7). */
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { toStudentResults } from '@/api/student';
import { API, apiError, http, json, server } from '@/test/server';
import { renderApp, signedInAs } from '@/test/renderApp';

const college = { id: 'c1', code: 'NLSIU', name: 'National Law School' };
const subject = { id: 's1', code: 'CON-101', name: 'Constitutional Law I' };

function question(position: number, outcome: string, overrides: Record<string, unknown> = {}) {
  return {
    questionId: `q${position}`,
    position,
    text: `Question text ${position}`,
    maxMarks: 10,
    outcome,
    finalMarks: null,
    finalFeedback: null,
    publishedAt: null,
    ...overrides,
  };
}

function results(questions: object[], totals = { publishedMarks: 8, publishedMaxMarks: 10, totalMaxMarks: 30 }) {
  return {
    assessment: { id: 'a1', title: 'Moot problem', subject, status: 'CLOSED', dueAt: '2020-11-02T12:00:00Z' },
    totals,
    questions,
  };
}

beforeEach(() => {
  signedInAs({ id: 'u1', role: 'C_STUDENT', loginId: 'R001', college });
});

describe('student results (F4.6)', () => {
  it('shows published marks and feedback, and where the other questions stand', async () => {
    server.use(
      http.get(`${API}/student/assessments/a1/results`, () =>
        json(
          results([
            question(1, 'PUBLISHED', { finalMarks: 8, finalFeedback: 'Well argued.\nCite more.', publishedAt: '2026-10-18T10:00:00Z' }),
            question(2, 'AWAITING_EVALUATION'),
            question(3, 'NOT_ATTEMPTED', { finalMarks: 0 }),
          ]),
        ),
      ),
    );
    await renderApp('/student/assessments/a1/results');
    expect(await screen.findByRole('heading', { level: 1, name: 'Results: Moot problem' })).toBeInTheDocument();
    expect(screen.getByText('Marks, of published questions')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Marks, of published questions' })).getByText('8 / 10')).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 questions published · the assessment is out of 30 marks\./)).toBeInTheDocument();

    const card = (n: number) => screen.getByRole('heading', { level: 2, name: `Question ${n}` }).closest('article') as HTMLElement;
    expect(within(card(1)).getByText('Published')).toBeInTheDocument();
    expect(within(card(1)).getByText(/Well argued\./)).toBeInTheDocument();
    expect(within(card(2)).getByText('Awaiting evaluation')).toBeInTheDocument();
    expect(within(card(2)).getByText('— / 10')).toBeInTheDocument();
    expect(within(card(3)).getByText('Not attempted')).toBeInTheDocument();
    expect(within(card(3)).getByText('0 / 10')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to your answers' })).toHaveAttribute('href', '/student/assessments/a1');
  });

  it('says when nothing is published yet', async () => {
    server.use(
      http.get(`${API}/student/assessments/a1/results`, () =>
        json(results([question(1, 'AWAITING_EVALUATION')], { publishedMarks: 0, publishedMaxMarks: 0, totalMaxMarks: 10 })),
      ),
    );
    await renderApp('/student/assessments/a1/results');
    expect(await screen.findByText(/No marks are published yet\./)).toBeInTheDocument();
  });

  it('shows a removed or unknown assessment as Not Found', async () => {
    server.use(http.get(`${API}/student/assessments/x/results`, () => apiError(404, 'NOT_FOUND')));
    await renderApp('/student/assessments/x/results');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('keeps only published feedback, and nothing beyond the contract fields', () => {
    const mapped = toStudentResults(
      results([
        { ...question(1, 'AWAITING_EVALUATION', { finalMarks: 6, finalFeedback: 'draft' }), aiMarks: 7, aiFeedback: 'AI says' },
      ]) as never,
    );
    expect(mapped.questions[0]).toEqual({
      questionId: 'q1',
      position: 1,
      text: 'Question text 1',
      maxMarks: 10,
      outcome: 'AWAITING_EVALUATION',
      finalMarks: null,
      finalFeedback: null,
      publishedAt: null,
    });
  });
});

describe('ways into the results', () => {
  it('links from the assessment and from a published answer card', async () => {
    server.use(
      http.get(`${API}/student/assessments/a1`, () =>
        json({
          id: 'a1',
          subject,
          title: 'Moot problem',
          instructions: null,
          professorName: 'Dr. K. Menon',
          status: 'PUBLISHED',
          state: 'SUBMITTED',
          dueAt: '2099-11-02T12:00:00Z',
          totalMarks: 10,
          serverTime: new Date().toISOString(),
          uploadLimits: { maxFileMb: 5, maxPages: 10 },
          questions: [
            {
              id: 'q1',
              position: 1,
              text: 'Discuss.',
              maxMarks: 10,
              wordLimit: 500,
              answer: { status: 'SUBMITTED', originalFilename: 'q1.pdf', sizeBytes: 1000, pageCount: 1, uploadedAt: null, submittedAt: '2026-10-16T10:00:00Z' },
              resultPublished: true,
            },
          ],
        }),
      ),
    );
    await renderApp('/student/assessments/a1');
    const links = await screen.findAllByRole('link', { name: 'View results' });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute('href', '/student/assessments/a1/results');
    expect(screen.getByText(/Your result is published\./)).toBeInTheDocument();
  });

  it('sends a results-available card to the results, with the published count', async () => {
    server.use(
      http.get(`${API}/college/subjects`, () => json([])),
      http.get(`${API}/student/assessments`, () =>
        json({
          content: [
            {
              id: 'a1',
              subject,
              title: 'Moot problem',
              professorName: null,
              status: 'CLOSED',
              state: 'RESULTS_AVAILABLE',
              dueAt: '2020-11-02T12:00:00Z',
              questionCount: 2,
              totalMarks: 15,
              progress: { uploaded: 0, submitted: 2, resultsPublished: 1 },
            },
          ],
          page: 0,
          size: 50,
          totalElements: 1,
          totalPages: 1,
        }),
      ),
    );
    await renderApp('/student');
    const link = await screen.findByRole('link', { name: /Moot problem/ });
    expect(link).toHaveAttribute('href', '/student/assessments/a1/results');
    expect(within(link).getByText(/1 result published/)).toBeInTheDocument();
  });
});
