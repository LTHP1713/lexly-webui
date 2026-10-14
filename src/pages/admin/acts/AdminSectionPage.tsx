import { useId, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  SECTION_LIMITS,
  getAdminAct,
  getAdminSection,
  refreshReaderCache,
  updateSection,
  type ActAdmin,
  type AdminSection,
} from '@/api/adminContent';
import { ApiError } from '@/api/client';
import { conflictFieldError, errorMessage, hasCode } from '@/api/errors';
import { TextAreaField, TextField } from '@/components/Field';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { RepeatableList } from '@/components/RepeatableList';
import { ContentSubNav } from '@/components/SubNav';
import { useToast } from '@/components/Toast';
import { useUnsavedChangesGuard } from '@/components/useUnsavedChangesGuard';
import { useApiQuery } from '@/hooks/useApiQuery';
import { parseServerErrors, remapListErrors, type ContentErrors } from '@/pages/admin/contentForm';
import {
  SECTION_GROUPS,
  describeSectionPath,
  emptySectionRow,
  errorCountFor,
  formFromSection,
  requestFromSectionForm,
  validateSection,
  type IllustrationRow,
  type SectionForm,
  type SectionListName,
} from '@/pages/admin/sectionForm';
import { NotFoundPage } from '@/pages/NotFoundPage';
import styles from '@/components/ui.module.css';

interface Loaded {
  section: AdminSection;
  act: ActAdmin | null;
}

/** The section and, for the breadcrumb, its act (a failed act load doesn't block editing). */
async function loadSection(sectionId: string): Promise<Loaded> {
  const section = await getAdminSection(sectionId);
  const act = await getAdminAct(section.actId).catch(() => null);
  return { section, act };
}

/** `/admin/sections/:sectionId` (UI spec F1.7): every reader field, saved with one full-replace `PUT`. */
export function AdminSectionPage() {
  const { sectionId = '' } = useParams();
  const query = useApiQuery(`admin-section:${sectionId}`, () => loadSection(sectionId));

  if (query.status === 'error' && hasCode(query.error, 'NOT_FOUND')) return <NotFoundPage />;
  return (
    <>
      {query.status === 'success' ? (
        <SectionEditor key={sectionId} initial={query.data.section} act={query.data.act} />
      ) : (
        <>
          <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
            <Link to="/admin/acts">Acts</Link>
          </nav>
          <h1 className={styles.title}>{query.status === 'error' ? 'Section unavailable' : 'Loading section…'}</h1>
          <ContentSubNav />
          {query.status === 'error' ? (
            <ErrorState error={query.error} onRetry={query.retry} />
          ) : (
            <LoadingState label="Loading section" lines={6} />
          )}
        </>
      )}
    </>
  );
}

const LIST_ITEM_LABELS: Record<SectionListName, string> = {
  provisionMeaning: 'Clause',
  illustrations: 'Illustration',
  exceptions: 'Exception',
  keyLegalTerms: 'Term',
};

