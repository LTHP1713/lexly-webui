import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AUDIT_ACTIONS, isAuditAction, listAudit, type AuditEvent } from '@/api/audit';
import { CollegeFilter } from '@/components/CollegeFilter';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { pageFromParam } from '@/lib/urlParams';
import { formatInstant, formatListInstant, startOfLocalDay, toDateInputValue } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { ACTION_LABELS, actionLabel, auditActor, auditSummary, detailValue, humaniseCode, humaniseKey } from './auditFormat';
import styles from '@/components/ui.module.css';

const PAGE_SIZE = 20;
const DEFAULT_DAYS = 7;

/** The default range: the last 7 days, today included. */
function defaultRange(now = new Date()): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (DEFAULT_DAYS - 1));
  return { from: toDateInputValue(from), to: toDateInputValue(now) };
}

/**
 * `/admin/audit` (SUPERADMIN, every college, `scope="all"`) and `/college/audit` (C_ADMIN, own
 * college; the server scopes it, so no `collegeId` is ever sent). Filters live in the URL.
 */
export function AuditLogPage({ scope }: { scope: 'all' | 'college' }) {
  const [params, setParams] = useSearchParams();
  const defaults = defaultRange();
  const collegeId = scope === 'all' ? (params.get('collegeId') ?? '') : '';
  const actionParam = params.get('action');
  const action = isAuditAction(actionParam) ? actionParam : '';
  const from = params.get('from') ?? defaults.from;
  const to = params.get('to') ?? defaults.to;
  const page = pageFromParam(params.get('page'));
  const isDefault = !collegeId && !action && !params.get('from') && !params.get('to');

  // `to` is exclusive on the server, so the range ends at the start of the day after `to`.
  const fromInstant = startOfLocalDay(from);
  const toInstant = startOfLocalDay(to, 1);
  const rangeError =
    !fromInstant || !toInstant
      ? 'Enter both dates.'
      : fromInstant >= toInstant
        ? 'The start date must be on or before the end date.'
        : null;

  const wide = useMediaQuery('(min-width: 1024px)');
  const [expanded, setExpanded] = useState<string | null>(null);

  const results = useCachedQuery(
    queryKeys.audit.list({ scope, collegeId, action, from, to, page }),
    () =>
      listAudit({
        collegeId: collegeId || undefined,
        action: action || undefined,
        from: fromInstant ?? undefined,
        to: toInstant ?? undefined,
        page,
        size: PAGE_SIZE,
      }),
    { enabled: !rangeError },
  );
  const data = results.status === 'success' ? results.data : results.status === 'loading' ? results.staleData : undefined;

  function update(next: Partial<Record<'collegeId' | 'action' | 'from' | 'to', string>> & { page?: number }) {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (key === 'page') continue;
      if (value) merged.set(key, String(value));
      else merged.delete(key);
    }
    if (next.page) merged.set('page', String(next.page + 1));
    else merged.delete('page');
    setParams(merged);
  }

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>{scope === 'all' ? 'Super admin' : 'College admin'}</p>
          <h1 className={styles.title}>Audit log</h1>
        </div>
      </div>

      <div className={styles.filterBar} role="search" aria-label="Filter the audit log">
        {scope === 'all' && <CollegeFilter id="audit-college" value={collegeId} onChange={(value) => update({ collegeId: value })} />}
        <div className={styles.field}>
          <label htmlFor="audit-action" className={styles.label}>
            Action
          </label>
          <select
            id="audit-action"
            className={styles.input}
            value={action}
            onChange={(event) => update({ action: event.target.value })}
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((value) => (
              <option key={value} value={value}>
                {ACTION_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="audit-from" className={styles.label}>
            From
          </label>
          <input
            id="audit-from"
            type="date"
            className={styles.input}
            value={from}
            max={to}
            onChange={(event) => update({ from: event.target.value })}
            aria-invalid={rangeError ? true : undefined}
            aria-describedby={rangeError ? 'audit-range-error' : undefined}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="audit-to" className={styles.label}>
            To
          </label>
          <input
            id="audit-to"
            type="date"
            className={styles.input}
            value={to}
            min={from}
            onChange={(event) => update({ to: event.target.value })}
            aria-invalid={rangeError ? true : undefined}
            aria-describedby={rangeError ? 'audit-range-error' : undefined}
          />
        </div>
      </div>
      {rangeError && (
        <p id="audit-range-error" role="alert" className={styles.fieldError}>
          {rangeError}
        </p>
      )}
      <p className={styles.hint}>Entries are kept for 30 days.</p>

      <div className={styles.listSection}>
        {results.status === 'loading' && !data && <LoadingState label="Loading the audit log" />}
        {results.status === 'error' && <ErrorState error={results.error} onRetry={results.retry} />}
        {data && results.status !== 'error' && (
          <div aria-busy={results.status === 'loading'}>
            {data.totalElements === 0 ? (
              isDefault ? (
                <EmptyState>Nothing has been recorded in the last 7 days.</EmptyState>
              ) : (
                <EmptyState
                  actions={
                    <button type="button" className={styles.secondaryButton} onClick={() => setParams(new URLSearchParams())}>
                      Clear filters
                    </button>
                  }
                >
                  No entries match these filters.
                </EmptyState>
              )
            ) : (
              <>
                <p className={styles.resultMeta} aria-live="polite">
                  <span className={styles.hint}>
                    {data.totalElements} {data.totalElements === 1 ? 'entry' : 'entries'}
                  </span>
                </p>
                {wide ? (
                  <AuditTable
                    events={data.content}
                    showCollege={scope === 'all'}
                    expanded={expanded}
                    onToggle={(id) => setExpanded((current) => (current === id ? null : id))}
                  />
                ) : (
                  <AuditCards
                    events={data.content}
                    showCollege={scope === 'all'}
                    expanded={expanded}
                    onToggle={(id) => setExpanded((current) => (current === id ? null : id))}
                  />
                )}
                <Pagination
                  label="Audit log pages"
                  page={data.page}
                  totalPages={data.totalPages}
                  onChange={(next) => update({ page: next })}
                />
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function ActionName({ action }: { action: string }) {
  const label = actionLabel(action);
  return label ? <>{label}</> : <span className={styles.mono}>{action}</span>;
}

function When({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={formatInstant(iso)}>
      {formatListInstant(iso)}
    </time>
  );
}

/** `details` as a key–value list of text; nested values as indented JSON text. Never HTML. */
function AuditDetails({ event }: { event: AuditEvent }) {
  const entries = Object.entries(event.details);
  if (entries.length === 0) return <p className={styles.hint}>No details were recorded.</p>;
  return (
    <dl className={styles.detailList}>
      {entries.map(([key, value]) => {
        const shown = detailValue(value);
        return (
          <Fragment key={key}>
            <dt>{humaniseKey(key)}</dt>
            <dd>{shown.nested ? <pre>{shown.text}</pre> : shown.text}</dd>
          </Fragment>
        );
      })}
    </dl>
  );
}

interface ListProps {
  events: AuditEvent[];
  showCollege: boolean;
  expanded: string | null;
  onToggle: (id: string) => void;
}

function SummaryToggle({ event, expanded, onToggle }: { event: AuditEvent; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={styles.expandButton}
      aria-expanded={expanded}
      aria-controls={`audit-details-${event.id}`}
      onClick={onToggle}
    >
      {auditSummary(event)}
    </button>
  );
}

function AuditTable({ events, showCollege, expanded, onToggle }: ListProps) {
  const columns = showCollege ? 6 : 5;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>Audit log entries, newest first</caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Who</th>
            {showCollege && <th scope="col">College</th>}
            <th scope="col">Action</th>
            <th scope="col">Entity</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const open = expanded === event.id;
            return (
              <Fragment key={event.id}>
                <tr>
                  <td>
                    <When iso={event.createdAt} />
                  </td>
                  <td>{auditActor(event)}</td>
                  {showCollege && <td className={styles.mono}>{event.college?.code ?? '—'}</td>}
                  <td>
                    <ActionName action={event.action} />
                  </td>
                  <td>{event.entityType ? humaniseCode(event.entityType) : '—'}</td>
                  <td>
                    <SummaryToggle event={event} expanded={open} onToggle={() => onToggle(event.id)} />
                  </td>
                </tr>
                {open && (
                  <tr className={styles.expandRow} id={`audit-details-${event.id}`}>
                    <td colSpan={columns}>
                      <AuditDetails event={event} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AuditCards({ events, showCollege, expanded, onToggle }: ListProps) {
  return (
    <ul className={styles.cardList} aria-label="Audit log entries, newest first">
      {events.map((event) => {
        const open = expanded === event.id;
        return (
          <li key={event.id} className={styles.card}>
            <h2 className={styles.cardTitle}>
              <ActionName action={event.action} />
            </h2>
            <span className={styles.hint}>
              {auditActor(event)} · <When iso={event.createdAt} />
            </span>
            {showCollege && event.college && <span className={`${styles.hint} ${styles.mono}`}>{event.college.code}</span>}
            <SummaryToggle event={event} expanded={open} onToggle={() => onToggle(event.id)} />
            {open && (
              <div id={`audit-details-${event.id}`}>
                <AuditDetails event={event} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
