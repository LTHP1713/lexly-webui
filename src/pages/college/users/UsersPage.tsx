import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { UserSummary } from '@/api/colleges';
import {
  KIND_ROLES,
  LOGIN_ID_LABELS,
  USER_SORTS,
  listCollegeUsers,
  toUserKind,
  type CollegeUserKind,
  type UserSort,
} from '@/api/collegeUsers';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { RowMenu } from '@/components/RowMenu';
import { StatusBadge } from '@/components/StatusBadge';
import { UsersSubNav } from '@/components/SubNav';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { TABLE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { formatCount, formatDate } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { pageFromParam } from '@/lib/urlParams';
import { RemoveUserDialog, ResetUserPasswordDialog, UserFormDialog, type UserFormTarget } from './userDialogs';
import { userName } from './userQueries';
import styles from '@/components/ui.module.css';

const PAGE_SIZE = 20;
const KINDS: readonly CollegeUserKind[] = ['students', 'professors'];
const KIND_LABELS: Record<CollegeUserKind, string> = { students: 'Students', professors: 'Professors' };
const SINGULAR: Record<CollegeUserKind, string> = { students: 'student', professors: 'professor' };

function sortLabel(sort: UserSort, kind: CollegeUserKind) {
  if (sort === 'loginId,asc') return LOGIN_ID_LABELS[kind];
  return sort === 'createdAt,desc' ? 'Newest' : 'Name (A–Z)';
}

/** "Must change password" until their first sign-in (or after a reset); text, not only colour. */
export function SignInBadge({ user }: { user: UserSummary }) {
  return user.mustChangePassword ? (
    <StatusBadge tone="warning">Must change password</StatusBadge>
  ) : (
    <StatusBadge tone="success">Active</StatusBadge>
  );
}

/**
 * `/college/users` (UI spec F2.2): Students / Professors tabs, search, sort and page in the URL,
 * a table from 768px and cards below, and the row actions edit, reset password and remove.
 */
export function UsersPage() {
  const [params, setParams] = useSearchParams();
  const kind = toUserKind(params.get('role'));
  const q = params.get('q') ?? '';
  const sortParam = params.get('sort');
  const sort: UserSort = (USER_SORTS as readonly string[]).includes(sortParam ?? '') ? (sortParam as UserSort) : 'fullName,asc';
  const page = pageFromParam(params.get('page'));
  const [search, setSearch] = useState(q);
  const [formTarget, setFormTarget] = useState<UserFormTarget | null>(null);
  const [resetting, setResetting] = useState<UserSummary | null>(null);
  const [removing, setRemoving] = useState<UserSummary | null>(null);
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
  function update(next: { kind?: CollegeUserKind; q?: string; sort?: UserSort; page?: number }) {
    setParams(
      (current) => {
        const merged = new URLSearchParams(current);
        const set = (key: string, value: string | null) => (value ? merged.set(key, value) : merged.delete(key));
        if (next.kind !== undefined) set('role', next.kind === 'students' ? null : next.kind);
        if (next.q !== undefined) set('q', next.q);
        if (next.sort !== undefined) set('sort', next.sort === 'fullName,asc' ? null : next.sort);
        // Any other change (a tab, the search, the sort) returns to the first page.
        set('page', next.page ? String(next.page + 1) : null);
        return merged;
      },
      { replace: next.q !== undefined },
    );
  }

  /** The box updates `q` once typing pauses for 300 ms. */
  function changeSearch(value: string) {
    setSearch(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => update({ q: value.trim() }), 300);
  }

  function clearFilters() {
    window.clearTimeout(searchTimer.current);
    setSearch('');
    update({ q: '' });
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = KINDS[(KINDS.indexOf(kind) + 1) % KINDS.length];
    update({ kind: next });
    document.getElementById(`users-tab-${next}`)?.focus();
  }

  const role = KIND_ROLES[kind];
  const results = useCachedQuery(queryKeys.collegeUsers.list({ role, q, sort, page }), (signal) =>
    listCollegeUsers({ role, q: q || undefined, sort, page, size: PAGE_SIZE }, signal),
  );
  const data = results.status === 'success' ? results.data : results.status === 'loading' ? results.staleData : undefined;
  const noun = kind === 'students' ? 'students' : 'professors';
  const importLink = `/college/users/import${kind === 'students' ? '' : '?kind=professors'}`;

  const menuItems = (user: UserSummary) => [
    { label: 'Edit', onSelect: () => setFormTarget({ mode: 'edit', user }) },
    { label: 'Reset password', onSelect: () => setResetting(user) },
    { label: 'Remove', danger: true, onSelect: () => setRemoving(user) },
  ];

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>College admin</p>
          <h1 className={styles.title}>Users</h1>
        </div>
        <div className={styles.headerLinks}>
          <Link to={importLink} className={styles.secondaryButton}>
            Import
          </Link>
          <button type="button" className={styles.primaryButton} onClick={() => setFormTarget({ mode: 'add', kind })}>
            Add {SINGULAR[kind]}
          </button>
        </div>
      </div>
      <UsersSubNav />

      <div role="tablist" aria-label="Role" className={styles.tabs}>
        {KINDS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`users-tab-${value}`}
            aria-selected={kind === value}
            aria-controls="users-panel"
            tabIndex={kind === value ? 0 : -1}
            className={styles.tab}
            onClick={() => kind !== value && update({ kind: value })}
            onKeyDown={onTabKeyDown}
          >
            {KIND_LABELS[value]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="users-panel" aria-labelledby={`users-tab-${kind}`}>
        <div className={styles.filterBar} role="search" aria-label={`Filter ${noun}`}>
          <div className={`${styles.field} ${styles.fieldGrow}`}>
            <label htmlFor="user-search" className={styles.label}>
              Search
            </label>
            <input
              id="user-search"
              type="search"
              className={styles.input}
              placeholder={`Search by name, email or ${kind === 'students' ? 'roll no' : 'employee ID'}`}
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="user-sort" className={styles.label}>
              Sort
            </label>
            <select
              id="user-sort"
              className={styles.input}
              value={sort}
              onChange={(event) => update({ sort: event.target.value as UserSort })}
            >
              {USER_SORTS.map((value) => (
                <option key={value} value={value}>
                  {sortLabel(value, kind)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {results.status === 'loading' && !data && <LoadingState label={`Loading ${noun}`} />}
        {results.status === 'error' && <ErrorState error={results.error} onRetry={results.retry} />}

        {data && results.status !== 'error' && (
          <div aria-busy={results.status === 'loading'}>
            {data.totalElements === 0 ? (
              q ? (
                <EmptyState
                  actions={
                    <button type="button" className={styles.secondaryButton} onClick={clearFilters}>
                      Clear filters
                    </button>
                  }
                >
                  No {noun} match these filters.
                </EmptyState>
              ) : (
                <EmptyState
                  actions={
                    <>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => setFormTarget({ mode: 'add', kind })}
                      >
                        Add {SINGULAR[kind]}
                      </button>
                      <Link to={importLink} className={styles.secondaryButton}>
                        Import {noun}
                      </Link>
                    </>
                  }
                >
                  No {noun} yet. Add them one at a time, or import a CSV or Excel file.
                </EmptyState>
              )
            ) : (
              <>
                <p className={styles.resultMeta} aria-live="polite">
                  <span className={styles.hint}>
                    {formatCount(data.totalElements)} {data.totalElements === 1 ? SINGULAR[kind] : noun}
                  </span>
                </p>
                {wide ? (
                  <UserTable users={data.content} kind={kind} menuItems={menuItems} />
                ) : (
                  <UserCards users={data.content} kind={kind} menuItems={menuItems} />
                )}
                <Pagination
                  label={`${KIND_LABELS[kind]} pages`}
                  page={data.page}
                  totalPages={data.totalPages}
                  onChange={(next) => update({ page: next })}
                />
              </>
            )}
          </div>
        )}
      </div>

      <UserFormDialog target={formTarget} onClose={() => setFormTarget(null)} />
      <ResetUserPasswordDialog user={resetting} onClose={() => setResetting(null)} />
      <RemoveUserDialog user={removing} onClose={() => setRemoving(null)} />
    </>
  );
}

type MenuItems = (user: UserSummary) => { label: string; onSelect: () => void; danger?: boolean }[];

function UserTable({ users, kind, menuItems }: { users: UserSummary[]; kind: CollegeUserKind; menuItems: MenuItems }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>{kind === 'students' ? 'Students' : 'Professors'}</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">{LOGIN_ID_LABELS[kind]}</th>
            <th scope="col">Sign-in</th>
            <th scope="col">Added</th>
            <th scope="col">
              <span className={styles.visuallyHidden}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <Link to={`/college/users/${user.id}`} className={styles.cellTitle}>
                  {user.fullName ?? '—'}
                </Link>
                <span className={styles.cellSub}>{user.email ?? '—'}</span>
              </td>
              <td className={styles.mono}>{user.loginId ?? '—'}</td>
              <td>
                <SignInBadge user={user} />
              </td>
              <td>{formatDate(user.createdAt)}</td>
              <td>
                <RowMenu label={`Actions for ${userName(user)}`} items={menuItems(user)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserCards({ users, kind, menuItems }: { users: UserSummary[]; kind: CollegeUserKind; menuItems: MenuItems }) {
  return (
    <ul className={styles.cardList} aria-label={kind === 'students' ? 'Students' : 'Professors'}>
      {users.map((user) => (
        <li key={user.id} className={styles.card}>
          <div className={styles.cardHead}>
            <Link to={`/college/users/${user.id}`} className={styles.cellTitle}>
              {user.fullName ?? '—'}
            </Link>
            <span className={styles.detailFacts}>
              <SignInBadge user={user} />
              <RowMenu label={`Actions for ${userName(user)}`} items={menuItems(user)} />
            </span>
          </div>
          <span className={styles.hint}>{user.email ?? '—'}</span>
          <span className={styles.hint}>
            <span className={styles.mono}>{user.loginId ?? '—'}</span> · Added {formatDate(user.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
