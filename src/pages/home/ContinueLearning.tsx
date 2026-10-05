import { Link } from 'react-router-dom';
import type { ContinueLearningItem, LearningContentType } from '@/api/users';
import { ArrowRightIcon, BookIcon, ClockIcon, DocumentIcon, ScalesIcon } from '@/components/icons/Icons';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useContinueLearning } from '@/hooks/useHomeData';
import { contentPath, type SectionLinkState } from '@/pages/content/navigation';
import { formatRelative } from './format';
import { CardNotice, HomeCard, ProgressBar } from './HomeCard';
import styles from './Home.module.css';

const typeIcon: Record<LearningContentType, typeof BookIcon> = {
  SECTION: DocumentIcon,
  CASE_LAW: ScalesIcon,
  TOPIC: BookIcon,
};

export function ContinueLearning() {
  const item = useContinueLearning();

  return (
    <HomeCard
      title="Continue Learning"
      subtitle="Pick up where you left off"
      sample={item.sample}
      className={styles.continueCard}
    >
      {item.status === 'loading' && <LoadingState label="Loading your last activity" lines={2} />}
      {item.status === 'error' && <ErrorState error={item.error} onRetry={item.retry} />}
      {item.status === 'unavailable' && (
        <CardNotice
          icon={ClockIcon}
          title="Not tracked yet"
          message="The last section or case you studied will appear here once tracking is available."
        >
          <Link to="/acts" className={styles.textLink}>
            Start with Bare Acts
          </Link>
        </CardNotice>
      )}
      {item.status === 'success' &&
        (item.data === null ? (
          <CardNotice icon={ClockIcon} title="Nothing to continue yet" message="Open a section or case law to start.">
            <Link to="/acts" className={styles.textLink}>
              Start with Bare Acts
            </Link>
          </CardNotice>
        ) : (
          <ContinueItem item={item.data} />
        ))}
    </HomeCard>
  );
}

function ContinueItem({ item }: { item: ContinueLearningItem }) {
  const path = contentPath(item.type, item.id);
  const ItemIcon = typeIcon[item.type];
  const opened = formatRelative(item.lastAccessedAt);

  return (
    <div className={styles.continueBody}>
      <div className={styles.continueHead}>
        <span className={styles.continueIcon}>
          <ItemIcon size={24} />
        </span>
        <div className={styles.continueText}>
          {item.subject && <p className={styles.eyebrow}>{item.subject}</p>}
          <p className={styles.continueTitle}>{item.title}</p>
          {item.subtitle && <p className={styles.continueSubtitle}>{item.subtitle}</p>}
        </div>
      </div>

      {item.percent !== null && (
        <div className={styles.continueProgress}>
          <ProgressBar percent={item.percent} />
          <span className={styles.actPercent}>
            {item.percent}%<span className={styles.visuallyHidden}> complete</span>
          </span>
        </div>
      )}

      <div className={styles.continueFooter}>
        {opened && <span className={styles.continueWhen}>Opened {opened}</span>}
        {path && (
          <Link
            to={path}
            state={{ backTo: { to: '/dashboard', label: 'Home' } } satisfies SectionLinkState}
            className={styles.primaryButton}
          >
            Continue <ArrowRightIcon size={18} />
          </Link>
        )}
      </div>
    </div>
  );
}
