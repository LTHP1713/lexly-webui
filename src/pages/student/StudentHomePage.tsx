import { Link } from 'react-router-dom';
import { ChecklistIcon } from '@/components/icons/Icons';
import styles from '@/pages/SimplePage.module.css';

/** `/student`: the C_STUDENT home, a placeholder until assessments ship (F3). */
export function StudentHomePage() {
  return (
    <>
      <h1 className={styles.title}>Assessments</h1>
      <section className={styles.panel} aria-label="Coming soon">
        <span className={styles.panelIcon}>
          <ChecklistIcon size={32} />
        </span>
        <p className={styles.panelText}>Your assessments will appear here. Meanwhile, the Library is open to you.</p>
        <div className={styles.actions}>
          <Link to="/acts" className={styles.primaryButton}>
            Open the Library
          </Link>
        </div>
      </section>
    </>
  );
}
