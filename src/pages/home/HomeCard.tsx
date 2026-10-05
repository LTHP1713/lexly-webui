import { useId, type ComponentType, type ReactNode } from 'react';
import styles from './Home.module.css';

/** Frame shared by the Home dashboard cards: titled `<section>` + optional header action. */
export function HomeCard({
  title,
  subtitle,
  action,
  sample,
  className,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  sample?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={`${styles.card} ${className ?? ''}`}>
      <header className={styles.cardHeader}>
        <div className={styles.cardHeading}>
          <h2 id={headingId} className={styles.cardTitle}>
            {title}
            {sample && <SampleBadge />}
          </h2>
          <p className={styles.cardSubtitle}>{subtitle}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Marks dev-only mock data so it can never be mistaken for the student's real progress. */
function SampleBadge() {
  return (
    <span className={styles.sampleBadge} title="Development-only mock data (VITE_HOME_MOCKS)">
      Sample data
    </span>
  );
}

/** Honest placeholder for "no data yet" and "tracking not available yet" states. */
export function CardNotice({
  icon: NoticeIcon,
  title,
  message,
  children,
}: {
  icon: ComponentType<{ size?: number }>;
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className={styles.notice}>
      <span className={styles.noticeIcon}>
        <NoticeIcon size={22} />
      </span>
      <div className={styles.noticeBody}>
        <p className={styles.noticeTitle}>{title}</p>
        <p className={styles.noticeMessage}>{message}</p>
        {children}
      </div>
    </div>
  );
}

/** Decorative bar; pair it with a text equivalent (e.g. "322 of 448 sections read"). */
export function ProgressBar({ percent }: { percent: number }) {
  return (
    <span className={styles.bar} aria-hidden="true">
      <span className={styles.barFill} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </span>
  );
}
