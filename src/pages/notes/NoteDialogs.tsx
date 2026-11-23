/**
 * The note dialogs of UI spec F5c: upload, edit, replace the file, and delete (professor and
 * C_ADMIN). Every successful write refreshes all note lists. The forms are rendered only while
 * their dialog is open, so each opening starts from empty.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '@/api/client';
import { errorMessage, hasCode } from '@/api/errors';
import {
  NOTE_ACCEPT,
  NOTE_LIMITS,
  checkNoteFile,
  deleteCollegeNote,
  deleteNote,
  replaceNoteFile,
  sharedBy,
  updateNote,
  uploadNote,
  type SubjectNote,
} from '@/api/notes';
import type { Subject } from '@/api/subjects';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Dialog } from '@/components/Dialog';
import { Banner } from '@/components/DialogForm';
import { TextAreaField, TextField } from '@/components/Field';
import { FileDropzone } from '@/components/FileDropzone';
import { flash } from '@/components/flash';
import { saveErrors, type FieldErrors } from '@/lib/forms';
import { formatBytes } from '@/lib/format';
import { useRefreshSubjects } from '@/pages/college/subjects/subjectQueries';
import { useRefreshNotes } from './noteQueries';
import notes from './notes.module.css';
import ui from '@/components/ui.module.css';

// ---------- The file field and the upload ----------

/** The text under the file field for a failed upload, or null when the error isn't about the file. */
function fileProblemFrom(err: unknown): string | null {
  if (hasCode(err, 'INVALID_FILE')) {
    return `This file can't be used: ${err.message.replace(/^file:\s*/, '')}`;
  }
  if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && /^file:\s*is larger than the upload limit/.test(err.message)) {
    return 'This file is too large. Files can be at most 20 MB.';
  }
  return null;
}

/** The chosen file, its client-side check, and an upload with progress that can be stopped. */
function useNoteUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);

  async function choose(chosen: File) {
    const problem = await checkNoteFile(chosen);
    setFile(problem ? null : chosen);
    setFileError(problem);
  }

  function remove() {
    setFile(null);
    setFileError(null);
  }

  /** Runs `send` with the options that report progress and abort. */
  async function run<T>(send: (options: { onProgress: (fraction: number) => void; signal: AbortSignal }) => Promise<T>) {
    const abort = new AbortController();
    controller.current = abort;
    setProgress(0);
    try {
      return await send({ onProgress: setProgress, signal: abort.signal });
    } finally {
      controller.current = null;
      setProgress(null);
    }
  }

  return { file, fileError, setFileError, choose, remove, progress, run, stop: () => controller.current?.abort() };
}

function NoteFileField({ id, upload, disabled }: { id: string; upload: ReturnType<typeof useNoteUpload>; disabled: boolean }) {
  return (
    <FileDropzone
      id={id}
      label="File"
      prompt="Choose a file or drop it here"
      hint="PDF, Word (.docx) or PowerPoint (.pptx), up to 20 MB."
      accept={NOTE_ACCEPT}
      file={upload.file}
      error={upload.fileError}
      disabled={disabled}
      onFile={(chosen) => void upload.choose(chosen)}
      onRemove={upload.remove}
    />
  );
}

/** The progress bar and the buttons: while uploading, Cancel becomes **Stop upload**. */
function UploadButtons({
  busy,
  progress,
  submitLabel,
  onCancel,
  onStop,
}: {
  busy: boolean;
  progress: number | null;
  submitLabel: string;
  onCancel: () => void;
  onStop: () => void;
}) {
  const percent = Math.round((progress ?? 0) * 100);
  return (
    <>
      {busy && (
        <div className={notes.progressRow}>
          <progress className={notes.progress} max={100} value={percent} aria-label="Upload progress" />
        </div>
      )}
      <div className={ui.dialogActions}>
        <button type="button" className={ui.secondaryButton} onClick={busy ? onStop : onCancel}>
          {busy ? 'Stop upload' : 'Cancel'}
        </button>
        <button type="submit" className={ui.primaryButton} disabled={busy}>
          {busy ? `Uploading… ${percent}%` : submitLabel}
        </button>
      </div>
    </>
  );
}

