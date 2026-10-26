import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listCollegeUsers } from '@/api/collegeUsers';
import { hasCode } from '@/api/errors';
import { listCollegeNotes, noteKind, NOTE_KIND_LABELS, type SubjectNote } from '@/api/notes';
import { listSubjects } from '@/api/subjects';
import { EmptyState } from '@/components/QueryStates';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { TABLE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { formatBytes, formatDate, formatInstant } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { pageFromParam } from '@/lib/urlParams';
import { DeleteNoteDialog } from './NoteDialogs';
import { NoteCard } from './NoteCard';
import { NoteResults, SubjectFilter } from './NoteList';
import ui from '@/components/ui.module.css';

const PROFESSOR_QUERY = { role: 'C_PROFESSOR', page: 0, size: 100, sort: 'fullName,asc' } as const;

function typeLabel(note: SubjectNote): string {
  const kind = noteKind(note.file.contentType);
  return kind ? NOTE_KIND_LABELS[kind] : 'File';
}

function uploaderName(note: SubjectNote): string {
  return note.uploadedBy ? (note.uploadedBy.fullName ?? 'A professor') : 'Former professor';
}

/** The description's first line, muted under the title. */
function firstLine(text: string | null): string | null {
  return text?.split('\n').find((line) => line.trim()) ?? null;
}

/**
 * `/college/notes` (UI spec F5c.5): what's shared at the college, with Delete. The C_ADMIN has
 * metadata only: the API offers no View or Download for this role.
 */
export function CollegeNotesPage() {
  const [params, setParams] = useSearchParams();
  const subjectId = params.get('subjectId') ?? '';
  const professorId = params.get('professorId') ?? '';
  const page = pageFromParam(params.get('page'));
  const wide = useMediaQuery(TABLE_QUERY);
  const [deleting, setDeleting] = useState<SubjectNote | null>(null);

  const subjects = useCachedQuery(queryKeys.subjects.list(''), (signal) => listSubjects(undefined, signal));
  const professors = useCachedQuery(queryKeys.collegeUsers.list(PROFESSOR_QUERY), (signal) =>
    listCollegeUsers(PROFESSOR_QUERY, signal),
  );
  const results = useCachedQuery(queryKeys.notes.college({ subjectId, professorId, page }), (signal) =>
    listCollegeNotes({ subjectId: subjectId || undefined, professorId: professorId || undefined, page }, signal),
  );

  function setFilter(key: 'subjectId' | 'professorId', value: string) {
    const copy = new URLSearchParams(params);
    if (value) copy.set(key, value);
    else copy.delete(key);
    copy.delete('page');
    setParams(copy);
  }
  function setPage(next: number) {
    const copy = new URLSearchParams(params);
    if (next > 0) copy.set('page', String(next + 1));
    else copy.delete('page');
    setParams(copy);
  }
  const filtered = !!subjectId || !!professorId;
  const clear = (
    <button type="button" className={ui.secondaryButton} onClick={() => setParams({})}>
      Clear filters
    </button>
  );
  const professorList = professors.status === 'success' ? professors.data.content : [];
  const gone = results.status === 'error' && hasCode(results.error, 'NOT_FOUND');

  return (
    <>
      <nav aria-label="Breadcrumb" className={ui.breadcrumb}>
        <Link to="/college">College</Link> / <span aria-current="page">Study notes</span>
      </nav>
      <p className={ui.eyebrow}>College</p>
      <h1 className={ui.title}>Study notes</h1>
      <p className={ui.hint}>
        Notes professors have shared with your students. You can remove a note, but only professors and students can open the
        files.
      </p>

      <div className={ui.filterBar} role="search" aria-label="Filter notes">
        <SubjectFilter
          id="notes-subject"
          subjects={subjects.status === 'success' ? subjects.data : []}
          value={subjectId}
          allLabel="All subjects"
          onChange={(value) => setFilter('subjectId', value)}
        />
        <div className={ui.field}>
          <label htmlFor="notes-professor" className={ui.label}>
            Professor
          </label>
          <select
            id="notes-professor"
            className={ui.input}
            value={professorId}
            onChange={(event) => setFilter('professorId', event.target.value)}
          >
            <option value="">All professors</option>
            {professorId && !professorList.some((p) => p.id === professorId) && (
              <option value={professorId}>Selected professor</option>
            )}
            {professorList.map((professor) => (
              <option key={professor.id} value={professor.id}>
                {professor.fullName ?? professor.loginId ?? 'Unnamed professor'}
              </option>
            ))}
          </select>
        </div>
        {filtered && clear}
      </div>

      {gone ? (
        <EmptyState actions={clear}>This subject or professor no longer exists.</EmptyState>
      ) : (
        <NoteResults
          results={results}
          page={page}
          onPage={setPage}
          empty={
            filtered ? (
              <EmptyState actions={clear}>No notes match these filters.</EmptyState>
            ) : (
              <EmptyState>No professor has shared notes yet.</EmptyState>
            )
          }
        >
          {(notes) =>
            wide ? (
              <NoteTable notes={notes} onDelete={setDeleting} />
            ) : (
              <ul className={ui.cardList} aria-label="Notes">
                {notes.map((note) => (
                  <li key={note.id}>
                    <NoteCard
                      note={note}
                      actions={
                        <button type="button" className={ui.dangerButton} onClick={() => setDeleting(note)}>
                          Delete
                        </button>
                      }
                    />
                  </li>
                ))}
              </ul>
            )
          }
        </NoteResults>
      )}

      {deleting && <DeleteNoteDialog note={deleting} as="college" open onClose={() => setDeleting(null)} />}
    </>
  );
}

function NoteTable({ notes, onDelete }: { notes: SubjectNote[]; onDelete: (note: SubjectNote) => void }) {
  return (
    <div className={ui.tableWrap}>
      <table className={ui.table}>
        <caption className={ui.visuallyHidden}>Study notes</caption>
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">Subject</th>
            <th scope="col">Shared by</th>
            <th scope="col">Type</th>
            <th scope="col" className={ui.numeric}>
              Size
            </th>
            <th scope="col">Updated</th>
            <th scope="col">
              <span className={ui.visuallyHidden}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {notes.map((note) => (
            <tr key={note.id}>
              <td>
                <span className={ui.cellTitle}>{note.title}</span>
                {firstLine(note.description) && <span className={ui.cellSub}>{firstLine(note.description)}</span>}
              </td>
              <td>
                <span className={ui.codeChip}>{note.subject.code}</span>
              </td>
              <td>{uploaderName(note)}</td>
              <td>{typeLabel(note)}</td>
              <td className={ui.numeric}>{formatBytes(note.file.sizeBytes)}</td>
              <td>
                <span title={formatInstant(note.updatedAt)}>{formatDate(note.updatedAt)}</span>
              </td>
              <td>
                <button type="button" className={`${ui.rowButton} ${ui.rowButtonDanger}`} onClick={() => onDelete(note)} aria-label={`Delete ${note.title}`}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
