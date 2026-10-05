import { Link } from 'react-router-dom';
import { ChecklistIcon } from '@/components/icons/Icons';
import styles from './SimplePage.module.css';

/** Placeholder until the practice flow (question banks → attempt → result) is built. */
export function PracticePage() {
  return (
    <>
      <h1 className={styles.title}>Practice</h1>
      <section className={styles.panel} aria-labelledby="practice-soon">
        <span className={styles.panelIcon}>
          <ChecklistIcon size={32} />
        </span>
        <h2 id="practice-soon" className={styles.panelTitle}>
          MCQ practice is coming soon
        </h2>
        <p className={styles.panelText}>
          You’ll be able to practise subject-wise MCQs, see explanations for every answer, and track your accuracy on
          the Home page.
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
