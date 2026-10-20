/** UR.3: the five role homes, built only from existing endpoints (UR.6). */
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { API, apiError, http, server } from '@/test/server';
import { renderApp, signedInAs } from '@/test/renderApp';
import { mockAdminOverview, mockCollegeOverview, mockMyStudies, mockStudyHub, mockTeachingDesk } from '@/test/homes';

const college = { id: 'c1', code: 'NLSIU', name: 'National Law School' };
const subject = { id: 's1', code: 'CON-101', name: 'Constitutional Law I' };

function placard(name: RegExp) {
  return within(screen.getByRole('main')).getByRole('link', { name });
}

describe('SUPERADMIN Overview', () => {
  it('shows spend, colleges, people across colleges and the last index run', async () => {
    signedInAs({ role: 'SUPERADMIN' });
    mockAdminOverview({
      colleges: [
        { id: 'c1', code: 'NLSIU', name: 'National Law School', active: true, counts: { admins: 2, professors: 41, students: 1180 } },
        { id: 'c2', code: 'ILS', name: 'ILS Law College', active: false, counts: { admins: 1, professors: 22, students: 640 } },
      ],
      activeTotal: 1,
      runs: [
        {
          id: 'r1',
          status: 'SUCCEEDED',
          startedAt: '2026-10-20T08:00:00Z',
          finishedAt: '2026-10-20T08:04:12Z',
          startedBy: null,
          files: { ingested: 1, failed: [] },
          library: { sections: 1, caseLaws: 1 },
          chunks: { embedded: 1, reused: 0, removed: 0 },
          embeddingTokens: 10,
          error: null,
        },
      ],
      usage: {
        from: '2026-09-21',
        to: '2026-10-20',
        currency: 'USD',
        rates: { inputPerMillion: 1.125, outputPerMillion: 5.625, embeddingPerMillion: 0.2 },
        days: [
          { date: '2026-10-19', questions: 2, indexRuns: 0, inputTokens: 1, outputTokens: 1, embeddingTokens: 0, cost: 0.01 },
          { date: '2026-10-20', questions: 40, indexRuns: 1, inputTokens: 1, outputTokens: 1, embeddingTokens: 0, cost: 0.6347 },
        ],
        totals: { questions: 42, indexRuns: 1, inputTokens: 2, outputTokens: 2, embeddingTokens: 0, cost: 0.6447 },
      },
    });
    await renderApp('/admin');
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(await screen.findByText('$0.6447')).toBeInTheDocument();
    expect(screen.getByText('42 tutor questions · 1 index run')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open spend/ })).toHaveAttribute('href', '/admin/tutor?tab=spend');
    expect(placard(/Active colleges/)).toHaveTextContent('1');
    expect(placard(/Students · 63 professors/)).toHaveTextContent('1,820');
    expect(placard(/Last index run · 4 min 12 s/)).toHaveTextContent('Succeeded');
    const table = screen.getByRole('table', { name: 'Colleges, first 5 by name' });
    expect(within(table).getByRole('link', { name: 'National Law School' })).toHaveAttribute('href', '/admin/colleges/c1');
    expect(within(table).getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Re-index' })).toHaveAttribute('href', '/admin/tutor');
  });

  it('keeps the other cards when one fails', async () => {
    signedInAs({ role: 'SUPERADMIN' });
    mockAdminOverview();
    server.use(http.get(`${API}/superadmin/ai-usage/daily`, () => apiError(500, 'INTERNAL_ERROR')));
    await renderApp('/admin');
    expect(await screen.findByText(/Lexly is having trouble right now/)).toBeInTheDocument();
    expect(placard(/The tutor needs a first index run/)).toHaveTextContent('Not indexed');
    expect(screen.getByText('No colleges yet.')).toBeInTheDocument();
  });
});

describe('C_ADMIN Overview', () => {
  it('counts people and subjects and lists the week’s activity', async () => {
    signedInAs({ role: 'C_ADMIN', college });
    mockCollegeOverview({
      students: 1180,
      professors: 41,
      subjects: [subject, { ...subject, id: 's2', code: 'CRM-201' }],
      audit: [
        {
          id: 'e1',
          action: 'USER_CREATED',
          actor: { id: 'u', fullName: 'Ritu Iyer', role: 'C_ADMIN' },
          college,
          entityType: 'USER',
          entityId: 'x',
          details: { role: 'C_PROFESSOR', loginId: 'EMP14' },
          createdAt: new Date().toISOString(),
        },
      ],
    });
    await renderApp('/college');
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(await screen.findByText('1,221')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '1,180 students, 41 professors' })).toBeInTheDocument();
    expect(placard(/Professors/)).toHaveAttribute('href', '/college/users?role=professors');
    expect(placard(/Subjects/)).toHaveTextContent('2');
    const table = screen.getByRole('table', { name: 'Recent audit entries' });
    expect(within(table).getByText('Ritu Iyer · College admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import users' })).toHaveAttribute('href', '/college/users/import');
  });
});

