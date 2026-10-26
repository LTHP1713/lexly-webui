import { useEffect, useRef, useState, type ComponentType, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { hasCode } from '@/api/errors';
import type { Page } from '@/api/content';
import {
  GLOSSARY_LETTERS,
  GLOSSARY_QUERY_MAX,
  listMaxims,
  listVocab,
  parseGlossaryLetter,
  type GlossaryQuery,
  type MaximSummary,
  type VocabSummary,
} from '@/api/vocab';
import { LetterBar } from '@/components/LetterBar';
import { ErrorState } from '@/components/QueryStates';
import { GlossarySubNav, LibrarySubNav } from '@/components/SubNav';
import { BookIcon, LayersIcon, ScalesIcon, SearchIcon } from '@/components/icons/Icons';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { SectionLinkState } from '@/pages/content/navigation';
import { glossaryCount } from './glossaryFormat';
import contentStyles from '@/pages/content/Content.module.css';
import browse from '@/pages/content/Browse.module.css';
import styles from './Glossary.module.css';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;

/** What a glossary entry shows, whichever list it came from. */
interface GlossaryEntry {
  key: string;
  label: string;
  meaning: string;
  source: { to: string; text: string; kind: 'section' | 'caseLaw' };
}

interface GlossaryConfig {
  path: '/vocab' | '/maxims';
  eyebrow: string;
  title: string;
  intro: string;
  searchLabel: string;
  placeholder: string;
  singular: string;
  plural: string;
  icon: ComponentType<{ size?: number | string; strokeWidth?: number; className?: string }>;
  fetch: (input: GlossaryQuery) => Promise<Page<GlossaryEntry>>;
}

function vocabEntry(entry: VocabSummary): GlossaryEntry {
  const { source } = entry;
  return {
    key: entry.term.toLowerCase(),
    label: entry.term,
    meaning: entry.definition,
    source: {
      to: `/sections/${encodeURIComponent(source.sectionId)}`,
      text: `${source.actShortCode} · s. ${source.sectionNumber}`,
      kind: 'section',
    },
  };
}

function maximEntry(entry: MaximSummary): GlossaryEntry {
  return {
    key: entry.title.toLowerCase(),
    label: entry.title,
    meaning: entry.explanation,
    source: { to: `/caselaws/${encodeURIComponent(entry.source.caseLawId)}`, text: entry.source.caseTitle, kind: 'caseLaw' },
  };
}

const VOCAB: GlossaryConfig = {
  path: '/vocab',
  eyebrow: 'Legal terms',
  title: 'Vocab',
  intro: 'Key terms defined in the bare acts, A to Z.',
  searchLabel: 'Search terms',
  placeholder: 'Search terms and definitions',
  singular: 'term',
  plural: 'terms',
  icon: LayersIcon,
  fetch: async (input) => {
    const page = await listVocab(input);
    return { ...page, content: page.content.map(vocabEntry) };
  },
};

const MAXIMS: GlossaryConfig = {
  path: '/maxims',
  eyebrow: 'Legal principles',
  title: 'Maxims',
  intro: 'Principles the courts have laid down, A to Z.',
  searchLabel: 'Search maxims',
  placeholder: 'Search maxims and explanations',
  singular: 'maxim',
  plural: 'maxims',
  icon: ScalesIcon,
  fetch: async (input) => {
    const page = await listMaxims(input);
    return { ...page, content: page.content.map(maximEntry) };
  },
};

/** `/vocab`: key legal terms from the bare acts (UI spec F5b.3, contract §11b.1). */
export function VocabPage() {
  return <GlossaryPage config={VOCAB} />;
}

/** `/maxims`: legal principles from the case laws (UI spec F5b.3, contract §11b.2). */
export function MaximsPage() {
  return <GlossaryPage config={MAXIMS} />;
}

/**
 * One A–Z glossary. `q`, `letter` and `page` (1-based) live in the URL, as on Case Laws; changing
 * the search or the letter goes back to page 1 and keeps the other filter. A letter the server
 * wouldn't accept is dropped from the URL rather than sent.
 */
function GlossaryPage({ config }: { config: GlossaryConfig }) {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const rawLetter = params.get('letter');
  const letter = parseGlossaryLetter(rawLetter);
  const rawPage = Number(params.get('page'));
  const page = Number.isInteger(rawPage) && rawPage > 1 ? rawPage - 1 : 0;

  useEffect(() => {
    if (rawLetter !== null && rawLetter !== letter) {
      const merged = new URLSearchParams(params);
      if (letter) merged.set('letter', letter);
      else merged.delete('letter');
      setParams(merged, { replace: true });
    }
  }, [rawLetter, letter, params, setParams]);

  const [input, setInput] = useState(query);
  const debounceTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(debounceTimer.current), []);

  // Browser back/forward changes `q` under us: pull the input along so it matches the results.
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (query !== syncedQuery) {
    setSyncedQuery(query);
    if (input.trim() !== query) setInput(query);
  }

  function update(next: { q?: string; letter?: string | null; page?: number }, replace = false) {
    const merged = new URLSearchParams(params);
    if (next.q !== undefined) {
      if (next.q) merged.set('q', next.q);
      else merged.delete('q');
    }
    if (next.letter !== undefined) {
      if (next.letter) merged.set('letter', next.letter);
      else merged.delete('letter');
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

  // The timer fires after later renders, so it must call the latest `commitQuery`: a stale one
  // would merge `q` into old params and undo a letter or page chosen in the meantime.
  const latestCommit = useRef(commitQuery);
  useEffect(() => {
    latestCommit.current = commitQuery;
  });

  function handleChange(value: string) {
    setInput(value);
    window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => latestCommit.current(value), DEBOUNCE_MS);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    commitQuery(input);
  }

  function clearSearch() {
    window.clearTimeout(debounceTimer.current);
    setInput('');
    update({ q: '' });
  }

  function clearFilters() {
    window.clearTimeout(debounceTimer.current);
    setInput('');
    setParams(new URLSearchParams());
  }

  const results = useApiQuery(`glossary:${config.path}:${query}:${letter ?? ''}:${page}`, () =>
    config.fetch({ query: query || undefined, letter, page, size: PAGE_SIZE }),
  );
  const data = results.status === 'success' ? results.data : results.status === 'loading' ? results.staleData : undefined;
  const backTo: SectionLinkState['backTo'] = { to: `${config.path}?${params.toString()}`, label: config.title.toLowerCase() };
  const Icon = config.icon;
  const searchId = `${config.path.slice(1)}-search`;

  return (
    <div className={browse.page}>
      <header className={browse.hero}>
        <div className={browse.heroArt} aria-hidden="true">
          <Icon size="100%" strokeWidth={0.6} />
        </div>
        <p className={browse.eyebrow}>{config.eyebrow}</p>
        <h1 className={browse.title}>{config.title}</h1>
        <p className={browse.subtitle}>{config.intro}</p>
        <LibrarySubNav />
        <GlossarySubNav />

        <form role="search" className={browse.searchForm} onSubmit={handleSubmit}>
          <label htmlFor={searchId} className={contentStyles.visuallyHidden}>
            {config.searchLabel}
          </label>
          <div className={browse.searchField}>
            <SearchIcon size={20} className={browse.searchIcon} />
            <input
              id={searchId}
              type="search"
              className={browse.searchInput}
              value={input}
              maxLength={GLOSSARY_QUERY_MAX}
              onChange={(event) => handleChange(event.target.value)}
              placeholder={config.placeholder}
              autoComplete="off"
            />
          </div>
        </form>
      </header>

      <div className={styles.filters}>
        <LetterBar
          letters={GLOSSARY_LETTERS}
          value={letter}
          label="Filter by first letter"
          onChange={(next) => update({ letter: next })}
        />
        {data && results.status !== 'error' && (
          <p role="status" className={browse.resultSummary}>
            {results.status === 'loading' ? 'Loading…' : glossaryCount(data.totalElements, config, letter, query)}
          </p>
        )}
      </div>

      {results.status === 'loading' && !data && (
        <div role="status" className={browse.grid}>
          <span className={contentStyles.visuallyHidden}>Loading {config.plural}…</span>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`${browse.skeletonCard} ${styles.skeleton}`} aria-hidden="true" />
          ))}
        </div>
      )}

      {results.status === 'error' &&
        (hasCode(results.error, 'VALIDATION_ERROR') ? (
          <div className={browse.emptyState} role="alert">
            <p className={browse.emptyTitle}>These filters can&apos;t be used.</p>
            <button type="button" className={browse.clearButton} onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        ) : (
          <ErrorState error={results.error} onRetry={results.retry} />
        ))}

      {data && results.status !== 'error' && (
        <div aria-busy={results.status === 'loading'} className={results.status === 'loading' ? browse.stale : undefined}>
          {data.content.length === 0 ? (
            <EmptyGlossary
              config={config}
              letter={letter}
              query={query}
              onShowAllLetters={() => update({ letter: null })}
              onClearSearch={clearSearch}
            />
          ) : (
            <dl className={`${browse.grid} ${styles.entries}`}>
              {data.content.map((entry) => (
                <div key={entry.key} className={styles.entry}>
                  <dt className={styles.term}>{entry.label}</dt>
                  <dd className={styles.meaning}>{entry.meaning}</dd>
                  <dd className={styles.source}>
                    <Link to={entry.source.to} state={{ backTo } satisfies SectionLinkState} className={styles.sourceLink}>
                      {entry.source.kind === 'section' ? <BookIcon size={16} /> : <ScalesIcon size={16} />}
                      <span>{entry.source.text}</span>
                    </Link>
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {data.totalPages > 1 && (
            <nav aria-label={`${config.title} pages`} className={browse.pagination}>
              <button
                type="button"
                className={browse.pageButton}
                onClick={() => {
                  update({ page: data.page - 1 });
                  window.scrollTo({ top: 0 });
                }}
                disabled={data.page <= 0}
              >
                ← Previous
              </button>
              <span className={browse.pageInfo}>
                Page {data.page + 1} of {data.totalPages}
              </span>
              <button
                type="button"
                className={browse.pageButton}
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

function EmptyGlossary({
  config,
  letter,
  query,
  onShowAllLetters,
  onClearSearch,
}: {
  config: GlossaryConfig;
  letter: string | null;
  query: string;
  onShowAllLetters: () => void;
  onClearSearch: () => void;
}) {
  const Icon = config.icon;
  const noun = config.plural;
  const title = query
    ? `No ${noun} match '${query}'.`
    : letter
      ? `No ${noun} under ${letter}.`
      : `No ${noun} yet.`;
  return (
    <div className={browse.emptyState}>
      <Icon size={40} className={browse.emptyIcon} />
      <p className={browse.emptyTitle}>{title}</p>
      {(query || letter) && (
        <div className={styles.emptyActions}>
          {query && (
            <button type="button" className={browse.clearButton} onClick={onClearSearch}>
              Clear search
            </button>
          )}
          {letter && (
            <button type="button" className={browse.clearButton} onClick={onShowAllLetters}>
              Show all letters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
