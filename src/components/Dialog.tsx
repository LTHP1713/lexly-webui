import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './ui.module.css';

/**
 * A modal for short forms and multi-step flows (add college, add admin and its share step), on
 * the native <dialog> like `ConfirmDialog`. The caller renders the body and its own buttons.
 * Focus starts on the first field (or `[data-autofocus]`); Escape closes unless `busy`.
 */
export function Dialog({
  open,
  title,
  description,
  busy = false,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      const target =
        dialog.querySelector<HTMLElement>('[data-autofocus]') ??
        dialog.querySelector<HTMLElement>('input:not([type=hidden]):not([readonly]), select, textarea') ??
        dialog.querySelector<HTMLElement>('button');
      target?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${styles.dialogWide}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id={titleId} className={styles.dialogTitle}>
        {title}
      </h2>
      {description && (
        <div id={descriptionId} className={styles.dialogBody}>
          {description}
        </div>
      )}
      {open && children}
    </dialog>
  );
}
