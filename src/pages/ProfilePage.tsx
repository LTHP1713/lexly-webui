import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { LockIcon, LogOutIcon, UserIcon } from '@/components/icons/Icons';
import styles from './SimplePage.module.css';

/** Shows only what the session actually knows — no invented profile fields. */
export function ProfilePage() {
  const { user, logout } = useAuth();

  return (
    <>
      <h1 className={styles.title}>Profile</h1>
      <section className={styles.panel} aria-label="Account">
        <span className={styles.panelIcon}>
          <UserIcon size={32} />
        </span>
        <dl className={styles.details}>
          <dt>Email</dt>
          <dd>{user?.email ?? '—'}</dd>
        </dl>
        <div className={styles.actions}>
          <Link to="/change-password" className={styles.secondaryButton}>
            <LockIcon size={18} />
            Change password
          </Link>
          <button type="button" className={styles.secondaryButton} onClick={() => void logout()}>
            <LogOutIcon size={18} />
            Log Out
          </button>
        </div>
      </section>
    </>
  );
}
