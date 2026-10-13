import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CASE_LAW_LIMITS,
  createCaseLaw,
  updateCaseLaw,
  type CaseLawAdmin,
  type CaseLawMetadataRequest,
} from '@/api/adminCaseLaws';
import { importanceLabel, type CaseLawDetail, type CaseLawImportance } from '@/api/caselaws';
import { ApiError } from '@/api/client';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useApiQuery } from '@/hooks/useApiQuery';
import { caseTypeLabel, KNOWN_CASE_TYPES } from '@/pages/content/caseLawLabels';
import { sectionLabel } from '@/pages/content/navigation';
import { loadCaseLawForAdmin, refreshCachedCaseLaw, type ContentEditorHandoff } from './adminCaseLaw';
import { TextField } from './Field';
import { useToast } from './Toast';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';
import styles from './Admin.module.css';

const IMPORTANCE_VALUES: CaseLawImportance[] = ['LANDMARK', 'IMPORTANT', 'STANDARD'];

type TextKey = Exclude<keyof CaseLawMetadataRequest, 'importance'>;

type MetadataForm = Record<TextKey, string> & { importance: CaseLawImportance };

const EMPTY_FORM: MetadataForm = {
  title: '',
  citation: '',
  court: '',
  caseNumber: '',
  decidedOn: '',
  bench: '',
  judges: '',
  jurisdiction: '',
  caseType: '',
  sourcePdfUrl: '',
  importance: 'STANDARD',
};

/** Accepts the read-side detail or the admin response: both carry every metadata field. */
function formFromSource(detail: CaseLawMetadataRequest): MetadataForm {
  return {
    title: detail.title,
    citation: detail.citation ?? '',
    court: detail.court ?? '',
    caseNumber: detail.caseNumber ?? '',
    decidedOn: detail.decidedOn ?? '',
    bench: detail.bench ?? '',
    judges: detail.judges ?? '',
    jurisdiction: detail.jurisdiction ?? '',
    caseType: detail.caseType ?? '',
    sourcePdfUrl: detail.sourcePdfUrl ?? '',
    importance: detail.importance,
  };
}

function requestFromForm(form: MetadataForm): CaseLawMetadataRequest {
  const optional = (value: string) => value.trim() || null;
  return {
    title: form.title.trim(),
    citation: optional(form.citation),
    court: optional(form.court),
    caseNumber: optional(form.caseNumber),
    decidedOn: optional(form.decidedOn),
    bench: optional(form.bench),
    judges: optional(form.judges),
    jurisdiction: optional(form.jurisdiction),
    caseType: optional(form.caseType),
    importance: form.importance,
    sourcePdfUrl: optional(form.sourcePdfUrl),
  };
}

function validate(form: MetadataForm): Partial<Record<keyof MetadataForm, string>> {
  const errors: Partial<Record<keyof MetadataForm, string>> = {};
  if (!form.title.trim()) errors.title = 'Enter the case name.';
  for (const [key, limit] of Object.entries(CASE_LAW_LIMITS) as [TextKey, number][]) {
    if (form[key].trim().length > limit) errors[key] = `Must be at most ${limit} characters.`;
  }
  const url = form.sourcePdfUrl.trim();
  if (url && !errors.sourcePdfUrl && !/^https?:\/\/\S+$/i.test(url)) {
    errors.sourcePdfUrl = 'Enter a full link starting with https:// or http://.';
  }
  return errors;
}

/** Server `VALIDATION_ERROR` messages read `field: message, field: message`. */
function serverFieldErrors(message: string): Partial<Record<keyof MetadataForm, string>> {
  const errors: Partial<Record<keyof MetadataForm, string>> = {};
  for (const match of message.matchAll(/(\w+): ([^,]+)/g)) {
    if (match[1] in EMPTY_FORM) errors[match[1] as keyof MetadataForm] = match[2];
  }
  return errors;
}

/** `/admin/caselaws/new` and `/admin/caselaws/:caseLawId` — the case law's metadata. */
export function AdminCaseLawFormPage() {
  const { caseLawId } = useParams();
  const existing = useApiQuery(caseLawId ? `admin-caselaw:${caseLawId}` : null, () =>
    loadCaseLawForAdmin(caseLawId ?? ''),
  );

  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/admin/caselaws">← All case laws</Link>
      </nav>
      {!caseLawId && <MetadataEditor key="new" initial={null} />}
      {caseLawId && existing.status === 'loading' && (
        <>
          <h1 className={styles.title}>Loading case law…</h1>
          <LoadingState label="Loading case law" />
        </>
      )}
      {caseLawId && existing.status === 'error' && (
        <>
          <h1 className={styles.title}>Case law unavailable</h1>
          <ErrorState error={existing.error} onRetry={existing.retry} />
        </>
      )}
      {caseLawId && existing.status === 'success' && <MetadataEditor key={caseLawId} initial={existing.data} />}
    </>
  );
}

