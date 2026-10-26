import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { listProfessorNotes, type SubjectNote } from '@/api/notes';
import { hasCode } from '@/api/errors';
import { listSubjects } from '@/api/subjects';
import { useAuth } from '@/auth/AuthContext';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { RowMenu } from '@/components/RowMenu';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { TABLE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { queryKeys } from '@/lib/queryClient';
import { pageFromParam } from '@/lib/urlParams';
import { DeleteNoteDialog, EditNoteDialog, ReplaceNoteFileDialog, UploadNoteDialog } from './NoteDialogs';
import { NoteCard } from './NoteCard';
import { NoteResults, SubjectFilter } from './NoteList';
import { useRefreshNotes } from './noteQueries';
import { useOpenNote } from './useOpenNote';
import ui from '@/components/ui.module.css';

type NoteAction = 'edit' | 'replace' | 'delete';

/**
 * `/professor/notes` (UI spec F5c.3): share and manage study notes for the subjects the professor
 * teaches. Every note of those subjects is listed; only the uploader's own can be changed.
 */
export function ProfessorNotesPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const subjectId = params.get('subjectId') ?? '';
  const page = pageFromParam(params.get('page'));
  const wide = useMediaQuery(TABLE_QUERY);
  const [uploading, setUploading] = useState(false);
  const [active, setActive] = useState<{ note: SubjectNote; action: NoteAction } | null>(null);

  // `GET /college/subjects` already returns only the subjects mapped to the caller.
  const subjects = useCachedQuery(queryKeys.subjects.list(''), (signal) => listSubjects(undefined, signal));
  const noSubjects = subjects.status === 'success' && subjects.data.length === 0;
  const results = useCachedQuery(
    queryKeys.notes.professor({ subjectId, page }),
    (signal) => listProfessorNotes({ subjectId: subjectId || undefined, page }, signal),
    { enabled: subjects.status === 'success' && !noSubjects },
  );

  function setFilter(next: string) {
    setParams(next ? { subjectId: next } : {});
  }
  function setPage(next: number) {
    const copy = new URLSearchParams(params);
    if (next > 0) copy.set('page', String(next + 1));
    else copy.delete('page');
    setParams(copy);
  }

  const subjectList = subjects.status === 'success' ? subjects.data : [];
  const chosen = subjectList.find((s) => s.id === subjectId);
  const gone = results.status === 'error' && hasCode(results.error, 'NOT_FOUND');
  const canUpload = subjectList.length > 0;

  return (
    <>
      <div className={ui.titleRow}>
        <div>
          <p className={ui.eyebrow}>Teaching</p>
          <h1 className={ui.title}>Study notes</h1>
          <p className={ui.hint}>Notes you share here are visible to every student at your college.</p>
        </div>
        <div className={ui.headerLinks}>
          <button type="button" className={ui.primaryButton} onClick={() => setUploading(true)} disabled={!canUpload}>
            Upload note
          </button>
        </div>
      </div>
      {subjects.status === 'success' && !canUpload && (
        <p className={ui.hint}>You aren&rsquo;t assigned to any subjects yet.</p>
      )}

      {subjects.status === 'loading' && !subjects.staleData && <LoadingState label="Loading notes" />}
      {subjects.status === 'error' && <ErrorState error={subjects.error} onRetry={subjects.retry} />}

      {noSubjects && (
        <EmptyState>You aren&rsquo;t assigned to any subjects yet. Your college admin assigns subjects to professors.</EmptyState>
      )}

      {canUpload && (
        <>
          <div className={ui.filterBar} role="search" aria-label="Filter notes">
            <SubjectFilter
              id="notes-subject"
              subjects={subjectList}
              value={subjectId}
              allLabel="All my subjects"
              onChange={setFilter}
            />
          </div>

          {gone ? (
            <EmptyState
              actions={
                <button type="button" className={ui.secondaryButton} onClick={() => setFilter('')}>
                  Show all subjects
                </button>
              }
            >
              You no longer teach this subject, or it was removed.
            </EmptyState>
          ) : (
            <NoteResults
              results={results}
              page={page}
              onPage={setPage}
              empty={
                <EmptyState
                  actions={
                    <button type="button" className={ui.primaryButton} onClick={() => setUploading(true)}>
                      Upload note
                    </button>
                  }
                >
                  {chosen
                    ? `No notes for ${chosen.code} yet.`
                    : 'No notes yet. Share lecture slides, handouts or reading lists with your students.'}
                </EmptyState>
              }
            >
              {(notes) => (
                <ul className={ui.cardList} aria-label="Notes">
                  {notes.map((note) => (
                    <li key={note.id}>
                      <ProfessorNote
                        note={note}
                        mine={!!user && note.uploadedBy?.id === user.id}
                        compact={!wide}
                        onAction={(action) => setActive({ note, action })}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </NoteResults>
          )}
        </>
      )}

      <UploadNoteDialog open={uploading} subjects={subjectList} initialSubjectId={subjectId} onClose={() => setUploading(false)} />
      {active && (
        <>
          <EditNoteDialog note={active.note} open={active.action === 'edit'} onClose={() => setActive(null)} />
          <ReplaceNoteFileDialog note={active.note} open={active.action === 'replace'} onClose={() => setActive(null)} />
          <DeleteNoteDialog note={active.note} as="professor" open={active.action === 'delete'} onClose={() => setActive(null)} />
        </>
      )}
    </>
  );
}

function ProfessorNote({
  note,
  mine,
  compact,
  onAction,
}: {
  note: SubjectNote;
  mine: boolean;
  compact: boolean;
  onAction: (action: NoteAction) => void;
}) {
  const refresh = useRefreshNotes();
  const open = useOpenNote(note, 'professor', refresh);
  return (
    <NoteCard
      note={note}
      actions={
        <>
          {open.button}
          {mine &&
            (compact ? (
              <RowMenu
                label={`More actions for ${note.title}`}
                items={[
                  { label: 'Edit', onSelect: () => onAction('edit') },
                  { label: 'Replace file', onSelect: () => onAction('replace') },
                  { label: 'Delete', onSelect: () => onAction('delete'), danger: true },
                ]}
              />
            ) : (
              <>
                <button type="button" className={ui.secondaryButton} onClick={() => onAction('edit')}>
                  Edit
                </button>
                <button type="button" className={ui.secondaryButton} onClick={() => onAction('replace')}>
                  Replace file
                </button>
                <button type="button" className={ui.dangerButton} onClick={() => onAction('delete')}>
                  Delete
                </button>
              </>
            ))}
        </>
      }
    >
      {open.error}
    </NoteCard>
  );
}
