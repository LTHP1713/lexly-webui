import { useId } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getCaseLaw, type CaseLawDetail, type LockedCaseLawTeaser } from '@/api/caselaws';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useRecordLearningActivity } from '@/hooks/useHomeData';
import { ImportanceBadge } from './ImportanceBadge';
import { sectionLabel, type SectionLinkState } from './navigation';
import { ProBadge } from './ProBadge';
import styles from './Content.module.css';

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

function formatDecidedOn(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

/** Only http(s) links are rendered — never `javascript:` or other schemes from data. */
function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function CaseLawDetailPage() {
  const { caseLawId = '' } = useParams();
  const backTo = (useLocation().state as SectionLinkState | null)?.backTo ?? { to: '/caselaws', label: 'all case laws' };
  const query = useApiQuery(`caselaw:${caseLawId}`, () => getCaseLaw(caseLawId));
  useRecordLearningActivity(
    'CASE_LAW',
    query.status === 'success' && query.data.access === 'full' ? query.data.caseLaw.id : null,
  );

  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to={backTo.to}>← Back to {backTo.label}</Link>
      </nav>

      {query.status === 'loading' && (
        <>
          <h1 className={styles.title}>Loading case law…</h1>
          <LoadingState label="Loading case law" lines={5} />
        </>
      )}
      {query.status === 'error' && (
        <>
          <h1 className={styles.title}>Case law unavailable</h1>
          <ErrorState error={query.error} onRetry={query.retry} />
        </>
      )}
      {query.status === 'success' &&
        (query.data.access === 'full' ? (
          <FullCaseLaw caseLaw={query.data.caseLaw} />
        ) : (
          <LockedCaseLaw teaser={query.data.teaser} />
        ))}
    </>
  );
}

function CaseMeta({ citation, court, decidedOn }: { citation: string | null; court: string | null; decidedOn?: string | null }) {
  if (!citation && !court && !decidedOn) return null;
  return (
    <dl className={styles.caseMeta}>
      {citation && (
        <>
          <dt>Citation</dt>
          <dd>{citation}</dd>
        </>
      )}
      {court && (
        <>
          <dt>Court</dt>
          <dd>{court}</dd>
        </>
      )}
      {decidedOn && (
        <>
          <dt>Decided</dt>
          <dd>{decidedOn}</dd>
        </>
      )}
    </dl>
  );
}

const SUMMARY_PARTS = [
  ['facts', 'Facts'],
  ['issues', 'Issues'],
  ['held', 'Held'],
  ['analysis', 'Analysis'],
] as const;

function FullCaseLaw({ caseLaw }: { caseLaw: CaseLawDetail }) {
  const relatedId = useId();
  const pdfUrl = safeExternalUrl(caseLaw.sourcePdfUrl);
  const parts = SUMMARY_PARTS.filter(([key]) => caseLaw.summary?.[key]?.trim());
  const sectionBackTo: SectionLinkState['backTo'] = { to: `/caselaws/${caseLaw.id}`, label: 'case law' };

  return (
    <article>
      <h1 className={styles.title}>{caseLaw.title}</h1>
      <span className={styles.badgeRow}>
        <ImportanceBadge importance={caseLaw.importance} />
      </span>
      <CaseMeta citation={caseLaw.citation} court={caseLaw.court} decidedOn={formatDecidedOn(caseLaw.decidedOn)} />

      {parts.length === 0 ? (
        <p className={`${styles.empty} ${styles.summaryBlock}`}>No summary is available for this case yet.</p>
      ) : (
        parts.map(([key, heading]) => (
          <section key={key} className={styles.summaryBlock}>
            <h2 className={styles.entriesHeading}>{heading}</h2>
            <p>{caseLaw.summary?.[key]}</p>
          </section>
        ))
      )}

      {caseLaw.relatedSections.length > 0 && (
        <section aria-labelledby={relatedId} className={styles.entries}>
          <h2 id={relatedId} className={styles.entriesHeading}>
            Sections interpreted
          </h2>
          <ul className={styles.list}>
            {caseLaw.relatedSections.map((section) => (
              <li key={section.id}>
                <Link
                  to={`/sections/${section.id}`}
                  state={{ backTo: sectionBackTo } satisfies SectionLinkState}
                  className={`${styles.item} ${section.isFree ? '' : styles.itemLocked}`}
                >
                  <span className={styles.itemTitle}>{sectionLabel(section.sectionNumber, section.title)}</span>
                  {!section.isFree && <ProBadge />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pdfUrl && (
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className={styles.externalLink}>
          Read the full judgment (opens in a new tab)
        </a>
      )}
    </article>
  );
}

function LockedCaseLaw({ teaser }: { teaser: LockedCaseLawTeaser }) {
  return (
    <article className={styles.lockedCard}>
      <h1 className={styles.title}>{teaser.title}</h1>
      {teaser.importance && (
        <span className={styles.badgeRow}>
          <ImportanceBadge importance={teaser.importance} />
        </span>
      )}
      <CaseMeta citation={teaser.citation} court={teaser.court} />
      <p className={styles.lockedLead}>
        <ProBadge /> This case summary is part of Lexly Pro.
      </p>
      <p className={styles.lockedMessage}>{teaser.message || 'Upgrade to Pro to read this case summary.'}</p>
    </article>
  );
}
