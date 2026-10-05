import { useAuth } from '@/auth/AuthContext';
import { LogOutIcon, UserIcon } from '@/components/icons/Icons';
import styles from './SimplePage.module.css';

/** Shows only what the session actually knows (the login email) — no invented profile fields. */
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
        <button type="button" className={styles.secondaryButton} onClick={logout}>
          <LogOutIcon size={18} />
          Log Out
        </button>
      </section>
    </>
  );
}
