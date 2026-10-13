import type { ComponentType } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { firstNameFrom } from '@/auth/firstName';
import type { AppLayoutContext } from '@/components/appLayoutContext';
import { BookIcon, ChecklistIcon, HomeIcon, LexlyMark, UserIcon } from '@/components/icons/Icons';
import { NotificationsButton } from '@/components/NotificationsButton';
import { useCurrentUser } from '@/hooks/useHomeData';
import styles from './AppLayout.module.css';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  /** Path prefixes that count as "in" this section. */
  matches: string[];
}

/** Mobile tab bar only — on wider screens the Dashboard is the navigation hub. */
const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Home', icon: HomeIcon, matches: ['/dashboard'] },
  { to: '/acts', label: 'Bare Acts', icon: BookIcon, matches: ['/acts', '/sections'] },
  { to: '/practice', label: 'Practice', icon: ChecklistIcon, matches: ['/practice'] },
  { to: '/profile', label: 'Profile', icon: UserIcon, matches: ['/profile'] },
];

function isActive(item: NavItem, pathname: string) {
  return item.matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Shell for every authenticated screen: skip link, header (brand → Dashboard, greeting,
 * notifications, profile), the `<main>` landmark, and a fixed bottom tab bar below 768px.
 */
export function AppLayout() {
  const { pathname } = useLocation();
  // Dashboard, the act and case law lists (card grids), the section and case law study screens
  // and admin screens use the wide (72rem) layout; other pages stay a reading column.
  const isWide =
    pathname === '/dashboard' ||
    pathname === '/acts' ||
    pathname === '/caselaws' ||
    pathname.startsWith('/sections/') ||
    pathname.startsWith('/caselaws/') ||
    pathname.startsWith('/admin/');
  const { user } = useAuth();
  const currentUser = useCurrentUser();
  // `/users/me` wins once it exists; until then the login/register response supplies the name.
  const profile = currentUser.status === 'success' ? currentUser.data : null;
  const fullName = profile?.fullName?.trim() || user?.fullName || null;
  const firstName = (profile && firstNameFrom(profile)) ?? firstNameFrom({ fullName });

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/dashboard" className={styles.brand} aria-label="Go to dashboard">
            <LexlyMark />
            <span className={styles.brandName}>Lexly</span>
          </Link>
          <div className={styles.actions}>
            <p className={styles.greeting}>
              Hi
              {/* The leading space lives in the span so it hides with the name on very narrow screens. */}
              {fullName && (
                <span className={styles.greetingName} title={fullName}>
                  {` ${fullName}`}
                </span>
              )}
              !
            </p>
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

      <main id="main-content" className={`${styles.main} ${isWide ? styles.mainWide : ''}`} tabIndex={-1}>
        <Outlet context={{ firstName } satisfies AppLayoutContext} />
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
