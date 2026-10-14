import { Link, NavLink, useLocation } from 'react-router-dom';
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

const CONTENT_ITEMS: { to: string; label: string; matches: string[] }[] = [
  { to: '/admin/acts', label: 'Acts', matches: ['/admin/acts', '/admin/sections'] },
  { to: '/admin/caselaws', label: 'Case laws', matches: ['/admin/caselaws'] },
  { to: '/admin/import', label: 'Import', matches: ['/admin/import'] },
];

/**
 * Acts · Case laws · Import on the SUPERADMIN content pages (UI spec F0.3). The section editor
 * belongs to Acts, so Acts is also current under `/admin/sections/*`.
 */
export function ContentSubNav() {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Content" className={styles.subNav}>
      <ul className={styles.list}>
        {CONTENT_ITEMS.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className={styles.link}
              aria-current={
                item.matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ? 'page' : undefined
              }
            >
              {item.label}
            </Link>
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
