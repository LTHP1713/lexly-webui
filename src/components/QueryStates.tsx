import type { ApiError } from '@/api/client';
import styles from './QueryStates.module.css';

/** Skeleton placeholder shown while a request is in flight; announced once to screen readers. */
export function LoadingState({ label, lines = 4 }: { label: string; lines?: number }) {
  return (
    <div role="status" className={styles.loading}>
      <span className={styles.visuallyHidden}>{label}…</span>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={styles.skeleton} aria-hidden="true" />
      ))}
    </div>
  );
}

/** Readable failure message built from the response's `message` field — never raw response JSON. */
export function ErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div role="alert" className={styles.error}>
      <p className={styles.errorMessage}>{error.message || 'Something went wrong. Please try again.'}</p>
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
