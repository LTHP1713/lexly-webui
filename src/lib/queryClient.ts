/**
 * React Query setup (plan §3.3, D1). Screens with mutations that must refresh other views use
 * `useQuery` / `useMutation` with the keys from `queryKeys`, and a save invalidates by prefix.
 * The HTTP cache modes (`no-cache` in dev, `reload` after a sign-out) stay in `client.ts` and
 * apply underneath unchanged.
 */
import { QueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/api/client';
import { sessionStore } from '@/auth/session-store';

declare module '@tanstack/react-query' {
  interface Register {
    /** `apiClient` turns every failure into an `ApiError`. */
    defaultError: ApiError;
  }
}

/**
 * No automatic retries (a 404 or a validation error won't change, and `ErrorState` has Try
 * again) and no refetch on window focus, as with `useApiQuery`. Data is refetched whenever a
 * screen mounts, so returning to a list always shows the server's current state.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Drops every cached response when the signed-in user changes or signs out, so the next user on
 * this tab never sees the previous user's data (plan §9). Returns the unsubscribe function.
 */
export function clearOnUserChange(client: QueryClient): () => void {
  let userId = sessionStore.getSnapshot().user?.id ?? null;
  return sessionStore.subscribe(() => {
    const next = sessionStore.getSnapshot().user?.id ?? null;
    if (next !== userId) {
      userId = next;
      client.clear();
    }
  });
}

/**
 * Query keys mirror the API paths, so a mutation can invalidate a whole area by prefix
 * (`queryKeys.collegeUsers.all` refreshes every user list and detail).
 */
export const queryKeys = {
  colleges: {
    all: ['superadmin', 'colleges'] as const,
    list: (filters: object) => ['superadmin', 'colleges', 'list', filters] as const,
    detail: (id: string) => ['superadmin', 'colleges', 'detail', id] as const,
    admins: (id: string) => ['superadmin', 'colleges', 'detail', id, 'admins'] as const,
  },
  adminActs: {
    all: ['admin', 'acts'] as const,
    list: ['admin', 'acts', 'list'] as const,
    detail: (id: string) => ['admin', 'acts', 'detail', id] as const,
    sections: (actId: string) => ['admin', 'acts', 'detail', actId, 'sections'] as const,
  },
  adminCaseLaws: {
    list: (filters: object) => ['admin', 'caselaws', 'list', filters] as const,
  },
  audit: {
    list: (filters: object) => ['audit', filters] as const,
  },
  collegeUsers: {
    all: ['college', 'users'] as const,
    /** Every list but no detail, so a removed user's open detail isn't refetched into a 404. */
    lists: ['college', 'users', 'list'] as const,
    list: (filters: object) => ['college', 'users', 'list', filters] as const,
    detail: (id: string) => ['college', 'users', 'detail', id] as const,
  },
  subjects: {
    all: ['college', 'subjects'] as const,
    lists: ['college', 'subjects', 'list'] as const,
    list: (q: string) => ['college', 'subjects', 'list', q] as const,
    detail: (id: string) => ['college', 'subjects', 'detail', id] as const,
  },
  professorAssessments: {
    all: ['professor', 'assessments'] as const,
    lists: ['professor', 'assessments', 'list'] as const,
    list: (filters: object) => ['professor', 'assessments', 'list', filters] as const,
    /** The assessment and, under it, its submissions grid. */
    detail: (id: string) => ['professor', 'assessments', 'detail', id] as const,
    answers: (id: string, filters: object) => ['professor', 'assessments', 'detail', id, 'answers', filters] as const,
  },
  professorAnswers: {
    all: ['professor', 'answers'] as const,
    /** One answer's review; the order changes only `navigation`. */
    detail: (id: string, order: string) => ['professor', 'answers', id, order] as const,
    byId: (id: string) => ['professor', 'answers', id] as const,
  },
  studentAssessments: {
    all: ['student', 'assessments'] as const,
    lists: ['student', 'assessments', 'list'] as const,
    list: (filters: object) => ['student', 'assessments', 'list', filters] as const,
    detail: (id: string) => ['student', 'assessments', 'detail', id] as const,
    /** Under the detail, so refreshing an assessment refreshes its results too. */
    results: (id: string) => ['student', 'assessments', 'detail', id, 'results'] as const,
  },
  library: {
    acts: ['library', 'acts'] as const,
    caseLawCount: ['library', 'caselaws', 'count'] as const,
  },
  tutor: {
    quota: ['tutor', 'quota'] as const,
    conversations: ['tutor', 'conversations'] as const,
    conversation: (id: string) => ['tutor', 'conversation', id] as const,
    indexRuns: ['superadmin', 'tutor', 'index-runs'] as const,
    usage: (filters: object) => ['superadmin', 'ai-usage', filters] as const,
  },
} as const;
