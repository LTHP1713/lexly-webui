import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { importanceLabel, listCaseLaws, type CaseLawImportance } from '@/api/caselaws';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useApiQuery } from '@/hooks/useApiQuery';
import { ImportanceBadge } from './ImportanceBadge';
import type { SectionLinkState } from './navigation';
import { ProBadge } from './ProBadge';
import styles from './Content.module.css';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;
const IMPORTANCE_VALUES: CaseLawImportance[] = ['LANDMARK', 'IMPORTANT', 'STANDARD'];

function parseImportance(value: string | null): CaseLawImportance | undefined {
  return IMPORTANCE_VALUES.find((v) => v === value);
}

/**
 * `GET /caselaws` browse + search. Filters live in the URL (`?q=&importance=&sectionId=&page=`,
 * page 1-based) so back navigation from a case restores the same list — same as `/search`.
 */
export function CaseLawsPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const importance = parseImportance(params.get('importance'));
  const sectionId = params.get('sectionId') ?? undefined;
  const page = Math.max(0, (Number(params.get('page')) || 1) - 1);

  const [input, setInput] = useState(query);
  const debounceTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(debounceTimer.current), []);

  // Browser back/forward changes `q` under us: pull the input along so it matches the results.
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (query !== syncedQuery) {
    setSyncedQuery(query);
    if (input.trim() !== query) setInput(query);
  }

  function update(next: { q?: string; importance?: CaseLawImportance | null; page?: number }, replace = false) {
    const merged = new URLSearchParams(params);
    if (next.q !== undefined) {
      if (next.q) merged.set('q', next.q);
      else merged.delete('q');
    }
    if (next.importance !== undefined) {
      if (next.importance) merged.set('importance', next.importance);
      else merged.delete('importance');
    }
    // Any filter change resets to the first page; only an explicit page move keeps one.
    if (next.page) merged.set('page', String(next.page + 1));
    else merged.delete('page');
    setParams(merged, { replace });
  }

  function commitQuery(value: string) {
    window.clearTimeout(debounceTimer.current);
    const next = value.trim();
    if (next !== query) update({ q: next }, true);
  }

  function handleChange(value: string) {
    setInput(value);
    window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => commitQuery(value), DEBOUNCE_MS);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    commitQuery(input);
  }

  const results = useApiQuery(`caselaws:${query}:${importance ?? ''}:${sectionId ?? ''}:${page}`, () =>
    listCaseLaws({ query: query || undefined, importance, sectionId, page, size: PAGE_SIZE }),
  );
  const data = results.status === 'success' ? results.data : results.status === 'loading' ? results.staleData : undefined;
  const backTo: SectionLinkState['backTo'] = { to: `/caselaws?${params.toString()}`, label: 'case laws' };
  const filtered = Boolean(query || importance || sectionId);

  return (
    <>
      <h1 className={styles.title}>Case Laws</h1>
      <p className={styles.subtitle}>Landmark and important judgments, with structured summaries.</p>

      <div className={styles.filters}>
        <form role="search" className={styles.searchForm} onSubmit={handleSubmit}>
          <label htmlFor="caselaw-search" className={styles.searchLabel}>
            Search case laws
          </label>
          <input
            id="caselaw-search"
            type="search"
            className={styles.searchInput}
            value={input}
            onChange={(event) => handleChange(event.target.value)}
            placeholder="e.g. Kesavananda, free consent"
            autoComplete="off"
          />
        </form>
        <div className={styles.filterField}>
          <label htmlFor="caselaw-importance" className={styles.searchLabel}>
            Importance
          </label>
          <select
            id="caselaw-importance"
            className={styles.select}
            value={importance ?? ''}
            onChange={(event) => update({ importance: parseImportance(event.target.value) ?? null })}
          >
            <option value="">All</option>
            {IMPORTANCE_VALUES.map((value) => (
              <option key={value} value={value}>
                {importanceLabel[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sectionId && (
        <p className={styles.filterNote}>
          Showing case laws that interpret one section.
          <button
            type="button"
            onClick={() => {
              const merged = new URLSearchParams(params);
              merged.delete('sectionId');
              merged.delete('page');
              setParams(merged);
            }}
          >
            Show all
          </button>
        </p>
      )}

      {results.status === 'loading' && !data && <LoadingState label="Loading case laws" />}
      {results.status === 'error' && <ErrorState error={results.error} onRetry={results.retry} />}

      {data && results.status !== 'error' && (
        <div aria-busy={results.status === 'loading'} className={results.status === 'loading' ? styles.stale : undefined}>
          <p role="status" className={styles.resultSummary}>
            {results.status === 'loading'
              ? 'Loading…'
              : data.totalElements === 0
                ? filtered
                  ? 'No case laws match these filters.'
                  : 'No case laws are available yet.'
                : `${data.totalElements} ${data.totalElements === 1 ? 'case law' : 'case laws'}`}
          </p>

          {data.content.length > 0 && (
            <ul className={styles.list}>
              {data.content.map((caseLaw) => (
                <li key={caseLaw.id}>
                  <Link
                    to={`/caselaws/${caseLaw.id}`}
                    state={{ backTo } satisfies SectionLinkState}
                    className={`${styles.item} ${styles.searchHit} ${caseLaw.isFree ? '' : styles.itemLocked}`}
                  >
                    <span className={styles.itemTitle}>{caseLaw.title}</span>
                    {(caseLaw.citation || caseLaw.court) && (
                      <span className={styles.snippet}>{[caseLaw.citation, caseLaw.court].filter(Boolean).join(' • ')}</span>
                    )}
                    <span className={styles.badgeRow}>
                      <ImportanceBadge importance={caseLaw.importance} />
                      {!caseLaw.isFree && <ProBadge />}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {data.totalPages > 1 && (
            <nav aria-label="Case law pages" className={styles.pagination}>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => {
                  update({ page: data.page - 1 });
                  window.scrollTo({ top: 0 });
                }}
                disabled={data.page <= 0}
              >
                ← Previous
              </button>
              <span className={styles.pageInfo}>
                Page {data.page + 1} of {data.totalPages}
              </span>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => {
                  update({ page: data.page + 1 });
                  window.scrollTo({ top: 0 });
                }}
                disabled={data.page >= data.totalPages - 1}
              >
                Next →
              </button>
            </nav>
          )}
        </div>
      )}
    </>
  );
}
