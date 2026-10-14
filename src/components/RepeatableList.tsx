import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import styles from './ui.module.css';

type Keyed = { key: string };

/** Where focus goes after a list change, so keyboard users never land on <body>. */
type PendingFocus = { key: string; target: 'up' | 'down' | 'first' } | { key: null; target: 'add' };

/**
 * An ordered list of editable rows with Add / Move up / Move down / Remove buttons — no drag.
 * Row numbers come from position, so they update live as rows move. `onChange` also gets the
 * new order as old indexes (`order[newIndex] = oldIndex`) so index-keyed errors can follow.
 */
export function RepeatableList<T extends Keyed>({
  id,
  title,
  description,
  itemLabel,
  rows,
  max,
  error,
  makeRow,
  onChange,
  renderRow,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  /** Singular, e.g. "Issue" → "Issue 1", "Add issue". */
  itemLabel: string;
  rows: T[];
  max: number;
  /** A list-level error (e.g. too many items). */
  error?: string;
  makeRow: () => T;
  onChange: (rows: T[], order: number[]) => void;
  renderRow: (row: T, index: number) => ReactNode;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<PendingFocus | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const lowerLabel = itemLabel.toLowerCase();

  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    if (pending.key === null) {
      addRef.current?.focus();
      return;
    }
    const row = listRef.current?.querySelector<HTMLElement>(`[data-row-key="${pending.key}"]`);
    if (!row) return;
    if (pending.target === 'first') {
      row.querySelector<HTMLElement>('input, textarea, select')?.focus();
      return;
    }
    // A row moved to the top/bottom has that button disabled now; use the other one.
    const preferred = row.querySelector<HTMLButtonElement>(`[data-action="${pending.target}"]`);
    const fallback = row.querySelector<HTMLButtonElement>(`[data-action="${pending.target === 'up' ? 'down' : 'up'}"]`);
    (preferred && !preferred.disabled ? preferred : fallback)?.focus();
  }, [rows]);

  function move(index: number, delta: -1 | 1) {
    const to = index + delta;
    if (to < 0 || to >= rows.length) return;
    const order = rows.map((_, i) => i);
    [order[index], order[to]] = [order[to], order[index]];
    pendingFocus.current = { key: rows[index].key, target: delta < 0 ? 'up' : 'down' };
    setAnnouncement(`${itemLabel} ${index + 1} moved to position ${to + 1} of ${rows.length}.`);
    onChange(
      order.map((i) => rows[i]),
      order,
    );
  }

  function remove(index: number) {
    const order = rows.map((_, i) => i).filter((i) => i !== index);
    const next = rows[index + 1] ?? rows[index - 1];
    pendingFocus.current = next ? { key: next.key, target: 'first' } : { key: null, target: 'add' };
    setAnnouncement(`${itemLabel} ${index + 1} removed.`);
    onChange(
      order.map((i) => rows[i]),
      order,
    );
  }

  function add() {
    const row = makeRow();
    pendingFocus.current = { key: row.key, target: 'first' };
    setAnnouncement(`${itemLabel} ${rows.length + 1} added.`);
    onChange(
      [...rows, row],
      rows.map((_, i) => i),
    );
  }

  const full = rows.length >= max;

  return (
    <section aria-labelledby={`${id}-title`} className={styles.editorSection}>
      <div className={styles.editorSectionHeader}>
        <h2 id={`${id}-title`} className={styles.editorSectionTitle}>
          {title} <span className={styles.count}>({rows.length})</span>
        </h2>
        {description && <p className={styles.hint}>{description}</p>}
      </div>
      {error && <p className={styles.fieldError}>{error}</p>}

      {rows.length === 0 ? (
        <p className={styles.emptyList}>Nothing added yet.</p>
      ) : (
        <ol ref={listRef} className={styles.rows}>
          {rows.map((row, index) => {
            const label = `${itemLabel} ${index + 1}`;
            return (
              <li key={row.key} data-row-key={row.key}>
                <fieldset className={styles.row}>
                  <legend className={styles.rowLegend}>{label}</legend>
                  <div className={styles.rowControls}>
                    <button
                      type="button"
                      data-action="up"
                      className={styles.rowButton}
                      aria-label={`Move up: ${label}`}
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                    >
                      <span aria-hidden="true">↑</span> Move up
                    </button>
                    <button
                      type="button"
                      data-action="down"
                      className={styles.rowButton}
                      aria-label={`Move down: ${label}`}
                      onClick={() => move(index, 1)}
                      disabled={index === rows.length - 1}
                    >
                      <span aria-hidden="true">↓</span> Move down
                    </button>
                    <button
                      type="button"
                      className={`${styles.rowButton} ${styles.rowButtonDanger}`}
                      aria-label={`Remove: ${label}`}
                      onClick={() => remove(index)}
                    >
                      Remove
                    </button>
                  </div>
                  <div className={styles.rowFields}>{renderRow(row, index)}</div>
                </fieldset>
              </li>
            );
          })}
        </ol>
      )}

      <button ref={addRef} type="button" className={styles.secondaryButton} onClick={add} disabled={full}>
        + Add {lowerLabel}
      </button>
      {full && <p className={styles.hint}>The limit is {max} entries.</p>}
      <p className={styles.visuallyHidden} aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
