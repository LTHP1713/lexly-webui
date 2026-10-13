import { useId, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SEARCH_MIN_QUERY_LENGTH,
  searchTypeLabel,
  universalSearch,
  type SearchResult,
  type SearchResultType,
} from '@/api/search';
import {
  ArrowRightIcon,
  BookIcon,
  ChecklistIcon,
  DocumentIcon,
  ScalesIcon,
  SearchIcon,
} from '@/components/icons/Icons';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { HighlightedSnippet } from '@/pages/content/HighlightedSnippet';
import { contentPath, type ActLinkState, type SectionLinkState } from '@/pages/content/navigation';
import styles from './UniversalSearch.module.css';

const DEBOUNCE_MS = 300;

const typeIcon: Record<SearchResultType, ComponentType<{ size?: number }>> = {
  ACT: BookIcon,
  SECTION: DocumentIcon,
  CASE_LAW: ScalesIcon,
  TOPIC: BookIcon,
  QUESTION: ChecklistIcon,
};

const typeSingular: Record<SearchResultType, string> = {
  ACT: 'Bare Act',
  SECTION: 'Bare Act section',
  CASE_LAW: 'Case Law',
  TOPIC: 'Topic',
  QUESTION: 'Question',
};

type Option =
  | { kind: 'result'; type: SearchResultType; result: SearchResult; path: string }
  | { kind: 'seeAll'; path: string };

const HOME_BACK: SectionLinkState = { backTo: { to: '/dashboard', label: 'Home' } };

/**
 * Home search box with grouped suggestions (ARIA combobox + listbox). Data comes from
 * `universalSearch`, which hides whether it's the temporary fan-out or the unified endpoint.
 * Enter with no highlighted suggestion opens the full `/search` page.
 */
