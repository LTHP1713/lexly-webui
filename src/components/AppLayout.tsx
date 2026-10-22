import { Suspense, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { LexlyMark, LexlyWordmark } from '@/components/brand/Logo';
import { CHANGE_PASSWORD_PATH, homeFor, isNavItemActive, navFor, sidebarFor, type NavItem } from '@/auth/roles';
import { ChevronLeftIcon, ChevronRightIcon, LogOutIcon, SearchIcon } from '@/components/icons/Icons';
import { useFlash } from '@/components/flash';
import { NotificationsButton } from '@/components/NotificationsButton';
import { LoadingState } from '@/components/QueryStates';
import { useToast } from '@/components/Toast';
import styles from './AppLayout.module.css';

/** Wide (72rem) layout: card grids, study screens and the work areas; other pages stay a reading column. */
function isWidePath(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname === '/acts' ||
    pathname === '/caselaws' ||
    pathname.startsWith('/sections/') ||
    pathname.startsWith('/caselaws/') ||
    pathname === '/admin' ||
    pathname === '/college' ||
    (pathname.startsWith('/college/') && pathname !== '/college/users/import') ||
    pathname.startsWith('/admin/') ||
    pathname === '/professor' ||
    pathname.startsWith('/professor/') ||
    pathname === '/student' ||
    pathname === '/tutor' ||
    pathname.startsWith('/tutor/')
  );
}

/** The sidebar's collapsed / expanded choice: a per-browser UI preference, never session data. */
const SIDEBAR_KEY = 'lexly.sidebar';

function readSidebarExpanded(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'expanded';
  } catch {
    return false;
  }
}

function writeSidebarExpanded(expanded: boolean) {
  try {
    localStorage.setItem(SIDEBAR_KEY, expanded ? 'expanded' : 'collapsed');
  } catch {
    // Storage unavailable: the choice lasts until reload.
  }
}

/** "Asha Rao" → "AR"; one letter for a single name. */
function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.length === 0 ? '' : (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/**
 * Shell for every authenticated screen (UI spec UR.2). From 768 px: a pale page with a black frame
 * holding the collapsible sidebar (the role's home and nav, the collapse toggle and Log out) and a
 * white panel with a top bar (context, Library search, notifications, profile) above the page.
 * Below 768 px: a top bar and a floating bottom tab bar with at most 5 items. While the password
 * must be changed there is no nav, and the top bar offers only Log out (UI spec F1.2).
 */
export function AppLayout() {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const toast = useToast();
  useFlash(toast.show);
  const [expanded, setExpanded] = useState(readSidebarExpanded);
  const forced = user?.mustChangePassword === true;
  const role = user?.role ?? null;
  const sideItems = forced ? [] : sidebarFor(role);
  const tabItems = forced ? [] : navFor(role);
  const home = forced ? CHANGE_PASSWORD_PATH : homeFor(role);
  // College roles see their college; SUPERADMIN pages already say "Super admin" above the H1.
  const context = user?.college?.name ?? '';

  function toggleSidebar() {
    setExpanded((current) => {
      writeSidebarExpanded(!current);
      return !current;
    });
  }

  return (
    <div className={styles.shell}>
      <a href="#main-content" className={styles.skipLink}>
        Skip to content
      </a>
      <div className={styles.frame}>
        {sideItems.length > 0 && (
          <nav aria-label="Primary" className={`${styles.sidebar} ${expanded ? styles.sidebarExpanded : ''}`}>
            <div className={styles.sidebarTop}>
              <Link to={home} className={styles.brand} aria-label="Lexly home">
                {expanded ? (
                  <span className={styles.brandText}>
                    <LexlyWordmark size="1.85rem" />
                    {user?.college?.code && <span className={styles.brandSub}>{user.college.code}</span>}
                  </span>
                ) : (
                  <LexlyMark size="3rem" />
                )}
              </Link>
              <ul className={styles.sideList}>
                {sideItems.map((item) => (
                  <li key={item.to}>
                    <SideLink item={item} expanded={expanded} active={isNavItemActive(item, pathname)} />
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.sidebarBottom}>
              <button
                type="button"
                className={styles.sideButton}
                onClick={toggleSidebar}
                aria-expanded={expanded}
                title={expanded ? undefined : 'Expand sidebar'}
              >
                {expanded ? <ChevronLeftIcon size={22} /> : <ChevronRightIcon size={22} />}
                <span className={expanded ? styles.sideLabel : styles.visuallyHidden}>
                  {expanded ? 'Collapse sidebar' : 'Expand sidebar'}
                </span>
              </button>
              <button
                type="button"
                className={styles.sideButton}
                onClick={() => void logout()}
                title={expanded ? undefined : 'Log out'}
              >
                <LogOutIcon size={22} />
                <span className={expanded ? styles.sideLabel : styles.visuallyHidden}>Log out</span>
              </button>
            </div>
          </nav>
        )}

        <div className={styles.panel}>
          <header className={styles.topBar}>
            <Link to={home} className={styles.phoneBrand} aria-label="Lexly home">
              <LexlyWordmark size="1.6rem" />
            </Link>
            {context && <p className={styles.context}>{context}</p>}
            <div className={styles.actions}>
              {forced ? (
                <button type="button" className={styles.logout} onClick={() => void logout()}>
                  <LogOutIcon size={18} />
                  Log out
                </button>
              ) : (
                <>
                  <Link to="/search" className={styles.roundButton} aria-label="Search the library">
                    <SearchIcon size={20} />
                  </Link>
                  <NotificationsButton />
                  <Link
                    to="/profile"
                    className={styles.profile}
                    aria-label={user?.fullName ? `Profile: ${user.fullName}` : 'Profile'}
                    aria-current={pathname === '/profile' ? 'page' : undefined}
                  >
                    <span className={styles.initials} aria-hidden="true">
                      {initials(user?.fullName) || '·'}
                    </span>
                    {user?.fullName && (
                      <span className={styles.profileName} title={user.fullName}>
                        {user.fullName}
                      </span>
                    )}
                  </Link>
                </>
              )}
            </div>
          </header>

          <main
            id="main-content"
            className={`${styles.main} ${isWidePath(pathname) ? styles.mainWide : ''} ${tabItems.length === 0 ? styles.mainNoTabs : ''}`}
            tabIndex={-1}
          >
            <Suspense fallback={<LoadingState label="Loading page" />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>

      {tabItems.length > 0 && (
        <nav aria-label="Primary" className={styles.bottomNav}>
          <ul className={styles.bottomNavList} style={{ gridTemplateColumns: `repeat(${tabItems.length}, 1fr)` }}>
            {tabItems.map((item) => {
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

/** A sidebar item: icon only when collapsed (the label stays its accessible name), icon + label when expanded. */
function SideLink({ item, expanded, active }: { item: NavItem; expanded: boolean; active: boolean }) {
  const ItemIcon = item.icon;
  return (
    <Link
      to={item.to}
      className={styles.sideLink}
      aria-current={active ? 'page' : undefined}
      title={expanded ? undefined : item.label}
    >
      <ItemIcon size={22} />
      <span className={expanded ? styles.sideLabel : styles.visuallyHidden}>{item.label}</span>
    </Link>
  );
}
