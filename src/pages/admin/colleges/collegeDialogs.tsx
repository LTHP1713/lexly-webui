/**
 * The short-form dialogs of UI spec F1.6. Each dialog owns its fields and errors, and is
 * remounted on every open (`Dialog` renders children only while open), so it always starts clean.
 * Temporary passwords are typed or generated here and shown once in the share step; they are
 * never stored, logged or put in a URL.
 */
import { useState, type FormEvent } from 'react';
import {
  COLLEGE_CODE_PATTERN,
  COLLEGE_LIMITS,
  createCollege,
  createCollegeAdmin,
  generateTemporaryPassword,
  resetAdminPassword,
  updateCollege,
  type College,
  type UserSummary,
} from '@/api/colleges';
import { validateEmail } from '@/auth/validation';
import { Dialog } from '@/components/Dialog';
import { Banner, DialogButtons } from '@/components/DialogForm';
import { TextField } from '@/components/Field';
import { saveErrors, type FieldErrors } from '@/lib/forms';
import styles from '@/components/ui.module.css';

type Errors = FieldErrors;

// ---------- Add college ----------

export function AddCollegeDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (college: College) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} title="Add college" busy={busy} onClose={onClose}>
      <AddCollegeForm busy={busy} setBusy={setBusy} onCancel={onClose} onCreated={onCreated} />
    </Dialog>
  );
}

function AddCollegeForm({
  busy,
  setBusy,
  onCancel,
  onCreated,
}: {
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCancel: () => void;
  onCreated: (college: College) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found: Errors = {};
    if (!COLLEGE_CODE_PATTERN.test(code.trim())) found.code = 'Use 2–20 letters or digits, no spaces.';
    if (!name.trim()) found.name = 'Enter the college name.';
    else if (name.trim().length > COLLEGE_LIMITS.name) found.name = `Use at most ${COLLEGE_LIMITS.name} characters.`;
    setErrors(found);
    setBanner(null);
    if (Object.keys(found).length > 0) {
      document.getElementById(found.code ? 'college-code' : 'college-name')?.focus();
      return;
    }
    setBusy(true);
    try {
      const college = await createCollege({ code: code.trim().toUpperCase(), name: name.trim() });
      setBusy(false);
      onCreated(college);
    } catch (err) {
      const next = saveErrors(err, ['code', 'name']);
      setErrors(next.fields);
      setBanner(next.banner);
      setBusy(false);
    }
  }

  return (
    <form className={styles.dialogForm} noValidate onSubmit={(event) => void handleSubmit(event)}>
      <TextField
        id="college-code"
        label="College code"
        required
        hint="Students and professors type this when they sign in. It can't be changed later."
        value={code}
        onChange={(value) => {
          setCode(value.toUpperCase().replace(/\s/g, ''));
          setErrors((e) => ({ ...e, code: '' }));
        }}
        error={errors.code || undefined}
        maxLength={20}
        inputClassName={styles.mono}
      />
      <TextField
        id="college-name"
        label="College name"
        required
        value={name}
        onChange={(value) => {
          setName(value);
          setErrors((e) => ({ ...e, name: '' }));
        }}
        error={errors.name || undefined}
        maxLength={COLLEGE_LIMITS.name}
      />
      <Banner message={banner} />
      <DialogButtons busy={busy} submitLabel="Add college" busyLabel="Adding…" onCancel={onCancel} />
    </form>
  );
}

// ---------- Edit college name ----------

export function EditCollegeNameDialog({
  college,
  open,
  onClose,
  onSaved,
}: {
  college: College;
  open: boolean;
  onClose: () => void;
  onSaved: (college: College) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      title="Edit college name"
      description={<p>Code {college.code} stays the same.</p>}
      busy={busy}
      onClose={onClose}
    >
      <EditNameForm college={college} busy={busy} setBusy={setBusy} onCancel={onClose} onSaved={onSaved} />
    </Dialog>
  );
}

