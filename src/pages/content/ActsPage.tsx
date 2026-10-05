import { Link } from 'react-router-dom';
import { listActs } from '@/api/content';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { ActLinkState } from './navigation';
import styles from './Content.module.css';

export function ActsPage() {
  const acts = useApiQuery('acts', listActs);

  return (
    <>
      <h1 className={styles.title}>Bare Acts</h1>
      <p className={styles.subtitle}>Choose an act to browse its sections.</p>

      {acts.status === 'loading' && <LoadingState label="Loading acts" />}
      {acts.status === 'error' && <ErrorState error={acts.error} onRetry={acts.retry} />}
      {acts.status === 'success' &&
        (acts.data.length === 0 ? (
          <p className={styles.empty}>No acts are available yet.</p>
        ) : (
          <ul className={styles.list}>
            {acts.data.map((act) => (
              <li key={act.id}>
                <Link
                  to={`/acts/${act.id}`}
                  state={{ actTitle: act.title } satisfies ActLinkState}
                  className={styles.item}
                >
                  <span className={styles.itemTitle}>{act.title}</span>
                  {act.shortCode && <span className={styles.meta}>{act.shortCode}</span>}
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </>
  );
}
