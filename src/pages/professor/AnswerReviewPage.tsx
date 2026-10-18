import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { REVIEW_ORDERS, oneOf, type ReviewOrder } from '@/api/assessments';
import { hasCode } from '@/api/errors';
import {
  FEEDBACK_MAX,
  answerReviewFilePath,
  approveGrade,
  getAnswerReview,
  saveGradeDraft,
  type AnswerReview,
  type Grade,
  type GradeHistoryEntry,
  type HistoryEvent,
} from '@/api/grading';
import { AssessmentStatusBadge } from '@/components/AssessmentBadges';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { NumberField, TextAreaField } from '@/components/Field';
import { flash } from '@/components/flash';
import { PdfPanel, PdfViewer } from '@/components/PdfViewer';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { StatusBadge } from '@/components/StatusBadge';
import { useUnsavedChangesGuard } from '@/components/useUnsavedChangesGuard';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { formatBytes, formatCount, formatInstant, formatMarks } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { NotFoundPage } from '@/pages/NotFoundPage';
import {
  formFromGrade,
  gradeBanner,
  gradeFieldErrors,
  gradeSnapshot,
  requestFromGradeForm,
  validateApprove,
  validateDraft,
  type GradeErrors,
  type GradeForm,
} from './gradeForm';
import { ORDER_LABELS, answerReviewLink } from './reviewLinks';
import localStyles from '@/components/Assessment.module.css';
import styles from '@/components/ui.module.css';

const NEXT_UNGRADED_ID = 'review-next-ungraded';

/**
 * `/professor/answers/:answerId` (UI spec F4.1–F4.4): one submitted answer with its PDF, the
 * grade panel, the grade history, and previous / next / next ungraded in the order from the URL.
 * An answer that isn't submitted or isn't on one of the professor's own assessments is a `404`
 * → Not Found.
 */
export function AnswerReviewPage() {
  const { answerId = '' } = useParams();
  const [params] = useSearchParams();
  const order = oneOf(REVIEW_ORDERS, params.get('order'));
  const query = useCachedQuery(queryKeys.professorAnswers.detail(answerId, order), (signal) =>
    getAnswerReview(answerId, order, signal),
  );

  if (query.status === 'error' && hasCode(query.error, 'NOT_FOUND')) return <NotFoundPage />;
  // A change of order keeps the same answer on screen while its navigation reloads.
  const stale = query.status === 'loading' && query.staleData?.id === answerId ? query.staleData : null;
  const review = query.status === 'success' ? query.data : stale;
  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/professor">Assessments</Link>
        {review && (
          <>
            {' / '}
            <Link to={`/professor/assessments/${review.assessment.id}`}>{review.assessment.title}</Link>
            <span aria-current="page"> / Question {review.question.position}</span>
          </>
        )}
      </nav>
      {!review && query.status === 'loading' && (
        <>
          <h1 className={styles.title}>Loading answer…</h1>
          <LoadingState label="Loading answer" />
        </>
      )}
      {query.status === 'error' && (
        <>
          <h1 className={styles.title}>Answer unavailable</h1>
          <ErrorState error={query.error} onRetry={query.retry} />
        </>
      )}
      {review && <ReviewView review={review} order={order} refreshing={Boolean(stale)} />}
    </>
  );
}

/** Puts a saved grade into every cached copy of this review, then refreshes what it affects (F4.5). */
function useGradeCache(answerId: string) {
  const client = useQueryClient();
  return {
    put: useCallback(
      (grade: Grade) => {
        client.setQueriesData<AnswerReview>({ queryKey: queryKeys.professorAnswers.byId(answerId) }, (old) =>
          old ? { ...old, grade } : old,
        );
        // History and every other review's "next ungraded", plus the list, detail and grid counts.
        void client.invalidateQueries({ queryKey: queryKeys.professorAnswers.all });
        void client.invalidateQueries({ queryKey: queryKeys.professorAssessments.all });
      },
      [client, answerId],
    ),
    refetch: useCallback(() => {
      void client.invalidateQueries({ queryKey: queryKeys.professorAnswers.byId(answerId) });
    }, [client, answerId]),
    markDownloaded: useCallback(() => {
      client.setQueriesData<AnswerReview>({ queryKey: queryKeys.professorAnswers.byId(answerId) }, (old) =>
        old && !old.professorDownloadedAt ? { ...old, professorDownloadedAt: new Date().toISOString() } : old,
      );
    }, [client, answerId]),
  };
}

