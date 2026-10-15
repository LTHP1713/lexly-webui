import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { deleteCaseLaw } from '@/api/adminCaseLaws';
import { listCaseLaws, type CaseLawSummary } from '@/api/caselaws';
import { ApiError } from '@/api/client';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { queryKeys } from '@/lib/queryClient';
import { ImportanceBadge } from '@/pages/content/ImportanceBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ContentSubNav } from '@/components/SubNav';
import { useToast } from '@/components/Toast';
import styles from '@/components/ui.module.css';

const PAGE_SIZE = 20;

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

/** `/admin/caselaws`: find a case law, then edit its details or content, or delete it. */
export function AdminCaseLawsPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const page = Math.max(0, (Number(params.get('page')) || 1) - 1);
  const [input, setInput] = useState(query);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CaseLawSummary | null>(null);
  const toast = useToast();

  const results = useCachedQuery(queryKeys.adminCaseLaws.list({ query, page }), () =>
    listCaseLaws({ query: query || undefined, page, size: PAGE_SIZE }, { cache: 'no-cache' }),
  );
  const data = results.status === 'success' ? results.data : results.status === 'loading' ? results.staleData : undefined;

  function goTo(next: { q?: string; page?: number }) {
    const merged = new URLSearchParams(params);
    if (next.q !== undefined) {
      if (next.q) merged.set('q', next.q);
      else merged.delete('q');
    }
    if (next.page) merged.set('page', String(next.page + 1));
    else merged.delete('page');
    setParams(merged);
  }

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    goTo({ q: input.trim() });
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusyId(toDelete.id);
    setActionError(null);
    try {
      await deleteCaseLaw(toDelete.id);
      toast.show(`Deleted "${toDelete.title}".`);
      setToDelete(null);
      results.retry();
    } catch (err) {
      setToDelete(null);
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Admin</p>
          <h1 className={styles.title}>Case laws</h1>
        </div>
        <Link to="/admin/caselaws/new" className={styles.primaryButton}>
          + New case law
        </Link>
      </div>
      <ContentSubNav />

      <form role="search" className={styles.searchRow} onSubmit={handleSearch}>
        <label htmlFor="admin-caselaw-search" className={styles.label}>
          Search case laws
        </label>
        <div className={styles.searchControls}>
          <input
            id="admin-caselaw-search"
            type="search"
            className={styles.input}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Case name, citation, court, case number or judge"
            autoComplete="off"
          />
          <button type="submit" className={styles.secondaryButton}>
            Search
          </button>
        </div>
      </form>

      {actionError && (
        <p role="alert" className={styles.formError}>
          {actionError}
        </p>
      )}

      {results.status === 'loading' && !data && <LoadingState label="Loading case laws" />}
      {results.status === 'error' && <ErrorState error={results.error} onRetry={results.retry} />}

      {data && results.status !== 'error' && (
        <div aria-busy={results.status === 'loading'}>
          <p className={styles.hint}>
            {data.totalElements === 0
              ? query
                ? 'No case laws match this search.'
                : 'No case laws yet.'
              : `${data.totalElements} ${data.totalElements === 1 ? 'case law' : 'case laws'}`}
          </p>
          <ul className={styles.adminList}>
            {data.content.map((caseLaw) => (
              <li key={caseLaw.id} className={styles.adminItem}>
                <div className={styles.adminItemText}>
                  <span className={styles.adminItemTitle}>{caseLaw.title}</span>
                  {(caseLaw.citation || caseLaw.court) && (
                    <span className={styles.hint}>{[caseLaw.citation, caseLaw.court].filter(Boolean).join(' • ')}</span>
                  )}
                  <span className={styles.badges}>
                    <ImportanceBadge importance={caseLaw.importance} />
                  </span>
                </div>
                <div className={styles.adminItemActions}>
                  <Link
                    to={`/admin/caselaws/${caseLaw.id}`}
                    className={styles.rowButton}
                    aria-label={`Details: ${caseLaw.title}`}
                  >
                    Details
                  </Link>
                  <Link
                    to={`/admin/caselaws/${caseLaw.id}/content`}
                    className={styles.rowButton}
                    aria-label={`Content: ${caseLaw.title}`}
                  >
                    Content
                  </Link>
                  <button
                    type="button"
                    className={`${styles.rowButton} ${styles.rowButtonDanger}`}
                    aria-label={`Delete: ${caseLaw.title}`}
                    onClick={() => setToDelete(caseLaw)}
                    disabled={busyId === caseLaw.id}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {data.totalPages > 1 && (
            <nav aria-label="Case law pages" className={styles.pagination}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => goTo({ page: data.page - 1 })}
                disabled={data.page <= 0}
              >
                ← Previous
              </button>
              <span className={styles.hint}>
                Page {data.page + 1} of {data.totalPages}
              </span>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => goTo({ page: data.page + 1 })}
                disabled={data.page >= data.totalPages - 1}
              >
                Next →
              </button>
            </nav>
          )}
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this case law?"
        confirmLabel="Delete case law"
        destructive
        busy={busyId !== null && busyId === toDelete?.id}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      >
        <p>
          <strong>{toDelete?.title}</strong> will be deleted permanently, along with all of its issues, arguments,
          holdings and other content, and its links to sections. This can't be undone.
        </p>
      </ConfirmDialog>
      {toast.element}
    </>
  );
}
