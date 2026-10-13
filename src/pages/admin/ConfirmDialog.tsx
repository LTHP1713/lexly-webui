import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './Admin.module.css';

/**
 * Modal confirmation on the native <dialog>: `showModal()` gives focus containment, Escape to
 * cancel and an inert background for free. Focus starts on the safe (cancel) action.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape: let React state drive closing so `open` stays the source of truth.
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h2 id={titleId} className={styles.dialogTitle}>
        {title}
      </h2>
      <div className={styles.dialogBody}>{children}</div>
      <div className={styles.dialogActions}>
        <button ref={cancelRef} type="button" className={styles.secondaryButton} onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={destructive ? styles.dangerButton : styles.primaryButton}
          onClick={onConfirm}
          disabled={busy}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
