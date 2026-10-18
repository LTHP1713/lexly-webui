import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CELL_STATUSES,
  REVIEW_ORDERS,
  oneOf,
  type CellStatus,
  type GridStatusFilter,
  type ReviewOrder,
} from '@/api/assessments';
import { errorMessage, hasCode } from '@/api/errors';
import {
  deleteAssessment,
  getAssessment,
  listSubmissions,
  removeAssessment,
  type AssessmentDetail,
  type AssessmentQuestion,
  type GridCell,
  type GridRow,
} from '@/api/professor';
import { AssessmentStatusBadge, CellStatusLabel, GradeStatusLabel } from '@/components/AssessmentBadges';
import { CELL_LABELS, GRADE_FILTERS, GRADE_LABELS, gradeStatusText } from '@/components/assessmentLabels';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Deadline } from '@/components/Deadline';
import { flash } from '@/components/flash';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { TABLE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { useNow } from '@/lib/deadline';
import { formatCount, formatInstant, formatMarks } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { pageFromParam } from '@/lib/urlParams';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { useRefreshAssessments } from './assessmentQueries';
import { ORDER_LABELS, answerReviewLink } from './reviewLinks';
import localStyles from '@/components/Assessment.module.css';
import styles from '@/components/ui.module.css';

const GRID_PAGE_SIZE = 50;

/**
 * `/professor/assessments/:assessmentId` (UI spec F3.8): the assessment as published, its
 * actions (F3.4) and the students × questions submissions grid. Another professor's assessment
 * is a `404` → Not Found.
 */
export function ProfessorAssessmentDetailPage() {
  const { assessmentId = '' } = useParams();
  const query = useCachedQuery(queryKeys.professorAssessments.detail(assessmentId), (signal) =>
    getAssessment(assessmentId, signal),
  );

  if (query.status === 'error' && hasCode(query.error, 'NOT_FOUND')) return <NotFoundPage />;
  const assessment = query.status === 'success' ? query.data : null;
  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/professor">Assessments</Link>
        {assessment && <span aria-current="page"> / {assessment.title || 'Untitled draft'}</span>}
      </nav>
      {query.status === 'loading' && (
        <>
          <h1 className={styles.title}>Loading assessment…</h1>
          <LoadingState label="Loading assessment" />
        </>
      )}
      {query.status === 'error' && (
        <>
          <h1 className={styles.title}>Assessment unavailable</h1>
          <ErrorState error={query.error} onRetry={query.retry} />
        </>
      )}
      {assessment && <AssessmentDetailView assessment={assessment} />}
    </>
  );
}

