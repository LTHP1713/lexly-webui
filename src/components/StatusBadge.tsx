import type { ReactNode } from 'react';
import styles from './ui.module.css';

export type BadgeTone = 'success' | 'neutral' | 'warning' | 'danger' | 'info';

/** A status chip. Its text carries the meaning; the colour only reinforces it (UI spec §0.8). */
export function StatusBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[`badge_${tone}`]}`}>{children}</span>;
}
