import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';

type SettledState<T> = { status: 'success'; data: T } | { status: 'error'; error: ApiError };

export type QueryResult<T> = (
  | { status: 'idle' }
  /** `staleData` is the last successful result (possibly for a previous key), if any. */
  | { status: 'loading'; staleData?: T }
  | SettledState<T>
) & { retry: () => void };

function toApiError(err: unknown): ApiError {
  return err instanceof ApiError
    ? err
    : new ApiError('UNKNOWN_ERROR', 'Something went wrong. Please try again.', 0);
}

/**
 * Runs `fetcher` whenever `key` changes (a `null` key means "don't fetch") and exposes
 * loading/success/error state. `fetcher` must be fully determined by `key`: a new inline
 * function each render does not refetch. Responses for a superseded key are dropped.
 */
export function useApiQuery<T>(key: string | null, fetcher: () => Promise<T>): QueryResult<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: SettledState<T> } | null>(null);
  const requestKey = key === null ? null : `${attempt}:${key}`;

  // Layout effects run before effects, so the fetch below always sees this render's fetcher.
  const fetcherRef = useRef(fetcher);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    if (requestKey === null) return;
    let ignore = false;
    fetcherRef.current().then(
      (data) => {
        if (!ignore) setResult({ key: requestKey, state: { status: 'success', data } });
      },
      (err: unknown) => {
        if (!ignore) setResult({ key: requestKey, state: { status: 'error', error: toApiError(err) } });
      },
    );
    return () => {
      ignore = true;
    };
  }, [requestKey]);

  const retry = () => setAttempt((n) => n + 1);

  if (requestKey === null) return { status: 'idle', retry };
  if (!result || result.key !== requestKey) {
    const staleData = result?.state.status === 'success' ? result.state.data : undefined;
    return { status: 'loading', staleData, retry };
  }
  return { ...result.state, retry };
}
