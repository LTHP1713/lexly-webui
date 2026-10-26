import { useState, type ReactNode } from 'react';
import { NOTE_KIND_LABELS, noteKind, sharedBy, type SubjectNote } from '@/api/notes';
import { NotesIcon } from '@/components/icons/Icons';
import { formatBytes, formatDate, formatInstant } from '@/lib/format';
import styles from './notes.module.css';
import ui from '@/components/ui.module.css';

/** The file type as an icon plus its text label (UI spec F5c, `FileTypeIcon`): "PDF", "Word" or "PowerPoint". */
export function FileTypeIcon({ contentType }: { contentType: string }) {
  const kind = noteKind(contentType);
  return (
    <span className={`${styles.typeChip} ${styles[`type_${kind ?? 'other'}`]}`}>
      <NotesIcon size={14} />
      {kind ? NOTE_KIND_LABELS[kind] : 'File'}
    </span>
  );
}

const LONG_DESCRIPTION = 180;

/**
 * One note (UI spec F5c, `NoteCard`): the same card for the professor, the student and, on a
 * phone, the C_ADMIN. The description is plain text; a long one is clamped to 3 lines. What the
 * viewer can do is passed in as `actions`, and `children` render under the card (an inline error).
 */
export function NoteCard({ note, actions, children }: { note: SubjectNote; actions?: ReactNode; children?: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const clampable = !!note.description && (note.description.length > LONG_DESCRIPTION || note.description.split('\n').length > 3);
  return (
    <article className={styles.card} aria-label={note.title}>
      <div className={styles.body}>
        <div className={styles.topLine}>
          <FileTypeIcon contentType={note.file.contentType} />
          <span className={ui.codeChip}>{note.subject.code}</span>
          <span className={styles.subject}>{note.subject.name}</span>
        </div>
        <h2 className={styles.title}>{note.title}</h2>
        {note.description && (
          <>
            <p className={`${styles.description} ${clampable && !expanded ? styles.clamped : ''}`}>{note.description}</p>
            {clampable && (
              <button type="button" className={ui.linkButton} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </>
        )}
        <p className={styles.facts}>
          {formatBytes(note.file.sizeBytes)} · {sharedBy(note)} ·{' '}
          <span title={formatInstant(note.updatedAt)}>Updated {formatDate(note.updatedAt)}</span>
        </p>
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
      {children}
    </article>
  );
}
