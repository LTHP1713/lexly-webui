import { LexlyMark } from '@/components/brand/Logo';
import styles from './SessionPending.module.css';

/**
 * Neutral screen while the session bootstrap (`/auth/refresh` + `/users/me`) is in flight, so
 * neither protected nor auth routes flash the wrong page. The mark only fades in after a short
 * delay, so a fast restore shows nothing but the background.
 */
export function SessionPending() {
  return (
    <div className={styles.screen} role="status">
      <span className={styles.mark}>
        <LexlyMark size={48} pulse />
      </span>
      <span className={styles.visuallyHidden}>Loading Lexly…</span>
    </div>
  );
}
