import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listStudentNotes, type SubjectNote } from '@/api/notes';
import { listSubjects } from '@/api/subjects';
import { EmptyState } from '@/components/QueryStates';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { queryKeys } from '@/lib/queryClient';
import { pageFromParam } from '@/lib/urlParams';
import { NoteCard } from './NoteCard';
import { NoteResults, SubjectFilter } from './NoteList';
import { useRefreshNotes } from './noteQueries';
import { useOpenNote } from './useOpenNote';
import ui from '@/components/ui.module.css';

const SEARCH_MAX = 100;

/**
 * `/student/notes` (UI spec F5c.4): the notes the college's professors have shared, filtered by
 * subject and a search on title and description. All three filters and the page are in the URL.
 */
export function StudentNotesPage() {
  const [params, setParams] = useSearchParams();
  const subjectId = params.get('subjectId') ?? '';
  const q = (params.get('q') ?? '').slice(0, SEARCH_MAX);
  const page = pageFromParam(params.get('page'));
  const [search, setSearch] = useState(q);
  const searchTimer = useRef<number | undefined>(undefined);

  // Back/Forward (or Clear filters) change `q`: show it in the box (adjusting state during render).
  const [shownQ, setShownQ] = useState(q);
  if (q !== shownQ) {
    setShownQ(q);
    if (search.trim() !== q) setSearch(q);
  }
  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  function update(next: { subjectId?: string; q?: string; page?: number }) {
    // Functional, so the debounced search never writes over a subject chosen meanwhile.
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        for (const key of ['subjectId', 'q'] as const) {
          if (next[key] === undefined) continue;
          if (next[key]) copy.set(key, next[key]);
          else copy.delete(key);
        }
        // Any filter change returns to the first page; only a page change sets it.
        if (next.page && next.page > 0) copy.set('page', String(next.page + 1));
        else copy.delete('page');
        return copy;
      },
      next.q !== undefined && next.subjectId === undefined ? { replace: true } : undefined,
    );
  }

  function changeSearch(value: string) {
    setSearch(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => update({ q: value.trim() }), 300);
  }

  function clearFilters() {
    window.clearTimeout(searchTimer.current);
    setSearch('');
    setParams({});
  }

  const subjects = useCachedQuery(queryKeys.subjects.list(''), (signal) => listSubjects(undefined, signal));
  const results = useCachedQuery(queryKeys.notes.student({ subjectId, q, page }), (signal) =>
    listStudentNotes({ subjectId: subjectId || undefined, q: q || undefined, page }, signal),
  );
  const filtered = !!subjectId || !!q;
  const clear = (
    <button type="button" className={ui.secondaryButton} onClick={clearFilters}>
      Clear filters
    </button>
  );

  return (
    <>
      <p className={ui.eyebrow}>My studies</p>
      <h1 className={ui.title}>Study notes</h1>

      <div className={ui.filterBar} role="search" aria-label="Filter notes">
        <SubjectFilter
          id="notes-subject"
          subjects={subjects.status === 'success' ? subjects.data : []}
          value={subjectId}
          allLabel="All subjects"
          onChange={(value) => update({ subjectId: value, q })}
        />
        <div className={`${ui.field} ${ui.fieldGrow}`}>
          <label htmlFor="notes-search" className={ui.label}>
            Search notes
          </label>
          <input
            id="notes-search"
            type="search"
            className={ui.input}
            placeholder="Search titles and descriptions"
            maxLength={SEARCH_MAX}
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
            autoComplete="off"
          />
        </div>
        {filtered && clear}
      </div>

      <NoteResults
        results={results}
        page={page}
        onPage={(next) => update({ subjectId, q, page: next })}
        empty={
          filtered ? (
            <EmptyState actions={clear}>No notes match these filters.</EmptyState>
          ) : (
            <EmptyState>Your professors haven&rsquo;t shared any notes yet.</EmptyState>
          )
        }
      >
        {(notes) => (
          <ul className={ui.cardList} aria-label="Notes">
            {notes.map((note) => (
              <li key={note.id}>
                <StudentNote note={note} />
              </li>
            ))}
          </ul>
        )}
      </NoteResults>
    </>
  );
}

function StudentNote({ note }: { note: SubjectNote }) {
  const refresh = useRefreshNotes();
  const open = useOpenNote(note, 'student', refresh);
  return (
    <NoteCard note={note} actions={open.button}>
      {open.error}
    </NoteCard>
  );
}
