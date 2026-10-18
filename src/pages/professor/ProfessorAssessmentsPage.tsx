import { Link, useSearchParams } from 'react-router-dom';
import { ASSESSMENT_STATUSES, type AssessmentStatus } from '@/api/assessments';
import { listAssessments, type AssessmentSummary } from '@/api/professor';
import { listSubjects } from '@/api/subjects';
import { AssessmentStatusBadge } from '@/components/AssessmentBadges';
import { ASSESSMENT_STATUS_LABELS } from '@/components/assessmentLabels';
import { Deadline } from '@/components/Deadline';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { TABLE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { useNow } from '@/lib/deadline';
import { formatCount, formatMarks } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { pageFromParam } from '@/lib/urlParams';
import styles from '@/components/ui.module.css';

const PAGE_SIZE = 20;

/** Drafts open in the editor; everything else on its detail. */
function assessmentLink(assessment: Pick<AssessmentSummary, 'id' | 'status'>): string {
  return assessment.status === 'DRAFT'
    ? `/professor/assessments/${assessment.id}/edit`
    : `/professor/assessments/${assessment.id}`;
}

function submittedText(a: AssessmentSummary): string {
  return a.status === 'DRAFT' ? '—' : `${formatCount(a.counts.submitted)} of ${formatCount(a.counts.answerSlots)}`;
}

/** A grading count, or "—" for drafts (nothing can be submitted yet). */
function gradingText(a: AssessmentSummary, value: number): string {
  return a.status === 'DRAFT' ? '—' : formatCount(value);
}

function notAttemptedText(a: AssessmentSummary): string {
  return a.status === 'CLOSED' || a.status === 'REMOVED' ? formatCount(a.counts.notAttempted) : '—';
}

/**
 * `/professor` (UI spec F3.1): the professor's own assessments in every status, filtered by
 * subject and status in the URL, newest due date first (drafts without one at the top).
 */
export function ProfessorAssessmentsPage() {
  const [params, setParams] = useSearchParams();
  const subjectId = params.get('subject') ?? '';
  const statusParam = params.get('status');
  const status = (ASSESSMENT_STATUSES as readonly string[]).includes(statusParam ?? '')
    ? (statusParam as AssessmentStatus)
    : null;
  const page = pageFromParam(params.get('page'));
  const wide = useMediaQuery(TABLE_QUERY);
  const now = useNow();

  const subjects = useCachedQuery(queryKeys.subjects.list(''), (signal) => listSubjects(undefined, signal));
  const results = useCachedQuery(queryKeys.professorAssessments.list({ subjectId, status, page }), (signal) =>
    listAssessments({ subjectId: subjectId || undefined, status: status ?? undefined, page, size: PAGE_SIZE }, signal),
  );
  const data = results.status === 'success' ? results.data : results.status === 'loading' ? results.staleData : undefined;
  const noSubjects = subjects.status === 'success' && subjects.data.length === 0;
  const filtered = Boolean(subjectId || status);

  function update(next: { subject?: string; status?: string; page?: number }) {
    setParams((current) => {
      const merged = new URLSearchParams(current);
      const set = (key: string, value: string | undefined) => (value ? merged.set(key, value) : merged.delete(key));
      if (next.subject !== undefined) set('subject', next.subject);
      if (next.status !== undefined) set('status', next.status);
      set('page', next.page ? String(next.page + 1) : undefined);
      return merged;
    });
  }

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>Professor</p>
          <h1 className={styles.title}>Assessments</h1>
        </div>
        <div className={styles.headerLinks}>
          {noSubjects ? (
            <button type="button" className={styles.primaryButton} disabled aria-describedby="new-assessment-hint">
              New assessment
            </button>
          ) : (
            <Link to="/professor/assessments/new" className={styles.primaryButton}>
              New assessment
            </Link>
          )}
        </div>
      </div>
      {noSubjects && (
        <p id="new-assessment-hint" className={styles.hint}>
          You need a subject first. Your college admin assigns them.
        </p>
      )}

      <div className={styles.filterBar} role="search" aria-label="Filter assessments">
        <div className={styles.field}>
          <label htmlFor="assessment-subject" className={styles.label}>
            Subject
          </label>
          <select
            id="assessment-subject"
            className={styles.input}
            value={subjectId}
            onChange={(event) => update({ subject: event.target.value })}
          >
            <option value="">All subjects</option>
            {subjects.status === 'success' &&
              subjects.data.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} · {subject.name}
                </option>
              ))}
          </select>
          {subjects.status === 'error' && (
            <span className={styles.fieldError} role="alert">
              Subjects couldn&rsquo;t be loaded.{' '}
              <button type="button" className={styles.linkButton} onClick={subjects.retry}>
                Try again
              </button>
            </span>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor="assessment-status" className={styles.label}>
            Status
          </label>
          <select
            id="assessment-status"
            className={styles.input}
            value={status ?? ''}
            onChange={(event) => update({ status: event.target.value })}
          >
            <option value="">All</option>
            {ASSESSMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {ASSESSMENT_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {results.status === 'loading' && !data && <LoadingState label="Loading assessments" />}
      {results.status === 'error' && <ErrorState error={results.error} onRetry={results.retry} />}

      {data && results.status !== 'error' && (
        <div aria-busy={results.status === 'loading'}>
          {data.totalElements === 0 ? (
            filtered ? (
              <EmptyState
                actions={
                  <button type="button" className={styles.secondaryButton} onClick={() => setParams({})}>
                    Clear filters
                  </button>
                }
              >
                No assessments match these filters.
              </EmptyState>
            ) : noSubjects ? (
              <EmptyState>
                You haven&rsquo;t been assigned any subjects yet. Your college admin assigns them, and then you can create
                assessments.
              </EmptyState>
            ) : (
              <EmptyState
                actions={
                  <Link to="/professor/assessments/new" className={styles.primaryButton}>
                    New assessment
                  </Link>
                }
              >
                No assessments yet. Create one for a subject you teach; students see it once you publish it.
              </EmptyState>
            )
          ) : (
            <>
              <p className={styles.resultMeta} aria-live="polite">
                <span className={styles.hint}>
                  {formatCount(data.totalElements)} {data.totalElements === 1 ? 'assessment' : 'assessments'}
                </span>
              </p>
              {wide ? (
                <AssessmentTable assessments={data.content} now={now} />
              ) : (
                <AssessmentCards assessments={data.content} now={now} />
              )}
              <Pagination
                label="Assessment pages"
                page={data.page}
                totalPages={data.totalPages}
                onChange={(next) => update({ page: next })}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

function AssessmentTable({ assessments, now }: { assessments: AssessmentSummary[]; now: number }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>Assessments</caption>
        <thead>
          <tr>
            <th scope="col">Assessment</th>
            <th scope="col">Due</th>
            <th scope="col">Status</th>
            <th scope="col" className={styles.numeric}>
              Questions
            </th>
            <th scope="col" className={styles.numeric}>
              <span title="Answers submitted, out of students × questions">Submitted</span>
            </th>
            <th scope="col" className={styles.numeric}>
              <span title="Submitted answers whose grade isn't published yet">To grade</span>
            </th>
            <th scope="col" className={styles.numeric}>
              Published
            </th>
            <th scope="col" className={styles.numeric}>
              Not attempted
            </th>
          </tr>
        </thead>
        <tbody>
          {assessments.map((a) => (
            <tr key={a.id}>
              <td>
                <Link to={assessmentLink(a)} className={styles.cellTitle}>
                  {a.title || 'Untitled draft'}
                </Link>
                <span className={styles.cellSub}>
                  <span className={styles.mono}>{a.subject.code}</span> · {a.subject.name}
                </span>
              </td>
              <td>
                <Deadline dueAt={a.dueAt} now={now} prefix="" />
              </td>
              <td>
                <AssessmentStatusBadge status={a.status} />
              </td>
              <td className={styles.numeric}>
                {formatCount(a.questionCount)}
                <span className={styles.cellSub}>{formatMarks(a.totalMarks)} marks</span>
              </td>
              <td className={styles.numeric}>{submittedText(a)}</td>
              <td className={styles.numeric}>{gradingText(a, a.counts.pendingEvaluation)}</td>
              <td className={styles.numeric}>{gradingText(a, a.counts.published)}</td>
              <td className={styles.numeric}>{notAttemptedText(a)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssessmentCards({ assessments, now }: { assessments: AssessmentSummary[]; now: number }) {
  return (
    <ul className={styles.cardList} aria-label="Assessments">
      {assessments.map((a) => (
        <li key={a.id} className={styles.card}>
          <div className={styles.cardHead}>
            <Link to={assessmentLink(a)} className={styles.cellTitle}>
              {a.title || 'Untitled draft'}
            </Link>
            <AssessmentStatusBadge status={a.status} />
          </div>
          <span className={styles.hint}>
            <span className={styles.mono}>{a.subject.code}</span> · {a.subject.name}
          </span>
          <span className={styles.hint}>
            <Deadline dueAt={a.dueAt} now={now} />
          </span>
          {a.status !== 'DRAFT' && (
            <span className={styles.hint}>
              {formatCount(a.counts.submitted)} of {formatCount(a.counts.answerSlots)} submitted
            </span>
          )}
          {a.status !== 'DRAFT' && a.counts.submitted > 0 && (
            <span className={styles.hint}>
              {formatCount(a.counts.pendingEvaluation)} to grade · {formatCount(a.counts.published)} published
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