/** Tells the dialog that owns the "discard?" prompt whether the form has edits, and that it hasn't once it unmounts. */
function useReportDirty(onDirtyChange: (dirty: boolean) => void, value: boolean) {
  useEffect(() => {
    onDirtyChange(value);
  });
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
}

/** The "dirty" flag of a dialog's form, as a ref (it changes no rendering) plus the stable setter the form calls. */
function useDirtyFlag() {
  const dirty = useRef(false);
  const setDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  return { dirty, setDirty };
}

// ---------- Upload ----------

const UPLOAD_FIELDS = ['subjectId', 'title', 'description'] as const;
const FIELD_IDS: Record<string, string> = {
  subjectId: 'note-subject',
  title: 'note-title',
  description: 'note-description',
  file: 'note-file',
};

export function UploadNoteDialog({
  open,
  subjects,
  initialSubjectId,
  onClose,
}: {
  open: boolean;
  subjects: Subject[];
  /** Pre-fills the subject (the list's filter). */
  initialSubjectId: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { dirty, setDirty } = useDirtyFlag();

  function requestClose() {
    if (dirty.current) setConfirming(true);
    else onClose();
  }

  return (
    <>
      <Dialog open={open} title="Upload a note" busy={busy} onClose={requestClose}>
        <UploadForm
          subjects={subjects}
          initialSubjectId={initialSubjectId}
          busy={busy}
          setBusy={setBusy}
          onDirtyChange={setDirty}
          onCancel={requestClose}
          onUploaded={onClose}
        />
      </Dialog>
      <ConfirmDialog
        open={confirming}
        title="Discard this note?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirming(false);
          onClose();
        }}
        onCancel={() => setConfirming(false)}
      >
        <p>Your title, description and file will be lost.</p>
      </ConfirmDialog>
    </>
  );
}

function UploadForm({
  subjects,
  initialSubjectId,
  busy,
  setBusy,
  onDirtyChange,
  onCancel,
  onUploaded,
}: {
  subjects: Subject[];
  initialSubjectId: string;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onUploaded: () => void;
}) {
  const refreshNotes = useRefreshNotes();
  const refreshSubjects = useRefreshSubjects();
  const upload = useNoteUpload();
  const startSubject = subjects.some((s) => s.id === initialSubjectId) ? initialSubjectId : '';
  const [subjectId, setSubjectId] = useState(startSubject);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);

  useReportDirty(onDirtyChange, !!(title || description || upload.file || subjectId !== startSubject));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found: FieldErrors = {};
    if (!subjectId) found.subjectId = 'Choose a subject.';
    if (!title.trim()) found.title = 'Enter a title.';
    else if (title.trim().length > NOTE_LIMITS.title) found.title = 'Titles can be at most 200 characters.';
    if (description.length > NOTE_LIMITS.description) found.description = 'Descriptions can be at most 2,000 characters.';
    const noFile = !upload.file;
    setErrors(found);
    setBanner(null);
    if (noFile && !upload.fileError) upload.setFileError('Choose a file.');
    const first = [...UPLOAD_FIELDS, 'file'].find((key) => (key === 'file' ? noFile : found[key]));
    if (first) {
      document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }
    const chosen = upload.file!;
    setBusy(true);
    try {
      await upload.run((options) => uploadNote({ subjectId, title, description, file: chosen }, options));
      setBusy(false);
      refreshNotes();
      flash(`'${title.trim()}' shared with students.`);
      onUploaded();
    } catch (err) {
      setBusy(false);
      if (hasCode(err, 'ABORTED')) {
        setBanner('Upload stopped.');
        return;
      }
      const problem = fileProblemFrom(err);
      if (problem) {
        upload.setFileError(problem);
        document.getElementById(FIELD_IDS.file)?.focus();
      } else if (hasCode(err, 'NOT_FOUND')) {
        setBanner("You can't share notes for this subject any more.");
        refreshSubjects();
      } else {
        const next = saveErrors(err, UPLOAD_FIELDS);
        setErrors(next.fields);
        setBanner(next.banner);
        const firstError = UPLOAD_FIELDS.find((key) => next.fields[key]);
        if (firstError) document.getElementById(FIELD_IDS[firstError])?.focus();
      }
    }
  }

  const clear = (key: string) => setErrors((e) => ({ ...e, [key]: '' }));

  return (
    <form className={ui.dialogForm} noValidate onSubmit={(event) => void handleSubmit(event)}>
      <div className={ui.field}>
        <label htmlFor={FIELD_IDS.subjectId} className={ui.label}>
          Subject<span className={ui.required}> (required)</span>
        </label>
        <select
          id={FIELD_IDS.subjectId}
          className={ui.input}
          value={subjectId}
          disabled={busy}
          aria-required="true"
          aria-invalid={errors.subjectId ? true : undefined}
          aria-describedby={errors.subjectId ? 'note-subject-error' : undefined}
          onChange={(event) => {
            setSubjectId(event.target.value);
            clear('subjectId');
          }}
        >
          <option value="">Choose a subject</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.code} · {subject.name}
            </option>
          ))}
        </select>
        {errors.subjectId && (
          <span id="note-subject-error" className={ui.fieldError}>
            {errors.subjectId}
          </span>
        )}
      </div>
      <TextField
        id={FIELD_IDS.title}
        label="Title"
        required
        value={title}
        onChange={(value) => {
          setTitle(value);
          clear('title');
        }}
        error={errors.title || undefined}
        maxLength={NOTE_LIMITS.title}
      />
      <TextAreaField
        id={FIELD_IDS.description}
        label="Description"
        rows={4}
        value={description}
        onChange={(value) => {
          setDescription(value);
          clear('description');
        }}
        error={errors.description || undefined}
        maxLength={NOTE_LIMITS.description}
      />
      <NoteFileField id={FIELD_IDS.file} upload={upload} disabled={busy} />
      <Banner message={banner} />
      <UploadButtons busy={busy} progress={upload.progress} submitLabel="Upload" onCancel={onCancel} onStop={upload.stop} />
    </form>
  );
}

