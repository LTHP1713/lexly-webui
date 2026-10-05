import type { ComponentType } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { BookIcon, ChecklistIcon, HomeIcon, LexlyMark, UserIcon } from '@/components/icons/Icons';
import { NotificationsButton } from '@/components/NotificationsButton';
import styles from './AppLayout.module.css';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  /** Path prefixes that count as "in" this section. */
  matches: string[];
}

/** "Subjects" points at Bare Acts until the Subjects feature exists. */
const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Home', icon: HomeIcon, matches: ['/dashboard'] },
  { to: '/acts', label: 'Subjects', icon: BookIcon, matches: ['/acts', '/sections'] },
  { to: '/practice', label: 'Practice', icon: ChecklistIcon, matches: ['/practice'] },
  { to: '/profile', label: 'Profile', icon: UserIcon, matches: ['/profile'] },
];

function isActive(item: NavItem, pathname: string) {
  return item.matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Shell for every authenticated screen: skip link, header (brand, desktop nav, notifications,
 * profile), the `<main>` landmark, and a fixed bottom tab bar below 768px. The two navs are
 * never visible at once (`display: none` also hides the inactive one from assistive tech).
 */
export function AppLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/dashboard';

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/dashboard" className={styles.brand} aria-label="Lexly home">
            <LexlyMark />
            <span className={styles.brandName}>Lexly</span>
          </Link>
          <nav aria-label="Primary" className={styles.topNav}>
            <ul className={styles.topNavList}>
              {NAV_ITEMS.filter((item) => item.to !== '/profile').map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={styles.topNavLink}
                    aria-current={isActive(item, pathname) ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.actions}>
            <NotificationsButton />
            <Link
              to="/profile"
              className={styles.avatar}
              aria-label="Profile"
              aria-current={pathname === '/profile' ? 'page' : undefined}
            >
              <UserIcon size={20} />
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" className={`${styles.main} ${isHome ? styles.mainWide : ''}`} tabIndex={-1}>
        <Outlet />
      </main>

      <nav aria-label="Primary" className={styles.bottomNav}>
        <ul className={styles.bottomNavList}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item, pathname);
            const ItemIcon = item.icon;
            return (
              <li key={item.to}>
                <Link to={item.to} className={styles.bottomNavLink} aria-current={active ? 'page' : undefined}>
                  <ItemIcon size={22} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
