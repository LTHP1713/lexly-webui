import { useId } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getSection, type LockedSectionTeaser, type SectionDetail, type SectionEntry } from '@/api/content';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useRecordLearningActivity } from '@/hooks/useHomeData';
import { sectionLabel, type SectionLinkState } from './navigation';
import { ProBadge } from './ProBadge';
import styles from './Content.module.css';

export function SectionDetailPage() {
  const { sectionId = '' } = useParams();
  const backTo = (useLocation().state as SectionLinkState | null)?.backTo ?? { to: '/acts', label: 'all acts' };
  const query = useApiQuery(`section:${sectionId}`, () => getSection(sectionId));
  // Opening a readable section feeds Continue Learning + Bare Acts Progress (no-op until the API exists).
  useRecordLearningActivity(
    'SECTION',
    query.status === 'success' && query.data.access === 'full' ? query.data.section.id : null,
  );

  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to={backTo.to}>← Back to {backTo.label}</Link>
      </nav>

      {query.status === 'loading' && (
        <>
          <h1 className={styles.title}>Loading section…</h1>
          <LoadingState label="Loading section" lines={5} />
        </>
      )}
      {query.status === 'error' && (
        <>
          <h1 className={styles.title}>Section unavailable</h1>
          <ErrorState error={query.error} onRetry={query.retry} />
        </>
      )}
      {query.status === 'success' &&
        (query.data.access === 'full' ? (
          <FullSection section={query.data.section} />
        ) : (
          <LockedSection teaser={query.data.teaser} />
        ))}
    </>
  );
}

function FullSection({ section }: { section: SectionDetail }) {
  return (
    <article>
      <h1 className={styles.title}>{sectionLabel(section.sectionNumber, section.title)}</h1>
      <div className={styles.bodyText}>{section.bodyText}</div>
      <EntryList heading="Illustrations" entries={section.illustrations} />
      <EntryList heading="Exceptions" entries={section.exceptions} />
    </article>
  );
}

/** Rendered in the order returned — the backend already sorts by display_order. */
function EntryList({ heading, entries }: { heading: string; entries: SectionEntry[] }) {
  const headingId = useId();
  if (entries.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={styles.entries}>
      <h2 id={headingId} className={styles.entriesHeading}>
        {heading}
      </h2>
      <ol className={styles.entryList}>
        {entries.map((entry) => (
          <li key={entry.id} className={styles.entry}>
            {entry.text}
          </li>
        ))}
      </ol>
    </section>
  );
}

function LockedSection({ teaser }: { teaser: LockedSectionTeaser }) {
  return (
    <article className={styles.lockedCard}>
      <h1 className={styles.title}>{sectionLabel(teaser.sectionNumber, teaser.title)}</h1>
      <p className={styles.lockedLead}>
        <ProBadge /> This section is part of Lexly Pro.
      </p>
      <p className={styles.lockedMessage}>{teaser.message || 'Upgrade to Pro to read this section in full.'}</p>
    </article>
  );
}
