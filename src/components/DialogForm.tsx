/**
 * Buttons and banner shared by the short-form dialogs (UI spec F1.6, F2.3, F2.7). Mapping a failed
 * save to field errors is `saveErrors` in `lib/forms.ts`.
 */
import styles from './ui.module.css';

export function DialogButtons({
  busy,
  submitLabel,
  busyLabel,
  onCancel,
  destructive = false,
}: {
  busy: boolean;
  submitLabel: string;
  busyLabel: string;
  onCancel: () => void;
  destructive?: boolean;
}) {
  return (
    <div className={styles.dialogActions}>
      <button type="button" className={styles.secondaryButton} onClick={onCancel} disabled={busy}>
        Cancel
      </button>
      <button type="submit" className={destructive ? styles.dangerButton : styles.primaryButton} disabled={busy}>
        {busy ? busyLabel : submitLabel}
      </button>
    </div>
  );
}

/** A form banner (`role="alert"`, always mounted so a new message is announced). */
export function Banner({ message }: { message: string | null }) {
  return <div role="alert">{message && <p className={styles.formError}>{message}</p>}</div>;
}
