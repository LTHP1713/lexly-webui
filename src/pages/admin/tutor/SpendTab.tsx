import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { hasCode } from '@/api/errors';
import { getAiUsageDaily, type AiUsageDaily } from '@/api/tutor';
import { ROLES, toRole, type Role } from '@/auth/roles';
import { CollegeFilter } from '@/components/CollegeFilter';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { formatCount } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { formatUsd } from '@/pages/tutor/tutorFormat';
import { SpendChart } from './SpendChart';
import { defaultRange, formatLongDate, rangeError } from './spendRange';
import styles from '@/components/ui.module.css';
import adminStyles from './TutorAdmin.module.css';

/** `ROLE_LABELS` names both student roles "Student"; the filter needs them apart. */
const ROLE_OPTIONS: Record<Role, string> = {
  SUPERADMIN: 'Super admin',
  C_ADMIN: 'College admin',
  C_PROFESSOR: 'Professor',
  C_STUDENT: 'College student',
  S_STUDENT: 'Solo student',
};

type FilterKey = 'from' | 'to' | 'collegeId' | 'role';

/**
 * Spend tab (UI spec F5a.4): daily AI cost and usage, filtered in the URL by India dates,
 * college and role. The range is checked here as on the server (`to ≥ from`, ≤ 366 days).
 */