function ReviewView({ review, order, refreshing }: { review: AnswerReview; order: ReviewOrder; refreshing: boolean }) {
  const cache = useGradeCache(review.id);
  const [fullScreen, setFullScreen] = useState(false);
  const { question, student, file } = review;
  const removed = review.assessment.status === 'REMOVED';

  return (
    <div aria-busy={refreshing || undefined}>
      <header className={styles.detailHeader}>
        <p className={styles.eyebrow}>
          Question {question.position} · {review.assessment.title}
        </p>
        <h1 className={styles.title}>{student.fullName ?? 'Unnamed student'}</h1>
        <p className={styles.detailFacts}>
          {student.loginId && <span className={styles.mono}>{student.loginId}</span>}
          <span>Submitted {formatInstant(review.submittedAt)}</span>
          {removed && <AssessmentStatusBadge status="REMOVED" />}
        </p>
      </header>

      <ReviewNav review={review} order={order} />

      {removed && (
        <p className={styles.notice}>
          This assessment was removed, so its answers can&rsquo;t be graded any more. You can still read them.
        </p>
      )}

      <div className={localStyles.reviewGrid}>
        <div className={localStyles.reviewColumn}>
          <section className={localStyles.panel} aria-labelledby="review-question-title">
            <h2 id="review-question-title" className={localStyles.panelTitle}>
              Question {question.position}
            </h2>
            <p className={localStyles.questionMeta}>
              {formatMarks(question.maxMarks)} marks
              {question.wordLimit !== null && ` · up to ${formatCount(question.wordLimit)} words`}
            </p>
            <p className={localStyles.questionText}>{question.text}</p>
          </section>

          <section className={localStyles.panel} aria-labelledby="review-answer-title">
            <div className={localStyles.answerCardHead}>
              <h2 id="review-answer-title" className={localStyles.panelTitle}>
                Answer
              </h2>
              <button type="button" className={styles.secondaryButton} onClick={() => setFullScreen(true)}>
                Open full screen
              </button>
            </div>
            <p className={localStyles.fileLine}>
              <span className={localStyles.fileName}>{file.originalFilename}</span> · {formatBytes(file.sizeBytes)} ·{' '}
              {formatCount(file.pageCount)} {file.pageCount === 1 ? 'page' : 'pages'}
            </p>
            <PdfPanel
              key={review.id}
              path={answerReviewFilePath(review.id)}
              title={file.originalFilename}
              onLoaded={cache.markDownloaded}
            />
          </section>
        </div>

        <div className={localStyles.gradeAside}>
          <GradePanel key={review.id} review={review} cache={cache} />
          <GradeHistory history={review.history} maxMarks={question.maxMarks} />
        </div>
      </div>

      {fullScreen && (
        <PdfViewer
          path={answerReviewFilePath(review.id)}
          title={file.originalFilename}
          onClose={() => setFullScreen(false)}
        />
      )}
    </div>
  );
}

