import { Link } from 'react-router-dom';
import { ChecklistIcon } from '@/components/icons/Icons';
import styles from './SimplePage.module.css';

/** S_STUDENT entry point for Solo practice (F7); a placeholder until then. */
export function PracticePage() {
  return (
    <>
      <h1 className={styles.title}>Practice</h1>
      <section className={styles.panel} aria-labelledby="practice-soon">
        <span className={styles.panelIcon}>
          <ChecklistIcon size={32} />
        </span>
        <h2 id="practice-soon" className={styles.panelTitle}>
          Solo practice is coming soon
        </h2>
        <p className={styles.panelText}>
          You’ll get exam-style questions on the subjects you choose, upload your handwritten answers and get marks
          and feedback on each attempt.
        </p>
        <p className={styles.panelText}>Until then, keep reading:</p>
        <div className={styles.actions}>
          <Link to="/acts" className={styles.primaryButton}>
            Browse Bare Acts
          </Link>
          <Link to="/caselaws" className={styles.secondaryButton}>
            Study Case Laws
          </Link>
        </div>
      </section>
    </>
  );
}
