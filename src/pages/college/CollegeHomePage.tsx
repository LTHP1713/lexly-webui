import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { CourthouseIcon } from '@/components/icons/Icons';
import styles from '@/pages/SimplePage.module.css';

/** `/college`: the C_ADMIN home, a placeholder until F2 (users, subjects) and F6.3 (overview). */
export function CollegeHomePage() {
  const { user } = useAuth();
  const college = user?.college;
  return (
    <>
      <h1 className={styles.title}>{college ? `${college.name} (${college.code})` : 'Your college'}</h1>
      <section className={styles.panel} aria-labelledby="college-soon">
        <span className={styles.panelIcon}>
          <CourthouseIcon size={32} />
        </span>
        <h2 id="college-soon" className={styles.panelTitle}>
          User and subject management is coming soon.
        </h2>
        <p className={styles.panelText}>Meanwhile, you can review sign-ins and changes for your college.</p>
        <div className={styles.actions}>
          <Link to="/college/audit" className={styles.primaryButton}>
            Open the audit log
          </Link>
          <Link to="/acts" className={styles.secondaryButton}>
            Open the Library
          </Link>
        </div>
      </section>
    </>
  );
}