// ---------- Edit ----------

export function EditNoteDialog({ note, open, onClose }: { note: SubjectNote; open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { dirty, setDirty } = useDirtyFlag();

  function requestClose() {
    if (dirty.current) setConfirming(true);
    else onClose();
  }

  return (
    <>
      <Dialog open={open} title="Edit note" busy={busy} onClose={requestClose}>
        <EditForm note={note} busy={busy} setBusy={setBusy} onDirtyChange={setDirty} onCancel={requestClose} onSaved={onClose} />
      </Dialog>
      <ConfirmDialog
        open={confirming}
        title="Discard your changes?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          setConfirming(false);
          onClose();
        }}
        onCancel={() => setConfirming(false)}
      >
        <p>Your changes to this note will be lost.</p>
      </ConfirmDialog>
    </>
  );
}

function EditForm({
  note,
  busy,
  setBusy,
  onDirtyChange,
  onCancel,
  onSaved,
}: {
  note: SubjectNote;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const refreshNotes = useRefreshNotes();
  const [title, setTitle] = useState(note.title);
  const [description, setDescription] = useState(note.description ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);

  useReportDirty(onDirtyChange, title !== note.title || description !== (note.description ?? ''));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found: FieldErrors = {};
    if (!title.trim()) found.title = 'Enter a title.';
    else if (title.trim().length > NOTE_LIMITS.title) found.title = 'Titles can be at most 200 characters.';
    if (description.length > NOTE_LIMITS.description) found.description = 'Descriptions can be at most 2,000 characters.';
    setErrors(found);
    setBanner(null);
    const first = (['title', 'description'] as const).find((key) => found[key]);
    if (first) {
      document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }
    setBusy(true);
    try {
      await updateNote(note.id, { title, description });
      setBusy(false);
      refreshNotes();
      flash('Note updated.');
      onSaved();
    } catch (err) {
      setBusy(false);
      if (hasCode(err, 'NOT_FOUND')) {
        setBanner('This note no longer exists, or you no longer teach its subject. The list has been refreshed.');
        refreshNotes();
        return;
      }
      const next = saveErrors(err, ['title', 'description']);
      setErrors(next.fields);
      setBanner(next.banner);
    }
  }

  const clear = (key: string) => setErrors((e) => ({ ...e, [key]: '' }));

  return (
    <form className={ui.dialogForm} noValidate onSubmit={(event) => void handleSubmit(event)}>
      <TextField
        id={FIELD_IDS.title}
        label="Title"
        required
        value={title}
        onChange={(value) => {
          setTitle(value);
          clear('title');
        }}
        error={errors.title || undefined}
        maxLength={NOTE_LIMITS.title}
      />
      <TextAreaField
        id={FIELD_IDS.description}
        label="Description"
        rows={4}
        value={description}
        onChange={(value) => {
          setDescription(value);
          clear('description');
        }}
        error={errors.description || undefined}
        maxLength={NOTE_LIMITS.description}
      />
      <Banner message={banner} />
      <div className={ui.dialogActions}>
        <button type="button" className={ui.secondaryButton} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className={ui.primaryButton} disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

// ---------- Replace the file ----------

export function ReplaceNoteFileDialog({ note, open, onClose }: { note: SubjectNote; open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      title={`Replace the file of '${note.title}'`}
      description={
        <p>
          Students get the new file straight away. The current file ({note.file.originalFilename},{' '}
          {formatBytes(note.file.sizeBytes)}) is deleted.
        </p>
      }
      busy={busy}
      onClose={onClose}
    >
      <ReplaceForm note={note} busy={busy} setBusy={setBusy} onCancel={onClose} onReplaced={onClose} />
    </Dialog>
  );
}

function ReplaceForm({
  note,
  busy,
  setBusy,
  onCancel,
  onReplaced,
}: {
  note: SubjectNote;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCancel: () => void;
  onReplaced: () => void;
}) {
  const refreshNotes = useRefreshNotes();
  const upload = useNoteUpload();
  const [banner, setBanner] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBanner(null);
    if (!upload.file) {
      if (!upload.fileError) upload.setFileError('Choose a file.');
      document.getElementById('replace-file')?.focus();
      return;
    }
    const chosen = upload.file;
    setBusy(true);
    try {
      await upload.run((options) => replaceNoteFile(note.id, chosen, options));
      setBusy(false);
      refreshNotes();
      flash('File replaced.');
      onReplaced();
    } catch (err) {
      setBusy(false);
      if (hasCode(err, 'ABORTED')) {
        setBanner('Upload stopped.');
        return;
      }
      const problem = fileProblemFrom(err);
      if (problem) {
        upload.setFileError(problem);
      } else if (hasCode(err, 'NOT_FOUND')) {
        setBanner('This note no longer exists, or you no longer teach its subject. The list has been refreshed.');
        refreshNotes();
      } else {
        setBanner(errorMessage(err));
      }
    }
  }

  return (
    <form className={ui.dialogForm} noValidate onSubmit={(event) => void handleSubmit(event)}>
      <NoteFileField id="replace-file" upload={upload} disabled={busy} />
      <Banner message={banner} />
      <UploadButtons busy={busy} progress={upload.progress} submitLabel="Replace file" onCancel={onCancel} onStop={upload.stop} />
    </form>
  );
}

// ---------- Delete ----------

/**
 * Delete for the uploading professor (`as="professor"`) or the C_ADMIN (`as="college"`, which
 * names the uploader and the subject). A `404` means it is gone already, which is the goal.
 */
export function DeleteNoteDialog({
  note,
  as,
  open,
  onClose,
}: {
  note: SubjectNote;
  as: 'professor' | 'college';
  open: boolean;
  onClose: () => void;
}) {
  const refreshNotes = useRefreshNotes();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setError(null);
    onClose();
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await (as === 'college' ? deleteCollegeNote : deleteNote)(note.id);
    } catch (err) {
      if (!hasCode(err, 'NOT_FOUND')) {
        setBusy(false);
        setError(errorMessage(err));
        return;
      }
    }
    setBusy(false);
    refreshNotes();
    flash('Note deleted.');
    close();
  }

  
  return (
    <ConfirmDialog
      open={open}
      title={`Delete '${note.title}'?`}
      confirmLabel={busy ? 'Deleting…' : 'Delete note'}
      destructive
      busy={busy}
      onConfirm={() => void confirm()}
      onCancel={close}
    >
      <p>
        {as === 'college' ? `${sharedBy(note)} for ${note.subject.code}. ` : ''}Students lose access to this file. This can&rsquo;t be
        undone.
      </p>
      <Banner message={error} />
    </ConfirmDialog>
  );
}