function EditNameForm({
  college,
  busy,
  setBusy,
  onCancel,
  onSaved,
}: {
  college: College;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCancel: () => void;
  onSaved: (college: College) => void;
}) {
  const [name, setName] = useState(college.name);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    const found = !trimmed
      ? 'Enter the college name.'
      : trimmed.length > COLLEGE_LIMITS.name
        ? `Use at most ${COLLEGE_LIMITS.name} characters.`
        : null;
    setError(found);
    setBanner(null);
    if (found) return;
    setBusy(true);
    try {
      // `active` is required by the server, so the current value is sent unchanged.
      const saved = await updateCollege(college.id, { name: trimmed, active: college.active });
      setBusy(false);
      onSaved(saved);
    } catch (err) {
      const next = saveErrors(err, ['name']);
      setError(next.fields.name ?? null);
      setBanner(next.banner);
      setBusy(false);
    }
  }

  return (
    <form className={styles.dialogForm} noValidate onSubmit={(event) => void handleSubmit(event)}>
      <TextField
        id="college-edit-name"
        label="College name"
        required
        value={name}
        onChange={(value) => {
          setName(value);
          setError(null);
        }}
        error={error ?? undefined}
        maxLength={COLLEGE_LIMITS.name}
      />
      <Banner message={banner} />
      <DialogButtons busy={busy} submitLabel="Save name" busyLabel="Saving…" onCancel={onCancel} />
    </form>
  );
}

// ---------- Temporary password + share step ----------

function validateTemporaryPassword(value: string): string | null {
  if (!value) return 'Enter a temporary password, or generate one.';
  if (value.length < COLLEGE_LIMITS.passwordMin) return `Use at least ${COLLEGE_LIMITS.passwordMin} characters.`;
  return null;
}

function TemporaryPasswordField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const hintId = 'temporary-password-hint';
  const errorId = 'temporary-password-error';
  return (
    <div className={styles.field}>
      <label htmlFor="temporary-password" className={styles.label}>
        Temporary password <span className={styles.required}>(required)</span>
      </label>
      <span id={hintId} className={styles.hint}>
        They&rsquo;ll be asked to change it when they first sign in.
      </span>
      <div className={styles.inputWithButton}>
        <input
          id="temporary-password"
          type="text"
          className={`${styles.input} ${styles.mono}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        />
        <button type="button" className={styles.secondaryButton} onClick={() => onChange(generateTemporaryPassword())}>
          Generate
        </button>
      </div>
      {error && (
        <span id={errorId} className={styles.fieldError}>
          {error}
        </span>
      )}
    </div>
  );
}

interface ShareDetails {
  fullName: string;
  email: string;
  password: string;
}

/** The only time a temporary password is shown (UI spec F1.6). */
function ShareStep({ details, onDone }: { details: ShareDetails; onDone: () => void }) {
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const signInUrl = `${window.location.origin}/login`;
  const text = `Sign-in page: ${signInUrl}\nEmail: ${details.email}\nTemporary password: ${details.password}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('yes');
    } catch {
      setCopied('failed');
    }
  }

  return (
    <div className={styles.dialogForm}>
      <p className={styles.hint}>
        Send these details to {details.fullName} through a channel you trust. The password won&rsquo;t be shown again.
      </p>
      <dl className={styles.shareBlock}>
        <dt>Sign-in page</dt>
        <dd>{signInUrl}</dd>
        <dt>Email</dt>
        <dd>{details.email}</dd>
        <dt>Temporary password</dt>
        <dd>{details.password}</dd>
      </dl>
      <p className={styles.hint} aria-live="polite">
        {copied === 'yes' ? 'Copied.' : copied === 'failed' ? "Couldn't copy. Select the details and copy them yourself." : ''}
      </p>
      <div className={styles.dialogActions}>
        <button type="button" className={styles.secondaryButton} onClick={() => void copy()}>
          Copy details
        </button>
        <button type="button" className={styles.primaryButton} onClick={onDone} data-autofocus>
          Done
        </button>
      </div>
    </div>
  );
}

// ---------- Add admin ----------

