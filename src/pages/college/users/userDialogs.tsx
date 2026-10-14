/**
 * The user dialogs of UI spec F2.3–F2.5, shared by the users list and the user detail. Each one
 * refreshes every view its change affects (F2.1): the user lists, that user's detail and the
 * subjects (which show professor names). Success messages go through `flash`, so they survive
 * the navigation after a removal from the detail page.
 */
import { useState, type FormEvent } from 'react';
import type { UserSummary } from '@/api/colleges';
import {
  LOGIN_ID_LABELS,
  USER_LIMITS,
  createCollegeUser,
  kindOf,
  removeCollegeUser,
  resetCollegeUserPassword,
  updateCollegeUser,
  KIND_ROLES,
  type CollegeUserKind,
} from '@/api/collegeUsers';
import { errorMessage, hasCode } from '@/api/errors';
import { useAuth } from '@/auth/AuthContext';
import { validateEmail } from '@/auth/validation';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Dialog } from '@/components/Dialog';
import { Banner, DialogButtons } from '@/components/DialogForm';
import { TextField } from '@/components/Field';
import { flash } from '@/components/flash';
import { TypedConfirmDialog } from '@/components/TypedConfirmDialog';
import { saveErrors, type FieldErrors } from '@/lib/forms';
import { useRefreshUsers, userName } from './userQueries';
import styles from '@/components/ui.module.css';

/** "Roll no" → "roll no", for use inside a sentence. */
function loginIdNoun(kind: CollegeUserKind) {
  return kind === 'students' ? 'roll no' : 'employee ID';
}

const SINGULAR: Record<CollegeUserKind, string> = { students: 'student', professors: 'professor' };

// ---------- Add / edit (F2.3) ----------

export type UserFormTarget = { mode: 'add'; kind: CollegeUserKind } | { mode: 'edit'; user: UserSummary };

export function UserFormDialog({
  target,
  onClose,
  onSaved,
}: {
  /** `null` keeps the dialog closed. */
  target: UserFormTarget | null;
  onClose: () => void;
  onSaved?: (user: UserSummary) => void;
}) {
  const [busy, setBusy] = useState(false);
  const kind = target?.mode === 'edit' ? kindOf(target.user.role) : (target?.kind ?? 'students');
  const title = target?.mode === 'edit' ? `Edit ${SINGULAR[kind]}` : `Add ${SINGULAR[kind]}`;
  return (
    <Dialog open={target !== null} title={title} busy={busy} onClose={onClose}>
      {target && (
        <UserForm target={target} kind={kind} busy={busy} setBusy={setBusy} onCancel={onClose} onSaved={onSaved} onClose={onClose} />
      )}
    </Dialog>
  );
}

const USER_FIELDS = ['fullName', 'email', 'loginId'] as const;
const FIELD_IDS: Record<string, string> = { fullName: 'user-full-name', email: 'user-email', loginId: 'user-login-id' };

