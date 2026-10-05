import { importanceLabel, type CaseLawImportance } from '@/api/caselaws';
import styles from './Content.module.css';

/** Text label (not colour alone); LANDMARK gets the strongest treatment. */
export function ImportanceBadge({ importance }: { importance: CaseLawImportance }) {
  const variant =
    importance === 'LANDMARK' ? styles.importanceLandmark : importance === 'IMPORTANT' ? styles.importanceImportant : '';
  return <span className={`${styles.importance} ${variant}`}>{importanceLabel[importance]}</span>;
}
