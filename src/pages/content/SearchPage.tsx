import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { searchSections } from '@/api/content';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useApiQuery } from '@/hooks/useApiQuery';
import { sectionLabel, type SectionLinkState } from './navigation';
import { HighlightedSnippet } from './HighlightedSnippet';
import { ProBadge } from './ProBadge';
import styles from './Content.module.css';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

/**
 * The query and page live in the URL (`?q=…&page=…`, page 1-based) so browser back from a
 * section returns to the same results. Locked hits are marked but their snippet is rendered as
 * returned — the backend doesn't redact it yet (see docs/progress/frontend_progress.md).
 */
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
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

  function commitQuery(value: string) {
    window.clearTimeout(debounceTimer.current);
    const next = value.trim();
    if (next !== query) setParams(next ? { q: next } : {}, { replace: true });
  }

  function handleChange(value: string) {
    setInput(value);
    window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => commitQuery(value), DEBOUNCE_MS);
  }

  const results = useApiQuery(query ? `search:${query}:${page}` : null, () =>
    searchSections({ query, page, size: PAGE_SIZE }),
  );
  const data = results.status === 'success' ? results.data : results.status === 'loading' ? results.staleData : undefined;

  function goToPage(nextPage: number) {
    setParams({ q: query, page: String(nextPage + 1) });
    window.scrollTo({ top: 0 });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    commitQuery(input);
  }

  const backTo: SectionLinkState['backTo'] = { to: `/search?${params.toString()}`, label: 'search results' };

  return (
    <>
      <h1 className={styles.title}>Search sections</h1>

      <form role="search" className={styles.searchForm} onSubmit={handleSubmit}>
        <label htmlFor="section-search" className={styles.searchLabel}>
          Search bare act sections
        </label>
        <input
          id="section-search"
          type="search"
          className={styles.searchInput}
          value={input}
          onChange={(event) => handleChange(event.target.value)}
          placeholder="e.g. murder, bail, cheque dishonour"
          autoComplete="off"
        />
      </form>

      {results.status === 'idle' && <p className={styles.empty}>Type to search across all sections.</p>}
      {results.status === 'loading' && !data && <LoadingState label="Searching" />}
      {results.status === 'error' && <ErrorState error={results.error} onRetry={results.retry} />}

      {data && results.status !== 'error' && (
        <div aria-busy={results.status === 'loading'} className={results.status === 'loading' ? styles.stale : undefined}>
          <p role="status" className={styles.resultSummary}>
            {results.status === 'loading'
              ? 'Searching…'
              : data.totalElements === 0
                ? `No sections match “${query}”.`
                : `${data.totalElements} ${data.totalElements === 1 ? 'result' : 'results'} for “${query}”`}
          </p>

          {data.content.length > 0 && (
            <ul className={styles.list}>
              {data.content.map((hit) => (
                <li key={hit.id}>
                  <Link
                    to={`/sections/${hit.id}`}
                    state={{ backTo } satisfies SectionLinkState}
                    className={`${styles.item} ${styles.searchHit} ${hit.isFree ? '' : styles.itemLocked}`}
                  >
                    <span className={styles.hitHeading}>
                      <span className={styles.itemTitle}>{sectionLabel(hit.sectionNumber, hit.title)}</span>
                      {!hit.isFree && <ProBadge />}
                    </span>
                    {hit.snippet && <HighlightedSnippet snippet={hit.snippet} />}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {data.totalPages > 1 && (
            <nav aria-label="Search results pages" className={styles.pagination}>
              <button
                type="button"
                className={styles.pageButton}
                onClick={() => goToPage(data.page - 1)}
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
                onClick={() => goToPage(data.page + 1)}
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
