import { Link } from 'react-router-dom';
import type { PracticeSummary } from '@/api/users';
import { ChecklistIcon } from '@/components/icons/Icons';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { usePracticeStats } from '@/hooks/useHomeData';
import { formatCount } from './format';
import { CardNotice, HomeCard } from './HomeCard';
import styles from './Home.module.css';

export function PracticeProgress() {
  const stats = usePracticeStats();

  return (
    <HomeCard
      title="Practice Progress"
      subtitle="Your MCQ performance"
      sample={stats.sample}
      className={styles.practiceCard}
    >
      {stats.status === 'loading' && <LoadingState label="Loading practice progress" lines={2} />}
      {stats.status === 'error' && <ErrorState error={stats.error} onRetry={stats.retry} />}
      {stats.status === 'unavailable' && (
        <PracticeEmpty message="Practice progress will appear here once tracking is available." />
      )}
      {stats.status === 'success' &&
        (stats.data.attempted === 0 ? (
          <PracticeEmpty message="Answer your first MCQs to see your accuracy here." title="No questions attempted yet" />
        ) : (
          <PracticeStats summary={stats.data} />
        ))}
    </HomeCard>
  );
}

function PracticeStats({ summary }: { summary: PracticeSummary }) {
  return (
    <div className={styles.practiceBody}>
      <AccuracyDonut summary={summary} />
      <div className={styles.practiceDetails}>
        <dl className={styles.metrics}>
          <div className={styles.metric}>
            <dt>Attempted</dt>
            <dd>{formatCount(summary.attempted)}</dd>
          </div>
          <div className={styles.metric}>
            <dt>
              <span className={`${styles.dot} ${styles.dotCorrect}`} aria-hidden="true" />
              Correct
            </dt>
            <dd>{formatCount(summary.correct)}</dd>
          </div>
          <div className={styles.metric}>
            <dt>
              <span className={`${styles.dot} ${styles.dotWrong}`} aria-hidden="true" />
              Wrong
            </dt>
            <dd>{formatCount(summary.wrong)}</dd>
          </div>
        </dl>
        {summary.uniqueQuestionsAttempted > 0 && (
          <p className={styles.metricNote}>
            Across {formatCount(summary.uniqueQuestionsAttempted)} unique{' '}
            {summary.uniqueQuestionsAttempted === 1 ? 'question' : 'questions'}
          </p>
        )}
        <Link to="/practice" className={styles.primaryButton}>
          Continue Practice
        </Link>
      </div>
    </div>
  );
}

function PracticeEmpty({ message, title = 'Not tracked yet' }: { message: string; title?: string }) {
  return (
    <div className={styles.practiceBody}>
      <AccuracyDonut summary={null} />
      <div className={styles.practiceDetails}>
        <CardNotice icon={ChecklistIcon} title={title} message={message} />
        <Link to="/practice" className={styles.primaryButton}>
          Go to Practice
        </Link>
      </div>
    </div>
  );
}

const RADIUS = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * SVG ring: navy arc = correct share, terracotta = wrong. Scales with its container (viewBox).
 * `summary === null` draws the empty track only.
 */
function AccuracyDonut({ summary }: { summary: PracticeSummary | null }) {
  const correctFraction = summary && summary.attempted > 0 ? summary.correct / summary.attempted : 0;
  const label = summary
    ? `Accuracy ${summary.accuracyPercent}%: ${summary.correct} correct and ${summary.wrong} wrong out of ${summary.attempted} attempted`
    : 'No accuracy data yet';

  return (
    <figure className={styles.donut}>
      <svg viewBox="0 0 120 120" role="img" aria-label={label}>
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="11"
          className={summary ? styles.donutWrong : styles.donutTrack}
          strokeDasharray={summary ? undefined : '3 5'}
        />
        {summary && correctFraction > 0 && (
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            strokeWidth="11"
            strokeLinecap={correctFraction < 1 ? 'round' : 'butt'}
            className={styles.donutCorrect}
            strokeDasharray={`${CIRCUMFERENCE * correctFraction} ${CIRCUMFERENCE}`}
            transform="rotate(-90 60 60)"
          />
        )}
      </svg>
      <figcaption className={styles.donutCenter} aria-hidden="true">
        <span className={styles.donutValue}>{summary ? `${summary.accuracyPercent}%` : '—'}</span>
        <span className={styles.donutLabel}>Accuracy</span>
      </figcaption>
    </figure>
  );
}
