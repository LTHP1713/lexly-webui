import { useState, type FormEvent } from 'react';
import { ACT_LIMITS, createAct, getAdminAct, updateAct, type ActAdmin } from '@/api/adminContent';
import { ApiError } from '@/api/client';
import { conflictFieldError, errorMessage } from '@/api/errors';
import { Dialog } from '@/components/Dialog';
import { TextAreaField, TextField } from '@/components/Field';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useApiQuery } from '@/hooks/useApiQuery';
import { parseServerErrors } from '@/pages/admin/contentForm';
import styles from '@/components/ui.module.css';

/**
 * Add act / Edit act (UI spec F1.7). Edit loads `GET /admin/acts/{id}` because `GET /acts` has no
 * `description`, and `PUT` replaces it.
 */
export function ActDialog({
  open,
  actId,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Null to add a new act. */
  actId: string | null;
  onClose: () => void;
  onSaved: (act: ActAdmin, created: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} title={actId ? 'Edit act' : 'Add act'} busy={busy} onClose={onClose}>
      {actId ? (
        <EditActLoader actId={actId} busy={busy} setBusy={setBusy} onCancel={onClose} onSaved={onSaved} />
      ) : (
        <ActForm initial={null} busy={busy} setBusy={setBusy} onCancel={onClose} onSaved={onSaved} />
      )}
    </Dialog>
  );
}

const ACT_FIELDS = ['title', 'shortCode', 'description'];

interface FormProps {
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCancel: () => void;
  onSaved: (act: ActAdmin, created: boolean) => void;
}

function EditActLoader({ actId, ...props }: FormProps & { actId: string }) {
  const act = useApiQuery(`admin-act:${actId}`, () => getAdminAct(actId));
  if (act.status === 'loading' || act.status === 'idle') return <LoadingState label="Loading the act" lines={3} />;
  if (act.status === 'error') return <ErrorState error={act.error} onRetry={act.retry} />;
  return <ActForm initial={act.data} {...props} />;
}

function ActForm({ initial, busy, setBusy, onCancel, onSaved }: FormProps & { initial: ActAdmin | null }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [shortCode, setShortCode] = useState(initial?.shortCode ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found: Record<string, string> = {};
    if (!title.trim()) found.title = 'Enter the act’s title.';
    else if (title.trim().length > ACT_LIMITS.title) found.title = `Use at most ${ACT_LIMITS.title} characters.`;
    if (shortCode.trim().length > ACT_LIMITS.shortCode) found.shortCode = `Use at most ${ACT_LIMITS.shortCode} characters.`;
    setErrors(found);
    setBanner(null);
    if (Object.keys(found).length > 0) {
      document.getElementById(found.title ? 'act-title' : 'act-short-code')?.focus();
      return;
    }
    setBusy(true);
    const body = {
      title: title.trim(),
      shortCode: shortCode.trim().toUpperCase() || null,
      description: description.trim() ? description : null,
    };
    try {
      const saved = initial ? await updateAct(initial.id, body) : await createAct(body);
      setBusy(false);
      onSaved(saved, initial === null);
    } catch (err) {
      const conflict = conflictFieldError(err);
      const parsed = err instanceof ApiError && err.code === 'VALIDATION_ERROR' ? parseServerErrors(err.message) : {};
      const fields =
        conflict ?? Object.fromEntries(Object.entries(parsed).filter(([path]) => ACT_FIELDS.includes(path)));
      setErrors(fields);
      setBanner(Object.keys(fields).length > 0 ? null : errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className={styles.dialogForm} noValidate onSubmit={(event) => void handleSubmit(event)}>
      <TextField
        id="act-title"
        label="Title"
        required
        value={title}
        onChange={(value) => {
          setTitle(value);
          setErrors((e) => ({ ...e, title: '' }));
        }}
        error={errors.title || undefined}
        maxLength={ACT_LIMITS.title}
      />
      <TextField
        id="act-short-code"
        label="Short code"
        hint="Used in imports to refer to this act, e.g. ICA."
        value={shortCode}
        onChange={(value) => {
          setShortCode(value.toUpperCase());
          setErrors((e) => ({ ...e, shortCode: '' }));
        }}
        error={errors.shortCode || undefined}
        maxLength={ACT_LIMITS.shortCode}
        inputClassName={styles.mono}
      />
      <TextAreaField
        id="act-description"
        label="Description"
        rows={3}
        value={description}
        onChange={setDescription}
        error={errors.description || undefined}
      />
      <div role="alert">{banner && <p className={styles.formError}>{banner}</p>}</div>
      <div className={styles.dialogActions}>
        <button type="button" className={styles.secondaryButton} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className={styles.primaryButton} disabled={busy}>
          {busy ? 'Saving…' : initial ? 'Save act' : 'Add act'}
        </button>
      </div>
    </form>
  );
}
