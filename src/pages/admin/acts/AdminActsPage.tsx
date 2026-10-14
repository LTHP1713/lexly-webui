import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { deleteAct, refreshReaderCache } from '@/api/adminContent';
import { listActs, type ActSummary } from '@/api/content';
import { errorMessage } from '@/api/errors';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { RowMenu } from '@/components/RowMenu';
import { ContentSubNav } from '@/components/SubNav';
import { useToast } from '@/components/Toast';
import { TypedConfirmDialog } from '@/components/TypedConfirmDialog';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { TABLE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { queryKeys } from '@/lib/queryClient';
import { ActDialog } from './ActDialog';
import styles from '@/components/ui.module.css';

/** `/admin/acts` (UI spec F1.7): every act, filtered on the client (`GET /acts` isn't paged). */
export function AdminActsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const filter = params.get('q') ?? '';
  const acts = useCachedQuery(queryKeys.adminActs.list, () => listActs({ cache: 'no-cache' }));
  const [dialog, setDialog] = useState<{ actId: string | null } | null>(null);
  const [toDelete, setToDelete] = useState<ActSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const wide = useMediaQuery(TABLE_QUERY);

  const all = acts.status === 'success' ? acts.data : acts.status === 'loading' ? (acts.staleData ?? null) : null;
  const needle = filter.trim().toLowerCase();
  const shown = all?.filter(
    (act) => !needle || act.title.toLowerCase().includes(needle) || (act.shortCode ?? '').toLowerCase().includes(needle),
  );

  function setFilter(value: string) {
    setParams(value ? { q: value } : {}, { replace: true });
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteAct(toDelete.id);
      toast.show(`${toDelete.title} deleted.`);
      refreshReaderCache({ actList: true });
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setDeleting(false);
      setToDelete(null);
      acts.retry();
    }
  }

  const menuFor = (act: ActSummary) => (
    <RowMenu
      label={`Actions for ${act.title}`}
      items={[
        { label: 'Edit', onSelect: () => setDialog({ actId: act.id }) },
        { label: 'View as reader', to: `/acts/${act.id}` },
        { label: 'Delete', danger: true, onSelect: () => setToDelete(act) },
      ]}
    />
  );

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>Content</p>
          <h1 className={styles.title}>Acts</h1>
        </div>
        <button type="button" className={styles.primaryButton} onClick={() => setDialog({ actId: null })}>
          Add act
        </button>
      </div>
      <ContentSubNav />

      <div className={styles.filterBar} role="search" aria-label="Filter acts">
        <div className={`${styles.field} ${styles.fieldGrow}`}>
          <label htmlFor="act-filter" className={styles.label}>
            Filter by title or short code
          </label>
          <input
            id="act-filter"
            type="search"
            className={styles.input}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      {actionError && (
        <p role="alert" className={styles.formError}>
          {actionError}
        </p>
      )}

      {acts.status === 'loading' && !all && <LoadingState label="Loading acts" />}
      {acts.status === 'error' && <ErrorState error={acts.error} onRetry={acts.retry} />}
      {all && acts.status !== 'error' && (
        <div aria-busy={acts.status === 'loading'}>
          {all.length === 0 ? (
            <EmptyState
              actions={
                <>
                  <button type="button" className={styles.primaryButton} onClick={() => setDialog({ actId: null })}>
                    Add act
                  </button>
                  <Link to="/admin/import?kind=acts" className={styles.secondaryButton}>
                    Import
                  </Link>
                </>
              }
            >
              No acts yet. Add one, or import a batch.
            </EmptyState>
          ) : shown && shown.length === 0 ? (
            <EmptyState
              actions={
                <button type="button" className={styles.secondaryButton} onClick={() => setFilter('')}>
                  Clear filters
                </button>
              }
            >
              No acts match these filters.
            </EmptyState>
          ) : wide ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className={styles.visuallyHidden}>Acts, by title</caption>
                <thead>
                  <tr>
                    <th scope="col">Act</th>
                    <th scope="col">Short code</th>
                    <th scope="col" className={styles.actionsCell}>
                      <span className={styles.visuallyHidden}>Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown?.map((act) => (
                    <tr key={act.id}>
                      <td>
                        <Link to={`/admin/acts/${act.id}`} className={styles.cellTitle}>
                          {act.title}
                        </Link>
                      </td>
                      <td className={styles.mono}>{act.shortCode ?? '—'}</td>
                      <td className={styles.actionsCell}>{menuFor(act)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className={styles.cardList} aria-label="Acts">
              {shown?.map((act) => (
                <li key={act.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <Link to={`/admin/acts/${act.id}`} className={styles.cellTitle}>
                      {act.title}
                    </Link>
                    {menuFor(act)}
                  </div>
                  <span className={`${styles.hint} ${styles.mono}`}>{act.shortCode ?? 'No short code'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ActDialog
        open={dialog !== null}
        actId={dialog?.actId ?? null}
        onClose={() => setDialog(null)}
        onSaved={(_act, created) => {
          setDialog(null);
          toast.show(created ? 'Act added.' : 'Act updated.');
          refreshReaderCache({ actList: true });
          acts.retry();
        }}
      />
      {toDelete?.shortCode ? (
        <TypedConfirmDialog
          open
          title={`Delete ${toDelete.title}?`}
          phrase={toDelete.shortCode}
          confirmLabel="Delete act"
          busy={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        >
          <DeleteActBody />
        </TypedConfirmDialog>
      ) : (
        <ConfirmDialog
          open={toDelete !== null}
          title={`Delete ${toDelete?.title ?? ''}?`}
          confirmLabel="Delete act"
          destructive
          busy={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        >
          <DeleteActBody />
        </ConfirmDialog>
      )}
      {toast.element}
    </>
  );
}

function DeleteActBody() {
  return (
    <p>
      All of its sections are deleted too, with their illustrations, exceptions and links to case laws. This can&rsquo;t
      be undone.
    </p>
  );
}