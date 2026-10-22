import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { TABLE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { RowChip } from './Dashboard';
import dash from './Dashboard.module.css';
import styles from '@/components/ui.module.css';

/** What leads a row: the black chip, the name (a link when it opens something) and a muted line. */
export interface HomeRowLead {
  chip: string;
  title: string;
  to?: string;
  sub?: string;
}

export interface HomeColumn<T> {
  header: string;
  cell: (row: T) => ReactNode;
  numeric?: boolean;
  /** The key number of the row: bold. */
  strong?: boolean;
}

/**
 * A home page's table (UI spec UR.3): from 768 px a table whose first column is the lead, below
 * it the same rows as cards (UI spec §0.8: phones get a list, not a table), each column as a
 * "label: value" pair in the same order.
 */
export function HomeTable<T>({
  caption,
  rows,
  rowKey,
  lead,
  leadHeader,
  columns,
}: {
  caption: string;
  rows: T[];
  rowKey: (row: T) => string;
  lead: (row: T) => HomeRowLead;
  leadHeader: string;
  columns: HomeColumn<T>[];
}) {
  const wide = useMediaQuery(TABLE_QUERY);

  if (!wide) {
    return (
      <ul className={styles.cardList} aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className={styles.card}>
            <LeadCell lead={lead(row)} />
            <dl className={dash.cardFacts}>
              {columns.map((column) => (
                <div key={column.header}>
                  <dt>{column.header}</dt>
                  <dd className={column.strong ? dash.strong : undefined}>{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${dash.compactTable}`}>
        <caption className={styles.visuallyHidden}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{leadHeader}</th>
            {columns.map((column) => (
              <th key={column.header} scope="col" className={column.numeric ? styles.numeric : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              <th scope="row">
                <LeadCell lead={lead(row)} />
              </th>
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={[column.numeric ? styles.numeric : '', column.strong ? dash.strong : ''].join(' ').trim() || undefined}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeadCell({ lead }: { lead: HomeRowLead }) {
  return (
    <span className={dash.nameCell}>
      <RowChip>{lead.chip}</RowChip>
      <span className={dash.nameText}>
        {lead.to ? (
          <Link to={lead.to} className={dash.nameLink}>
            {lead.title}
          </Link>
        ) : (
          <span>{lead.title}</span>
        )}
        {lead.sub && <span>{lead.sub}</span>}
      </span>
    </span>
  );
}
