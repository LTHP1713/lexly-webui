import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  caseLawActs,
  getCaseLaw,
  importanceLabel,
  listCaseLaws,
  type CaseLawImportance,
  type CaseLawSummary,
} from '@/api/caselaws';
import { ErrorState } from '@/components/QueryStates';
import { LibrarySubNav } from '@/components/SubNav';
import { ArrowRightIcon, CourthouseIcon, DocumentIcon, ScalesIcon, SearchIcon } from '@/components/icons/Icons';
import { useApiQuery } from '@/hooks/useApiQuery';
import { ImportanceBadge } from './ImportanceBadge';
import type { SectionLinkState } from './navigation';
import contentStyles from './Content.module.css';
import styles from './Browse.module.css';

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

  function clearFilters() {
    window.clearTimeout(debounceTimer.current);
    setInput('');
    setParams(new URLSearchParams());
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroArt} aria-hidden="true">
          <ScalesIcon size="100%" strokeWidth={0.6} />
        </div>
        <p className={styles.eyebrow}>Judgments</p>
        <h1 className={styles.title}>Case Laws</h1>
        <p className={styles.subtitle}>Judgments, explained issue by issue.</p>
        <LibrarySubNav />

        <form role="search" className={styles.searchForm} onSubmit={handleSubmit}>
          <label htmlFor="caselaw-search" className={contentStyles.visuallyHidden}>
            Search case laws
          </label>
          <div className={styles.searchField}>
            <SearchIcon size={20} className={styles.searchIcon} />
            <input
              id="caselaw-search"
              type="search"
              className={styles.searchInput}
              value={input}
              onChange={(event) => handleChange(event.target.value)}
              placeholder="e.g. Kesavananda, 2026 INSC 564, Bagchi"
              aria-describedby="caselaw-search-help"
              autoComplete="off"
            />
          </div>
          <span id="caselaw-search-help" className={contentStyles.visuallyHidden}>
            Search by case name, citation, court, case number or judge
          </span>
        </form>
      </header>

      <div className={styles.toolbar}>
        <div role="group" aria-labelledby="caselaw-importance-label" className={styles.chips}>
          <span id="caselaw-importance-label" className={styles.chipsLabel}>
            Importance
          </span>
          {[undefined, ...IMPORTANCE_VALUES].map((value) => (
            <button
              key={value ?? 'ALL'}
              type="button"
              className={styles.chip}
              aria-pressed={importance === value}
              onClick={() => update({ importance: value ?? null })}
            >
              {value ? importanceLabel[value] : 'All'}
            </button>
          ))}
        </div>
        {data && results.status !== 'error' && (
          <p role="status" className={styles.resultSummary}>
            {results.status === 'loading' ? (
              'Loading…'
            ) : data.totalElements > 0 ? (
              <>
                <span className={styles.resultCount}>{data.totalElements}</span>{' '}
                {data.totalElements === 1 ? 'case law' : 'case laws'}
                {data.totalPages > 1 && ` · page ${data.page + 1} of ${data.totalPages}`}
              </>
            ) : null}
          </p>
        )}
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

      {results.status === 'loading' && !data && (
        <div role="status" className={styles.grid}>
          <span className={contentStyles.visuallyHidden}>Loading case laws…</span>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={styles.skeletonCard} aria-hidden="true" />
          ))}
        </div>
      )}
      {results.status === 'error' && <ErrorState error={results.error} onRetry={results.retry} />}

      {data && results.status !== 'error' && (
        <div aria-busy={results.status === 'loading'} className={results.status === 'loading' ? styles.stale : undefined}>
          {data.content.length === 0 ? (
            <div className={styles.emptyState}>
              <ScalesIcon size={40} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>{filtered ? 'No matching case laws' : 'No case laws yet'}</p>
              <p className={styles.emptyMessage}>
                {filtered
                  ? 'Try a different case name, citation or judge, or widen the importance filter.'
                  : 'Judgments will appear here as they are added.'}
              </p>
              {filtered && (
                <button type="button" className={styles.clearButton} onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <ul className={styles.grid}>
              {data.content.map((caseLaw) => (
                <li key={caseLaw.id}>
                  <CaseLawCard caseLaw={caseLaw} backTo={backTo} />
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
    </div>
  );
}

function CaseLawCard({ caseLaw, backTo }: { caseLaw: CaseLawSummary; backTo: SectionLinkState['backTo'] }) {
  return (
    <Link
      to={`/caselaws/${caseLaw.id}`}
      state={{ backTo } satisfies SectionLinkState}
      className={`${styles.card} ${caseLaw.importance === 'LANDMARK' ? styles.cardLandmark : ''}`}
    >
      <span className={styles.cardTop}>
        <ImportanceBadge importance={caseLaw.importance} />
        <ScalesIcon size={20} className={styles.cardIcon} />
      </span>
      <span className={styles.cardTitle}>{caseLaw.title}</span>
      {(caseLaw.citation || caseLaw.court) && (
        <span className={styles.facts}>
          {caseLaw.citation && (
            <span className={styles.fact}>
              <DocumentIcon size={16} />
              <span className={styles.citation}>{caseLaw.citation}</span>
            </span>
          )}
          {caseLaw.court && (
            <span className={styles.fact}>
              <CourthouseIcon size={16} />
              <span>{caseLaw.court}</span>
            </span>
          )}
        </span>
      )}
      <ActTags caseLaw={caseLaw} />
      <span className={styles.cardFooter}>
        Read case
        <ArrowRightIcon size={16} />
      </span>
    </Link>
  );
}

/**
 * Act name tags for a case card. Uses `acts` from the list response when the backend sends it;
 * otherwise falls back to the case detail (browser-cached, so opening the case reuses it).
 * A failed fetch just renders no tags — the card is still usable.
 */
function ActTags({ caseLaw }: { caseLaw: CaseLawSummary }) {
  const fromSummary = caseLaw.acts;
  const detail = useApiQuery(fromSummary ? null : `caselaw:${caseLaw.id}`, () => getCaseLaw(caseLaw.id));
  const acts = fromSummary ?? (detail.status === 'success' ? caseLawActs(detail.data) : []);
  if (acts.length === 0) return null;
  return (
    <span className={styles.acts}>
      {acts.map((act) => (
        <span key={act} className={`${contentStyles.importance} ${contentStyles.actTag}`}>
          {act}
        </span>
      ))}
    </span>
  );
}
