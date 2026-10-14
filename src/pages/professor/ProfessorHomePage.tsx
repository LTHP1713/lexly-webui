import { Link } from 'react-router-dom';
import { ChecklistIcon } from '@/components/icons/Icons';
import { SubjectCards } from '@/components/SubjectCards';
import styles from '@/pages/SimplePage.module.css';

/** `/professor`: the C_PROFESSOR home, a placeholder until assessments ship (F3), plus "My subjects" (F2.8). */
export function ProfessorHomePage() {
  return (
    <>
      <h1 className={styles.title}>Assessments</h1>
      <section className={styles.panel} aria-label="Coming soon">
        <span className={styles.panelIcon}>
          <ChecklistIcon size={32} />
        </span>
        <p className={styles.panelText}>Assessments are coming soon. Meanwhile, the Library is open to you.</p>
        <div className={styles.actions}>
          <Link to="/acts" className={styles.primaryButton}>
            Open the Library
          </Link>
        </div>
      </section>
      <SubjectCards
        title="My subjects"
        emptyText="You haven't been assigned any subjects yet. Your college admin assigns them."
        showProfessors
      />
    </>
  );
}
