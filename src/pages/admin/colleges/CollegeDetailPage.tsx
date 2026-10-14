import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getCollege, listCollegeAdmins, removeAdmin, updateCollege, type College, type UserSummary } from '@/api/colleges';
import { errorMessage, hasCode } from '@/api/errors';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { RowMenu } from '@/components/RowMenu';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/components/Toast';
import { useApiQuery } from '@/hooks/useApiQuery';
import { formatCount, formatDate } from '@/lib/format';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { AddAdminDialog, EditCollegeNameDialog, ResetPasswordDialog } from './collegeDialogs';
import styles from '@/components/ui.module.css';

/** Tabs whose phase has shipped (UI spec F1.6). F3.9 adds Assessments, F5.5 AI usage. */
const TABS = [{ id: 'admins', label: 'Admins' }] as const;

/** `/admin/colleges/:collegeId`. */
export function CollegeDetailPage() {
  const { collegeId = '' } = useParams();
  const query = useApiQuery(`college:${collegeId}`, () => getCollege(collegeId));

  if (query.status === 'error' && hasCode(query.error, 'NOT_FOUND')) return <NotFoundPage />;
  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/admin/colleges">Colleges</Link>
        {query.status === 'success' && <span aria-current="page"> / {query.data.code}</span>}
      </nav>
      {query.status === 'loading' && (
        <>
          <h1 className={styles.title}>Loading college…</h1>
          <LoadingState label="Loading college" />
        </>
      )}
      {query.status === 'error' && (
        <>
          <h1 className={styles.title}>College unavailable</h1>
          <ErrorState error={query.error} onRetry={query.retry} />
        </>
      )}
      {query.status === 'success' && <CollegeDetail key={collegeId} initial={query.data} />}
    </>
  );
}

