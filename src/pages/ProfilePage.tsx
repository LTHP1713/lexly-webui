import { Link } from 'react-router-dom';
import { toSessionUser } from '@/api/auth';
import { getCurrentUser } from '@/api/users';
import { useAuth } from '@/auth/AuthContext';
import { ROLE_LABELS } from '@/auth/roles';
import type { SessionUser } from '@/auth/session-store';
import { LockIcon, LogOutIcon, UserIcon } from '@/components/icons/Icons';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useApiQuery } from '@/hooks/useApiQuery';
import styles from './SimplePage.module.css';

/** `/profile` for every role (UI spec F1.5), from a fresh `GET /users/me`. */
export function ProfilePage() {
  const { user: sessionUser, logout } = useAuth();
  const me = useApiQuery('profile:me', async () => toSessionUser(await getCurrentUser()));

  return (
    <>
      <h1 className={styles.title}>Profile</h1>
      <section className={styles.panel} aria-label="Account" aria-busy={me.status === 'loading'}>
        <span className={styles.panelIcon}>
          <UserIcon size={32} />
        </span>
        {me.status === 'success' && <AccountDetails user={me.data} />}
        {me.status === 'loading' && <LoadingState label="Loading your profile" lines={3} />}
        {me.status === 'error' && (
          <>
            <dl className={styles.details}>
              <dt>Email</dt>
              <dd>{sessionUser?.email ?? '—'}</dd>
            </dl>
            <ErrorState error={me.error} onRetry={me.retry} />
          </>
        )}
        <div className={styles.actions}>
          <Link to="/change-password" className={styles.secondaryButton}>
            <LockIcon size={18} />
            Change password
          </Link>
          <button type="button" className={styles.secondaryButton} onClick={() => void logout()}>
            <LogOutIcon size={18} />
            Log out
          </button>
        </div>
      </section>
    </>
  );
}

function AccountDetails({ user }: { user: SessionUser }) {
  const loginIdLabel = user.role === 'C_STUDENT' ? 'Roll no.' : user.role === 'C_PROFESSOR' ? 'Employee ID' : null;
  return (
    <dl className={styles.details}>
      <dt>Name</dt>
      <dd>{user.fullName ?? '—'}</dd>
      <dt>Email</dt>
      <dd>{user.email || '—'}</dd>
      <dt>Role</dt>
      <dd>{user.role ? ROLE_LABELS[user.role] : '—'}</dd>
      {user.college && (
        <>
          <dt>College</dt>
          <dd>
            {user.college.name} ({user.college.code})
          </dd>
        </>
      )}
      {loginIdLabel && (
        <>
          <dt>{loginIdLabel}</dt>
          <dd>{user.loginId ?? '—'}</dd>
        </>
      )}
    </dl>
  );
}
