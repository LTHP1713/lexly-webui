import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { listSubjects, type Subject } from '@/api/subjects';
import { flash } from '@/components/flash';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { TABLE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { formatCount } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { SubjectFormDialog } from './subjectDialogs';
import styles from '@/components/ui.module.css';

/** "None" in the warning colour (with text, not only colour): nobody can set assessments for it yet. */
function ProfessorNames({ subject }: { subject: Subject }) {
  if (subject.professors.length === 0) return <span className={styles.warningText}>None</span>;
  return <>{subject.professors.map((p) => p.fullName ?? 'Unnamed professor').join(', ')}</>;
}

/** `/college/subjects` (UI spec F2.7): a plain list ordered by name, with the search in the URL. */
export function SubjectsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [search, setSearch] = useState(q);
  const [adding, setAdding] = useState(false);
  const wide = useMediaQuery(TABLE_QUERY);
  const searchTimer = useRef<number | undefined>(undefined);

  // Back/Forward (or Clear search) change `q`: show it in the box (adjusting state during render).
  const [shownQ, setShownQ] = useState(q);
  if (q !== shownQ) {
    setShownQ(q);
    if (search.trim() !== q) setSearch(q);
  }

  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  function changeSearch(value: string) {
    setSearch(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      const next = value.trim();
      setParams(next ? { q: next } : {}, { replace: true });
    }, 300);
  }

  function clearSearch() {
    window.clearTimeout(searchTimer.current);
    setSearch('');
    setParams({});
  }

  const results = useCachedQuery(queryKeys.subjects.list(q), (signal) => listSubjects(q || undefined, signal));
  const data = results.status === 'success' ? results.data : results.status === 'loading' ? results.staleData : undefined;

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>College admin</p>
          <h1 className={styles.title}>Subjects</h1>
        </div>
        <button type="button" className={styles.primaryButton} onClick={() => setAdding(true)}>
          Add subject
        </button>
      </div>

      <div className={styles.filterBar} role="search" aria-label="Filter subjects">
        <div className={`${styles.field} ${styles.fieldGrow}`}>
          <label htmlFor="subject-search" className={styles.label}>
            Search
          </label>
          <input
            id="subject-search"
            type="search"
            className={styles.input}
            placeholder="Search by code or name"
            value={search}
            onChange={(event) => changeSearch(event.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      {results.status === 'loading' && !data && <LoadingState label="Loading subjects" />}
      {results.status === 'error' && <ErrorState error={results.error} onRetry={results.retry} />}

      {data && results.status !== 'error' && (
        <div aria-busy={results.status === 'loading'}>
          {data.length === 0 ? (
            q ? (
              <EmptyState
                actions={
                  <button type="button" className={styles.secondaryButton} onClick={clearSearch}>
                    Clear search
                  </button>
                }
              >
                No subjects match this search.
              </EmptyState>
            ) : (
              <EmptyState
                actions={
                  <button type="button" className={styles.primaryButton} onClick={() => setAdding(true)}>
                    Add subject
                  </button>
                }
              >
                No subjects yet. Add the subjects your college teaches, then assign professors to them.
              </EmptyState>
            )
          ) : (
            <>
              <p className={styles.resultMeta} aria-live="polite">
                <span className={styles.hint}>
                  {formatCount(data.length)} {data.length === 1 ? 'subject' : 'subjects'}
                </span>
              </p>
              {wide ? <SubjectTable subjects={data} /> : <SubjectCards subjects={data} />}
            </>
          )}
        </div>
      )}

      <SubjectFormDialog
        open={adding}
        subject={null}
        onClose={() => setAdding(false)}
        onSaved={(subject) => {
          setAdding(false);
          flash('Subject added. Next, assign its professors.');
          navigate(`/college/subjects/${subject.id}`);
        }}
      />
    </>
  );
}

function SubjectTable({ subjects }: { subjects: Subject[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>Subjects</caption>
        <thead>
          <tr>
            <th scope="col">Subject</th>
            <th scope="col">Professors</th>
            <th scope="col" className={styles.numeric}>
              Assessments
            </th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject) => (
            <tr key={subject.id}>
              <td>
                <Link to={`/college/subjects/${subject.id}`} className={styles.cellTitle}>
                  {subject.name}
                </Link>
                <span className={`${styles.cellSub} ${styles.mono}`}>{subject.code}</span>
              </td>
              <td>
                <ProfessorNames subject={subject} />
              </td>
              <td className={styles.numeric}>{formatCount(subject.assessmentCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubjectCards({ subjects }: { subjects: Subject[] }) {
  return (
    <ul className={styles.cardList} aria-label="Subjects">
      {subjects.map((subject) => (
        <li key={subject.id} className={styles.card}>
          <Link to={`/college/subjects/${subject.id}`} className={styles.cellTitle}>
            {subject.name}
          </Link>
          <span className={`${styles.hint} ${styles.mono}`}>{subject.code}</span>
          <span className={styles.hint}>
            Professors: <ProfessorNames subject={subject} />
          </span>
        </li>
      ))}
    </ul>
  );
}