function UserForm({
  target,
  kind,
  busy,
  setBusy,
  onCancel,
  onSaved,
  onClose,
}: {
  target: UserFormTarget;
  kind: CollegeUserKind;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCancel: () => void;
  onSaved?: (user: UserSummary) => void;
  onClose: () => void;
}) {
  const { user: me } = useAuth();
  const refresh = useRefreshUsers();
  const initial = target.mode === 'edit' ? target.user : null;
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [loginId, setLoginId] = useState(initial?.loginId ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const idLabel = LOGIN_ID_LABELS[kind];
  const collegeCode = me?.college?.code ?? 'your college code';

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    if (!fullName.trim()) found.fullName = 'Enter their full name.';
    else if (fullName.trim().length > USER_LIMITS.fullName) found.fullName = `Use at most ${USER_LIMITS.fullName} characters.`;
    const emailError = validateEmail(email.trim());
    if (emailError) found.email = emailError;
    else if (email.trim().length > USER_LIMITS.email) found.email = `Use at most ${USER_LIMITS.email} characters.`;
    if (!loginId.trim()) found.loginId = `Enter their ${loginIdNoun(kind)}.`;
    else if (loginId.trim().length > USER_LIMITS.loginId) found.loginId = `Use at most ${USER_LIMITS.loginId} characters.`;
    return found;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = validate();
    setErrors(found);
    setBanner(null);
    const first = USER_FIELDS.find((key) => found[key]);
    if (first) {
      document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }
    const body = { fullName: fullName.trim(), email: email.trim(), loginId: loginId.trim() };
    setBusy(true);
    try {
      const saved =
        target.mode === 'edit'
          ? await updateCollegeUser(target.user.id, body)
          : await createCollegeUser({ ...body, role: KIND_ROLES[kind] });
      setBusy(false);
      refresh();
      flash(
        target.mode === 'edit'
          ? 'Changes saved.'
          : `${saved.fullName ?? body.fullName} added. Their first password is their ${loginIdNoun(kind)}.`,
      );
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setBusy(false);
      if (target.mode === 'edit' && hasCode(err, 'NOT_FOUND')) {
        setErrors({});
        setBanner(errorMessage(err));
        refresh();
        return;
      }
      const next = saveErrors(err, USER_FIELDS);
      if (next.fields.email && target.mode === 'add' && kind === 'students' && hasCode(err, 'EMAIL_ALREADY_EXISTS')) {
        next.fields.email += " If it's their personal Lexly account, import them from a file to convert it.";
      }
      setErrors(next.fields);
      setBanner(next.banner);
      const firstError = USER_FIELDS.find((key) => next.fields[key]);
      if (firstError) document.getElementById(FIELD_IDS[firstError])?.focus();
    }
  }

  const clear = (key: string) => setErrors((e) => ({ ...e, [key]: '' }));

  return (
    <form className={styles.dialogForm} noValidate onSubmit={(event) => void handleSubmit(event)}>
      <TextField
        id={FIELD_IDS.fullName}
        label="Full name"
        required
        value={fullName}
        onChange={(value) => {
          setFullName(value);
          clear('fullName');
        }}
        error={errors.fullName || undefined}
        maxLength={USER_LIMITS.fullName}
      />
      <TextField
        id={FIELD_IDS.email}
        type="email"
        label="Email"
        required
        value={email}
        onChange={(value) => {
          setEmail(value);
          clear('email');
        }}
        error={errors.email || undefined}
        maxLength={USER_LIMITS.email}
      />
      <TextField
        id={FIELD_IDS.loginId}
        label={idLabel}
        required
        hint={
          target.mode === 'add'
            ? `They sign in with ${collegeCode} and this ID. Their first password is this ID, and they must change it when they first sign in.`
            : "Changing it doesn't change their password."
        }
        value={loginId}
        onChange={(value) => {
          setLoginId(value);
          clear('loginId');
        }}
        error={errors.loginId || undefined}
        maxLength={USER_LIMITS.loginId}
        inputClassName={styles.mono}
      />
      <Banner message={banner} />
      <DialogButtons
        busy={busy}
        submitLabel={target.mode === 'edit' ? 'Save changes' : `Add ${SINGULAR[kind]}`}
        busyLabel={target.mode === 'edit' ? 'Saving…' : 'Adding…'}
        onCancel={onCancel}
      />
    </form>
  );
}

// ---------- Reset password (F2.4) ----------

export function ResetUserPasswordDialog({ user, onClose }: { user: UserSummary | null; onClose: () => void }) {
  const refresh = useRefreshUsers();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kind = kindOf(user?.role ?? null);

  function close() {
    setError(null);
    onClose();
  }

  async function confirm() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await resetCollegeUserPassword(user.id);
      flash(`Password reset for ${userName(user)}.`);
      refresh();
      close();
    } catch (err) {
      setError(errorMessage(err));
      if (hasCode(err, 'NOT_FOUND')) refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open={user !== null}
      title={`Reset password for ${user ? userName(user) : ''}?`}
      confirmLabel={busy ? 'Resetting…' : 'Reset password'}
      busy={busy}
      onConfirm={() => void confirm()}
      onCancel={close}
    >
      <p>
        The password becomes their {loginIdNoun(kind)} (<span className={styles.mono}>{user?.loginId ?? '—'}</span>), and
        they must change it at next sign-in. They&rsquo;ll be signed out everywhere.
      </p>
      <Banner message={error} />
    </ConfirmDialog>
  );
}

// ---------- Remove (F2.5) ----------

export function RemoveUserDialog({
  user,
  onClose,
  onRemoved,
}: {
  user: UserSummary | null;
  onClose: () => void;
  /** Called after a removal, before the caches are refreshed (the detail page navigates away here). */
  onRemoved?: (user: UserSummary) => void;
}) {
  const refresh = useRefreshUsers();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kind = kindOf(user?.role ?? null);

  function close() {
    setError(null);
    onClose();
  }

  async function confirm() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await removeCollegeUser(user.id);
      flash(`${userName(user)} removed.`);
      close();
      onRemoved?.(user);
      refresh(user.id);
    } catch (err) {
      setError(errorMessage(err));
      if (hasCode(err, 'NOT_FOUND')) refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <TypedConfirmDialog
      open={user !== null}
      title={`Remove ${user ? userName(user) : ''}?`}
      phrase={user?.loginId ?? user?.email ?? ''}
      confirmLabel={`Remove ${SINGULAR[kind]}`}
      busyLabel="Removing…"
      busy={busy}
      onConfirm={() => void confirm()}
      onCancel={close}
    >
      {kind === 'students' ? (
        <p>
          Their account is deleted for good, together with all their answers, grades and ranking entries. This can&rsquo;t
          be undone.
        </p>
      ) : (
        <p>
          Their account is deleted for good, and they&rsquo;re taken off every subject. Assessments they created stay,
          shown as &ldquo;Former professor&rdquo;, and their ungraded answers can no longer be graded. This can&rsquo;t be
          undone.
        </p>
      )}
      <Banner message={error} />
    </TypedConfirmDialog>
  );
}
