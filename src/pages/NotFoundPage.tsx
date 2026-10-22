import { Link, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { CHANGE_PASSWORD_PATH, homeFor } from '@/auth/roles';
import { SessionPending } from '@/auth/SessionPending';
import { AppLayout } from '@/components/AppLayout';
import { Maxim } from '@/components/brand/Maxim';
import { AlertIcon } from '@/components/icons/Icons';
import { AuthLayout } from '@/pages/auth/AuthLayout';
import styles from './SimplePage.module.css';

/**
 * "Page not found" (UI spec F0.3). Also what an out-of-scope id looks like, since the server
 * answers those with 404 by design, so it never hints that something exists.
 */
export function NotFoundPage() {
  const { status, user } = useAuth();
  const signedIn = status === 'authenticated';
  return (
    <>
      <h1 className={styles.title}>Page not found</h1>
      <section className={styles.panel} aria-label="Page not found">
        <span className={styles.panelIcon}>
          <AlertIcon size={32} />
        </span>
        <Maxim latin="Ignorantia juris non excusat." meaning="Ignorance of the law is no excuse. A missing page, though, is excused." />
        <p className={styles.panelText}>This page doesn&rsquo;t exist, or you don&rsquo;t have access to it.</p>
        <div className={styles.actions}>
          <Link to={signedIn ? homeFor(user?.role ?? null) : '/login'} className={styles.primaryButton}>
            {signedIn ? 'Go to my home' : 'Sign in'}
          </Link>
        </div>
      </section>
    </>
  );
}

/** Frame for unknown URLs: the app shell when signed in, the auth layout when signed out. */
export function NotFoundFrame() {
  const { status, user } = useAuth();
  if (status === 'loading') return <SessionPending />;
  if (status === 'authenticated') {
    return user?.mustChangePassword ? <Navigate to={CHANGE_PASSWORD_PATH} replace /> : <AppLayout />;
  }
  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  );
}
