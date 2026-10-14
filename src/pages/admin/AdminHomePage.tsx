import { Link } from 'react-router-dom';
import styles from '@/components/ui.module.css';

const CARDS = [
  { to: '/admin/colleges', title: 'Colleges', text: 'Add colleges and their admins' },
  { to: '/admin/acts', title: 'Content', text: 'Acts, sections, case laws and imports' },
  { to: '/admin/audit', title: 'Audit log', text: 'Who did what, last 30 days' },
];

/** `/admin`: the SUPERADMIN home (UI spec F1.4). F7 adds a Solo practice card. */
export function AdminHomePage() {
  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>Super admin</p>
          <h1 className={styles.title}>Administration</h1>
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
