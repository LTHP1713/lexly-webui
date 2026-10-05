import { useEffect } from 'react';
import {
  getBareActProgress,
  getContinueLearning,
  getCurrentUser,
  getPracticeSummary,
  recordLearningActivity,
  type BareActProgressItem,
  type ContinueLearningItem,
  type CurrentUserDto,
  type LearningContentType,
  type PracticeSummary,
} from '@/api/users';
import { backendFeatures, homeMockMode } from '@/config/features';
import type { HomeMockData } from '@/dev/homeMocks';
import { useApiQuery, type QueryResult } from '@/hooks/useApiQuery';

/**
 * `useApiQuery` plus one extra state: `unavailable` — the backend endpoint doesn't exist yet
 * (its feature flag is off), so nothing is requested. `sample` is true only for dev-only mock
 * data, so the UI can label it.
 */
export type HomeQuery<T> =
  | { status: 'unavailable'; sample: false; retry: () => void }
  | (Exclude<QueryResult<T>, { status: 'idle' }> & { sample: boolean });

function useBackendQuery<T>(
  key: string,
  enabled: boolean,
  fetcher: () => Promise<T>,
  mockKey: keyof HomeMockData,
): HomeQuery<T> {
  // `import.meta.env.DEV` is statically false in production, so the mock module is never bundled.
  const mockMode = import.meta.env.DEV ? homeMockMode : null;
  const requestKey = mockMode ? `${key}:mock:${mockMode}` : enabled ? key : null;
  const result = useApiQuery<T>(requestKey, () => {
    if (import.meta.env.DEV && mockMode) {
      return import('@/dev/homeMocks').then((m) => m.mockFetch(mockMode, mockKey) as Promise<T>);
    }
    return fetcher();
  });

  if (result.status === 'idle') return { status: 'unavailable', sample: false, retry: result.retry };
  return { ...result, sample: mockMode !== null };
}

export function useCurrentUser(): HomeQuery<CurrentUserDto> {
  return useBackendQuery('users/me', backendFeatures.currentUser, getCurrentUser, 'currentUser');
}

export function usePracticeStats(): HomeQuery<PracticeSummary> {
  return useBackendQuery('practice-stats', backendFeatures.practiceStats, getPracticeSummary, 'practice');
}

export function useBareActProgress(): HomeQuery<BareActProgressItem[]> {
  return useBackendQuery('bare-act-progress', backendFeatures.learningProgress, getBareActProgress, 'bareActs');
}

export function useContinueLearning(): HomeQuery<ContinueLearningItem | null> {
  return useBackendQuery(
    'continue-learning',
    backendFeatures.learningProgress,
    getContinueLearning,
    'continueLearning',
  );
}

/**
 * Fire-and-forget: tells the backend a section/case law was opened (feeds Continue Learning and
 * Bare Acts Progress). A failure here must never affect the reading screen, so it is swallowed.
 */
export function useRecordLearningActivity(contentType: LearningContentType, contentId: string | null) {
  useEffect(() => {
    if (!backendFeatures.learningProgress || !contentId) return;
    recordLearningActivity({ contentType, contentId }).catch(() => {});
  }, [contentType, contentId]);
}
