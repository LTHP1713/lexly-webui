import { useState } from 'react';
import { Link } from 'react-router-dom';
import { listActs, type ActSummary } from '@/api/content';
import type { BareActProgressItem } from '@/api/users';
import { ErrorState } from '@/components/QueryStates';
import { LibrarySubNav } from '@/components/SubNav';
import { ArrowRightIcon, BookIcon, SearchIcon } from '@/components/icons/Icons';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useBareActProgress } from '@/hooks/useHomeData';
import type { ActLinkState } from './navigation';
import contentStyles from './Content.module.css';
import styles from './Browse.module.css';

function matchesFilter(act: ActSummary, filter: string): boolean {
  const needle = filter.trim().toLowerCase();
  if (!needle) return true;
  return act.title.toLowerCase().includes(needle) || Boolean(act.shortCode?.toLowerCase().includes(needle));
}

/**
 * `GET /acts` browse page. The list is small and fetched whole, so the filter is client-side.
 * Reading progress per act shows once `/users/me/bare-act-progress` is live; until then cards
 * just link to the act's sections.
 */
export function ActsPage() {
  const acts = useApiQuery('acts', listActs);
  const progress = useBareActProgress();
  const progressByAct = new Map(
    progress.status === 'success' ? progress.data.map((item) => [item.actId, item] as const) : [],
  );
  const [filter, setFilter] = useState('');

  const visible = acts.status === 'success' ? acts.data.filter((act) => matchesFilter(act, filter)) : [];

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroArt} aria-hidden="true">
          <BookIcon size="100%" strokeWidth={0.6} />
        </div>
        <p className={styles.eyebrow}>Statutes</p>
        <h1 className={styles.title}>Bare Acts</h1>
        <p className={styles.subtitle}>Every section, in simple words.</p>
        <LibrarySubNav />

        <form role="search" className={styles.searchForm} onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="act-filter" className={contentStyles.visuallyHidden}>
            Filter acts
          </label>
          <div className={styles.searchField}>
            <SearchIcon size={20} className={styles.searchIcon} />
            <input
              id="act-filter"
              type="search"
              className={styles.searchInput}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="e.g. Contract, BNS, Constitution"
              aria-describedby="act-filter-help"
              autoComplete="off"
            />
          </div>
          <span id="act-filter-help" className={contentStyles.visuallyHidden}>
            Filter by act name or short code
          </span>
        </form>
      </header>

      {acts.status === 'loading' && (
        <div role="status" className={styles.grid}>
          <span className={contentStyles.visuallyHidden}>Loading acts…</span>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={styles.skeletonCard} aria-hidden="true" />
          ))}
        </div>
      )}
      {acts.status === 'error' && <ErrorState error={acts.error} onRetry={acts.retry} />}

      {acts.status === 'success' && (
        <>
          {acts.data.length > 0 && (
            <div className={styles.toolbar}>
              <p role="status" className={styles.resultSummary}>
                <span className={styles.resultCount}>{visible.length}</span>{' '}
                {filter.trim() ? `of ${acts.data.length} acts` : visible.length === 1 ? 'act' : 'acts'}
              </p>
            </div>
          )}

          {visible.length === 0 ? (
            <div className={styles.emptyState}>
              <BookIcon size={40} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>{acts.data.length === 0 ? 'No acts yet' : 'No matching acts'}</p>
              <p className={styles.emptyMessage}>
                {acts.data.length === 0
                  ? 'Bare Acts will appear here as they are added.'
                  : 'Try a different act name or short code.'}
              </p>
              {acts.data.length > 0 && (
                <button type="button" className={styles.clearButton} onClick={() => setFilter('')}>
                  Clear filter
                </button>
              )}
            </div>
          ) : (
            <ul className={styles.grid}>
              {visible.map((act) => (
                <li key={act.id}>
                  <ActCard act={act} progress={progressByAct.get(act.id)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function ActCard({ act, progress }: { act: ActSummary; progress: BareActProgressItem | undefined }) {
  const started = progress && progress.completedSections > 0;
  return (
    <Link to={`/acts/${act.id}`} state={{ actTitle: act.title } satisfies ActLinkState} className={styles.card}>
      <span className={styles.cardTop}>
        <span className={styles.monogram} aria-hidden={!act.shortCode}>
          {act.shortCode ?? <BookIcon size={22} />}
        </span>
      </span>
      <span className={styles.cardTitle}>{act.title}</span>

      {progress && progress.totalSections > 0 && (
        <span className={styles.progress}>
          <span className={styles.progressText}>
            <span>
              {progress.completedSections} of {progress.totalSections} sections read
            </span>
            <span className={styles.progressPercent}>{progress.percent}%</span>
          </span>
          <span className={styles.bar} aria-hidden="true">
            <span className={styles.barFill} style={{ width: `${progress.percent}%` }} />
          </span>
        </span>
      )}
      {progress?.lastSection && (
        <span className={styles.lastRead}>
          Last read: Section {progress.lastSection.sectionNumber}
          {progress.lastSection.title && ` — ${progress.lastSection.title}`}
        </span>
      )}

      <span className={styles.cardFooter}>
        {started ? 'Continue reading' : 'Browse sections'}
        <ArrowRightIcon size={16} />
      </span>
    </Link>
  );
}
