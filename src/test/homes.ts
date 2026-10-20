/**
 * MSW handlers for what each role home (UI spec UR.3) loads, so a test that lands on a home — a
 * sign-in, a wrong-role redirect — doesn't fail on an unmocked request. Pass overrides to vary.
 */
import { API, http, json, server } from './server';

const emptyPage = { content: [], page: 0, size: 1, totalElements: 0, totalPages: 0 };
const quota = { limit: 10, used: 0, remaining: 10, resetsAt: '2026-10-20T18:30:00Z' };

export function mockStudyHub(overrides: { acts?: unknown[]; caseLawTotal?: number } = {}) {
  server.use(
    http.get(`${API}/acts`, () => json((overrides.acts ?? []) as never)),
    http.get(`${API}/caselaws`, () => json({ ...emptyPage, totalElements: overrides.caseLawTotal ?? 0 })),
    http.get(`${API}/tutor/quota`, () => json(quota)),
  );
}

export function mockCollegeOverview(overrides: { students?: number; professors?: number; subjects?: unknown[]; audit?: unknown[] } = {}) {
  server.use(
    http.get(`${API}/college/users`, ({ request }) => {
      const role = new URL(request.url).searchParams.get('role');
      const total = role === 'C_PROFESSOR' ? (overrides.professors ?? 0) : (overrides.students ?? 0);
      return json({ ...emptyPage, totalElements: total });
    }),
    http.get(`${API}/college/subjects`, () => json((overrides.subjects ?? []) as never)),
    http.get(`${API}/audit`, () => json({ ...emptyPage, content: (overrides.audit ?? []) as never[] })),
  );
}

export function mockAdminOverview(overrides: { colleges?: unknown[]; activeTotal?: number; runs?: unknown[]; usage?: unknown } = {}) {
  server.use(
    http.get(`${API}/superadmin/colleges`, ({ request }) => {
      const active = new URL(request.url).searchParams.get('active');
      const colleges = (overrides.colleges ?? []) as never[];
      if (active === 'true') return json({ ...emptyPage, totalElements: overrides.activeTotal ?? colleges.length });
      return json({ content: colleges, page: 0, size: 100, totalElements: colleges.length, totalPages: 1 });
    }),
    http.get(`${API}/superadmin/tutor/index-runs`, () => json((overrides.runs ?? []) as never)),
    http.get(`${API}/superadmin/ai-usage/daily`, () =>
      json(
        (overrides.usage ?? {
          from: '2026-09-21',
          to: '2026-10-20',
          currency: 'USD',
          rates: { inputPerMillion: 1.125, outputPerMillion: 5.625, embeddingPerMillion: 0.2 },
          days: [],
          totals: { questions: 0, indexRuns: 0, inputTokens: 0, outputTokens: 0, embeddingTokens: 0, cost: 0 },
        }) as never,
      ),
    ),
  );
}

export function mockTeachingDesk(assessments: unknown[] = []) {
  server.use(
    http.get(`${API}/professor/assessments`, () =>
      json({ content: assessments as never[], page: 0, size: 50, totalElements: assessments.length, totalPages: 1 }),
    ),
  );
}

export function mockMyStudies(assessments: unknown[] = []) {
  server.use(
    http.get(`${API}/student/assessments`, () =>
      json({ content: assessments as never[], page: 0, size: 50, totalElements: assessments.length, totalPages: 1 }),
    ),
    http.get(`${API}/tutor/quota`, () => json(quota)),
  );
}
