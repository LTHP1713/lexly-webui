import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { UserSummary } from '@/api/colleges';
import { LOGIN_ID_LABELS, getCollegeUser, kindOf } from '@/api/collegeUsers';
import { hasCode } from '@/api/errors';
import { listSubjects } from '@/api/subjects';
import { ROLE_LABELS } from '@/auth/roles';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { RemoveUserDialog, ResetUserPasswordDialog, UserFormDialog } from './userDialogs';
import { SignInBadge } from './UsersPage';
import styles from '@/components/ui.module.css';

/**
 * `/college/users/:userId` (UI spec F2.2). Another college's user, a C_ADMIN or a removed user
 * is a `404` and shows Not Found (contract §0.1), never "no access".
 */
export function UserDetailPage() {
  const { userId = '' } = useParams();
  const query = useCachedQuery(queryKeys.collegeUsers.detail(userId), () => getCollegeUser(userId));

  if (query.status === 'error' && hasCode(query.error, 'NOT_FOUND')) return <NotFoundPage />;
  const user = query.status === 'success' ? query.data : null;
  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to={user && kindOf(user.role) === 'professors' ? '/college/users?role=professors' : '/college/users'}>
          Users
        </Link>
        {user && <span aria-current="page"> / {user.loginId ?? user.fullName}</span>}
      </nav>
      {query.status === 'loading' && (
        <>
          <h1 className={styles.title}>Loading user…</h1>
          <LoadingState label="Loading user" />
        </>
      )}
      {query.status === 'error' && (
        <>
          <h1 className={styles.title}>User unavailable</h1>
          <ErrorState error={query.error} onRetry={query.retry} />
        </>
      )}
      {user && <UserDetail user={user} />}
    </>
  );
}

function UserDetail({ user }: { user: UserSummary }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const kind = kindOf(user.role);

  return (
    <>
      <header className={styles.detailHeader}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>{user.fullName ?? user.loginId ?? 'Unnamed user'}</h1>
            <p className={styles.detailFacts}>
              <span>{user.role ? ROLE_LABELS[user.role] : 'User'}</span>
              {user.loginId && <span className={styles.codeChip}>{user.loginId}</span>}
              <SignInBadge user={user} />
              <span>Added {formatDate(user.createdAt)}</span>
            </p>
          </div>
          <div className={styles.headerLinks}>
            <button type="button" className={styles.secondaryButton} onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => setResetting(true)}>
              Reset password
            </button>
            <button type="button" className={styles.dangerButton} onClick={() => setRemoving(true)}>
              Remove
            </button>
          </div>
        </div>
      </header>

      <section className={styles.editorSection} aria-labelledby="user-details-title">
        <h2 id="user-details-title" className={styles.editorSectionTitle}>
          Details
        </h2>
        <dl className={styles.detailList}>
          <dt>Email</dt>
          <dd>{user.email ?? '—'}</dd>
          <dt>{LOGIN_ID_LABELS[kind]}</dt>
          <dd className={styles.mono}>{user.loginId ?? '—'}</dd>
        </dl>
      </section>

      {kind === 'professors' && <ProfessorSubjects professorId={user.id} />}

      <UserFormDialog target={editing ? { mode: 'edit', user } : null} onClose={() => setEditing(false)} />
      <ResetUserPasswordDialog user={resetting ? user : null} onClose={() => setResetting(false)} />
      <RemoveUserDialog
        user={removing ? user : null}
        onClose={() => setRemoving(false)}
        onRemoved={() => navigate(kind === 'professors' ? '/college/users?role=professors' : '/college/users')}
      />
    </>
  );
}

/** The subjects this professor is mapped to, from the college's subject list. */
function ProfessorSubjects({ professorId }: { professorId: string }) {
  const subjects = useCachedQuery(queryKeys.subjects.list(''), (signal) => listSubjects(undefined, signal));
  const mine =
    subjects.status === 'success' ? subjects.data.filter((s) => s.professors.some((p) => p.id === professorId)) : [];

  return (
    <section className={`${styles.editorSection} ${styles.listSection}`} aria-labelledby="user-subjects-title">
      <h2 id="user-subjects-title" className={styles.editorSectionTitle}>
        Subjects
      </h2>
      {subjects.status === 'loading' && <LoadingState label="Loading subjects" lines={2} />}
      {subjects.status === 'error' && <ErrorState error={subjects.error} onRetry={subjects.retry} />}
      {subjects.status === 'success' &&
        (mine.length === 0 ? (
          <EmptyState>Not assigned to any subject yet.</EmptyState>
        ) : (
          <ul className={styles.plainList}>
            {mine.map((subject) => (
              <li key={subject.id}>
                <Link to={`/college/subjects/${subject.id}`}>{subject.name}</Link>{' '}
                <span className={`${styles.hint} ${styles.mono}`}>{subject.code}</span>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