function MetadataEditor({ initial }: { initial: CaseLawDetail | null }) {
  const navigate = useNavigate();
  const idPrefix = useId();
  const toast = useToast();
  const [baseline, setBaseline] = useState<MetadataForm>(() => (initial ? formFromSource(initial) : EMPTY_FORM));
  const [form, setForm] = useState(baseline);
  const [errors, setErrors] = useState<Partial<Record<keyof MetadataForm, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CaseLawAdmin | null>(null);
  const [linkedSections, setLinkedSections] = useState(initial?.relatedSections ?? []);

  const dirty = JSON.stringify(requestFromForm(form)) !== JSON.stringify(requestFromForm(baseline));
  const guard = useUnsavedChangesGuard(dirty && !saving);

  // Navigate only once the saved form is the baseline, so the unsaved-changes guard lets it through.
  useEffect(() => {
    if (!created || dirty) return;
    const handoff: ContentEditorHandoff = { flash: 'Case law created. Now add its content.' };
    navigate(`/admin/caselaws/${created.id}/content`, { state: handoff });
  }, [created, dirty, navigate]);

  const set = <K extends keyof MetadataForm>(key: K, value: MetadataForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) {
      setFormError('Fix the highlighted fields, then save again.');
      return;
    }
    setSaving(true);
    try {
      const body = requestFromForm(form);
      const saved = initial ? await updateCaseLaw(initial.id, body) : await createCaseLaw(body);
      const next = formFromSource(saved);
      setBaseline(next);
      setForm(next);
      setLinkedSections(saved.linkedSections ?? []);
      if (initial) {
        refreshCachedCaseLaw(saved.id);
        toast.show('Details saved.');
      } else {
        setCreated(saved);
      }
    } catch (err) {
      const apiError = err instanceof ApiError ? err : null;
      if (apiError?.code === 'VALIDATION_ERROR') setErrors(serverFieldErrors(apiError.message));
      setFormError(apiError?.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const fieldId = (key: string) => `${idPrefix}-${key}`;
  const text = (key: TextKey, label: string, extra: Partial<Parameters<typeof TextField>[0]> = {}) => (
    <TextField
      id={fieldId(key)}
      label={label}
      value={form[key]}
      onChange={(value) => set(key, value)}
      error={errors[key]}
      maxLength={key in CASE_LAW_LIMITS ? CASE_LAW_LIMITS[key as keyof typeof CASE_LAW_LIMITS] : undefined}
      {...extra}
    />
  );

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Admin · Case law</p>
          <h1 className={styles.title}>{initial ? 'Edit details' : 'New case law'}</h1>
          {initial && <p className={styles.hint}>{baseline.title}</p>}
        </div>
        {initial && (
          <div className={styles.headerLinks}>
            <Link to={`/admin/caselaws/${initial.id}/content`} className={styles.secondaryButton}>
              Edit content
            </Link>
            <Link to={`/caselaws/${initial.id}`} className={styles.secondaryButton}>
              View page
            </Link>
          </div>
        )}
      </div>

      <form noValidate onSubmit={(event) => void handleSubmit(event)} className={styles.form}>
        {formError && (
          <p role="alert" className={styles.formError}>
            {formError}
          </p>
        )}

        <fieldset className={styles.group}>
          <legend className={styles.groupLegend}>Case</legend>
          {text('title', 'Case name', { required: true })}
          {text('citation', 'Citation', { hint: 'e.g. 2026 INSC 564' })}
          {text('caseNumber', 'Case number', { hint: 'e.g. Writ Petition (Civil) No. 640 of 2025' })}
          <div className={styles.fieldRow}>
            {text('caseType', 'Case type', {
              list: fieldId('case-types'),
              hint: form.caseType.trim() ? `Shown as “${caseTypeLabel(form.caseType)}”` : 'e.g. WRIT_PETITION',
            })}
            {text('decidedOn', 'Decided on', { type: 'date' })}
          </div>
          <datalist id={fieldId('case-types')}>
            {KNOWN_CASE_TYPES.map((value) => (
              <option key={value} value={value}>
                {caseTypeLabel(value)}
              </option>
            ))}
          </datalist>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.groupLegend}>Court</legend>
          {text('court', 'Court', { hint: 'e.g. Supreme Court of India' })}
          <div className={styles.fieldRow}>
            {text('bench', 'Bench', { hint: 'e.g. Two-Judge Bench' })}
            {text('jurisdiction', 'Jurisdiction', { hint: 'e.g. Civil Original Jurisdiction' })}
          </div>
          {text('judges', 'Judges', { hint: 'One line, e.g. Surya Kant, CJI; Joymalya Bagchi, J.' })}
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.groupLegend}>Importance and source</legend>
          <div className={styles.field}>
            <label htmlFor={fieldId('importance')} className={styles.label}>
              Importance
            </label>
            <select
              id={fieldId('importance')}
              className={styles.input}
              value={form.importance}
              onChange={(event) => set('importance', event.target.value as CaseLawImportance)}
            >
              {IMPORTANCE_VALUES.map((value) => (
                <option key={value} value={value}>
                  {importanceLabel[value]}
                </option>
              ))}
            </select>
          </div>
          {text('sourcePdfUrl', 'Judgment PDF link', { type: 'url', hint: 'Optional. Opens from the case page.' })}
        </fieldset>

        <div className={styles.saveBar}>
          <button type="submit" className={styles.primaryButton} disabled={saving || (initial !== null && !dirty)}>
            {saving ? 'Saving…' : initial ? 'Save details' : 'Create case law'}
          </button>
          {initial && <span className={styles.hint}>{dirty ? 'Unsaved changes' : 'All changes saved'}</span>}
        </div>
      </form>

      {initial && (
        <section className={styles.editorSection} aria-labelledby={fieldId('linked')}>
          <h2 id={fieldId('linked')} className={styles.editorSectionTitle}>
            Linked sections
          </h2>
          {linkedSections.length === 0 ? (
            <p className={styles.emptyList}>No sections are linked to this case law.</p>
          ) : (
            <ul className={styles.plainList}>
              {linkedSections.map((section) => (
                <li key={section.id}>{sectionLabel(section.sectionNumber, section.title)}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {guard}
      {toast.element}
    </>
  );
}
