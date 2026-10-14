import { useState, type FormEvent, type ReactNode } from 'react';
import { Dialog } from './Dialog';
import styles from './ui.module.css';

/**
 * A confirmation for deletes that cascade to a lot of data (UI spec §0.5): the confirm button is
 * enabled only once the user has typed `phrase` exactly. Focus starts on the input.
 */
export function TypedConfirmDialog({
  open,
  title,
  phrase,
  confirmLabel,
  busyLabel = 'Deleting…',
  busy = false,
  children,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  /** What must be typed, e.g. the act's short code. */
  phrase: string;
  confirmLabel: string;
  /** Shown on the confirm button while `busy`. */
  busyLabel?: string;
  busy?: boolean;
  children: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} title={title} description={children} busy={busy} onClose={onCancel}>
      <TypedConfirmForm
        phrase={phrase}
        confirmLabel={confirmLabel}
        busyLabel={busyLabel}
        busy={busy}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </Dialog>
  );
}

function TypedConfirmForm({
  phrase,
  confirmLabel,
  busyLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  phrase: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === phrase;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (matches && !busy) onConfirm();
  }

  return (
    <form className={styles.dialogForm} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor="typed-confirm" className={styles.label}>
          Type <strong className={styles.mono}>{phrase}</strong> to confirm
        </label>
        <input
          id="typed-confirm"
          className={`${styles.input} ${styles.mono}`}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className={styles.dialogActions}>
        <button type="button" className={styles.secondaryButton} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className={styles.dangerButton} disabled={!matches || busy}>
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </form>
  );
}
