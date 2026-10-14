import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  SECTION_LIMITS,
  createSection,
  deleteSection,
  getAdminAct,
  refreshReaderCache,
  type ActAdmin,
} from '@/api/adminContent';
import { ApiError } from '@/api/client';
import { listSections, type SectionSummary } from '@/api/content';
import { conflictFieldError, errorMessage, hasCode } from '@/api/errors';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Dialog } from '@/components/Dialog';
import { TextAreaField, TextField } from '@/components/Field';
import { flash } from '@/components/flash';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryStates';
import { RowMenu } from '@/components/RowMenu';
import { ContentSubNav } from '@/components/SubNav';
import { useToast } from '@/components/Toast';
import { useApiQuery } from '@/hooks/useApiQuery';
import { TABLE_QUERY, useMediaQuery } from '@/hooks/useMediaQuery';
import { parseServerErrors } from '@/pages/admin/contentForm';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ActDialog } from './ActDialog';
import styles from '@/components/ui.module.css';

/** `/admin/acts/:actId` (UI spec F1.7): the act's sections in the server's (natural) order. */
export function AdminActDetailPage() {
  const { actId = '' } = useParams();
  const act = useApiQuery(`admin-act:${actId}`, () => getAdminAct(actId));

  if (act.status === 'error' && hasCode(act.error, 'NOT_FOUND')) return <NotFoundPage />;
  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/admin/acts">Acts</Link>
        {act.status === 'success' && <span aria-current="page"> / {act.data.shortCode ?? act.data.title}</span>}
      </nav>
      {act.status === 'loading' && (
        <>
          <h1 className={styles.title}>Loading act…</h1>
          <LoadingState label="Loading act" />
        </>
      )}
      {act.status === 'error' && (
        <>
          <h1 className={styles.title}>Act unavailable</h1>
          <ErrorState error={act.error} onRetry={act.retry} />
        </>
      )}
      {act.status === 'success' && <ActDetail key={actId} initial={act.data} />}
    </>
  );
}

