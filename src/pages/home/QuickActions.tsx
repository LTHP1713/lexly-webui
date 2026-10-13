import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, BookIcon, ChecklistIcon, CourthouseIcon } from '@/components/icons/Icons';
import styles from './Home.module.css';

const ACTIONS: { to: string; title: string; description: string; icon: ComponentType<{ size?: number }> }[] = [
  { to: '/acts', title: 'Bare Acts', description: 'Read Acts & provisions', icon: BookIcon },
  { to: '/caselaws', title: 'Case Laws', description: 'Study landmark judgments', icon: CourthouseIcon },
  { to: '/practice', title: 'Practice', description: 'Solo practice, coming soon', icon: ChecklistIcon },
];

export function QuickActions() {
  return (
    <nav aria-label="Study" className={styles.quickActions}>
      <ul className={styles.quickList}>
        {ACTIONS.map(({ to, title, description, icon: ActionIcon }) => (
          <li key={to}>
            <Link to={to} className={styles.quickCard}>
              <span className={styles.quickIcon}>
                <ActionIcon size={26} />
              </span>
              <span className={styles.quickText}>
                <span className={styles.quickTitle}>{title}</span>
                <span className={styles.quickDescription}>{description}</span>
              </span>
              <ArrowRightIcon size={18} className={styles.quickArrow} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
