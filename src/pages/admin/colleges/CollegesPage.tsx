import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { COLLEGE_SORTS, listColleges, type College, type CollegeSort } from '@/api/colleges';
import { flash } from '@/components/flash';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { StatusBadge } from '@/components/StatusBadge';
import { useApiQuery } from '@/hooks/useApiQuery';
import { TABLE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { pageFromParam } from '@/lib/urlParams';
import { formatCount, formatDate } from '@/lib/format';
import { AddCollegeDialog } from './collegeDialogs';
import styles from '@/components/ui.module.css';

const PAGE_SIZE = 20;

const SORT_LABELS: Record<CollegeSort, string> = {
  'name,asc': 'Name (A–Z)',
  'code,asc': 'Code',
  'createdAt,desc': 'Newest',
};

type StatusFilter = 'all' | 'active' | 'inactive';

/** `/admin/colleges` (UI spec F1.6): search, status and sort live in the URL. */
export function CollegesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status: StatusFilter = params.get('active') === 'true' ? 'active' : params.get('active') === 'false' ? 'inactive' : 'all';
  const sortParam = params.get('sort');
  const sort: CollegeSort = (COLLEGE_SORTS as readonly string[]).includes(sortParam ?? '') ? (sortParam as CollegeSort) : 'name,asc';
  const page = pageFromParam(params.get('page'));
  const [search, setSearch] = useState(q);
  const [adding, setAdding] = useState(false);
  const wide = useMediaQuery(TABLE_QUERY);
  const searchTimer = useRef<number | undefined>(undefined);

  // Back/Forward (or Clear filters) change `q`: show it in the box (adjusting state during render).
  const [shownQ, setShownQ] = useState(q);
  if (q !== shownQ) {
    setShownQ(q);
    if (search.trim() !== q) setSearch(q);
  }

  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  /** Functional, so a debounced update never overwrites a filter changed in the meantime. */
  function update(next: { q?: string; status?: StatusFilter; sort?: CollegeSort; page?: number }) {
    setParams(
      (current) => {
        const merged = new URLSearchParams(current);
        const set = (key: string, value: string | null) => (value ? merged.set(key, value) : merged.delete(key));
        if (next.q !== undefined) set('q', next.q);
        if (next.status !== undefined) set('active', next.status === 'all' ? null : String(next.status === 'active'));
        if (next.sort !== undefined) set('sort', next.sort === 'name,asc' ? null : next.sort);
        // Any filter change returns to the first page.
        set('page', next.page ? String(next.page + 1) : null);
        return merged;
      },
      { replace: next.q !== undefined },
    );
  }

  /** The box updates `q` once typing pauses for 300 ms (UI spec F1.6). */
  function changeSearch(value: string) {
    setSearch(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => update({ q: value.trim() }), 300);
  }

  const active = status === 'all' ? undefined : status === 'active';
  const results = useApiQuery(`colleges:${q}:${status}:${sort}:${page}`, () =>
    listColleges({ q: q || undefined, active, sort, page, size: PAGE_SIZE }),
  );
  const data = results.status === 'success' ? results.data : results.status === 'loading' ? results.staleData : undefined;
  const filtered = q !== '' || status !== 'all';

  function clearFilters() {
    window.clearTimeout(searchTimer.current);
    setSearch('');
    setParams(new URLSearchParams(sort === 'name,asc' ? {} : { sort }));
  }

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>Super admin</p>
          <h1 className={styles.title}>Colleges</h1>
        </div>
        <button type="button" className={styles.primaryButton} onClick={() => setAdding(true)}>
          Add college
        </button>
      </div>

      <div className={styles.filterBar} role="search" aria-label="Filter colleges">
        <div className={`${styles.field} ${styles.fieldGrow}`}>
          <label htmlFor="college-search" className={styles.label}>
            Search
          </label>
          <input
            id="college-search"
            type="search"
            className={styles.input}
            placeholder="Search by name or code"
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
            autoComplete="off"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="college-status" className={styles.label}>
            Status
          </label>
          <select
            id="college-status"
            className={styles.input}
            value={status}
            onChange={(event) => update({ status: event.target.value as StatusFilter })}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="college-sort" className={styles.label}>
            Sort
          </label>
          <select
            id="college-sort"
            className={styles.input}
            value={sort}
            onChange={(event) => update({ sort: event.target.value as CollegeSort })}
          >
            {COLLEGE_SORTS.map((value) => (
              <option key={value} value={value}>
                {SORT_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {results.status === 'loading' && !data && <LoadingState label="Loading colleges" />}
      {results.status === 'error' && <ErrorState error={results.error} onRetry={results.retry} />}

      {data && results.status !== 'error' && (
        <div aria-busy={results.status === 'loading'}>
          {data.totalElements === 0 ? (
            filtered ? (
              <EmptyState
                actions={
                  <button type="button" className={styles.secondaryButton} onClick={clearFilters}>
                    Clear filters
                  </button>
                }
              >
                No colleges match these filters.
              </EmptyState>
            ) : (
              <EmptyState
                actions={
                  <button type="button" className={styles.primaryButton} onClick={() => setAdding(true)}>
                    Add college
                  </button>
                }
              >
                No colleges yet. Add the first college to give its students and professors access.
              </EmptyState>
            )
          ) : (
            <>
              <p className={styles.resultMeta} aria-live="polite">
                <span className={styles.hint}>
                  {formatCount(data.totalElements)} {data.totalElements === 1 ? 'college' : 'colleges'}
                </span>
              </p>
              {wide ? <CollegeTable colleges={data.content} /> : <CollegeCards colleges={data.content} />}
              <Pagination
                label="College pages"
                page={data.page}
                totalPages={data.totalPages}
                onChange={(next) => update({ page: next })}
              />
            </>
          )}
        </div>
      )}

      <AddCollegeDialog
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(college) => {
          setAdding(false);
          flash('College added. Next, add a college admin.');
          navigate(`/admin/colleges/${college.id}`);
        }}
      />
    </>
  );
}

function AdminCount({ value }: { value: number }) {
  // Nobody can manage a college without an admin, so 0 stands out (with text, not only colour).
  return value === 0 ? <span className={styles.warningText}>None</span> : <>{formatCount(value)}</>;
}

function StatusCell({ college }: { college: College }) {
  return college.active ? <StatusBadge tone="success">Active</StatusBadge> : <StatusBadge tone="neutral">Inactive</StatusBadge>;
}

function CollegeTable({ colleges }: { colleges: College[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>Colleges</caption>
        <thead>
          <tr>
            <th scope="col">College</th>
            <th scope="col">Status</th>
            <th scope="col" className={styles.numeric}>
              Admins
            </th>
            <th scope="col" className={styles.numeric}>
              Professors
            </th>
            <th scope="col" className={styles.numeric}>
              Students
            </th>
            <th scope="col">Added</th>
          </tr>
        </thead>
        <tbody>
          {colleges.map((college) => (
            <tr key={college.id}>
              <td>
                <Link to={`/admin/colleges/${college.id}`} className={styles.cellTitle}>
                  {college.name}
                </Link>
                <span className={`${styles.cellSub} ${styles.mono}`}>{college.code}</span>
              </td>
              <td>
                <StatusCell college={college} />
              </td>
              <td className={styles.numeric}>
                <AdminCount value={college.counts.admins} />
              </td>
              <td className={styles.numeric}>{formatCount(college.counts.professors)}</td>
              <td className={styles.numeric}>{formatCount(college.counts.students)}</td>
              <td>{formatDate(college.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CollegeCards({ colleges }: { colleges: College[] }) {
  return (
    <ul className={styles.cardList} aria-label="Colleges">
      {colleges.map((college) => (
        <li key={college.id} className={styles.card}>
          <div className={styles.cardHead}>
            <Link to={`/admin/colleges/${college.id}`} className={styles.cellTitle}>
              {college.name}
            </Link>
            <StatusCell college={college} />
          </div>
          <span className={`${styles.hint} ${styles.mono}`}>{college.code}</span>
          <span className={styles.hint}>
            {college.counts.admins === 0 ? (
              <span className={styles.warningText}>No admins</span>
            ) : (
              `${formatCount(college.counts.admins)} ${college.counts.admins === 1 ? 'admin' : 'admins'}`
            )}
            {` · ${formatCount(college.counts.professors)} professors · ${formatCount(college.counts.students)} students`}
          </span>
        </li>
      ))}
    </ul>
  );
}