/** F4.3: previous / next / next ungraded in the chosen order, and the order itself. */
function ReviewNav({ review, order }: { review: AnswerReview; order: ReviewOrder }) {
  const [, setParams] = useSearchParams();
  const { previousAnswerId, nextAnswerId, nextUngradedAnswerId } = review.navigation;
  const published = review.grade.status === 'PUBLISHED';

  const step = (id: string | null, label: string, options: { primary?: boolean; elementId?: string } = {}) =>
    id ? (
      <Link
        id={options.elementId}
        to={answerReviewLink(id, order)}
        className={options.primary ? styles.primaryButton : styles.secondaryButton}
      >
        {label}
      </Link>
    ) : (
      <button type="button" className={styles.secondaryButton} disabled>
        {label}
      </button>
    );

  return (
    <nav aria-label="Answer navigation" className={localStyles.reviewNav}>
      <div className={localStyles.reviewNavButtons}>
        {step(previousAnswerId, '← Previous')}
        {step(nextAnswerId, 'Next →')}
        {step(nextUngradedAnswerId, 'Next ungraded →', { primary: published, elementId: NEXT_UNGRADED_ID })}
      </div>
      {!nextUngradedAnswerId && (
        <p className={styles.hint}>
          No ungraded answers after this one.{' '}
          <Link to={`/professor/assessments/${review.assessment.id}`}>Back to submissions</Link>
        </p>
      )}
      <div className={localStyles.reviewNavOrder}>
        <label htmlFor="review-order">Grading order</label>
        <select
          id="review-order"
          className={styles.input}
          value={order}
          onChange={(event) => setParams({ order: event.target.value }, { replace: true })}
        >
          {REVIEW_ORDERS.map((value) => (
            <option key={value} value={value}>
              {ORDER_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
    </nav>
  );
}

const FIELD_IDS = { finalMarks: 'grade-marks', finalFeedback: 'grade-feedback' } as const;

function focusFirstError(errors: GradeErrors) {
  const first = (['finalMarks', 'finalFeedback'] as const).find((field) => errors[field]);
  if (first) window.requestAnimationFrame(() => document.getElementById(FIELD_IDS[first])?.focus());
}

/**
 * F4.2: marks and feedback, Save draft (not visible to the student) and Approve & publish (final).
 * Keyed by the answer, so moving to another answer starts from that answer's saved grade.
 */
function GradePanel({ review, cache }: { review: AnswerReview; cache: ReturnType<typeof useGradeCache> }) {
  const { grade, question } = review;
  const maxMarks = question.maxMarks;
  const editable = grade.status !== 'PUBLISHED' && review.assessment.status !== 'REMOVED';
  const [form, setForm] = useState<GradeForm>(() => formFromGrade(grade));
  const [saved, setSaved] = useState(() => gradeSnapshot(formFromGrade(grade)));
  const [errors, setErrors] = useState<GradeErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'approve' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const dirty = editable && gradeSnapshot(form) !== saved;
  const guard = useUnsavedChangesGuard(dirty, { ignoreSearch: true });

  // After publishing, focus goes to Next ungraded. It must run after the confirm's own effect has
  // closed the <dialog>, since closing a native dialog moves focus back to where it was opened.
  const focusNextUngraded = useRef(false);
  useEffect(() => {
    if (!focusNextUngraded.current || confirming) return;
    focusNextUngraded.current = false;
    document.getElementById(NEXT_UNGRADED_ID)?.focus();
  });

  function update(patch: Partial<GradeForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function fail(err: unknown) {
    const fields = gradeFieldErrors(err, maxMarks);
    if (fields) {
      setErrors(fields);
      focusFirstError(fields);
      return;
    }
    // The view is out of date: a published grade, a removed assessment, or a vanished answer (Not Found).
    if (hasCode(err, 'GRADE_PUBLISHED') || hasCode(err, 'ASSESSMENT_NOT_EDITABLE') || hasCode(err, 'NOT_FOUND')) {
      cache.refetch();
    }
    setBanner(gradeBanner(err));
  }

  async function saveDraft() {
    const problems = validateDraft(form, maxMarks);
    setErrors(problems);
    setBanner(null);
    if (Object.keys(problems).length > 0) {
      focusFirstError(problems);
      return;
    }
    setBusy('save');
    try {
      const next = await saveGradeDraft(review.id, requestFromGradeForm(form));
      setSaved(gradeSnapshot(form));
      cache.put(next);
      flash("Draft saved. The student can't see it yet.");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  function startApprove() {
    const problems = validateApprove(form, maxMarks);
    setErrors(problems);
    setBanner(null);
    if (Object.keys(problems).length > 0) focusFirstError(problems);
    else setConfirming(true);
  }

  async function confirmApprove() {
    setBusy('approve');
    try {
      const next = await approveGrade(review.id, requestFromGradeForm(form));
      focusNextUngraded.current = true;
      setConfirming(false);
      setSaved(gradeSnapshot(form));
      cache.put(next);
      flash('Grade published.');
    } catch (err) {
      setConfirming(false);
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  const studentName = review.student.fullName ?? 'The student';
  return (
    <section className={localStyles.panel} aria-labelledby="grade-title">
      <div className={localStyles.answerCardHead}>
        <h2 id="grade-title" className={localStyles.panelTitle}>
          Grade
        </h2>
        {grade.status === 'PUBLISHED' ? (
          <StatusBadge tone="success">Published</StatusBadge>
        ) : (
          <StatusBadge tone="warning">Not published</StatusBadge>
        )}
      </div>
      <div role="alert">{banner && <p className={styles.formError}>{banner}</p>}</div>

      {editable ? (
        <>
          <p className={styles.hint}>Not published. The student can&rsquo;t see your marks or feedback yet.</p>
          <NumberField
            id={FIELD_IDS.finalMarks}
            label={`Marks (out of ${formatMarks(maxMarks)})`}
            value={form.marks}
            onChange={(marks) => update({ marks })}
            error={errors.finalMarks}
            step={0.5}
            min={0}
            max={maxMarks}
            inputMode="decimal"
          />
          <TextAreaField
            id={FIELD_IDS.finalFeedback}
            label="Feedback for the student"
            hint="The student sees this with their marks once you publish."
            value={form.feedback}
            onChange={(feedback) => update({ feedback })}
            error={errors.finalFeedback}
            maxLength={FEEDBACK_MAX}
            rows={8}
          />
          <div className={localStyles.answerActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => void saveDraft()} disabled={busy !== null}>
              {busy === 'save' ? 'Saving…' : 'Save draft'}
            </button>
            <button type="button" className={styles.primaryButton} onClick={startApprove} disabled={busy !== null}>
              Approve &amp; publish…
            </button>
          </div>
        </>
      ) : (
        <SavedGrade review={review} />
      )}

      <ConfirmDialog
        open={confirming}
        title={`Publish the grade for question ${question.position}?`}
        confirmLabel={busy === 'approve' ? 'Publishing…' : 'Publish grade'}
        busy={busy === 'approve'}
        onConfirm={() => void confirmApprove()}
        onCancel={() => setConfirming(false)}
      >
        <p>
          {studentName} sees {form.marks.trim() ? formatMarks(Number(form.marks)) : '—'} / {formatMarks(maxMarks)} and
          your feedback immediately. A published grade can&rsquo;t be changed.
        </p>
      </ConfirmDialog>
      {guard}
    </section>
  );
}

/** The read-only grade: published, or the last draft of a removed assessment's answer. */
function SavedGrade({ review }: { review: AnswerReview }) {
  const { grade, question } = review;
  const published = grade.status === 'PUBLISHED';
  return (
    <>
      {published && (
        <p className={styles.hint}>
          Published {formatInstant(grade.publishedAt)} by {grade.gradedBy?.fullName ?? 'a former professor'}
        </p>
      )}
      {!published && <p className={styles.hint}>Last saved draft (never published):</p>}
      <p className={localStyles.bigMarks}>
        {grade.finalMarks === null ? 'No marks' : formatMarks(grade.finalMarks)} / {formatMarks(question.maxMarks)}
      </p>
      <p className={localStyles.feedbackLabel}>Feedback</p>
      <p className={localStyles.feedbackText}>{grade.finalFeedback ?? 'No feedback'}</p>
    </>
  );
}

const EVENT_LABELS: Record<HistoryEvent, string> = {
  DRAFT_SAVED: 'Draft saved',
  AI_EVALUATED: 'AI evaluated',
  AI_FAILED: 'AI evaluation failed',
  PUBLISHED: 'Published',
};

function historyActor(entry: GradeHistoryEntry): string {
  if (entry.actor) return entry.actor.fullName ?? 'Unnamed user';
  return entry.event === 'AI_EVALUATED' || entry.event === 'AI_FAILED' ? 'Lexly AI' : 'Former user';
}

/** F4.4: every saved change, oldest first, collapsed by default. */
function GradeHistory({ history, maxMarks }: { history: GradeHistoryEntry[]; maxMarks: number }) {
  const id = useId();
  return (
    <details className={`${localStyles.panel} ${localStyles.history}`}>
      <summary id={id}>Grade history ({formatCount(history.length)})</summary>
      {history.length === 0 ? (
        <p className={localStyles.muted}>No changes yet.</p>
      ) : (
        <ol className={localStyles.historyList} aria-labelledby={id}>
          {history.map((entry, index) => (
            <li key={`${entry.createdAt}-${index}`}>
              <p className={localStyles.historyHead}>
                {EVENT_LABELS[entry.event]} ·{' '}
                {entry.marks === null ? 'No marks' : `${formatMarks(entry.marks)} / ${formatMarks(maxMarks)}`}
              </p>
              <p className={localStyles.muted}>
                {historyActor(entry)} · {formatInstant(entry.createdAt)}
              </p>
              <p className={`${localStyles.muted} ${localStyles.feedbackText}`}>{entry.feedback ?? 'No feedback'}</p>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