function AssessmentDetailView({ assessment }: { assessment: AssessmentDetail }) {
  const navigate = useNavigate();
  const refresh = useRefreshAssessments();
  const now = useNow(0, assessment.dueAt);
  const [confirm, setConfirm] = useState<'delete' | 'remove' | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const isDraft = assessment.status === 'DRAFT';
  const ended = assessment.status === 'CLOSED' || assessment.status === 'REMOVED';

  function fail(err: unknown) {
    setConfirm(null);
    if (hasCode(err, 'ASSESSMENT_NOT_EDITABLE')) {
      setBanner('This assessment changed in the meantime. It has been reloaded.');
      refresh();
    } else {
      setBanner(errorMessage(err));
    }
  }

  async function confirmDelete() {
    setBusy(true);
    setBanner(null);
    try {
      await deleteAssessment(assessment.id);
    } catch (err) {
      if (!hasCode(err, 'NOT_FOUND')) {
        setBusy(false);
        fail(err);
        return;
      }
      // Already gone: the same outcome as deleting it.
    }
    refresh(assessment.id);
    flash('Draft deleted.');
    navigate('/professor');
  }

  async function confirmRemove() {
    setBusy(true);
    setBanner(null);
    try {
      await removeAssessment(assessment.id);
      setConfirm(null);
      refresh();
      flash('Assessment removed.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className={styles.detailHeader}>
        <div className={styles.titleRow}>
          <div>
            <p className={styles.eyebrow}>Professor</p>
            <h1 className={styles.title}>{assessment.title || 'Untitled draft'}</h1>
            <p className={styles.detailFacts}>
              <AssessmentStatusBadge status={assessment.status} />
              <span>
                <span className={styles.codeChip}>{assessment.subject.code}</span> {assessment.subject.name}
              </span>
              <Deadline dueAt={assessment.dueAt} now={now} />
              <span>
                {formatCount(assessment.questionCount)} {assessment.questionCount === 1 ? 'question' : 'questions'} ·{' '}
                {formatMarks(assessment.totalMarks)} marks
              </span>
              <span>By {assessment.createdBy?.fullName ?? 'Former professor'}</span>
            </p>
          </div>
          <div className={styles.headerLinks}>
            {isDraft && (
              <>
                <Link to={`/professor/assessments/${assessment.id}/edit`} className={styles.primaryButton}>
                  Edit draft
                </Link>
                <button type="button" className={styles.dangerButton} onClick={() => setConfirm('delete')}>
                  Delete draft
                </button>
              </>
            )}
            {(assessment.status === 'PUBLISHED' || assessment.status === 'CLOSED') && (
              <button type="button" className={styles.dangerButton} onClick={() => setConfirm('remove')}>
                Remove
              </button>
            )}
          </div>
        </div>
      </header>

      <div role="alert">{banner && <p className={styles.formError}>{banner}</p>}</div>
      {assessment.status === 'REMOVED' && (
        <p className={styles.notice}>
          Removed {formatInstant(assessment.removedAt)}. Students no longer see this assessment.
        </p>
      )}

      {!isDraft && (
        <dl className={styles.statTiles}>
          <div className={styles.statTile}>
            <dt>Students</dt>
            <dd>{formatCount(assessment.counts.students)}</dd>
          </div>
          <div className={styles.statTile}>
            <dt>Submitted</dt>
            <dd>
              {formatCount(assessment.counts.submitted)} of {formatCount(assessment.counts.answerSlots)}
            </dd>
          </div>
          <div className={styles.statTile}>
            <dt>To grade</dt>
            <dd>{formatCount(assessment.counts.pendingEvaluation)}</dd>
          </div>
          <div className={styles.statTile}>
            <dt>Published</dt>
            <dd>{formatCount(assessment.counts.published)}</dd>
          </div>
          <div className={styles.statTile}>
            <dt>Not attempted</dt>
            <dd>{ended ? formatCount(assessment.counts.notAttempted) : '—'}</dd>
          </div>
        </dl>
      )}

      <section className={`${styles.editorSection} ${styles.listSection}`} aria-labelledby="assessment-questions-title">
        {assessment.instructions && (
          <>
            <h2 className={styles.sectionHeadTitle}>Instructions</h2>
            <p className={styles.preLine}>{assessment.instructions}</p>
          </>
        )}
        <h2 id="assessment-questions-title" className={styles.sectionHeadTitle}>
          Questions
        </h2>
        {assessment.questions.length === 0 ? (
          <p className={localStyles.muted}>No questions yet.</p>
        ) : (
          <ol className={localStyles.questionList}>
            {assessment.questions.map((q) => (
              <li key={q.id || q.position}>
                <p className={localStyles.questionMeta}>{questionMeta(q)}</p>
                <p className={localStyles.questionText}>{q.text ?? 'Not set'}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {!isDraft && <SubmissionsSection assessment={assessment} />}

      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this draft?"
        confirmLabel={busy ? 'Deleting…' : 'Delete draft'}
        destructive
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirm(null)}
      >
        <p>
          &ldquo;{assessment.title || 'Untitled draft'}&rdquo; and its questions are deleted. This can&rsquo;t be undone.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'remove'}
        title={`Remove “${assessment.title}”?`}
        confirmLabel={busy ? 'Removing…' : 'Remove assessment'}
        destructive
        busy={busy}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setConfirm(null)}
      >
        <p>
          Students won&rsquo;t see it any more, and it is left out of rankings. Answers that were uploaded but not
          submitted are deleted; submitted answers are kept. This can&rsquo;t be undone.
        </p>
      </ConfirmDialog>
    </>
  );
}

function questionMeta(q: AssessmentQuestion): string {
  const marks = q.maxMarks === null ? 'Not set' : `${formatMarks(q.maxMarks)} marks`;
  const words = q.wordLimit === null ? 'Not set' : `up to ${formatCount(q.wordLimit)} words`;
  return `Question ${q.position} · ${marks} · ${words}`;
}

/**
 * The submissions grid. Question, status and page are in the URL; the search text is not (it
 * can hold a student's name or roll no, plan §9 rule 3), so it lives in component state.
 */
function SubmissionsSection({ assessment }: { assessment: AssessmentDetail }) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const wide = useMediaQuery(TABLE_QUERY);
  const ended = assessment.status === 'CLOSED' || assessment.status === 'REMOVED';

  const position = Number(params.get('question'));
  const question = assessment.questions.find((item) => item.position === position) ?? null;
  const statusParam = params.get('status');
  // Grade statuses go right after "Submitted", since they narrow it down (UI spec F4.5).
  const statuses: GridStatusFilter[] = [
    'SUBMITTED',
    ...GRADE_FILTERS,
    ...CELL_STATUSES.filter((s) => s !== 'SUBMITTED' && (ended || s !== 'NOT_ATTEMPTED')),
  ];
  const status = (statuses as readonly string[]).includes(statusParam ?? '') ? (statusParam as GridStatusFilter) : null;
  const order = oneOf(REVIEW_ORDERS, params.get('order'));
  const page = pageFromParam(params.get('page'));
  const filtered = Boolean(question || status || q);

  const grid = useCachedQuery(
    queryKeys.professorAssessments.answers(assessment.id, { questionId: question?.id ?? null, status, q, page }),
    (signal) =>
      listSubmissions(
        assessment.id,
        { questionId: question?.id, status: status ?? undefined, q: q || undefined, page, size: GRID_PAGE_SIZE },
        signal,
      ),
  );
  const data = grid.status === 'success' ? grid.data : grid.status === 'loading' ? grid.staleData : undefined;
  const columns = question ? [question] : assessment.questions;

  function update(next: { question?: string; status?: string; order?: string; page?: number }) {
    setParams(
      (current) => {
        const merged = new URLSearchParams(current);
        const set = (key: string, value: string | undefined) => (value ? merged.set(key, value) : merged.delete(key));
        if (next.question !== undefined) set('question', next.question);
        if (next.status !== undefined) set('status', next.status);
        // The order doesn't filter, so it keeps the page.
        if (next.order !== undefined) {
          set('order', next.order === 'byStudent' ? undefined : next.order);
          return merged;
        }
        set('page', next.page ? String(next.page + 1) : undefined);
        return merged;
      },
      { replace: true },
    );
  }

  function clearFilters() {
    setSearch('');
    // The grading order isn't a filter, so it stays.
    setParams(order === 'byStudent' ? new URLSearchParams() : new URLSearchParams({ order }), { replace: true });
  }

  return (
    <section className={styles.listSection} aria-labelledby="submissions-title">
      <h2 id="submissions-title" className={styles.sectionHeadTitle}>
        Submissions
      </h2>
      <div className={styles.filterBar} role="search" aria-label="Filter submissions">
        <div className={styles.field}>
          <label htmlFor="grid-question" className={styles.label}>
            Question
          </label>
          <select
            id="grid-question"
            className={styles.input}
            value={question ? String(question.position) : ''}
            onChange={(event) => update({ question: event.target.value })}
          >
            <option value="">All questions</option>
            {assessment.questions.map((item) => (
              <option key={item.id} value={item.position}>
                Question {item.position}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="grid-status" className={styles.label}>
            Status
          </label>
          <select
            id="grid-status"
            className={styles.input}
            value={status ?? ''}
            onChange={(event) => update({ status: event.target.value })}
          >
            <option value="">Any</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {statusFilterLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="grid-order" className={styles.label}>
            Grading order
          </label>
          <select
            id="grid-order"
            className={styles.input}
            value={order}
            onChange={(event) => update({ order: event.target.value })}
          >
            {REVIEW_ORDERS.map((value) => (
              <option key={value} value={value}>
                {ORDER_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div className={`${styles.field} ${styles.fieldGrow}`}>
          <label htmlFor="grid-search" className={styles.label}>
            Search
          </label>
          <input
            id="grid-search"
            type="search"
            className={styles.input}
            placeholder="Search by student name or roll no"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              if (page) update({});
            }}
            autoComplete="off"
          />
        </div>
      </div>

      {grid.status === 'loading' && !data && <LoadingState label="Loading submissions" />}
      {grid.status === 'error' && <ErrorState error={grid.error} onRetry={grid.retry} />}
      {data && grid.status !== 'error' && (
        <div aria-busy={grid.status === 'loading'}>
          {data.totalElements === 0 ? (
            filtered ? (
              <EmptyState
                actions={
                  <button type="button" className={styles.secondaryButton} onClick={clearFilters}>
                    Clear filters
                  </button>
                }
              >
                No students match these filters.
              </EmptyState>
            ) : (
              <EmptyState>No students at your college yet.</EmptyState>
            )
          ) : (
            <>
              <p className={styles.resultMeta} aria-live="polite">
                <span className={styles.hint}>
                  {formatCount(data.totalElements)} {data.totalElements === 1 ? 'student' : 'students'}
                </span>
              </p>
              {wide ? (
                <SubmissionsGrid rows={data.content} columns={columns} order={order} />
              ) : (
                <SubmissionCards rows={data.content} columns={columns} order={order} />
              )}
              <Pagination
                label="Student pages"
                page={data.page}
                totalPages={data.totalPages}
                onChange={(next) => update({ page: next })}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** The row's cells for the shown columns, matched by question id (the server sends only the filtered one). */
function cellsFor(row: GridRow, columns: AssessmentQuestion[]) {
  return columns.map((column) => ({ column, cell: row.cells.find((c) => c.questionId === column.id) ?? null }));
}

function cellTitle(submittedAt: string | null): string | undefined {
  return submittedAt ? `Submitted ${formatInstant(submittedAt)}` : undefined;
}

function statusFilterLabel(value: GridStatusFilter): string {
  if (value === 'UPLOADED') return 'Uploaded, not submitted';
  if (value === 'PENDING' || value === 'PUBLISHED') return GRADE_LABELS[value];
  return CELL_LABELS[value as CellStatus];
}

/**
 * One cell (UI spec F4.5): a submitted answer shows its grade and links to its review; anything
 * else is its icon + text status. The link's name says which question and student it opens.
 */
function SubmissionCell({
  cell,
  column,
  row,
  order,
}: {
  cell: GridCell | null;
  column: AssessmentQuestion;
  row: GridRow;
  order: ReviewOrder;
}) {
  if (!cell) return <>—</>;
  if (cell.cellStatus !== 'SUBMITTED' || !cell.answerId) {
    return <CellStatusLabel status={cell.cellStatus} title={cellTitle(cell.submittedAt)} />;
  }
  const gradeStatus = cell.gradeStatus ?? 'PENDING';
  const name = row.student.fullName ?? 'Unnamed student';
  return (
    <Link
      to={answerReviewLink(cell.answerId, order)}
      className={localStyles.cellLink}
      aria-label={`Question ${column.position}, ${name}: ${gradeStatusText(gradeStatus, cell.finalMarks, column.maxMarks)}`}
      title={cellTitle(cell.submittedAt)}
    >
      <GradeStatusLabel status={gradeStatus} finalMarks={cell.finalMarks} maxMarks={column.maxMarks} />
    </Link>
  );
}

type CellsProps = { rows: GridRow[]; columns: AssessmentQuestion[]; order: ReviewOrder };

function SubmissionsGrid({ rows, columns, order }: CellsProps) {
  return (
    <div className={localStyles.gridWrap} tabIndex={0} role="region" aria-labelledby="submissions-caption">
      <table className={localStyles.grid}>
        <caption id="submissions-caption" className={styles.visuallyHidden}>
          Submissions
        </caption>
        <thead>
          <tr>
            <th scope="col" className={localStyles.stickyCol}>
              Student
            </th>
            {columns.map((column) => (
              <th key={column.id} scope="col">
                <abbr title={`Question ${column.position}`}>Q{column.position}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.student.id}>
              <th scope="row" className={localStyles.stickyCol}>
                <span className={localStyles.studentName}>{row.student.fullName ?? 'Unnamed student'}</span>
                {row.student.loginId && <span className={localStyles.studentId}>{row.student.loginId}</span>}
              </th>
              {cellsFor(row, columns).map(({ column, cell }) => (
                <td key={column.id}>
                  <SubmissionCell cell={cell} column={column} row={row} order={order} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SubmissionCards({ rows, columns, order }: CellsProps) {
  return (
    <ul className={styles.cardList} aria-label="Submissions">
      {rows.map((row) => (
        <li key={row.student.id} className={styles.card}>
          <span className={localStyles.studentName}>{row.student.fullName ?? 'Unnamed student'}</span>
          {row.student.loginId && <span className={localStyles.studentId}>{row.student.loginId}</span>}
          <ul className={localStyles.cellChips}>
            {cellsFor(row, columns).map(({ column, cell }) => (
              <li key={column.id}>
                <span className={localStyles.cellChipLabel}>Q{column.position}</span>
                <SubmissionCell cell={cell} column={column} row={row} order={order} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
