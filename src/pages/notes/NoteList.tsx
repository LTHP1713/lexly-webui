import type { ReactNode } from 'react';
import type { Page } from '@/api/content';
import type { SubjectNote } from '@/api/notes';
import type { Subject } from '@/api/subjects';
import type { QueryResult } from '@/hooks/useApiQuery';
import { Pagination } from '@/components/Pagination';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { formatCount } from '@/lib/format';
import ui from '@/components/ui.module.css';

/** "All subjects" plus each subject as "CON-101 · Constitutional Law I". */
export function SubjectFilter({
  id,
  subjects,
  value,
  allLabel,
  onChange,
}: {
  id: string;
  subjects: Subject[];
  value: string;
  allLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={ui.field}>
      <label htmlFor={id} className={ui.label}>
        Subject
      </label>
      <select id={id} className={ui.input} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {value && !subjects.some((s) => s.id === value) && <option value={value}>Selected subject</option>}
        {subjects.map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.code} · {subject.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * A page of notes (UI spec F5c, "List"): skeleton cards while loading, the previous page kept
 * (`aria-busy`) while another loads, a polite result count, and Previous / Next. `empty` shows
 * for a page without notes; `children` renders the notes of one page.
 */
export function NoteResults({
  results,
  page,
  onPage,
  empty,
  children,
}: {
  results: QueryResult<Page<SubjectNote>>;
  page: number;
  onPage: (page: number) => void;
  empty: ReactNode;
  children: (notes: SubjectNote[]) => ReactNode;
}) {
  const data = results.status === 'success' ? results.data : results.status === 'loading' ? results.staleData : undefined;
  return (
    <>
      {results.status === 'loading' && !data && <LoadingState label="Loading notes" lines={4} />}
      {results.status === 'error' && <ErrorState error={results.error} onRetry={results.retry} />}
      {data && results.status !== 'error' && (
        <div aria-busy={results.status === 'loading'}>
          {data.content.length === 0 && data.totalElements === 0 ? (
            empty
          ) : (
            <>
              <p className={ui.resultMeta} aria-live="polite">
                <span className={ui.hint}>
                  {formatCount(data.totalElements)} {data.totalElements === 1 ? 'note' : 'notes'}
                </span>
              </p>
              {children(data.content)}
              <Pagination label="Note pages" page={page} totalPages={data.totalPages} onChange={onPage} />
            </>
          )}
        </div>
      )}
    </>
  );
}
