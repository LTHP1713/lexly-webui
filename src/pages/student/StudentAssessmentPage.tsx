import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { errorMessage, hasCode } from '@/api/errors';
import {
  answerFilePath,
  checkAnswerFile,
  getStudentAssessment,
  submitAnswer,
  tooLargeMessage,
  uploadAnswer,
  type Answer,
  type StudentAssessmentDetail,
  type StudentQuestion,
  type UploadLimits,
} from '@/api/student';
import { StudentStateBadge } from '@/components/AssessmentBadges';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Deadline } from '@/components/Deadline';
import { FileDropzone } from '@/components/FileDropzone';
import { flash } from '@/components/flash';
import { PdfViewer } from '@/components/PdfViewer';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { StatusBadge } from '@/components/StatusBadge';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { clockOffset, useNow } from '@/lib/deadline';
import { formatBytes, formatCount, formatInstant, formatMarks } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { parseServerErrors } from '@/pages/admin/contentForm';
import { NotFoundPage } from '@/pages/NotFoundPage';
import localStyles from '@/components/Assessment.module.css';
import styles from '@/components/ui.module.css';

/** The detail plus the clock correction measured when it arrived (a cached copy keeps its own). */
type LoadedAssessment = StudentAssessmentDetail & { clockOffset: number };

async function loadAssessment(id: string, signal: AbortSignal): Promise<LoadedAssessment> {
  const detail = await getStudentAssessment(id, signal);
  return { ...detail, clockOffset: clockOffset(detail.serverTime, Date.now()) };
}

/**
 * `/student/assessments/:assessmentId` (UI spec F3.6, F3.7): the questions, and per question one
 * PDF answer that is uploaded (replaceable) and then submitted (locked). Open means published and
 * before the due date by the server-corrected clock; at the due date the page turns read-only at
 * once and refetches. Drafts, removed assessments and other colleges' ids are a `404` → Not Found.
 */
export function StudentAssessmentPage() {
  const { assessmentId = '' } = useParams();
  const query = useCachedQuery(queryKeys.studentAssessments.detail(assessmentId), (signal) =>
    loadAssessment(assessmentId, signal),
  );

  if (query.status === 'error' && hasCode(query.error, 'NOT_FOUND')) return <NotFoundPage />;
  const assessment = query.status === 'success' ? query.data : null;
  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/student">Assessments</Link>
        {assessment && <span aria-current="page"> / {assessment.title}</span>}
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
      {assessment && <AssessmentView assessment={assessment} />}
    </>
  );
}

/** Patches one question's answer into the cached detail, and refreshes the list and the detail. */
function useAnswerCache(assessmentId: string) {
  const client = useQueryClient();
  return useMemo(
    () => ({
      put(questionId: string, answer: Answer) {
        client.setQueryData<LoadedAssessment>(
          queryKeys.studentAssessments.detail(assessmentId),
          (old) => old && { ...old, questions: old.questions.map((q) => (q.id === questionId ? { ...q, answer } : q)) },
        );
        void client.invalidateQueries({ queryKey: queryKeys.studentAssessments.all });
      },
      refetch() {
        void client.invalidateQueries({ queryKey: queryKeys.studentAssessments.all });
      },
    }),
    [client, assessmentId],
  );
}

