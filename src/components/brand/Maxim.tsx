import styles from './Maxim.module.css';

/**
 * A Latin legal maxim with its plain-English meaning: part of Lexly's voice on quiet screens
 * (not found, grading). `lang="la"` so screen readers don't read the Latin as English.
 */
export function Maxim({ latin, meaning }: { latin: string; meaning: string }) {
  return (
    <p className={styles.maxim}>
      <span lang="la" className={styles.latin}>
        {latin}
      </span>{' '}
      <span className={styles.meaning}>{meaning}</span>
    </p>
  );
}
