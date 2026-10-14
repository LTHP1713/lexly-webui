import { keepPreviousData, useQuery, type QueryKey } from '@tanstack/react-query';
import type { QueryResult } from './useApiQuery';

/**
 * `useApiQuery`'s result shape on top of React Query (plan §3.3, F2.1), so screens keep their
 * loading / stale / error rendering while sharing one cache that mutations can invalidate by
 * prefix (`queryKeys` in `lib/queryClient.ts`). While a new key loads, the previous key's data
 * is returned as `staleData`; a background refetch of the same key keeps showing `success`.
 * `enabled: false` (like a `null` key) is `idle`.
 */
export function useCachedQuery<T>(
  queryKey: QueryKey,
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: { enabled?: boolean } = {},
): QueryResult<T> {
  const enabled = options.enabled ?? true;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetcher(signal),
    enabled,
    placeholderData: keepPreviousData,
  });
  const retry = () => void query.refetch();

  if (!enabled) return { status: 'idle', retry };
  // A retry after an error keeps `status: 'error'` while it runs; show it as loading instead.
  if (query.isError && !query.isFetching) return { status: 'error', error: query.error, retry };
  if (query.isPlaceholderData || query.data === undefined) {
    return { status: 'loading', staleData: query.data, retry };
  }
  return { status: 'success', data: query.data, retry };
}
