import { Link, useParams } from 'react-router-dom';
import { hasCode } from '@/api/errors';
import { getStudentResults, type QuestionResult, type ResultOutcome, type StudentResults } from '@/api/student';
import { Deadline } from '@/components/Deadline';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { StatusBadge, type BadgeTone } from '@/components/StatusBadge';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { useNow } from '@/lib/deadline';
import { formatCount, formatInstant, formatMarks } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { NotFoundPage } from '@/pages/NotFoundPage';
import localStyles from '@/components/Assessment.module.css';
import styles from '@/components/ui.module.css';

/**
 * `/student/assessments/:assessmentId/results` (UI spec F4.6): the marks and feedback of each
 * published question; the rest say where they stand. The response never carries AI fields or
 * draft marks (TDD §7.8). Drafts, removed assessments and other colleges' ids are a `404` → Not
 * Found.
 */
export function StudentResultsPage() {
  const { assessmentId = '' } = useParams();
  const query = useCachedQuery(queryKeys.studentAssessments.results(assessmentId), (signal) =>
    getStudentResults(assessmentId, signal),
  );

  if (query.status === 'error' && hasCode(query.error, 'NOT_FOUND')) return <NotFoundPage />;
  const results = query.status === 'success' ? query.data : null;
  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/student">Assessments</Link>
        {results && (
          <>
            {' / '}
            <Link to={`/student/assessments/${results.assessment.id}`}>{results.assessment.title}</Link>
            <span aria-current="page"> / Results</span>
          </>
        )}
      </nav>
      {query.status === 'loading' && (
        <>
          <h1 className={styles.title}>Loading results…</h1>
          <LoadingState label="Loading results" />
        </>
      )}
      {query.status === 'error' && (
        <>
          <h1 className={styles.title}>Results unavailable</h1>
          <ErrorState error={query.error} onRetry={query.retry} />
        </>
      )}
      {results && <ResultsView results={results} />}
    </>
  );
}

function ResultsView({ results }: { results: StudentResults }) {
  const now = useNow(0, results.assessment.dueAt);
  const { assessment, totals, questions } = results;
  const published = questions.filter((q) => q.outcome === 'PUBLISHED').length;

  return (
    <>
      <header className={styles.detailHeader}>
        <p className={styles.eyebrow}>
          {assessment.subject.code} · {assessment.subject.name}
        </p>
        <h1 className={styles.title}>Results: {assessment.title}</h1>
        <p className={styles.detailFacts}>
          <Deadline dueAt={assessment.dueAt} now={now} />
        </p>
      </header>

      <section className={localStyles.totalCard} aria-labelledby="results-total">
        {published > 0 ? (
          <>
            <p id="results-total" className={localStyles.totalLabel}>
              Marks, of published questions
            </p>
            <p className={localStyles.bigMarks}>
              {formatMarks(totals.publishedMarks)} / {formatMarks(totals.publishedMaxMarks)}
            </p>
            <p className={localStyles.muted}>
              {formatCount(published)} of {formatCount(questions.length)} questions published · the assessment is out of{' '}
              {formatMarks(totals.totalMaxMarks)} marks.
            </p>
          </>
        ) : (
          <p id="results-total" className={localStyles.muted}>
            No marks are published yet. Your professor publishes each answer&rsquo;s marks when it is graded.
          </p>
        )}
      </section>

      <ol className={localStyles.questionList} aria-label="Questions">
        {questions.map((question) => (
          <li key={question.questionId}>
            <ResultCard question={question} assessmentId={assessment.id} />
          </li>
        ))}
      </ol>

      <p>
        <Link to={`/student/assessments/${assessment.id}`} className={styles.secondaryButton}>
          Back to your answers
        </Link>
      </p>
    </>
  );
}

const OUTCOME_BADGES: Record<ResultOutcome, [BadgeTone, string]> = {
  PUBLISHED: ['success', 'Published'],
  AWAITING_EVALUATION: ['info', 'Awaiting evaluation'],
  NOT_ATTEMPTED: ['danger', 'Not attempted'],
  NOT_SUBMITTED: ['neutral', 'Not submitted'],
};

function marksText(question: QuestionResult): string {
  const max = formatMarks(question.maxMarks);
  if (question.outcome === 'PUBLISHED' && question.finalMarks !== null) return `${formatMarks(question.finalMarks)} / ${max}`;
  if (question.outcome === 'NOT_ATTEMPTED') return `${formatMarks(question.finalMarks ?? 0)} / ${max}`;
  return `— / ${max}`;
}

function ResultCard({ question, assessmentId }: { question: QuestionResult; assessmentId: string }) {
  const titleId = `result-${question.questionId}`;
  const [tone, label] = OUTCOME_BADGES[question.outcome];
  return (
    <article className={localStyles.answerCard} aria-labelledby={titleId}>
      <div className={localStyles.answerCardHead}>
        <h2 id={titleId} className={localStyles.answerCardTitle}>
          Question {question.position}
        </h2>
        <StatusBadge tone={tone}>{label}</StatusBadge>
      </div>
      {question.text && <p className={`${localStyles.questionText} ${localStyles.muted}`}>{question.text}</p>}
      <div className={localStyles.answerArea}>
        <p className={localStyles.resultMarks}>
          <span className={styles.visuallyHidden}>Marks: </span>
          {marksText(question)}
        </p>
        {question.outcome === 'PUBLISHED' && (
          <>
            <p className={localStyles.feedbackLabel}>Feedback from your professor</p>
            <p className={localStyles.feedbackText}>{question.finalFeedback ?? 'No feedback.'}</p>
            <p className={localStyles.muted}>Published {formatInstant(question.publishedAt)}</p>
          </>
        )}
        {question.outcome === 'AWAITING_EVALUATION' && (
          <p className={localStyles.muted}>Your answer was submitted and hasn&rsquo;t been graded yet.</p>
        )}
        {question.outcome === 'NOT_ATTEMPTED' && (
          <p className={localStyles.muted}>Nothing was submitted before the due date.</p>
        )}
        {question.outcome === 'NOT_SUBMITTED' && (
          <p className={localStyles.muted}>
            The assessment is still open. <Link to={`/student/assessments/${assessmentId}`}>Go to your answers</Link>
          </p>
        )}
      </div>
    </article>
  );
}