export function SpendTab() {
  const [params, setParams] = useSearchParams();
  const defaults = defaultRange();
  const from = params.get('from') ?? defaults.from;
  const to = params.get('to') ?? defaults.to;
  const collegeId = params.get('collegeId') ?? '';
  const role = toRole(params.get('role'));
  const filtered = Boolean(collegeId || role);
  const anyFilter = filtered || params.has('from') || params.has('to');
  const error = rangeError(from, to);
  const [showTable, setShowTable] = useState(false);

  const usage = useCachedQuery(
    queryKeys.tutor.usage({ from, to, collegeId, role }),
    (signal) => getAiUsageDaily({ from, to, collegeId: collegeId || undefined, role: role ?? undefined }, signal),
    { enabled: !error },
  );
  const data = usage.status === 'success' ? usage.data : usage.status === 'loading' ? usage.staleData : undefined;
  // The dates are checked above, so a server VALIDATION_ERROR means another filter (a bad URL).
  const serverValidation = usage.status === 'error' && hasCode(usage.error, 'VALIDATION_ERROR');
  const shownRangeError = error;

  function update(next: Partial<Record<FilterKey, string>>) {
    const merged = new URLSearchParams(params);
    merged.set('tab', 'spend');
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    setParams(merged, { replace: true });
  }

  const clearFilters = () => setParams({ tab: 'spend' }, { replace: true });

  return (
    <>
      <div className={styles.filterBar} role="search" aria-label="Filter AI spend">
        <div className={styles.field}>
          <label htmlFor="spend-from" className={styles.label}>
            From
          </label>
          <input
            id="spend-from"
            type="date"
            className={styles.input}
            value={from}
            max={to}
            onChange={(event) => update({ from: event.target.value })}
            aria-invalid={shownRangeError ? true : undefined}
            aria-describedby={shownRangeError ? 'spend-range-error' : undefined}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="spend-to" className={styles.label}>
            To
          </label>
          <input
            id="spend-to"
            type="date"
            className={styles.input}
            value={to}
            min={from}
            onChange={(event) => update({ to: event.target.value })}
            aria-invalid={shownRangeError ? true : undefined}
            aria-describedby={shownRangeError ? 'spend-range-error' : undefined}
          />
        </div>
        <CollegeFilter id="spend-college" value={collegeId} onChange={(value) => update({ collegeId: value })} />
        <div className={styles.field}>
          <label htmlFor="spend-role" className={styles.label}>
            Role
          </label>
          <select
            id="spend-role"
            className={styles.input}
            value={role ?? ''}
            onChange={(event) => update({ role: event.target.value })}
          >
            <option value="">All roles</option>
            {ROLES.map((value) => (
              <option key={value} value={value}>
                {ROLE_OPTIONS[value]}
              </option>
            ))}
          </select>
        </div>
        {anyFilter && (
          <button type="button" className={styles.secondaryButton} onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>
      <p className={styles.hint}>Dates are India dates.</p>
      {shownRangeError && (
        <p id="spend-range-error" role="alert" className={styles.fieldError}>
          {shownRangeError}
        </p>
      )}

      {!error && usage.status === 'loading' && !data && <LoadingState label="Loading AI spend" />}
      {usage.status === 'error' && hasCode(usage.error, 'NOT_FOUND') && (
        <EmptyState
          actions={
            <button type="button" className={styles.secondaryButton} onClick={clearFilters}>
              Clear filters
            </button>
          }
        >
          This college no longer exists.
        </EmptyState>
      )}
      {serverValidation && (
        <EmptyState
          actions={
            <button type="button" className={styles.secondaryButton} onClick={clearFilters}>
              Clear filters
            </button>
          }
        >
          These filters can&rsquo;t be used. Clear them and try again.
        </EmptyState>
      )}
      {usage.status === 'error' && !serverValidation && !hasCode(usage.error, 'NOT_FOUND') && (
        <ErrorState error={usage.error} onRetry={usage.retry} />
      )}
      {!error && data && usage.status !== 'error' && (
        <div aria-busy={usage.status === 'loading'}>
          <SpendView data={data} filtered={filtered} showTable={showTable} onToggleTable={() => setShowTable((v) => !v)} />
        </div>
      )}
    </>
  );
}

function SpendView({
  data,
  filtered,
  showTable,
  onToggleTable,
}: {
  data: AiUsageDaily;
  filtered: boolean;
  showTable: boolean;
  onToggleTable: () => void;
}) {
  const { totals, rates } = data;
  const tiles: [string, string][] = [
    ['Cost', formatUsd(totals.cost)],
    ['Questions', formatCount(totals.questions)],
    ['Index runs', formatCount(totals.indexRuns)],
    ['Input tokens', formatCount(totals.inputTokens)],
    ['Output tokens', formatCount(totals.outputTokens)],
    ['Embedding tokens', formatCount(totals.embeddingTokens)],
  ];
  const range = `${formatLongDate(data.from)} to ${formatLongDate(data.to)}`;
  return (
    <>
      <dl className={styles.statTiles} aria-label={`Totals, ${range}`}>
        {tiles.map(([label, value]) => (
          <div key={label} className={styles.statTile}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="spend-chart-title" className={adminStyles.chartSection}>
        <div className={styles.sectionHead}>
          <h2 id="spend-chart-title" className={styles.sectionHeadTitle}>
            Daily cost
          </h2>
          <button type="button" className={styles.secondaryButton} aria-expanded={showTable} onClick={onToggleTable}>
            {showTable ? 'Hide table' : 'Show as table'}
          </button>
        </div>
        <SpendChart days={data.days} label={`Daily AI cost from ${range}, total ${formatUsd(totals.cost)}`} />
        {totals.cost === 0 && totals.questions === 0 && <p className={styles.hint}>No AI use in this range.</p>}
        {showTable && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.visuallyHidden}>Daily AI usage, {range}</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col" className={styles.numeric}>
                    Questions
                  </th>
                  <th scope="col" className={styles.numeric}>
                    Index runs
                  </th>
                  <th scope="col" className={styles.numeric}>
                    Input tokens
                  </th>
                  <th scope="col" className={styles.numeric}>
                    Output tokens
                  </th>
                  <th scope="col" className={styles.numeric}>
                    Embedding tokens
                  </th>
                  <th scope="col" className={styles.numeric}>
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((day) => (
                  <tr key={day.date}>
                    <th scope="row">{formatLongDate(day.date)}</th>
                    <td className={styles.numeric}>{formatCount(day.questions)}</td>
                    <td className={styles.numeric}>{formatCount(day.indexRuns)}</td>
                    <td className={styles.numeric}>{formatCount(day.inputTokens)}</td>
                    <td className={styles.numeric}>{formatCount(day.outputTokens)}</td>
                    <td className={styles.numeric}>{formatCount(day.embeddingTokens)}</td>
                    <td className={styles.numeric}>{formatUsd(day.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className={styles.hint}>
        Rates now: ${rates.inputPerMillion} / ${rates.outputPerMillion} / ${rates.embeddingPerMillion} per million
        input / output / embedding tokens. Past days keep the rate of their time.
      </p>
      {filtered && (
        <p className={styles.hint}>Index runs aren&rsquo;t tied to a college or role, so they&rsquo;re excluded.</p>
      )}
    </>
  );
}