export function UniversalSearch() {
  const navigate = useNavigate();
  const inputId = useId();
  const listboxId = useId();
  const rootRef = useRef<HTMLFormElement>(null);

  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = input.trim();
  const debounced = useDebouncedValue(trimmed, DEBOUNCE_MS);
  const query = debounced.length >= SEARCH_MIN_QUERY_LENGTH ? debounced : null;
  const results = useApiQuery(query ? `universal-search:${query}` : null, () => universalSearch(query ?? ''));

  const data = results.status === 'success' ? results.data : results.status === 'loading' ? results.staleData : undefined;
  const isPending = results.status === 'loading' || (trimmed !== debounced && trimmed.length >= SEARCH_MIN_QUERY_LENGTH);
  const tooShort = trimmed.length > 0 && trimmed.length < SEARCH_MIN_QUERY_LENGTH;

  const options: Option[] = [];
  if (data && trimmed.length >= SEARCH_MIN_QUERY_LENGTH) {
    for (const group of data.groups) {
      for (const result of group.results) {
        const path = contentPath(group.type, result.id);
        if (path) options.push({ kind: 'result', type: group.type, result, path });
      }
    }
  }
  if (trimmed.length >= SEARCH_MIN_QUERY_LENGTH) {
    options.push({ kind: 'seeAll', path: `/search?q=${encodeURIComponent(trimmed)}` });
  }

  const popupOpen = open && trimmed.length > 0;
  const optionId = (i: number) => `${listboxId}-opt-${i}`;

  function choose(option: Option) {
    setOpen(false);
    setActiveIndex(-1);
    if (option.kind === 'seeAll') {
      navigate(option.path);
    } else if (option.type === 'ACT') {
      navigate(option.path, { state: { actTitle: option.result.title } satisfies ActLinkState });
    } else {
      navigate(option.path, { state: HOME_BACK });
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const active = activeIndex >= 0 ? options[activeIndex] : undefined;
    if (active) choose(active);
    else if (trimmed) choose({ kind: 'seeAll', path: `/search?q=${encodeURIComponent(trimmed)}` });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!options.length) return;
      event.preventDefault();
      setOpen(true);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      // -1 (nothing highlighted, focus stays on the text) sits between the last and first option.
      setActiveIndex((i) => {
        const next = i + delta;
        if (next >= options.length) return -1;
        if (next < -1) return options.length - 1;
        return next;
      });
    } else if (event.key === 'Escape') {
      if (popupOpen) {
        event.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      } else if (input) {
        setInput('');
      }
    }
  }

  let optionIndex = -1;

  return (
    <form
      ref={rootRef}
      role="search"
      className={styles.root}
      onSubmit={handleSubmit}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label htmlFor={inputId} className={styles.visuallyHidden}>
        Search Acts, sections and case laws
      </label>
      <div className={styles.field}>
        <SearchIcon size={20} className={styles.fieldIcon} />
        <input
          id={inputId}
          type="search"
          className={styles.input}
          placeholder="Acts, sections, cases…"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={popupOpen}
          aria-controls={listboxId}
          aria-activedescendant={popupOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        <button type="submit" className={styles.submit} aria-label="Search">
          <span className={styles.submitText}>Search</span>
          <ArrowRightIcon size={18} />
        </button>
      </div>

      <div className={styles.popup} hidden={!popupOpen}>
        <div id={listboxId} role="listbox" aria-label="Search suggestions" className={styles.listbox}>
          {!tooShort && data?.groups.map((group) => (
            <div key={group.type} role="group" aria-label={group.label} className={styles.group}>
              <div className={styles.groupHeading} aria-hidden="true">
                <span>{group.label}</span>
                <span className={styles.groupCount}>{group.totalResults}</span>
              </div>
              {group.results.map((result) => {
                const path = contentPath(group.type, result.id);
                if (!path) return null;
                optionIndex += 1;
                const index = optionIndex;
                const TypeIcon = typeIcon[group.type];
                return (
                  <div
                    key={result.id}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`${styles.option} ${isPending ? styles.stale : ''}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose({ kind: 'result', type: group.type, result, path })}
                  >
                    <span className={styles.optionIcon}>
                      <TypeIcon size={20} />
                    </span>
                    <span className={styles.optionText}>
                      <span className={styles.optionTitle}>{result.title}</span>
                      <span className={styles.optionMeta}>
                        {typeSingular[group.type]}
                        {result.subtitle ? ` • ${result.subtitle}` : ''}
                      </span>
                      {result.snippet && (
                        <span className={styles.optionSnippet}>
                          <HighlightedSnippet snippet={result.snippet} />
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}

          {trimmed.length >= SEARCH_MIN_QUERY_LENGTH && (
            <div
              id={optionId(options.length - 1)}
              role="option"
              aria-selected={activeIndex === options.length - 1}
              className={`${styles.option} ${styles.seeAll}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(options[options.length - 1])}
            >
              <span className={styles.optionIcon}>
                <SearchIcon size={20} />
              </span>
              <span className={styles.optionText}>
                <span className={styles.optionTitle}>See all section results for “{trimmed}”</span>
              </span>
            </div>
          )}
        </div>

        <div className={styles.status} role="status" aria-live="polite">
          {tooShort && `Type at least ${SEARCH_MIN_QUERY_LENGTH} characters to search.`}
          {!tooShort && isPending && !data && <span className={styles.searching}>Searching…</span>}
          {!tooShort && !isPending && data && data.groups.length === 0 && `No Acts, sections or case laws match “${data.query}”.`}
          {!tooShort && data?.failedTypes && data.failedTypes.length > 0 && (
            <span className={styles.partial}>
              {data.failedTypes.map((t) => searchTypeLabel[t]).join(' and ')} couldn’t be searched right now.
            </span>
          )}
        </div>
        {!tooShort && results.status === 'error' && (
          <div className={styles.error} role="alert">
            <span>{results.error.message || 'Search is unavailable right now.'}</span>
            <button
              type="button"
              className={styles.retry}
              onMouseDown={(event) => event.preventDefault()}
              onClick={results.retry}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
