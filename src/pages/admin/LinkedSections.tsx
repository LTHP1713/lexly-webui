import { useState } from 'react';
import { linkSection, unlinkSection } from '@/api/adminCaseLaws';
import type { RelatedSection } from '@/api/caselaws';
import { listActs, listSections } from '@/api/content';
import { errorMessage } from '@/api/errors';
import { Dialog } from '@/components/Dialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { useApiQuery } from '@/hooks/useApiQuery';
import { sectionLabel } from '@/pages/content/navigation';
import { refreshCachedCaseLaw } from './adminCaseLaw';
import styles from '@/components/ui.module.css';

/**
 * The Linked sections card on `/admin/caselaws/:id` (UI spec F1.8). Link and unlink take effect at
 * once (they are separate calls, not part of the metadata form), and each returns the full linked
 * list, which replaces the shown one. `SectionSummary` has no act, so the act's short code is
 * shown only for sections linked through the picker in this visit.
 */
export function LinkedSections({
  caseLawId,
  initial,
  showToast,
}: {
  caseLawId: string;
  initial: RelatedSection[];
  showToast: (message: string) => void;
}) {
  const [linked, setLinked] = useState(initial);
  const [actCodes, setActCodes] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function unlink(section: RelatedSection) {
    setBusyId(section.id);
    setError(null);
    try {
      setLinked(await unlinkSection(caseLawId, section.id));
      refreshCachedCaseLaw(caseLawId);
      showToast(`Section ${section.sectionNumber} unlinked.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={styles.editorSection} aria-labelledby="linked-sections-title">
      <div className={styles.sectionHead}>
        <h2 id="linked-sections-title" className={styles.editorSectionTitle}>
          Linked sections
        </h2>
        <button type="button" className={styles.secondaryButton} onClick={() => setPicking(true)}>
          Link sections
        </button>
      </div>
      <p className={styles.hint}>The Bare Act sections this case interprets. Readers see it under those sections.</p>
      {error && (
        <p role="alert" className={styles.formError}>
          {error}
        </p>
      )}
      {linked.length === 0 ? (
        <p className={styles.emptyList}>No sections are linked to this case law.</p>
      ) : (
        <ul className={styles.cardList} aria-live="polite">
          {linked.map((section) => (
            <li key={section.id} className={styles.card}>
              <div className={styles.cardHead}>
                <span>
                  {actCodes[section.id] ? `${actCodes[section.id]} · ` : ''}
                  {sectionLabel(section.sectionNumber, section.title)}
                </span>
                <button
                  type="button"
                  className={`${styles.rowButton} ${styles.rowButtonDanger}`}
                  aria-label={`Unlink section ${section.sectionNumber}`}
                  disabled={busyId === section.id}
                  onClick={() => void unlink(section)}
                >
                  Unlink
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={picking} title="Link sections" onClose={() => setPicking(false)}>
        <SectionPicker
          caseLawId={caseLawId}
          linkedIds={new Set(linked.map((s) => s.id))}
          onLinked={(next, sectionId, actCode) => {
            setLinked(next);
            if (actCode) setActCodes((codes) => ({ ...codes, [sectionId]: actCode }));
            refreshCachedCaseLaw(caseLawId);
          }}
          onDone={() => setPicking(false)}
        />
      </Dialog>
    </section>
  );
}

function SectionPicker({
  caseLawId,
  linkedIds,
  onLinked,
  onDone,
}: {
  caseLawId: string;
  linkedIds: Set<string>;
  onLinked: (linked: RelatedSection[], sectionId: string, actCode: string | null) => void;
  onDone: () => void;
}) {
  const acts = useApiQuery('picker-acts', () => listActs());
  const [actId, setActId] = useState('');
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sections = useApiQuery(actId ? `picker-sections:${actId}` : null, () => listSections(actId));
  const act = acts.status === 'success' ? acts.data.find((a) => a.id === actId) : undefined;

  const needle = filter.trim().toLowerCase();
  const shown =
    sections.status === 'success'
      ? sections.data.filter(
          (s) =>
            !needle || s.sectionNumber.toLowerCase().includes(needle) || (s.title ?? '').toLowerCase().includes(needle),
        )
      : [];

  async function link(sectionId: string) {
    setBusyId(sectionId);
    setError(null);
    try {
      onLinked(await linkSection(caseLawId, sectionId), sectionId, act?.shortCode ?? null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className={styles.dialogForm}>
      <div className={styles.field}>
        <label htmlFor="picker-act" className={styles.label}>
          Act
        </label>
        {acts.status === 'error' ? (
          <ErrorState error={acts.error} onRetry={acts.retry} />
        ) : (
          <select
            id="picker-act"
            className={styles.input}
            value={actId}
            onChange={(event) => {
              setActId(event.target.value);
              setFilter('');
            }}
            aria-busy={acts.status === 'loading'}
          >
            <option value="">Choose an act</option>
            {acts.status === 'success' &&
              acts.data.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                  {a.shortCode ? ` (${a.shortCode})` : ''}
                </option>
              ))}
          </select>
        )}
      </div>

      {actId && (
        <>
          <div className={styles.field}>
            <label htmlFor="picker-filter" className={styles.label}>
              Filter by number or title
            </label>
            <input
              id="picker-filter"
              type="search"
              className={styles.input}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              autoComplete="off"
            />
          </div>
          {error && (
            <p role="alert" className={styles.formError}>
              {error}
            </p>
          )}
          {sections.status === 'loading' && <LoadingState label="Loading sections" lines={3} />}
          {sections.status === 'error' && <ErrorState error={sections.error} onRetry={sections.retry} />}
          {sections.status === 'success' &&
            (shown.length === 0 ? (
              <EmptyState>
                {sections.data.length === 0 ? 'This act has no sections yet.' : 'No sections match this filter.'}
              </EmptyState>
            ) : (
              <ul className={`${styles.cardList} ${styles.pickerList}`}>
                {shown.map((section) => {
                  const isLinked = linkedIds.has(section.id);
                  return (
                    <li key={section.id} className={styles.card}>
                      <div className={styles.cardHead}>
                        <span>{sectionLabel(section.sectionNumber, section.title)}</span>
                        <button
                          type="button"
                          className={styles.rowButton}
                          disabled={isLinked || busyId === section.id}
                          aria-label={isLinked ? `Section ${section.sectionNumber} linked` : `Link section ${section.sectionNumber}`}
                          onClick={() => void link(section.id)}
                        >
                          {isLinked ? 'Linked' : busyId === section.id ? 'Linking…' : 'Link'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ))}
        </>
      )}

      <div className={styles.dialogActions}>
        <button type="button" className={styles.primaryButton} onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
