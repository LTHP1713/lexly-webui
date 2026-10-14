import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import styles from '@/components/ui.module.css';

const CARDS = [
  { to: '/college/users', title: 'Users', text: 'Students and professors, one at a time or from a file' },
  { to: '/college/subjects', title: 'Subjects', text: 'What your college teaches, and who teaches it' },
  { to: '/college/audit', title: 'Audit log', text: 'Who did what, last 30 days' },
];

/** `/college`: the C_ADMIN home (UI spec F2 shell changes). F6.3 adds the overview. */
export function CollegeHomePage() {
  const { user } = useAuth();
  const college = user?.college;
  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>College admin</p>
          <h1 className={styles.title}>{college?.name ?? 'Your college'}</h1>
          {college && (
            <p className={styles.detailFacts}>
              <span className={styles.codeChip}>{college.code}</span>
            </p>
          )}
        </div>
      </div>
      <ul className={styles.linkCards}>
        {CARDS.map((card) => (
          <li key={card.to}>
            <Link to={card.to} className={styles.linkCard}>
              <span className={styles.linkCardTitle}>{card.title}</span>
              <span className={styles.hint}>{card.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
