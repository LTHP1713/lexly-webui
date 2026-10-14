/**
 * The subject dialogs of UI spec F2.7. A save refreshes the subject list and that subject (F2.1);
 * a professor mapping also changes what the professors' user pages list, so it refreshes the
 * user views too.
 */
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listCollegeUsers } from '@/api/collegeUsers';
import type { UserSummary } from '@/api/colleges';
import { errorMessage, hasCode } from '@/api/errors';
import {
  SUBJECT_LIMITS,
  createSubject,
  deleteSubject,
  setSubjectProfessors,
  updateSubject,
  type Subject,
  type SubjectProfessor,
} from '@/api/subjects';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Dialog } from '@/components/Dialog';
import { Banner, DialogButtons } from '@/components/DialogForm';
import { TextAreaField, TextField } from '@/components/Field';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { saveErrors, type FieldErrors } from '@/lib/forms';
import { queryKeys } from '@/lib/queryClient';
import { useRefreshSubjects } from './subjectQueries';
import styles from '@/components/ui.module.css';

// ---------- Add / edit ----------

const SUBJECT_FIELDS = ['code', 'name', 'description'] as const;
const FIELD_IDS: Record<string, string> = { code: 'subject-code', name: 'subject-name', description: 'subject-description' };

export function SubjectFormDialog({
  open,
  subject,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** `null` adds a subject. */
  subject: Subject | null;
  onClose: () => void;
  onSaved: (subject: Subject) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} title={subject ? 'Edit subject' : 'Add subject'} busy={busy} onClose={onClose}>
      <SubjectForm subject={subject} busy={busy} setBusy={setBusy} onCancel={onClose} onSaved={onSaved} />
    </Dialog>
  );
}

function SubjectForm({
  subject,
  busy,
  setBusy,
  onCancel,
  onSaved,
}: {
  subject: Subject | null;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCancel: () => void;
  onSaved: (subject: Subject) => void;
}) {
  const refresh = useRefreshSubjects();
  const [code, setCode] = useState(subject?.code ?? '');
  const [name, setName] = useState(subject?.name ?? '');
  const [description, setDescription] = useState(subject?.description ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found: FieldErrors = {};
    if (!code.trim()) found.code = 'Enter the subject code.';
    else if (code.trim().length > SUBJECT_LIMITS.code) found.code = `Use at most ${SUBJECT_LIMITS.code} characters.`;
    if (!name.trim()) found.name = 'Enter the subject name.';
    else if (name.trim().length > SUBJECT_LIMITS.name) found.name = `Use at most ${SUBJECT_LIMITS.name} characters.`;
    if (description.length > SUBJECT_LIMITS.description) {
      found.description = `Use at most ${formatLimit(SUBJECT_LIMITS.description)} characters.`;
    }
    setErrors(found);
    setBanner(null);
    const first = SUBJECT_FIELDS.find((key) => found[key]);
    if (first) {
      document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }
    const body = { code: code.trim().toUpperCase(), name: name.trim(), description: description.trim() ? description : null };
    setBusy(true);
    try {
      const saved = subject ? await updateSubject(subject.id, body) : await createSubject(body);
      setBusy(false);
      refresh();
      onSaved(saved);
    } catch (err) {
      setBusy(false);
      if (subject && hasCode(err, 'NOT_FOUND')) refresh();
      const next = saveErrors(err, SUBJECT_FIELDS);
      setErrors(next.fields);
      setBanner(next.banner);
      const firstError = SUBJECT_FIELDS.find((key) => next.fields[key]);
      if (firstError) document.getElementById(FIELD_IDS[firstError])?.focus();
    }
  }

  const clear = (key: string) => setErrors((e) => ({ ...e, [key]: '' }));

  return (
    <form className={styles.dialogForm} noValidate onSubmit={(event) => void handleSubmit(event)}>
      <TextField
        id={FIELD_IDS.code}
        label="Subject code"
        required
        hint="A short code such as CON-101."
        value={code}
        onChange={(value) => {
          setCode(value.toUpperCase());
          clear('code');
        }}
        error={errors.code || undefined}
        maxLength={SUBJECT_LIMITS.code}
        inputClassName={styles.mono}
      />
      <TextField
        id={FIELD_IDS.name}
        label="Subject name"
        required
        value={name}
        onChange={(value) => {
          setName(value);
          clear('name');
        }}
        error={errors.name || undefined}
        maxLength={SUBJECT_LIMITS.name}
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
        maxLength={SUBJECT_LIMITS.description}
      />
      <Banner message={banner} />
      <DialogButtons
        busy={busy}
        submitLabel={subject ? 'Save changes' : 'Add subject'}
        busyLabel={subject ? 'Saving…' : 'Adding…'}
        onCancel={onCancel}
      />
    </form>
  );
}

