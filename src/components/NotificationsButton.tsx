import { useEffect, useId, useRef, useState } from 'react';
import { BellIcon } from '@/components/icons/Icons';
import styles from './NotificationsButton.module.css';

/** Bell + popover. There is no notifications backend yet, so it always shows the empty state. */
export function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={styles.button}
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon size={22} />
      </button>
      <div id={panelId} className={styles.panel} hidden={!open} role="region" aria-label="Notifications">
        <p className={styles.title}>Notifications</p>
        <p className={styles.empty}>No notifications</p>
        <p className={styles.hint}>You’re all caught up.</p>
      </div>
    </div>
  );
}
