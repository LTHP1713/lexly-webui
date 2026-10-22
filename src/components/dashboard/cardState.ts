import type { ApiError } from '@/api/client';

/** What a dashboard card shows while its data loads or after it failed (UI spec §0.3, UR.3). */
export type CardState = { status: 'loading' } | { status: 'error'; error: ApiError; retry: () => void } | { status: 'ready' };

/**
 * A card state from a `QueryResult`. A background refetch of the same key stays `success` (ready);
 * a new key loads afresh (a skeleton), because the cards read `data` only on success.
 */
export function cardState(query: { status: string; error?: ApiError; retry: () => void }): CardState {
  if (query.status === 'error' && query.error) return { status: 'error', error: query.error, retry: query.retry };
  return query.status === 'success' ? { status: 'ready' } : { status: 'loading' };
}