function formatLimit(value: number) {
  return new Intl.NumberFormat('en-IN').format(value);
}

// ---------- Manage professors ----------

export function ManageProfessorsDialog({
  open,
  subject,
  onClose,
  onSaved,
}: {
  open: boolean;
  subject: Subject;
  onClose: () => void;
  onSaved: (subject: Subject) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} title={`Professors for ${subject.name}`} busy={busy} onClose={onClose}>
      <ProfessorPicker subject={subject} busy={busy} setBusy={setBusy} onCancel={onClose} onSaved={onSaved} />
    </Dialog>
  );
}

const PICKER_SIZE = 50;

/**
 * A searchable multi-select (UI spec F2.7). The selection is kept apart from the search results
 * and shown as removable chips, so it survives a new search; the save sends every selected id.
 */
function ProfessorPicker({
  subject,
  busy,
  setBusy,
  onCancel,
  onSaved,
}: {
  subject: Subject;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCancel: () => void;
  onSaved: (subject: Subject) => void;
}) {
  const client = useQueryClient();
  const refresh = useRefreshSubjects();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const [selected, setSelected] = useState<SubjectProfessor[]>(subject.professors);
  const [banner, setBanner] = useState<string | null>(null);
  const filter = { role: 'C_PROFESSOR', q, size: PICKER_SIZE } as const;
  const results = useCachedQuery(queryKeys.collegeUsers.list(filter), (signal) =>
    listCollegeUsers({ role: 'C_PROFESSOR', q: q || undefined, page: 0, size: PICKER_SIZE }, signal),
  );
  const data = results.status === 'success' ? results.data : results.status === 'loading' ? results.staleData : undefined;
  const selectedIds = new Set(selected.map((p) => p.id));

  function toggle(professor: UserSummary) {
    setSelected((current) =>
      current.some((p) => p.id === professor.id)
        ? current.filter((p) => p.id !== professor.id)
        : [...current, { id: professor.id, fullName: professor.fullName }],
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBanner(null);
    setBusy(true);
    try {
      const saved = await setSubjectProfessors(
        subject.id,
        selected.map((p) => p.id),
      );
      setBusy(false);
      refresh();
      void client.invalidateQueries({ queryKey: queryKeys.collegeUsers.all });
      onSaved(saved);
    } catch (err) {
      setBusy(false);
      if (hasCode(err, 'VALIDATION_ERROR') && /professorIds\[\d+\]/.test(err.message)) {
        setBanner('Some of these professors are no longer at your college. Check the list and save again.');
        void client.invalidateQueries({ queryKey: queryKeys.collegeUsers.lists });
      } else {
        setBanner(errorMessage(err));
        if (hasCode(err, 'NOT_FOUND')) refresh();
      }
    }
  }

  const noProfessors = q === '' && data?.totalElements === 0;

  return (
    <form className={styles.dialogForm} noValidate onSubmit={(event) => void handleSubmit(event)}>
      {selected.length > 0 && (
        <ul className={styles.chips} aria-label="Selected professors">
          {selected.map((professor) => (
            <li key={professor.id}>
              <button
                type="button"
                className={styles.chip}
                aria-label={`Remove ${professor.fullName ?? 'professor'}`}
                onClick={() => setSelected((current) => current.filter((p) => p.id !== professor.id))}
                disabled={busy}
              >
                {professor.fullName ?? 'Unnamed professor'} <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.hint} aria-live="polite">
        {selected.length} selected
      </p>

      {noProfessors ? (
        <p>
          Your college has no professors yet. <Link to="/college/users?role=professors">Add professors</Link>
        </p>
      ) : (
        <>
          <div className={styles.field}>
            <label htmlFor="professor-search" className={styles.label}>
              Search professors
            </label>
            <input
              id="professor-search"
              type="search"
              className={styles.input}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoComplete="off"
              disabled={busy}
            />
          </div>
          {results.status === 'error' && <p className={styles.formError}>{errorMessage(results.error)}</p>}
          {!data && results.status === 'loading' && <p className={styles.hint}>Loading professors…</p>}
          {data && (
            <fieldset className={`${styles.plainFieldset} ${styles.pickerList}`} aria-busy={results.status === 'loading'}>
              <legend className={styles.visuallyHidden}>Professors</legend>
              {data.content.length === 0 ? (
                <p className={styles.hint}>No professors match this search.</p>
              ) : (
                data.content.map((professor) => (
                  <label key={professor.id} className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(professor.id)}
                      onChange={() => toggle(professor)}
                      disabled={busy}
                    />
                    <span>
                      {professor.fullName ?? '—'}{' '}
                      <span className={`${styles.hint} ${styles.mono}`}>{professor.loginId ?? ''}</span>
                    </span>
                  </label>
                ))
              )}
              {data.totalElements > data.content.length && (
                <p className={styles.hint}>
                  Showing the first {data.content.length} of {data.totalElements}. Search to narrow the list.
                </p>
              )}
            </fieldset>
          )}
        </>
      )}
      <Banner message={banner} />
      <DialogButtons busy={busy} submitLabel="Save" busyLabel="Saving…" onCancel={onCancel} />
    </form>
  );
}

// ---------- Delete ----------

export function DeleteSubjectDialog({
  subject,
  open,
  onClose,
  onDeleted,
  onRename,
}: {
  subject: Subject;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
  /** "Rename" in the in-use case: opens Edit. */
  onRename: () => void;
}) {
  const refresh = useRefreshSubjects();
  const [busy, setBusy] = useState(false);
  const [inUse, setInUse] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = inUse || subject.assessmentCount > 0;

  function close() {
    setInUse(false);
    setError(null);
    onClose();
  }

  async function confirm() {
    if (busy) return;
    if (blocked) {
      close();
      onRename();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteSubject(subject.id);
      setBusy(false);
      close();
      onDeleted();
      refresh(subject.id);
    } catch (err) {
      setBusy(false);
      if (hasCode(err, 'SUBJECT_IN_USE')) {
        setInUse(true);
        refresh();
      } else {
        setError(errorMessage(err));
      }
    }
  }

  return blocked ? (
    <ConfirmDialog
      open={open}
      title={`${subject.name} can't be deleted`}
      confirmLabel="Rename"
      cancelLabel="Close"
      onConfirm={() => void confirm()}
      onCancel={close}
    >
      <p>It has assessments, and they keep their subject. If it&rsquo;s no longer taught under this name, rename it instead.</p>
    </ConfirmDialog>
  ) : (
    <ConfirmDialog
      open={open}
      title={`Delete ${subject.name}?`}
      confirmLabel={busy ? 'Deleting…' : 'Delete subject'}
      destructive
      busy={busy}
      onConfirm={() => void confirm()}
      onCancel={close}
    >
      <p>Its professor assignments are removed too. This can&rsquo;t be undone.</p>
      <Banner message={error} />
    </ConfirmDialog>
  );
}
