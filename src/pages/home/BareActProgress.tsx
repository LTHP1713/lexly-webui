import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BareActProgressItem } from '@/api/users';
import { BookIcon, ChevronRightIcon } from '@/components/icons/Icons';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useBareActProgress } from '@/hooks/useHomeData';
import type { ActLinkState } from '@/pages/content/navigation';
import { formatCount } from './format';
import { CardNotice, HomeCard, ProgressBar } from './HomeCard';
import styles from './Home.module.css';

const INITIAL_VISIBLE = 5;

export function BareActProgress() {
  const progress = useBareActProgress();

  return (
    <HomeCard
      title="Bare Acts Progress"
      subtitle="Your reading progress"
      sample={progress.sample}
      className={styles.bareActsCard}
      action={
        <Link to="/acts" className={styles.headerLink}>
          All Acts
        </Link>
      }
    >
      {progress.status === 'loading' && <LoadingState label="Loading reading progress" lines={3} />}
      {progress.status === 'error' && <ErrorState error={progress.error} onRetry={progress.retry} />}
      {progress.status === 'unavailable' && (
        <CardNotice
          icon={BookIcon}
          title="Not tracked yet"
          message="Your reading progress for each Act will appear here once tracking is available."
        >
          <Link to="/acts" className={styles.textLink}>
            Browse Bare Acts
          </Link>
        </CardNotice>
      )}
      {progress.status === 'success' &&
        (progress.data.length === 0 ? (
          <CardNotice
            icon={BookIcon}
            title="No reading yet"
            message="Open any section of a Bare Act and your progress will show up here."
          >
            <Link to="/acts" className={styles.textLink}>
              Browse Bare Acts
            </Link>
          </CardNotice>
        ) : (
          <ActProgressList acts={progress.data} />
        ))}
    </HomeCard>
  );
}

function ActProgressList({ acts }: { acts: BareActProgressItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? acts : acts.slice(0, INITIAL_VISIBLE);

  return (
    <>
      <ul className={styles.actList}>
        {visible.map((act) => (
          <li key={act.actId}>
            <Link
              to={`/acts/${encodeURIComponent(act.actId)}`}
              state={{ actTitle: act.actName } satisfies ActLinkState}
              className={styles.actRow}
            >
              <span className={styles.actTop}>
                <span className={styles.actName}>{act.actName}</span>
                <span className={styles.actPercent}>{act.percent}%</span>
              </span>
              <ProgressBar percent={act.percent} />
              <span className={styles.actMeta}>
                {act.totalSections === 0
                  ? 'No sections published yet'
                  : `${formatCount(act.completedSections)} of ${formatCount(act.totalSections)} sections read`}
                {act.lastSection && (
                  <span className={styles.actLast}>
                    {' · '}Last read: Section {act.lastSection.sectionNumber}
                  </span>
                )}
              </span>
              <ChevronRightIcon size={18} className={styles.rowChevron} />
            </Link>
          </li>
        ))}
      </ul>
      {acts.length > INITIAL_VISIBLE && (
        <button type="button" className={styles.showMore} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? 'Show fewer' : `Show all ${acts.length} Acts`}
        </button>
      )}
    </>
  );
}