function ActDetail({ initial }: { initial: ActAdmin }) {
  const toast = useToast();
  const [act, setAct] = useState(initial);
  const sections = useApiQuery(`admin-act-sections:${act.id}`, () => listSections(act.id, { cache: 'no-cache' }));
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<SectionSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const wide = useMediaQuery(TABLE_QUERY);
  const list =
    sections.status === 'success' ? sections.data : sections.status === 'loading' ? (sections.staleData ?? null) : null;

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setActionError(null);
    try {
      await deleteSection(toDelete.id);
      toast.show(`Section ${toDelete.sectionNumber} deleted.`);
      refreshReaderCache({ actId: act.id });
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setDeleting(false);
      setToDelete(null);
      sections.retry();
    }
  }

  const menuFor = (section: SectionSummary) => (
    <RowMenu
      label={`Actions for section ${section.sectionNumber}`}
      items={[
        { label: 'Edit', to: `/admin/sections/${section.id}` },
        { label: 'View as reader', to: `/sections/${section.id}` },
        { label: 'Delete', danger: true, onSelect: () => setToDelete(section) },
      ]}
    />
  );

  return (
    <>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>Content · Act</p>
          <h1 className={styles.title}>{act.title}</h1>
          {act.shortCode && (
            <p className={styles.detailFacts}>
              <span className={styles.codeChip}>{act.shortCode}</span>
            </p>
          )}
        </div>
        <div className={styles.headerLinks}>
          <button type="button" className={styles.secondaryButton} onClick={() => setEditing(true)}>
            Edit act
          </button>
          <Link to={`/acts/${act.id}`} className={styles.secondaryButton}>
            View as reader
          </Link>
        </div>
      </div>
      <ContentSubNav />

      <div className={styles.sectionHead}>
        <h2 className={styles.sectionHeadTitle}>Sections</h2>
        <button type="button" className={styles.primaryButton} onClick={() => setAdding(true)}>
          Add section
        </button>
      </div>
      {actionError && (
        <p role="alert" className={styles.formError}>
          {actionError}
        </p>
      )}

      {sections.status === 'loading' && !list && <LoadingState label="Loading sections" />}
      {sections.status === 'error' && <ErrorState error={sections.error} onRetry={sections.retry} />}
      {list && sections.status !== 'error' && (
        <div aria-busy={sections.status === 'loading'}>
          {list.length === 0 ? (
            <EmptyState
              actions={
                <>
                  <button type="button" className={styles.primaryButton} onClick={() => setAdding(true)}>
                    Add section
                  </button>
                  <Link to="/admin/import?kind=sections" className={styles.secondaryButton}>
                    Import sections
                  </Link>
                </>
              }
            >
              This act has no sections yet.
            </EmptyState>
          ) : wide ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className={styles.visuallyHidden}>Sections of {act.title}, in order</caption>
                <thead>
                  <tr>
                    <th scope="col">Section</th>
                    <th scope="col">Title</th>
                    <th scope="col" className={styles.actionsCell}>
                      <span className={styles.visuallyHidden}>Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((section) => (
                    <tr key={section.id}>
                      <td className={styles.mono}>{section.sectionNumber}</td>
                      <td>
                        <Link to={`/admin/sections/${section.id}`} className={styles.cellTitle}>
                          {section.title ?? `Section ${section.sectionNumber}`}
                        </Link>
                      </td>
                      <td className={styles.actionsCell}>{menuFor(section)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className={styles.cardList} aria-label={`Sections of ${act.title}`}>
              {list.map((section) => (
                <li key={section.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <Link to={`/admin/sections/${section.id}`} className={styles.cellTitle}>
                      Section {section.sectionNumber}
                      {section.title ? ` — ${section.title}` : ''}
                    </Link>
                    {menuFor(section)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ActDialog
        open={editing}
        actId={act.id}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          setAct(saved);
          setEditing(false);
          toast.show('Act updated.');
          refreshReaderCache({ actList: true });
        }}
      />
      <AddSectionDialog actId={act.id} open={adding} onClose={() => setAdding(false)} />
      <ConfirmDialog
        open={toDelete !== null}
        title={`Delete section ${toDelete?.sectionNumber ?? ''}?`}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      >
        <p>
          Its illustrations, exceptions and study content are deleted, and case laws linked to it lose the link. This
          can&rsquo;t be undone.
        </p>
      </ConfirmDialog>
      {toast.element}
    </>
  );
}

const SECTION_FIELDS = ['sectionNumber', 'title', 'bodyText'];

/** Number, title and text only; the study content is added in the editor it opens next. */
function AddSectionDialog({ actId, open, onClose }: { actId: string; open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} title="Add section" busy={busy} onClose={onClose}>
      <AddSectionForm actId={actId} busy={busy} setBusy={setBusy} onCancel={onClose} />
    </Dialog>
  );
}

function AddSectionForm({
  actId,
  busy,
  setBusy,
  onCancel,
}: {
  actId: string;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCancel: () => void;
}) {
  const navigate = useNavigate();
  const [sectionNumber, setSectionNumber] = useState('');
  const [title, setTitle] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const ids: Record<string, string> = { sectionNumber: 'section-number', title: 'section-title', bodyText: 'section-body' };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found: Record<string, string> = {};
    if (!sectionNumber.trim()) found.sectionNumber = 'Enter the section number.';
    else if (sectionNumber.trim().length > SECTION_LIMITS.sectionNumber) {
      found.sectionNumber = `Use at most ${SECTION_LIMITS.sectionNumber} characters.`;
    }
    if (title.trim().length > SECTION_LIMITS.title) found.title = `Use at most ${SECTION_LIMITS.title} characters.`;
    if (!bodyText.trim()) found.bodyText = 'Enter the text of the section.';
    setErrors(found);
    setBanner(null);
    const first = SECTION_FIELDS.find((key) => found[key]);
    if (first) {
      document.getElementById(ids[first])?.focus();
      return;
    }
    setBusy(true);
    try {
      const created = await createSection(actId, {
        sectionNumber: sectionNumber.trim(),
        title: title.trim() || null,
        bodyText,
        inSimpleWords: null,
        provisionMeaning: [],
        illustrations: [],
        exceptions: [],
        keyLegalTerms: [],
      });
      refreshReaderCache({ actId });
      flash('Section added. Add its study content below.');
      setBusy(false);
      navigate(`/admin/sections/${created.id}`);
    } catch (err) {
      const conflict = conflictFieldError(err);
      const parsed = err instanceof ApiError && err.code === 'VALIDATION_ERROR' ? parseServerErrors(err.message) : {};
      const fields = conflict ?? Object.fromEntries(Object.entries(parsed).filter(([path]) => SECTION_FIELDS.includes(path)));
      setErrors(fields);
      setBanner(Object.keys(fields).length > 0 ? null : errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className={styles.dialogForm} noValidate onSubmit={(event) => void handleSubmit(event)}>
      <TextField
        id={ids.sectionNumber}
        label="Section number"
        required
        hint="e.g. 2, 19A"
        value={sectionNumber}
        onChange={(value) => {
          setSectionNumber(value);
          setErrors((e) => ({ ...e, sectionNumber: '' }));
        }}
        error={errors.sectionNumber || undefined}
        maxLength={SECTION_LIMITS.sectionNumber}
      />
      <TextField
        id={ids.title}
        label="Title"
        value={title}
        onChange={(value) => {
          setTitle(value);
          setErrors((e) => ({ ...e, title: '' }));
        }}
        error={errors.title || undefined}
        maxLength={SECTION_LIMITS.title}
      />
      <TextAreaField
        id={ids.bodyText}
        label="Section text"
        required
        rows={8}
        value={bodyText}
        onChange={(value) => {
          setBodyText(value);
          setErrors((e) => ({ ...e, bodyText: '' }));
        }}
        error={errors.bodyText || undefined}
        inputClassName={styles.serifArea}
      />
      <div role="alert">{banner && <p className={styles.formError}>{banner}</p>}</div>
      <div className={styles.dialogActions}>
        <button type="button" className={styles.secondaryButton} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className={styles.primaryButton} disabled={busy}>
          {busy ? 'Adding…' : 'Add section'}
        </button>
      </div>
    </form>
  );
}
