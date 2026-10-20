/**
 * Contract §11a bodies and MSW handlers for the tutor endpoints, shared by the tutor and tutor
 * admin tests. Each `*Handler` answers one endpoint; pass a resolver to vary the response.
 */
import { API, http, json } from './server';

export function conversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conv-1',
    title: 'Is a contract with a minor void?',
    createdAt: '2026-10-20T09:00:00Z',
    lastMessageAt: '2026-10-20T09:01:00Z',
    expiresAt: new Date(Date.now() + 23.5 * 3600_000).toISOString(),
    ...overrides,
  };
}

export function sectionCitation(overrides: Record<string, unknown> = {}) {
  return {
    ref: 1,
    sourceType: 'SECTION',
    sourceId: 'sec-11',
    label: 'Section 11, Indian Contract Act, 1872',
    location: null,
    snippet: 'Every person is competent to contract who is of the age of majority …',
    ...overrides,
  };
}

export function fileCitation(overrides: Record<string, unknown> = {}) {
  return {
    ref: 2,
    sourceType: 'FILE',
    sourceId: null,
    label: 'Contract notes.pdf',
    location: 'page 4',
    snippet: 'Minors cannot ratify agreements on attaining majority.',
    ...overrides,
  };
}

export function userMessage(content: string, id = 'm-q') {
  return { id, role: 'USER', content, notFound: false, citations: [], createdAt: '2026-10-20T09:00:00Z' };
}

export function answerMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm-a',
    role: 'ASSISTANT',
    content: 'A contract with a minor is void [1]. A minor cannot ratify it later [2].',
    notFound: false,
    citations: [sectionCitation(), fileCitation()],
    createdAt: '2026-10-20T09:01:00Z',
    ...overrides,
  };
}

export function quota(overrides: Record<string, unknown> = {}) {
  return { limit: 10, used: 3, remaining: 7, resetsAt: '2026-10-20T18:30:00Z', ...overrides };
}

export function askResponse(question: string, overrides: Record<string, unknown> = {}) {
  return {
    conversation: conversation(),
    question: userMessage(question),
    answer: answerMessage(),
    quota: quota({ used: 4, remaining: 6 }),
    ...overrides,
  };
}

export function indexRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    status: 'SUCCEEDED',
    startedAt: '2026-10-20T08:00:00Z',
    finishedAt: '2026-10-20T08:04:12Z',
    startedBy: { id: 'admin-1', fullName: 'Lexly Admin' },
    files: { ingested: 6, failed: ['Scan.pdf'] },
    library: { sections: 266, caseLaws: 12 },
    chunks: { embedded: 41, reused: 912, removed: 3 },
    embeddingTokens: 9800,
    error: null,
    ...overrides,
  };
}

export function usage(from: string, to: string, days: Record<string, unknown>[], overrides: Record<string, unknown> = {}) {
  const sum = (key: string) => days.reduce((total, day) => total + Number(day[key] ?? 0), 0);
  return {
    from,
    to,
    currency: 'USD',
    rates: { inputPerMillion: 1.125, outputPerMillion: 5.625, embeddingPerMillion: 0.2 },
    days,
    totals: {
      questions: sum('questions'),
      indexRuns: sum('indexRuns'),
      inputTokens: sum('inputTokens'),
      outputTokens: sum('outputTokens'),
      embeddingTokens: sum('embeddingTokens'),
      cost: Math.round(sum('cost') * 10_000) / 10_000,
    },
    ...overrides,
  };
}

export function usageDay(date: string, overrides: Record<string, unknown> = {}) {
  return { date, questions: 0, indexRuns: 0, inputTokens: 0, outputTokens: 0, embeddingTokens: 0, cost: 0, ...overrides };
}

type Resolver = Parameters<typeof http.get>[1];

export const quotaHandler = (resolver: Resolver = () => json(quota())) => http.get(`${API}/tutor/quota`, resolver);
export const conversationsHandler = (resolver: Resolver = () => json([])) =>
  http.get(`${API}/tutor/conversations`, resolver);
export const conversationHandler = (resolver: Resolver) => http.get(`${API}/tutor/conversations/:id`, resolver);
export const deleteConversationHandler = (resolver: Resolver = () => new Response(null, { status: 204 })) =>
  http.delete(`${API}/tutor/conversations/:id`, resolver);
export const askHandler = (resolver: Resolver) => http.post(`${API}/tutor/messages`, resolver);
export const indexRunsHandler = (resolver: Resolver = () => json([])) =>
  http.get(`${API}/superadmin/tutor/index-runs`, resolver);
export const startIndexRunHandler = (resolver: Resolver) => http.post(`${API}/superadmin/tutor/index-runs`, resolver);
export const usageHandler = (resolver: Resolver) => http.get(`${API}/superadmin/ai-usage/daily`, resolver);
