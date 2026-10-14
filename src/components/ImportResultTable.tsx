import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ImportResult, ImportRow } from '@/api/bulkImport';
import { TABLE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { formatCount } from '@/lib/format';
import { StatusBadge, type BadgeTone } from './StatusBadge';
import styles from './ui.module.css';

const STATUS_ORDER = ['CREATED', 'CONVERTED', 'REJECTED', 'FAILED'];

const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Created',
  CONVERTED: 'Converted',
  REJECTED: 'Rejected',
  FAILED: 'Failed',
};

const STATUS_TONES: Record<string, BadgeTone> = {
  CREATED: 'success',
  CONVERTED: 'info',
  REJECTED: 'warning',
  FAILED: 'danger',
};

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

/**
 * Row-by-row outcome of a bulk import (UI spec F1.9; reused by the F2 user imports, which add
 * `CONVERTED`). Status chips filter the rows; by default only the rows that need attention are
 * shown when there are any. `linkFor` gives a created row's link (or null). `rowNumber` turns a
 * row's `index` into the number shown (content imports: the 1-based position; user imports send
 * the spreadsheet row number, shown as it is), and `rowNote` adds a sentence to a row's details.
 */
export function ImportResultTable({
  result,
  linkFor,
  rowNumber = (row) => row.index + 1,
  keyLabel = 'Key',
  rowNote,
}: {
  result: ImportResult;
  linkFor: (row: ImportRow) => string | null;
  rowNumber?: (row: ImportRow) => number;
  keyLabel?: string;
  rowNote?: (row: ImportRow) => ReactNode;
}) {
  const needsAttention = result.rows.some((row) => row.status === 'REJECTED' || row.status === 'FAILED');
  const [selected, setSelected] = useState<Set<string>>(() =>
    needsAttention ? new Set(['REJECTED', 'FAILED']) : new Set(),
  );
  const wide = useMediaQuery(TABLE_QUERY);

  const counts = new Map<string, number>();
  for (const row of result.rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  const statuses = [
    ...STATUS_ORDER.filter((s) => s !== 'CONVERTED' || counts.has(s)),
    ...[...counts.keys()].filter((s) => !STATUS_ORDER.includes(s)),
  ];
  const rows = selected.size === 0 ? result.rows : result.rows.filter((row) => selected.has(row.status));

  function toggle(status: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      // Every status selected is the same as All.
      return next.size === statuses.length ? new Set() : next;
    });
  }

  const details = (row: ImportRow) => {
    if (row.status === 'CREATED' || row.status === 'CONVERTED') {
      const to = row.id ? linkFor(row) : null;
      const link = to ? (
        <Link to={to} aria-label={`Open ${row.key ?? `row ${rowNumber(row)}`}`}>
          Open
        </Link>
      ) : (
        '—'
      );
      const note = rowNote?.(row);
      return note ? (
        <>
          {link}
          <p className={styles.hint}>{note}</p>
        </>
      ) : (
        link
      );
    }
    if (row.errors.length === 0) return '—';
    return (
      <ul className={styles.plainList}>
        {row.errors.map((error, i) => (
          <li key={i}>{error}</li>
        ))}
      </ul>
    );
  };

  return (
    <div>
      <div className={styles.chips} role="group" aria-label="Show rows">
        <button type="button" className={styles.chip} aria-pressed={selected.size === 0} onClick={() => setSelected(new Set())}>
          All ({formatCount(result.rows.length)})
        </button>
        {statuses.map((status) => (
          <button
            key={status}
            type="button"
            className={styles.chip}
            aria-pressed={selected.has(status)}
            onClick={() => toggle(status)}
          >
            {statusLabel(status)} ({formatCount(counts.get(status) ?? 0)})
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className={styles.emptyList}>No rows with this result.</p>
      ) : wide ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.visuallyHidden}>Import results, in request order</caption>
            <thead>
              <tr>
                <th scope="col" className={styles.numeric}>
                  Row
                </th>
                <th scope="col">{keyLabel}</th>
                <th scope="col">Result</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.index}>
                  <td className={styles.numeric}>{rowNumber(row)}</td>
                  <td className={styles.mono}>{row.key ?? '—'}</td>
                  <td>
                    <StatusBadge tone={STATUS_TONES[row.status] ?? 'neutral'}>{statusLabel(row.status)}</StatusBadge>
                  </td>
                  <td>{details(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className={styles.cardList} aria-label="Import results, in request order">
          {rows.map((row) => (
            <li key={row.index} className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cellTitle}>
                  Row {rowNumber(row)}
                  {row.key && <span className={`${styles.cellSub} ${styles.mono}`}>{row.key}</span>}
                </span>
                <StatusBadge tone={STATUS_TONES[row.status] ?? 'neutral'}>{statusLabel(row.status)}</StatusBadge>
              </div>
              <div className={styles.hint}>{details(row)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