function CollegeDetail({ initial }: { initial: College }) {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [college, setCollege] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'admins';

  /** After an admin is added or removed, the counts change. */
  async function refreshCounts() {
    try {
      setCollege(await getCollege(college.id));
    } catch {
      // The counts stay as they were; the next visit shows the right ones.
    }
  }

  async function toggleActive() {
    setStatusBusy(true);
    setActionError(null);
    try {
      const saved = await updateCollege(college.id, { name: college.name, active: !college.active });
      setCollege(saved);
      toast.show(`${saved.name} ${saved.active ? 'activated' : 'deactivated'}.`);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setStatusBusy(false);
      setConfirmingStatus(false);
    }
  }

  return (
    <>
      <header className={styles.detailHeader}>
        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>{college.name}</h1>
            <p className={styles.detailFacts}>
              <span className={styles.codeChip}>{college.code}</span>
              {college.active ? (
                <StatusBadge tone="success">Active</StatusBadge>
              ) : (
                <StatusBadge tone="neutral">Inactive</StatusBadge>
              )}
              <span>Added {formatDate(college.createdAt)}</span>
            </p>
          </div>
          <div className={styles.headerLinks}>
            <button type="button" className={styles.secondaryButton} onClick={() => setEditing(true)}>
              Edit name
            </button>
            <button
              type="button"
              className={college.active ? styles.secondaryButton : styles.primaryButton}
              onClick={() => setConfirmingStatus(true)}
            >
              {college.active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </div>
        {!college.active && <p className={styles.notice}>This college is inactive. Its users can&rsquo;t sign in.</p>}
        {actionError && (
          <p role="alert" className={styles.formError}>
            {actionError}
          </p>
        )}
      </header>

      <dl className={styles.statTiles}>
        <div className={styles.statTile}>
          <dt>Admins</dt>
          <dd>{formatCount(college.counts.admins)}</dd>
        </div>
        <div className={styles.statTile}>
          <dt>Professors</dt>
          <dd>{formatCount(college.counts.professors)}</dd>
        </div>
        <div className={styles.statTile}>
          <dt>Students</dt>
          <dd>{formatCount(college.counts.students)}</dd>
        </div>
      </dl>

      <p className={styles.hint}>
        <Link to={`/admin/audit?collegeId=${encodeURIComponent(college.id)}`}>Audit log for this college</Link>
      </p>

      <div role="tablist" aria-label="College" className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`college-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`college-panel-${t.id}`}
            className={styles.tab}
            onClick={() => setParams({ tab: t.id }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="college-panel-admins" aria-labelledby="college-tab-admins">
        <AdminsTab college={college} onChanged={() => void refreshCounts()} showToast={toast.show} />
      </div>

      <EditCollegeNameDialog
        college={college}
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          setCollege(saved);
          setEditing(false);
          toast.show('College name updated.');
        }}
      />
      <ConfirmDialog
        open={confirmingStatus}
        title={`${college.active ? 'Deactivate' : 'Activate'} ${college.name}?`}
        confirmLabel={college.active ? 'Deactivate' : 'Activate'}
        destructive={college.active}
        busy={statusBusy}
        onConfirm={() => void toggleActive()}
        onCancel={() => setConfirmingStatus(false)}
      >
        {college.active ? (
          <p>
            Everyone at this college — admins, professors and students — loses access. They&rsquo;ll be signed out
            within 15 minutes and can&rsquo;t sign in until you activate the college again. Their data is kept.
          </p>
        ) : (
          <p>Admins, professors and students of this college will be able to sign in again.</p>
        )}
      </ConfirmDialog>
      {toast.element}
    </>
  );
}

function AdminsTab({
  college,
  onChanged,
  showToast,
}: {
  college: College;
  onChanged: () => void;
  showToast: (message: string) => void;
}) {
  const admins = useApiQuery(`college-admins:${college.id}`, () => listCollegeAdmins(college.id));
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<UserSummary | null>(null);
  const [removing, setRemoving] = useState<UserSummary | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const list = admins.status === 'success' ? admins.data : admins.status === 'loading' ? (admins.staleData ?? []) : [];

  async function confirmRemove() {
    if (!removing) return;
    setRemoveBusy(true);
    setActionError(null);
    try {
      await removeAdmin(removing.id);
      showToast(`${removing.fullName ?? removing.email ?? 'Admin'} removed.`);
      admins.retry();
      onChanged();
    } catch (err) {
      setActionError(errorMessage(err));
      if (hasCode(err, 'NOT_FOUND')) admins.retry();
    } finally {
      setRemoveBusy(false);
      setRemoving(null);
    }
  }

  const name = (admin: UserSummary) => admin.fullName ?? admin.email ?? 'This admin';

  return (
    <section aria-labelledby="admins-title">
      <div className={styles.sectionHead}>
        <h2 id="admins-title" className={styles.sectionHeadTitle}>
          Admins
        </h2>
        <button type="button" className={styles.primaryButton} onClick={() => setAdding(true)}>
          Add admin
        </button>
      </div>
      {actionError && (
        <p role="alert" className={styles.formError}>
          {actionError}
        </p>
      )}

      {admins.status === 'loading' && list.length === 0 && <LoadingState label="Loading admins" lines={2} />}
      {admins.status === 'error' && <ErrorState error={admins.error} onRetry={admins.retry} />}
      {admins.status === 'success' && list.length === 0 && (
        <EmptyState
          actions={
            <button type="button" className={styles.primaryButton} onClick={() => setAdding(true)}>
              Add admin
            </button>
          }
        >
          This college has no admin yet. Add one so they can set up users and subjects.
        </EmptyState>
      )}
      {list.length > 0 && (
        <ul className={styles.cardList}>
          {list.map((admin) => (
            <li key={admin.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <span className={styles.cellTitle}>{admin.fullName ?? '—'}</span>
                  <span className={styles.cellSub}>{admin.email ?? '—'}</span>
                </div>
                <RowMenu
                  label={`Actions for ${name(admin)}`}
                  items={[
                    { label: 'Reset password', onSelect: () => setResetting(admin) },
                    { label: 'Remove', danger: true, onSelect: () => setRemoving(admin) },
                  ]}
                />
              </div>
              <span className={styles.detailFacts}>
                {admin.mustChangePassword && <StatusBadge tone="warning">Must change password</StatusBadge>}
                <span>Added {formatDate(admin.createdAt)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <AddAdminDialog
        collegeId={college.id}
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={() => {
          admins.retry();
          onChanged();
        }}
      />
      <ResetPasswordDialog
        admin={resetting}
        onClose={() => {
          setResetting(null);
          admins.retry();
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing ? name(removing) : ''}?`}
        confirmLabel="Remove"
        destructive
        busy={removeBusy}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoving(null)}
      >
        <p>
          They&rsquo;ll lose access to {college.name} immediately. This can&rsquo;t be undone; you can add them again
          later as a new admin.
        </p>
        {list.length === 1 && (
          <p>
            <strong>This is the college&rsquo;s only admin.</strong> Until you add another, nobody can manage its users
            or subjects.
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}
