import { useState, type ReactNode } from 'react';
import { hasCode } from '@/api/errors';
import {
  downloadProfessorNote,
  downloadStudentNote,
  noteKind,
  professorNoteFilePath,
  saveDownload,
  studentNoteFilePath,
  type SubjectNote,
} from '@/api/notes';
import { PdfViewer } from '@/components/PdfViewer';
import styles from './notes.module.css';
import ui from '@/components/ui.module.css';

/**
 * Opens a note (UI spec F5c, "Open a note"): a PDF in the full-screen viewer, a Word or PowerPoint
 * file as a download. The choice follows the canonical `file.contentType`, not the file name.
 * Returns the button (with the viewer it opens) and an inline error for the card to place under
 * itself. `onGone` runs when the note no longer exists, so the list can refresh.
 */
export function useOpenNote(note: SubjectNote, area: 'professor' | 'student', onGone: () => void): { button: ReactNode; error: ReactNode } {
  const [viewing, setViewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPdf = noteKind(note.file.contentType) === 'pdf';

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const download = await (area === 'professor' ? downloadProfessorNote : downloadStudentNote)(note.id);
      saveDownload(download, note.file.originalFilename);
    } catch (err) {
      if (hasCode(err, 'NOT_FOUND')) {
        setError('This note no longer exists. The list has been refreshed.');
        onGone();
      } else {
        setError("This file couldn't be opened. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  const button = isPdf ? (
    <>
      <button type="button" className={ui.primaryButton} onClick={() => setViewing(true)}>
        View
      </button>
      {viewing && (
        <PdfViewer
          path={area === 'professor' ? professorNoteFilePath(note.id) : studentNoteFilePath(note.id)}
          title={note.title}
          onClose={() => setViewing(false)}
        />
      )}
    </>
  ) : (
    <button type="button" className={ui.primaryButton} onClick={() => void save()} disabled={busy}>
      {busy ? 'Downloading…' : 'Download'}
    </button>
  );

  return {
    button,
    error: (
      <div role="alert" className={styles.error}>
        {error && <p className={ui.formError}>{error}</p>}
      </div>
    ),
  };
}