export function AddAdminDialog({
  collegeId,
  open,
  onClose,
  onCreated,
}: {
  collegeId: string;
  open: boolean;
  onClose: () => void;
  /** Called as soon as the account exists (before the share step), so the list can refresh. */
  onCreated: (admin: UserSummary) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState<ShareDetails | null>(null);
  const close = () => {
    setShared(null);
    onClose();
  };
  return (
    <Dialog open={open} title={shared ? 'Admin added' : 'Add admin'} busy={busy} onClose={close}>
      {shared ? (
        <ShareStep details={shared} onDone={close} />
      ) : (
        <AddAdminForm
          collegeId={collegeId}
          busy={busy}
          setBusy={setBusy}
          onCancel={close}
          onCreated={(admin, password) => {
            setShared({ fullName: admin.fullName ?? 'the new admin', email: admin.email ?? '', password });
            onCreated(admin);
          }}
        />
      )}
    </Dialog>
  );
}

function AddAdminForm({
  collegeId,
  busy,
  setBusy,
  onCancel,
  onCreated,
}: {
  collegeId: string;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCancel: () => void;
  onCreated: (admin: UserSummary, password: string) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [banner, setBanner] = useState<string | null>(null);

  const fieldIds: Record<string, string> = {
    fullName: 'admin-full-name',
    email: 'admin-email',
    temporaryPassword: 'temporary-password',
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found: Errors = {};
    if (!fullName.trim()) found.fullName = 'Enter their full name.';
    const emailError = validateEmail(email);
    if (emailError) found.email = emailError;
    const passwordError = validateTemporaryPassword(password);
    if (passwordError) found.temporaryPassword = passwordError;
    setErrors(found);
    setBanner(null);
    const first = ['fullName', 'email', 'temporaryPassword'].find((key) => found[key]);
    if (first) {
      document.getElementById(fieldIds[first])?.focus();
      return;
    }
    setBusy(true);
    try {
      const admin = await createCollegeAdmin(collegeId, {
        fullName: fullName.trim(),
        email: email.trim(),
        temporaryPassword: password,
      });
      setBusy(false);
      onCreated(admin, password);
    } catch (err) {
      const next = saveErrors(err, ['fullName', 'email', 'temporaryPassword']);
      setErrors(next.fields);
      setBanner(next.banner);
      setBusy(false);
    }
  }

  const clear = (key: string) => setErrors((e) => ({ ...e, [key]: '' }));

  return (
    <form className={styles.dialogForm} noValidate onSubmit={(event) => void handleSubmit(event)}>
      <TextField
        id={fieldIds.fullName}
        label="Full name"
        required
        value={fullName}
        onChange={(value) => {
          setFullName(value);
          clear('fullName');
        }}
        error={errors.fullName || undefined}
        maxLength={COLLEGE_LIMITS.fullName}
      />
      <TextField
        id={fieldIds.email}
        type="email"
        label="Email"
        required
        hint="They sign in with this email."
        value={email}
        onChange={(value) => {
          setEmail(value);
          clear('email');
        }}
        error={errors.email || undefined}
      />
      <TemporaryPasswordField
        value={password}
        onChange={(value) => {
          setPassword(value);
          clear('temporaryPassword');
        }}
        error={errors.temporaryPassword || undefined}
      />
      <Banner message={banner} />
      <DialogButtons busy={busy} submitLabel="Add admin" busyLabel="Adding…" onCancel={onCancel} />
    </form>
  );
}

// ---------- Reset password ----------

export function ResetPasswordDialog({
  admin,
  onClose,
}: {
  /** The admin to reset; `null` keeps the dialog closed. */
  admin: UserSummary | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState<ShareDetails | null>(null);
  const name = admin?.fullName ?? admin?.email ?? 'this admin';
  const close = () => {
    setShared(null);
    onClose();
  };
  return (
    <Dialog
      open={admin !== null}
      title={shared ? 'Password reset' : `Reset password for ${name}?`}
      description={
        shared ? undefined : (
          <p>They&rsquo;ll be signed out everywhere and must set a new password the next time they sign in.</p>
        )
      }
      busy={busy}
      onClose={close}
    >
      {shared ? (
        <ShareStep details={shared} onDone={close} />
      ) : (
        admin && (
          <ResetForm
            admin={admin}
            busy={busy}
            setBusy={setBusy}
            onCancel={close}
            onReset={(password) => setShared({ fullName: name, email: admin.email ?? '', password })}
          />
        )
      )}
    </Dialog>
  );
}

function ResetForm({
  admin,
  busy,
  setBusy,
  onCancel,
  onReset,
}: {
  admin: UserSummary;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCancel: () => void;
  onReset: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = validateTemporaryPassword(password);
    setError(found);
    setBanner(null);
    if (found) {
      document.getElementById('temporary-password')?.focus();
      return;
    }
    setBusy(true);
    try {
      await resetAdminPassword(admin.id, password);
      setBusy(false);
      onReset(password);
    } catch (err) {
      const next = saveErrors(err, ['temporaryPassword']);
      setError(next.fields.temporaryPassword ?? null);
      setBanner(next.banner);
      setBusy(false);
    }
  }

  return (
    <form className={styles.dialogForm} noValidate onSubmit={(event) => void handleSubmit(event)}>
      <TemporaryPasswordField
        value={password}
        onChange={(value) => {
          setPassword(value);
          setError(null);
        }}
        error={error ?? undefined}
      />
      <Banner message={banner} />
      <DialogButtons busy={busy} submitLabel="Reset password" busyLabel="Resetting…" onCancel={onCancel} />
    </form>
  );
}