function AssessmentView({ assessment }: { assessment: LoadedAssessment }) {
  const now = useNow(assessment.clockOffset, assessment.dueAt);
  const cache = useAnswerCache(assessment.id);
  const due = assessment.dueAt ? new Date(assessment.dueAt).getTime() : NaN;
  const open = assessment.status === 'PUBLISHED' && now < due;
  const submitted = assessment.questions.filter((q) => q.answer?.status === 'SUBMITTED').length;
  const total = assessment.questions.length;

  // The due date passed while the page was open: it is already read-only; fetch the server's view.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) cache.refetch();
    wasOpen.current = open;
  }, [open, cache]);

  return (
    <>
      <header className={styles.detailHeader}>
        <p className={styles.eyebrow}>
          {assessment.subject.code} · {assessment.subject.name}
        </p>
        <h1 className={styles.title}>{assessment.title}</h1>
        <p className={styles.detailFacts}>
          <StudentStateBadge state={assessment.state} />
          <Deadline dueAt={assessment.dueAt} now={now} />
          <span>
            {formatCount(total)} {total === 1 ? 'question' : 'questions'} · {formatMarks(assessment.totalMarks)} marks
          </span>
          <span>{assessment.professorName ?? 'Former professor'}</span>
        </p>
        <p aria-live="polite" className={styles.hint}>
          {formatCount(submitted)} of {formatCount(total)} answers submitted
        </p>
      </header>

      {assessment.instructions && (
        <section aria-labelledby="instructions-title" className={styles.listSection}>
          <h2 id="instructions-title" className={styles.sectionHeadTitle}>
            Instructions
          </h2>
          <p className={styles.preLine}>{assessment.instructions}</p>
        </section>
      )}

      {open && (
        <p className={styles.notice}>
          Upload one PDF per question: at most {assessment.uploadLimits.maxFileMb} MB and{' '}
          {assessment.uploadLimits.maxPages} pages. You can replace an upload until you submit it. Submitted answers
          can&rsquo;t be changed.
        </p>
      )}

      <ol className={localStyles.questionList} aria-label="Questions">
        {assessment.questions.map((question) => (
          <li key={question.id}>
            <AnswerCard
              question={question}
              open={open}
              limits={assessment.uploadLimits}
              cache={cache}
              isLastToSubmit={submitted === total - 1}
            />
          </li>
        ))}
      </ol>
    </>
  );
}

type Upload = { name: string; progress: number | null; controller: AbortController };

