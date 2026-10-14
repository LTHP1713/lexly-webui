import styles from './ui.module.css';

/**
 * Previous / Next for a `PagedResponse`. `page` is 0-based (the wire value); callers keep it
 * 1-based in the URL. Renders nothing for a single page.
 */
export function Pagination({
  label,
  page,
  totalPages,
  onChange,
}: {
  /** e.g. "College pages". */
  label: string;
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={label} className={styles.pagination}>
      <button type="button" className={styles.secondaryButton} onClick={() => onChange(page - 1)} disabled={page <= 0}>
        ← Previous
      </button>
      <span className={styles.hint}>
        Page {page + 1} of {totalPages}
      </span>
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages - 1}
      >
        Next →
      </button>
    </nav>
  );
}

