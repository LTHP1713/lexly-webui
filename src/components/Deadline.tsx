import { timeLeft } from '@/lib/deadline';
import { formatInstant } from '@/lib/format';
import styles from './Assessment.module.css';

/**
 * A due date (UI spec F3 `Deadline`): "2 Nov 2026, 12:00 am · in 3 days". Under 24 hours it
 * also says "Due soon" in the warning colour; after the due date, "· closed". `now` comes from
 * `useNow`, corrected with the server's clock where the screen has one.
 */
export function Deadline({ dueAt, now, prefix = 'Due' }: { dueAt: string | null; now: number; prefix?: string }) {
  if (!dueAt) return <span className={styles.deadline}>No due date yet</span>;
  const left = timeLeft(dueAt, now);
  return (
    <span className={`${styles.deadline} ${left?.soon ? styles.deadlineSoon : ''}`}>
      {left?.soon && <strong>Due soon · </strong>}
      {prefix ? `${prefix} ` : ''}
      {formatInstant(dueAt)}
      {left && (left.past ? ' · closed' : ` · ${left.text}`)}
    </span>
  );
}
