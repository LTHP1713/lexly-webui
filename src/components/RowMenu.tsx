import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './ui.module.css';

export type RowMenuItem =
  | { label: string; to: string; danger?: false }
  | { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean };

/**
 * The "⋯" menu on a list row (disclosure pattern): a button that shows a short list of links and
 * buttons. Escape and a click outside close it, and focus returns to the button. `label` names
 * the row ("Actions for ICA") so each button is distinct for screen readers.
 */
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>('[data-menu-item]')?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={styles.menu}
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.rowButton}
        aria-label={label}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <ul id={menuId} className={styles.menuList}>
          {items.map((item) => (
            <li key={item.label}>
              {'to' in item ? (
                <Link to={item.to} className={styles.menuItem} data-menu-item onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              ) : (
                <button
                  type="button"
                  className={`${styles.menuItem} ${item.danger ? styles.menuItemDanger : ''}`}
                  data-menu-item
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