function SectionEditor({ initial, act }: { initial: AdminSection; act: ActAdmin | null }) {
  const idPrefix = useId();
  const toast = useToast();
  const [section, setSection] = useState(initial);
  const [form, setForm] = useState<SectionForm>(() => formFromSection(initial));
  const [baseline, setBaseline] = useState(() => JSON.stringify(requestFromSectionForm(formFromSection(initial))));
  const [errors, setErrors] = useState<ContentErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(requestFromSectionForm(form)) !== baseline;
  const guard = useUnsavedChangesGuard(dirty && !saving);
  const fieldId = (path: string) => `${idPrefix}-${path}`;

  function clearError(path: string) {
    setErrors((current) => {
      if (!(path in current)) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
  }

  function setText(key: 'sectionNumber' | 'title' | 'bodyText' | 'inSimpleWords', value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    clearError(key);
  }

  function setList<L extends SectionListName>(list: L, rows: SectionForm[L], order: number[]) {
    setForm((current) => ({ ...current, [list]: rows }));
    setErrors((current) => remapListErrors(current, list, order));
  }

  function patchRow<L extends SectionListName>(list: L, index: number, field: string, patch: Partial<SectionForm[L][number]>) {
    setForm((current) => ({
      ...current,
      [list]: current[list].map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
    clearError(`${list}[${index}].${field}`);
  }

  /** The nested illustrations of exception `index`. */
  function setExceptionIllustrations(index: number, rows: (IllustrationRow & { key: string })[], order: number[]) {
    setForm((current) => ({
      ...current,
      exceptions: current.exceptions.map((row, i) => (i === index ? { ...row, illustrations: rows } : row)),
    }));
    setErrors((current) => remapListErrors(current, `exceptions[${index}].illustrations`, order));
  }

  function patchExceptionIllustration(index: number, j: number, field: string, patch: Partial<IllustrationRow>) {
    setForm((current) => ({
      ...current,
      exceptions: current.exceptions.map((row, i) =>
        i === index ? { ...row, illustrations: row.illustrations.map((ill, k) => (k === j ? { ...ill, ...patch } : ill)) } : row,
      ),
    }));
    clearError(`exceptions[${index}].illustrations[${j}].${field}`);
  }

  function focusSummary() {
    window.requestAnimationFrame(() => document.getElementById(fieldId('errors'))?.focus());
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaveError(null);
    const found = validateSection(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusSummary();
      return;
    }
    setSaving(true);
    try {
      const saved = await updateSection(section.id, requestFromSectionForm(form));
      const next = formFromSection(saved);
      setSection(saved);
      setForm(next);
      setBaseline(JSON.stringify(requestFromSectionForm(next)));
      refreshReaderCache({ sectionId: saved.id, actId: saved.actId });
      toast.show('Section saved.');
    } catch (err) {
      const conflict = conflictFieldError(err);
      if (conflict) {
        setErrors(conflict);
        focusSummary();
      } else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        setErrors(parseServerErrors(err.message));
        focusSummary();
      } else {
        setSaveError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  const errorEntries = Object.entries(errors);
  const actLabel = act?.shortCode ?? act?.title ?? null;

  const illustrationFields = (
    path: string,
    row: IllustrationRow,
    onText: (text: string) => void,
    onHypothetical: (hypothetical: boolean) => void,
  ) => (
    <>
      <TextAreaField
        id={fieldId(`${path}.text`)}
        label="Text"
        required
        rows={3}
        value={row.text}
        onChange={onText}
        error={errors[`${path}.text`]}
      />
      <label className={styles.checkboxField}>
        <input type="checkbox" checked={row.hypothetical} onChange={(event) => onHypothetical(event.target.checked)} />
        Written by Lexly (hypothetical)
      </label>
      <p className={styles.hint}>{row.hypothetical ? 'Shown as “Hypothetical”.' : 'Shown as “From the Act”.'}</p>
    </>
  );

  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/admin/acts">Acts</Link>
        {actLabel && (
          <>
            {' / '}
            <Link to={`/admin/acts/${section.actId}`}>{actLabel}</Link>
          </>
        )}
        <span aria-current="page"> / Section {section.sectionNumber}</span>
      </nav>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>Content · Section</p>
          <h1 className={styles.title}>
            Section {section.sectionNumber}
            {section.title ? ` — ${section.title}` : ''}
          </h1>
        </div>
        <div className={styles.headerLinks}>
          <Link to={`/sections/${section.id}`} className={styles.secondaryButton}>
            View as reader
          </Link>
        </div>
      </div>
      <ContentSubNav />
      <p className={styles.notice}>
        Saving replaces this section&rsquo;s text and all of its study content with what is on this page. List order is
        the order readers see.
      </p>

      <div className={styles.editorLayout}>
        <nav aria-label="On this form" className={styles.editorIndex}>
          <span className={styles.label}>On this form</span>
          <ul>
            {SECTION_GROUPS.map((group) => {
              const count = errorCountFor(errors, group.paths);
              return (
                <li key={group.id}>
                  <a href={`#${fieldId(`group-${group.id}`)}`}>
                    <span>{group.label}</span>
                    {count > 0 && (
                      <span className={styles.fieldError}>
                        {count} {count === 1 ? 'error' : 'errors'}
                      </span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <form noValidate onSubmit={(event) => void handleSubmit(event)} className={styles.form}>
          {errorEntries.length > 0 && (
            <div id={fieldId('errors')} role="alert" tabIndex={-1} className={styles.errorSummary}>
              <p className={styles.errorSummaryTitle}>
                {errorEntries.length === 1
                  ? 'One problem stopped the save:'
                  : `${errorEntries.length} problems stopped the save:`}
              </p>
              <ul>
                {errorEntries.map(([path, message]) => (
                  <li key={path}>
                    {path ? (
                      <a
                        href={`#${fieldId(path)}`}
                        onClick={(event) => {
                          event.preventDefault();
                          document.getElementById(fieldId(path))?.focus();
                        }}
                      >
                        {describeSectionPath(path)}: {message}
                      </a>
                    ) : (
                      message
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {saveError && (
            <p role="alert" className={styles.formError}>
              {saveError}
            </p>
          )}

          <section id={fieldId('group-section')} aria-labelledby={fieldId('section-title')} className={styles.editorSection}>
            <h2 id={fieldId('section-title')} className={styles.editorSectionTitle}>
              Section
            </h2>
            <div className={styles.fieldRow}>
              <TextField
                id={fieldId('sectionNumber')}
                label="Section number"
                required
                maxLength={SECTION_LIMITS.sectionNumber}
                value={form.sectionNumber}
                onChange={(value) => setText('sectionNumber', value)}
                error={errors.sectionNumber}
              />
              <TextField
                id={fieldId('title')}
                label="Title"
                maxLength={SECTION_LIMITS.title}
                value={form.title}
                onChange={(value) => setText('title', value)}
                error={errors.title}
              />
            </div>
            <TextAreaField
              id={fieldId('bodyText')}
              label="Section text"
              required
              rows={10}
              value={form.bodyText}
              onChange={(value) => setText('bodyText', value)}
              error={errors.bodyText}
              inputClassName={styles.serifArea}
            />
          </section>

          <section
            id={fieldId('group-inSimpleWords')}
            aria-labelledby={fieldId('simple-title')}
            className={styles.editorSection}
          >
            <h2 id={fieldId('simple-title')} className={styles.editorSectionTitle}>
              In simple words
            </h2>
            <TextAreaField
              id={fieldId('inSimpleWords')}
              label="Plain-language summary"
              hint="Optional. Shown above the clause-by-clause explanation."
              rows={4}
              value={form.inSimpleWords}
              onChange={(value) => setText('inSimpleWords', value)}
              error={errors.inSimpleWords}
            />
          </section>

          <div id={fieldId('group-provisionMeaning')}>
            <RepeatableList
              id={fieldId('provisionMeaning')}
              title="Clause by clause"
              itemLabel={LIST_ITEM_LABELS.provisionMeaning}
              rows={form.provisionMeaning}
              max={SECTION_LIMITS.provisionMeaning}
              error={errors.provisionMeaning}
              makeRow={emptySectionRow.provisionMeaning}
              onChange={(rows, order) => setList('provisionMeaning', rows, order)}
              renderRow={(row, i) => (
                <>
                  <div className={styles.fieldRow}>
                    <TextField
                      id={fieldId(`provisionMeaning[${i}].clause`)}
                      label="Clause"
                      hint="e.g. (a)"
                      maxLength={SECTION_LIMITS.clause}
                      value={row.clause}
                      onChange={(clause) => patchRow('provisionMeaning', i, 'clause', { clause })}
                      error={errors[`provisionMeaning[${i}].clause`]}
                    />
                    <TextField
                      id={fieldId(`provisionMeaning[${i}].title`)}
                      label="Title"
                      hint="e.g. Proposal"
                      maxLength={SECTION_LIMITS.clauseTitle}
                      value={row.title}
                      onChange={(title) => patchRow('provisionMeaning', i, 'title', { title })}
                      error={errors[`provisionMeaning[${i}].title`]}
                    />
                  </div>
                  <TextAreaField
                    id={fieldId(`provisionMeaning[${i}].explanation`)}
                    label="Explanation"
                    required
                    rows={3}
                    value={row.explanation}
                    onChange={(explanation) => patchRow('provisionMeaning', i, 'explanation', { explanation })}
                    error={errors[`provisionMeaning[${i}].explanation`]}
                  />
                </>
              )}
            />
          </div>

          <div id={fieldId('group-illustrations')}>
            <RepeatableList
              id={fieldId('illustrations')}
              title="Illustrations"
              itemLabel={LIST_ITEM_LABELS.illustrations}
              rows={form.illustrations}
              max={SECTION_LIMITS.illustrations}
              error={errors.illustrations}
              makeRow={emptySectionRow.illustration}
              onChange={(rows, order) => setList('illustrations', rows, order)}
              renderRow={(row, i) =>
                illustrationFields(
                  `illustrations[${i}]`,
                  row,
                  (text) => patchRow('illustrations', i, 'text', { text }),
                  (hypothetical) => patchRow('illustrations', i, 'hypothetical', { hypothetical }),
                )
              }
            />
          </div>

          <div id={fieldId('group-exceptions')}>
            <RepeatableList
              id={fieldId('exceptions')}
              title="Exceptions"
              itemLabel={LIST_ITEM_LABELS.exceptions}
              rows={form.exceptions}
              max={SECTION_LIMITS.exceptions}
              error={errors.exceptions}
              makeRow={emptySectionRow.exceptions}
              onChange={(rows, order) => setList('exceptions', rows, order)}
              renderRow={(row, i) => (
                <>
                  <TextField
                    id={fieldId(`exceptions[${i}].title`)}
                    label="Title"
                    maxLength={SECTION_LIMITS.exceptionTitle}
                    value={row.title}
                    onChange={(title) => patchRow('exceptions', i, 'title', { title })}
                    error={errors[`exceptions[${i}].title`]}
                  />
                  <TextAreaField
                    id={fieldId(`exceptions[${i}].explanation`)}
                    label="Explanation"
                    required
                    rows={3}
                    value={row.explanation}
                    onChange={(explanation) => patchRow('exceptions', i, 'explanation', { explanation })}
                    error={errors[`exceptions[${i}].explanation`]}
                  />
                  <div className={styles.nestedList}>
                    <RepeatableList
                      id={fieldId(`exceptions[${i}].illustrations`)}
                      title={`Illustrations for exception ${i + 1}`}
                      itemLabel={`Exception ${i + 1} illustration`}
                      rows={row.illustrations}
                      max={SECTION_LIMITS.exceptionIllustrations}
                      error={errors[`exceptions[${i}].illustrations`]}
                      makeRow={emptySectionRow.illustration}
                      onChange={(rows, order) => setExceptionIllustrations(i, rows, order)}
                      renderRow={(ill, j) =>
                        illustrationFields(
                          `exceptions[${i}].illustrations[${j}]`,
                          ill,
                          (text) => patchExceptionIllustration(i, j, 'text', { text }),
                          (hypothetical) => patchExceptionIllustration(i, j, 'hypothetical', { hypothetical }),
                        )
                      }
                    />
                  </div>
                </>
              )}
            />
          </div>

          <div id={fieldId('group-keyLegalTerms')}>
            <RepeatableList
              id={fieldId('keyLegalTerms')}
              title="Key legal terms"
              itemLabel={LIST_ITEM_LABELS.keyLegalTerms}
              rows={form.keyLegalTerms}
              max={SECTION_LIMITS.keyLegalTerms}
              error={errors.keyLegalTerms}
              makeRow={emptySectionRow.keyLegalTerms}
              onChange={(rows, order) => setList('keyLegalTerms', rows, order)}
              renderRow={(row, i) => (
                <>
                  <TextField
                    id={fieldId(`keyLegalTerms[${i}].term`)}
                    label="Term"
                    required
                    maxLength={SECTION_LIMITS.term}
                    value={row.term}
                    onChange={(term) => patchRow('keyLegalTerms', i, 'term', { term })}
                    error={errors[`keyLegalTerms[${i}].term`]}
                  />
                  <TextAreaField
                    id={fieldId(`keyLegalTerms[${i}].definition`)}
                    label="Definition"
                    required
                    rows={2}
                    value={row.definition}
                    onChange={(definition) => patchRow('keyLegalTerms', i, 'definition', { definition })}
                    error={errors[`keyLegalTerms[${i}].definition`]}
                  />
                </>
              )}
            />
          </div>

          <div className={`${styles.saveBar} ${styles.saveBarSticky}`}>
            <button type="submit" className={styles.primaryButton} disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save section'}
            </button>
            <span className={styles.hint} aria-live="polite">
              {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
          </div>
        </form>
      </div>

      {guard}
      {toast.element}
    </>
  );
}
