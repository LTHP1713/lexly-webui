import styles from './Content.module.css';

/** Lock icon + visible "Pro" label (not colour alone), with fuller wording for screen readers. */
export function ProBadge() {
  return (
    <span className={styles.badge}>
      <svg
        className={styles.lockIcon}
        viewBox="0 0 16 16"
        width="12"
        height="12"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M4 7V5a4 4 0 1 1 8 0v2h.5A1.5 1.5 0 0 1 14 8.5v5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5v-5A1.5 1.5 0 0 1 3.5 7H4Zm2 0h4V5a2 2 0 1 0-4 0v2Z"
        />
      </svg>
      <span className={styles.visuallyHidden}>Locked, requires </span>
      Pro
    </span>
  );
}