function profAssessment(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    subject,
    title: `Assessment ${id}`,
    status: 'PUBLISHED',
    dueAt: new Date(Date.now() + 2.5 * 86_400_000).toISOString(),
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    createdBy: { id: 'p', fullName: 'Dr. Menon' },
    totalMarks: 10,
    questionCount: 1,
    counts: { students: 60, answerSlots: 60, submitted: 50, pendingEvaluation: 10, aiEvaluated: 0, published: 40, notAttempted: 0 },
    ...overrides,
  };
}

describe('Teaching desk', () => {
  it('sums grading from the assessment counts and links to the work', async () => {
    signedInAs({ role: 'C_PROFESSOR', firstName: 'Kavya', loginId: 'EMP1', college });
    mockTeachingDesk([
      profAssessment('a1'),
      profAssessment('a2', {
        status: 'CLOSED',
        dueAt: '2026-10-01T00:00:00Z',
        counts: { students: 60, answerSlots: 60, submitted: 60, pendingEvaluation: 0, aiEvaluated: 0, published: 60, notAttempted: 0 },
      }),
      profAssessment('d1', { status: 'DRAFT', dueAt: null }),
    ]);
    await renderApp('/professor');
    expect(await screen.findByRole('heading', { level: 1, name: 'Teaching desk' })).toBeInTheDocument();
    expect(await screen.findByText('100 of 110 published')).toBeInTheDocument();
    expect(placard(/Answers to grade/)).toHaveAttribute('href', '/professor/assessments/a1');
    expect(placard(/Answers to grade/)).toHaveTextContent('10');
    expect(placard(/Open assessments/)).toHaveAttribute('href', '/professor/assessments?status=PUBLISHED');
    expect(placard(/Next due · Assessment a1/)).toHaveTextContent('2 days');
    const table = screen.getByRole('table', { name: 'Your newest assessments' });
    expect(within(table).getByRole('link', { name: 'Assessment d1' })).toHaveAttribute('href', '/professor/assessments/d1/edit');
    expect(screen.getByRole('link', { name: /All assessments/ })).toHaveAttribute('href', '/professor/assessments');
  });
});

describe('My studies', () => {
  it('shows the assessment due next, open ones, results and tutor questions', async () => {
    signedInAs({ role: 'C_STUDENT', firstName: 'Asha', loginId: 'R001', college });
    const base = { subject, professorName: 'Dr. Menon', status: 'PUBLISHED', questionCount: 3, totalMarks: 30 };
    mockMyStudies([
      {
        ...base,
        id: 'a1',
        title: 'Moot problem',
        state: 'PARTIALLY_SUBMITTED',
        dueAt: new Date(Date.now() + 2.5 * 86_400_000).toISOString(),
        progress: { uploaded: 1, submitted: 2, resultsPublished: 0 },
      },
      {
        ...base,
        id: 'a2',
        title: 'Writ petitions',
        state: 'RESULTS_AVAILABLE',
        status: 'CLOSED',
        dueAt: '2026-10-01T00:00:00Z',
        progress: { uploaded: 0, submitted: 3, resultsPublished: 3 },
      },
    ]);
    await renderApp('/student');
    expect(await screen.findByRole('heading', { level: 1, name: 'My studies' })).toBeInTheDocument();
    expect(screen.getByText('Hi Asha · Roll no. R001')).toBeInTheDocument();
    expect(await screen.findByText('Moot problem', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('2 of 3 answers submitted')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Continue answering/ })).toHaveAttribute('href', '/student/assessments/a1');
    expect(placard(/Open assessments/)).toHaveTextContent('1');
    expect(placard(/With results published/)).toHaveAttribute('href', '/student/assessments/a2/results');
    expect(await screen.findByText('10 of 10')).toBeInTheDocument();
  });
});

describe('Study hub', () => {
  it('shows library search, acts and case law counts and the acts table', async () => {
    signedInAs({ role: 'S_STUDENT', firstName: 'Priya' });
    mockStudyHub({
      acts: [
        { id: 'a1', title: 'Indian Contract Act, 1872', shortCode: 'ICA' },
        { id: 'a2', title: 'Constitution of India', shortCode: 'COI' },
      ],
      caseLawTotal: 340,
    });
    await renderApp('/dashboard');
    expect(await screen.findByRole('heading', { level: 1, name: 'Study hub' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Find any section or case law' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Constitution of India' })).toHaveAttribute('href', '/acts/a2');
    expect(placard(/Bare acts/)).toHaveTextContent('2');
    expect(await screen.findByText('340')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sections of Indian Contract Act, 1872' })).toHaveAttribute('href', '/acts/a1');
  });
});
