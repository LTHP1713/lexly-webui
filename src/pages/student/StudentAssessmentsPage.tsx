import { Link, useSearchParams } from 'react-router-dom';
import type { StudentAssessmentState } from '@/api/assessments';
import { listStudentAssessments, type StudentAssessmentSummary } from '@/api/student';
import { listSubjects } from '@/api/subjects';
import { useAuth } from '@/auth/AuthContext';
import { StudentStateBadge } from '@/components/AssessmentBadges';
import { Deadline } from '@/components/Deadline';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { useNow } from '@/lib/deadline';
import { formatCount, formatMarks } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { pageFromParam } from '@/lib/urlParams';
import localStyles from '@/components/Assessment.module.css';
import styles from '@/components/ui.module.css';

const PAGE_SIZE = 50;

const GROUPS: { heading: string; states: StudentAssessmentState[] }[] = [
  { heading: 'To do', states: ['OPEN', 'PARTIALLY_SUBMITTED'] },
  { heading: 'Submitted', states: ['SUBMITTED'] },
  { heading: 'Closed', states: ['CLOSED', 'RESULTS_AVAILABLE'] },
];

/**
 * `/student` (UI spec F3.5): the college's published and closed assessments, grouped by the
 * student's state and kept in the server's order inside each group (open ones by due date
 * first). The subject filter and page are in the URL.
 */
export function StudentAssessmentsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const subjectId = params.get('subject') ?? '';
  const page = pageFromParam(params.get('page'));
  const now = useNow();

  const subjects = useCachedQuery(queryKeys.subjects.list(''), (signal) => listSubjects(undefined, signal));
  const results = useCachedQuery(queryKeys.studentAssessments.list({ subjectId, page }), (signal) =>
    listStudentAssessments({ subjectId: subjectId || undefined, page, size: PAGE_SIZE }, signal),
  );
  const data = results.status === 'success' ? results.data : results.status === 'loading' ? results.staleData : undefined;

  return (
    <>
      <p className={styles.eyebrow}>{user?.college?.name ?? 'Student'}</p>
      <h1 className={styles.title}>Assessments</h1>

      <div className={styles.filterBar} role="search" aria-label="Filter assessments">
        <div className={styles.field}>
          <label htmlFor="student-subject" className={styles.label}>
            Subject
          </label>
          <select
            id="student-subject"
            className={styles.input}
            value={subjectId}
            onChange={(event) => setParams(event.target.value ? { subject: event.target.value } : {})}
          >
            <option value="">All subjects</option>
            {subjects.status === 'success' &&
              subjects.data.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} · {subject.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {results.status === 'loading' && !data && <LoadingState label="Loading assessments" />}
      {results.status === 'error' && <ErrorState error={results.error} onRetry={results.retry} />}
      {data && results.status !== 'error' && (
        <div aria-busy={results.status === 'loading'}>
          {data.content.length === 0 ? (
            subjectId ? (
              <EmptyState
                actions={
                  <button type="button" className={styles.secondaryButton} onClick={() => setParams({})}>
                    Show all subjects
                  </button>
                }
              >
                No assessments for this subject yet.
              </EmptyState>
            ) : (
              <EmptyState>No assessments yet. When your professors publish one, it appears here.</EmptyState>
            )
          ) : (
            <>
              {GROUPS.map((group) => {
                const items = data.content.filter((a) => group.states.includes(a.state));
                if (items.length === 0) return null;
                const headingId = `group-${group.heading.toLowerCase().replace(/\s+/g, '-')}`;
                return (
                  <section key={group.heading} aria-labelledby={headingId}>
                    <h2 id={headingId} className={localStyles.groupHeading}>
                      {group.heading}
                    </h2>
                    <ul className={localStyles.assessmentCards}>
                      {items.map((a) => (
                        <li key={a.id}>
                          <AssessmentCard assessment={a} now={now} />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
              <Pagination
                label="Assessment pages"
                page={data.page}
                totalPages={data.totalPages}
                onChange={(next) => {
                  const nextParams = new URLSearchParams(params);
                  if (next) nextParams.set('page', String(next + 1));
                  else nextParams.delete('page');
                  setParams(nextParams);
                }}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

function AssessmentCard({ assessment: a, now }: { assessment: StudentAssessmentSummary; now: number }) {
  return (
    <Link to={`/student/assessments/${a.id}`} className={localStyles.assessmentCard}>
      <span className={localStyles.cardSubject}>
        {a.subject.code} · {a.subject.name}
      </span>
      <span className={localStyles.cardTitleRow}>
        <span className={localStyles.cardTitle}>{a.title}</span>
        <StudentStateBadge state={a.state} />
      </span>
      <span className={localStyles.cardLine}>
        <Deadline dueAt={a.dueAt} now={now} />
      </span>
      <span className={localStyles.cardLine}>
        {formatCount(a.progress.submitted)} of {formatCount(a.questionCount)} submitted
        {a.progress.uploaded > 0 && ` · ${formatCount(a.progress.uploaded)} uploaded, not submitted`}
      </span>
      <span className={`${localStyles.cardLine} ${localStyles.muted}`}>
        {formatMarks(a.totalMarks)} marks · {a.professorName ?? 'Former professor'}
      </span>
    </Link>
  );
}