/** One question and its answer (UI spec F3.6 table): not uploaded → uploaded → submitted. */
function AnswerCard({
  question,
  open,
  limits,
  cache,
  isLastToSubmit,
}: {
  question: StudentQuestion;
  open: boolean;
  limits: UploadLimits;
  cache: ReturnType<typeof useAnswerCache>;
  isLastToSubmit: boolean;
}) {
  const id = useId();
  const replaceRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [checking, setChecking] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [viewing, setViewing] = useState(false);
  const answer = question.answer;
  const busy = upload !== null || checking || submitting;

  // Abort an upload still running when the card goes away.
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  /** The §F3.6 card errors; `file` problems go under the dropzone, the rest in the card. */
  function showError(err: unknown) {
    if (hasCode(err, 'ABORTED')) return;
    if (hasCode(err, 'INVALID_FILE')) {
      const reason = parseServerErrors(err.message).file ?? err.message;
      setFileError(`This PDF can't be used: ${reason}`);
      return;
    }
    if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
      const errors = parseServerErrors(err.message);
      if (errors.file) {
        setFileError(tooLargeMessage(limits));
        return;
      }
      if (errors.answer) {
        cache.refetch();
        setMessage('Upload a PDF before submitting.');
        return;
      }
    }
    if (hasCode(err, 'ASSESSMENT_CLOSED') || hasCode(err, 'ANSWER_LOCKED') || hasCode(err, 'NOT_FOUND')) {
      // The page's view is out of date: refetch it (a removed assessment then shows Not Found).
      cache.refetch();
    }
    setMessage(errorMessage(err));
  }

  async function chooseFile(file: File) {
    setFileError(null);
    setMessage(null);
    setChecking(true);
    const problem = await checkAnswerFile(file, limits);
    setChecking(false);
    if (problem) {
      setFileError(problem);
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setUpload({ name: file.name, progress: null, controller });
    try {
      const saved = await uploadAnswer(question.id, file, {
        signal: controller.signal,
        onProgress: (progress) => setUpload((current) => current && { ...current, progress }),
      });
      cache.put(question.id, saved);
      flash("Answer uploaded. Submit it when you're ready.");
    } catch (err) {
      showError(err);
    } finally {
      controllerRef.current = null;
      setUpload(null);
    }
  }

  async function confirmSubmit() {
    setSubmitting(true);
    setMessage(null);
    try {
      const saved = await submitAnswer(question.id);
      setConfirming(false);
      cache.put(question.id, saved);
      flash(isLastToSubmit ? 'All answers submitted.' : 'Answer submitted.');
    } catch (err) {
      setConfirming(false);
      showError(err);
    } finally {
      setSubmitting(false);
    }
  }

  const titleId = `${id}-title`;
  return (
    <article className={localStyles.answerCard} aria-labelledby={titleId}>
      <div className={localStyles.answerCardHead}>
        <h2 id={titleId} className={localStyles.answerCardTitle}>
          Question {question.position}
        </h2>
        <AnswerBadge answer={answer} open={open} />
      </div>
      <p className={localStyles.questionMeta}>
        {question.maxMarks === null ? '—' : formatMarks(question.maxMarks)} marks · up to{' '}
        {question.wordLimit === null ? '—' : formatCount(question.wordLimit)} words
      </p>
      <p className={localStyles.questionText}>{question.text}</p>

      <div className={localStyles.answerArea} aria-busy={busy || undefined}>
        {!open && answer?.status !== 'SUBMITTED' ? (
          <p className={localStyles.muted}>
            {answer
              ? "This answer was uploaded but not submitted before the due date, so it doesn't count."
              : 'Nothing was submitted for this question before the due date.'}
          </p>
        ) : (
          <>
            {answer && <FileLine answer={answer} />}
            {upload ? (
              <div className={localStyles.progressRow}>
                <label htmlFor={`${id}-progress`}>
                  Uploading {upload.name}…{upload.progress !== null && ` ${Math.round(upload.progress * 100)}%`}
                </label>
                <progress
                  id={`${id}-progress`}
                  max={1}
                  value={upload.progress ?? undefined}
                  aria-valuetext={upload.progress === null ? undefined : `${Math.round(upload.progress * 100)}%`}
                />
                <div className={localStyles.answerActions}>
                  <button type="button" className={styles.secondaryButton} onClick={() => upload.controller.abort()}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : !answer ? (
              <FileDropzone
                id={`${id}-file`}
                label="Your answer"
                prompt="Choose a PDF, or drop it here"
                accept="application/pdf,.pdf"
                file={null}
                error={fileError}
                disabled={checking}
                onFile={(file) => void chooseFile(file)}
                onRemove={() => undefined}
              />
            ) : (
              <>
                <div className={localStyles.answerActions}>
                  <button type="button" className={styles.secondaryButton} onClick={() => setViewing(true)}>
                    View
                  </button>
                  {answer.status === 'UPLOADED' && (
                    <>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => replaceRef.current?.click()}
                        disabled={busy}
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => setConfirming(true)}
                        disabled={busy}
                      >
                        Submit answer
                      </button>
                    </>
                  )}
                </div>
                {answer.status === 'SUBMITTED' && <p className={localStyles.muted}>Submitted answers can&rsquo;t be changed.</p>}
                {answer.status === 'UPLOADED' && (
                  <input
                    ref={replaceRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className={styles.visuallyHidden}
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(event) => {
                      const chosen = event.target.files?.[0];
                      event.target.value = '';
                      if (chosen) void chooseFile(chosen);
                    }}
                  />
                )}
                {fileError && (
                  <p className={styles.fieldError} role="alert">
                    {fileError}
                  </p>
                )}
              </>
            )}
          </>
        )}
        <div role="alert">{message && <p className={styles.formError}>{message}</p>}</div>
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Submit your answer to question ${question.position}?`}
        confirmLabel={submitting ? 'Submitting…' : 'Submit answer'}
        busy={submitting}
        onConfirm={() => void confirmSubmit()}
        onCancel={() => setConfirming(false)}
      >
        <p>You can&rsquo;t change this answer after submitting.</p>
        {answer && <FileLine answer={answer} />}
      </ConfirmDialog>
      {viewing && answer && (
        <PdfViewer path={answerFilePath(question.id)} title={answer.originalFilename} onClose={() => setViewing(false)} />
      )}
    </article>
  );
}

function AnswerBadge({ answer, open }: { answer: Answer | null; open: boolean }) {
  if (answer?.status === 'SUBMITTED') return <StatusBadge tone="success">Submitted</StatusBadge>;
  if (!open) return <StatusBadge tone="danger">Not attempted</StatusBadge>;
  if (answer) return <StatusBadge tone="warning">Uploaded, not submitted</StatusBadge>;
  return <StatusBadge tone="neutral">Not uploaded</StatusBadge>;
}

/** "{name} · {size} · {pages} pages · uploaded {time}" (or "submitted {time}"). */
function FileLine({ answer }: { answer: Answer }) {
  const when =
    answer.status === 'SUBMITTED'
      ? `submitted ${formatInstant(answer.submittedAt)}`
      : `uploaded ${formatInstant(answer.uploadedAt)}`;
  return (
    <p className={localStyles.fileLine}>
      <span className={localStyles.fileName}>{answer.originalFilename}</span> · {formatBytes(answer.sizeBytes)} ·{' '}
      {formatCount(answer.pageCount)} {answer.pageCount === 1 ? 'page' : 'pages'} · {when}
    </p>
  );
}
