import { Suspense, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { CHANGE_PASSWORD_PATH, homeFor, isNavItemActive, navFor } from '@/auth/roles';
import { LexlyMark, LogOutIcon, UserIcon } from '@/components/icons/Icons';
import { NotificationsButton } from '@/components/NotificationsButton';
import { LoadingState } from '@/components/QueryStates';
import { useToast } from '@/components/Toast';
import styles from './AppLayout.module.css';

/** Router state any screen can pass when navigating, to show a toast on arrival ("Password updated."). */
export interface FlashState {
  flash?: string;
}

/** Wide (72rem) layout: card grids, study screens and the work areas; other pages stay a reading column. */
function isWidePath(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname === '/acts' ||
    pathname === '/caselaws' ||
    pathname.startsWith('/sections/') ||
    pathname.startsWith('/caselaws/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  );
}

/**
 * Shell for every authenticated screen: skip link, header (brand → role home, role nav from
 * 768px, greeting, notifications, profile), the `<main>` landmark, and the same nav as a fixed
 * bottom tab bar below 768px. While the password must be changed, the nav, greeting and profile
 * are hidden and the header offers only Log out (UI spec F1.2).
 */
export function AppLayout() {
  const { pathname, search, hash, state } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const toast = useToast();
  const showToast = toast.show;
  const forced = user?.mustChangePassword === true;
  const role = user?.role ?? null;
  const navItems = forced ? [] : navFor(role);

  const flash = (state as FlashState | null)?.flash;
  useEffect(() => {
    if (!flash) return;
    showToast(flash);
    // Show it once: drop it from history so Back/reload don't repeat it.
    navigate({ pathname, search, hash }, { replace: true, state: null });
  }, [flash, pathname, search, hash, navigate, showToast]);

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to={forced ? CHANGE_PASSWORD_PATH : homeFor(role)} className={styles.brand} aria-label="Lexly home">
            <LexlyMark />
            <span className={styles.brandName}>Lexly</span>
          </Link>

          {navItems.length > 0 && (
            <nav aria-label="Primary" className={styles.headerNav}>
              <ul className={styles.headerNavList}>
                {navItems.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={styles.headerNavLink}
                      aria-current={isNavItemActive(item, pathname) ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <div className={styles.actions}>
            {forced ? (
              <button type="button" className={styles.logout} onClick={() => void logout()}>
                <LogOutIcon size={18} />
                Log out
              </button>
            ) : (
              <>
                <p className={styles.greeting}>
                  Hi
                  {/* The leading space lives in the span so it hides with the name on very narrow screens. */}
                  {user?.fullName && (
                    <span className={styles.greetingName} title={user.fullName}>
                      {` ${user.fullName}`}
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
              </>
            )}
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className={`${styles.main} ${isWidePath(pathname) ? styles.mainWide : ''} ${navItems.length === 0 ? styles.mainNoTabs : ''}`}
        tabIndex={-1}
      >
        <Suspense fallback={<LoadingState label="Loading page" />}>
          <Outlet />
        </Suspense>
      </main>

      {navItems.length > 0 && (
        <nav aria-label="Primary" className={styles.bottomNav}>
          <ul className={styles.bottomNavList} style={{ gridTemplateColumns: `repeat(${navItems.length}, 1fr)` }}>
            {navItems.map((item) => {
              const ItemIcon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={styles.bottomNavLink}
                    aria-current={isNavItemActive(item, pathname) ? 'page' : undefined}
                  >
                    <ItemIcon size={22} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
      {toast.element}
    </div>
  );
}
