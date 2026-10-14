import { NavLink } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { hasLibrarySubNav } from '@/auth/roles';
import styles from './SubNav.module.css';

export interface SubNavItem {
  to: string;
  label: string;
  /** Exact match only (otherwise the item is also current on its sub-routes). */
  end?: boolean;
}

/** A row of section links under a page's H1; the current one is underlined (`aria-current="page"`). */
export function SubNav({ label, items }: { label: string; items: SubNavItem[] }) {
  return (
    <nav aria-label={label} className={styles.subNav}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.end} className={styles.link}>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const LIBRARY_ITEMS: SubNavItem[] = [
  { to: '/acts', label: 'Bare Acts', end: true },
  { to: '/caselaws', label: 'Case Laws', end: true },
  { to: '/search', label: 'Search', end: true },
];

/**
 * Bare Acts · Case Laws · Search on the Library list pages, for roles whose nav has a single
 * Library item (UI spec F0.3). S_STUDENT reaches these pages through Home and its tab bar instead.
 */
export function LibrarySubNav() {
  const { user } = useAuth();
  if (!hasLibrarySubNav(user?.role ?? null)) return null;
  return <SubNav label="Library" items={LIBRARY_ITEMS} />;
}
