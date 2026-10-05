import { Link, useLocation, useParams } from 'react-router-dom';
import { listActs, listSections } from '@/api/content';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { ActLinkState, SectionLinkState } from './navigation';
import { ProBadge } from './ProBadge';
import styles from './Content.module.css';

/**
 * The sections endpoint doesn't return the act's title. Use the title handed over from the acts
 * list when there is one; otherwise (deep link, post-login redirect) look it up from /acts, but
 * never let that lookup fail the page — the section list is what matters.
 */
async function loadActTitle(actId: string, known: string | undefined): Promise<string | null> {
  if (known) return known;
  try {
    const acts = await listActs();
    return acts.find((act) => act.id === actId)?.title ?? null;
  } catch {
    return null;
  }
}

export function SectionsPage() {
  const { actId = '' } = useParams();
  const knownTitle = (useLocation().state as ActLinkState | null)?.actTitle;

  const query = useApiQuery(`sections:${actId}`, async () => {
    const [sections, actTitle] = await Promise.all([listSections(actId), loadActTitle(actId, knownTitle)]);
    return { sections, actTitle };
  });

  const actTitle = query.status === 'success' ? query.data.actTitle : (knownTitle ?? null);
  const backTo: SectionLinkState['backTo'] = { to: `/acts/${actId}`, label: actTitle ?? 'sections' };

  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/acts">← All acts</Link>
      </nav>
      <h1 className={styles.title}>{actTitle ?? 'Sections'}</h1>
      <p className={styles.subtitle}>
        Sections marked <ProBadge /> need a Pro subscription to read in full.
      </p>

      {query.status === 'loading' && <LoadingState label="Loading sections" lines={6} />}
      {query.status === 'error' && <ErrorState error={query.error} onRetry={query.retry} />}
      {query.status === 'success' &&
        (query.data.sections.length === 0 ? (
          <p className={styles.empty}>This act has no sections yet.</p>
        ) : (
          <ul className={styles.list}>
            {query.data.sections.map((section) => (
              <li key={section.id}>
                {/* Locked sections stay clickable on purpose: the detail screen renders the upsell. */}
                <Link
                  to={`/sections/${section.id}`}
                  state={{ backTo } satisfies SectionLinkState}
                  className={`${styles.item} ${section.isFree ? '' : styles.itemLocked}`}
                >
                  <span className={styles.sectionNumber}>{section.sectionNumber}</span>
                  <span className={styles.itemTitle}>{section.title ?? `Section ${section.sectionNumber}`}</span>
                  {!section.isFree && <ProBadge />}
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </>
  );
}
