import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CONTENT_LIMITS, replaceCaseLawContent } from '@/api/adminCaseLaws';
import { PARTY_TYPES, type CaseLawDetail, type PartyType } from '@/api/caselaws';
import { ApiError } from '@/api/client';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useApiQuery } from '@/hooks/useApiQuery';
import { outcomeLabel, partyLabel } from '@/pages/content/caseLawLabels';
import { loadCaseLawForAdmin, refreshCachedCaseLaw, type ContentEditorHandoff } from './adminCaseLaw';
import {
  emptyRow,
  formFromDetail,
  parseServerErrors,
  remapListErrors,
  requestFromForm,
  validateContent,
  type ContentErrors,
  type ContentForm,
  type ListName,
} from './contentForm';
import { TextAreaField, TextField } from '@/components/Field';
import { RepeatableList } from '@/components/RepeatableList';
import { ContentSubNav } from '@/components/SubNav';
import { useToast } from '@/components/Toast';
import { useUnsavedChangesGuard } from '@/components/useUnsavedChangesGuard';
import styles from '@/components/ui.module.css';

/** `/admin/caselaws/:caseLawId/content` — the whole structured content, saved in one full replace. */
export function AdminCaseLawContentPage() {
  const { caseLawId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  // Read the hand-off once, then drop it from history so a reload doesn't show the message again.
  const [handoff] = useState(() => (location.state as ContentEditorHandoff | null) ?? {});
  const hasState = location.state !== null;
  useEffect(() => {
    if (hasState) navigate(location.pathname, { replace: true, state: null });
  }, [hasState, navigate, location.pathname]);

  const query = useApiQuery(`admin-caselaw:${caseLawId}`, () => loadCaseLawForAdmin(caseLawId));

  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/admin/caselaws">← All case laws</Link>
      </nav>
      {query.status === 'loading' && (
        <>
          <h1 className={styles.title}>Loading content…</h1>
          <LoadingState label="Loading case law content" lines={6} />
        </>
      )}
      {query.status === 'error' && (
        <>
          <h1 className={styles.title}>Content unavailable</h1>
          <ErrorState error={query.error} onRetry={query.retry} />
        </>
      )}
      {query.status === 'success' && <ContentEditor key={caseLawId} initial={query.data} flash={handoff.flash} />}
    </>
  );
}

const LIST_ITEM_LABELS: Record<ListName, string> = {
  issues: 'Issue',
  arguments: 'Argument',
  ratioDecidendi: 'Ratio',
  obiterDicta: 'Obiter dictum',
  importantProvisions: 'Provision',
  legalPrinciples: 'Principle',
};

const FIELD_LABELS: Record<string, string> = {
  onlineSummary: 'One-line summary',
  background: 'Background',
  finalHolding: 'Final holding',
  'finalHolding.summary': 'Final holding summary',
  'finalHolding.outcome': 'Final holding outcome',
  question: 'question',
  reasoning: 'reasoning',
  finding: 'finding',
  partyType: 'party',
  argument: 'argument',
  law: 'law',
  provision: 'provision',
  relevance: 'relevance',
  title: 'title',
  explanation: 'explanation',
};

/** `issues[2].question` → "Issue 3, question", for the error summary. */
function describePath(path: string): string {
  const match = /^(\w+)\[(\d+)\](?:\.(\w+))?$/.exec(path);
  if (match && match[1] in LIST_ITEM_LABELS) {
    const row = `${LIST_ITEM_LABELS[match[1] as ListName]} ${Number(match[2]) + 1}`;
    return match[3] ? `${row}, ${FIELD_LABELS[match[3]] ?? match[3]}` : row;
  }
  if (path in LIST_ITEM_LABELS) return `${LIST_ITEM_LABELS[path as ListName]} list`;
  return FIELD_LABELS[path] ?? path;
}

function ContentEditor({ initial, flash }: { initial: CaseLawDetail; flash?: string }) {
  const idPrefix = useId();
  const toast = useToast();
  const [title, setTitle] = useState(initial.title);
  const [form, setForm] = useState<ContentForm>(() => formFromDetail(initial));
  const [baseline, setBaseline] = useState(() => JSON.stringify(requestFromForm(formFromDetail(initial))));
  const [errors, setErrors] = useState<ContentErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(requestFromForm(form)) !== baseline;
  const guard = useUnsavedChangesGuard(dirty && !saving);

  // A message handed over by the previous screen (e.g. "Case law created"), shown once.
  const showToast = toast.show;
  useEffect(() => {
    if (flash) showToast(flash);
  }, [flash, showToast]);

  const fieldId = (path: string) => `${idPrefix}-${path}`;

  function setText(key: 'onlineSummary' | 'background' | 'holdingSummary' | 'holdingOutcome', value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    const path = key === 'holdingSummary' ? 'finalHolding.summary' : key === 'holdingOutcome' ? 'finalHolding.outcome' : key;
    clearError(path);
  }

  function clearError(path: string) {
    setErrors((current) => {
      if (!(path in current)) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
  }

  function setList<L extends ListName>(list: L, rows: ContentForm[L], order: number[]) {
    setForm((current) => ({ ...current, [list]: rows }));
    setErrors((current) => remapListErrors(current, list, order));
  }

  /** Updates one field of one row and clears that field's error. */
  function patchRow<L extends ListName>(list: L, index: number, field: string | null, patch: Partial<ContentForm[L][number]>) {
    setForm((current) => ({
      ...current,
      [list]: current[list].map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
    clearError(field ? `${list}[${index}].${field}` : `${list}[${index}]`);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaveError(null);
    const found = validateContent(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusSummary();
      return;
    }
    setSaving(true);
    try {
      const saved = await replaceCaseLawContent(initial.id, requestFromForm(form));
      const next = formFromDetail(saved);
      setForm(next);
      setBaseline(JSON.stringify(requestFromForm(next)));
      setTitle(saved.title);
      refreshCachedCaseLaw(initial.id);
      toast.show('Content saved.');
    } catch (err) {
      const apiError = err instanceof ApiError ? err : null;
      if (apiError?.code === 'VALIDATION_ERROR') {
        setErrors(parseServerErrors(apiError.message));
        focusSummary();
      } else {
        setSaveError(apiError?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  function focusSummary() {
    // After React renders the summary.
    window.requestAnimationFrame(() => document.getElementById(fieldId('errors'))?.focus());
  }

  const errorEntries = Object.entries(errors);
  const partyOptions = (current: PartyType) => (PARTY_TYPES.includes(current) ? PARTY_TYPES : [...PARTY_TYPES, current]);

  return (
    <>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Admin · Case law content</p>
          <h1 className={styles.title}>Edit content</h1>
          <p className={styles.hint}>{title}</p>
        </div>
        <div className={styles.headerLinks}>
          <Link to={`/admin/caselaws/${initial.id}`} className={styles.secondaryButton}>
            Edit details
          </Link>
          <Link to={`/caselaws/${initial.id}`} className={styles.secondaryButton}>
            View page
          </Link>
        </div>
      </div>
      <ContentSubNav />
      <p className={styles.notice}>
        Saving replaces all of this case's content with what is on this page. List order is the order shown to
        students; issue numbers follow it.
      </p>

      <form noValidate onSubmit={(event) => void handleSubmit(event)} className={styles.form}>
        {errorEntries.length > 0 && (
          <div id={fieldId('errors')} role="alert" tabIndex={-1} className={styles.errorSummary}>
            <p className={styles.errorSummaryTitle}>
              {errorEntries.length === 1 ? 'One problem stopped the save:' : `${errorEntries.length} problems stopped the save:`}
            </p>
            <ul>
              {errorEntries.map(([path, message]) => (
                <li key={path}>
                  {path ? (
                    <a
                      href={`#${fieldId(path)}`}
                      onClick={(event) => {
                        // List-level paths have no field; leave focus on the summary then.
                        const target = document.getElementById(fieldId(path));
                        event.preventDefault();
                        target?.focus();
                      }}
                    >
                      {describePath(path)}: {message}
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

        <section aria-labelledby={fieldId('overview')} className={styles.editorSection}>
          <h2 id={fieldId('overview')} className={styles.editorSectionTitle}>
            Overview
          </h2>
          <TextAreaField
            id={fieldId('onlineSummary')}
            label="One-line summary"
            hint="Shown under the case name."
            rows={2}
            value={form.onlineSummary}
            onChange={(value) => setText('onlineSummary', value)}
            error={errors.onlineSummary}
          />
          <TextAreaField
            id={fieldId('background')}
            label="Background"
            rows={6}
            value={form.background}
            onChange={(value) => setText('background', value)}
            error={errors.background}
          />
        </section>

        <RepeatableList
          id={fieldId('issues')}
          title="Issues"
          itemLabel="Issue"
          rows={form.issues}
          max={CONTENT_LIMITS.issues}
          error={errors.issues}
          makeRow={emptyRow.issues}
          onChange={(rows, order) => setList('issues', rows, order)}
          renderRow={(row, i) => (
            <>
              <TextAreaField
                id={fieldId(`issues[${i}].question`)}
                label="Question"
                required
                rows={2}
                value={row.question}
                onChange={(question) => patchRow('issues', i, 'question', { question })}
                error={errors[`issues[${i}].question`]}
              />
              <TextAreaField
                id={fieldId(`issues[${i}].reasoning`)}
                label="Reasoning"
                rows={4}
                value={row.reasoning}
                onChange={(reasoning) => patchRow('issues', i, 'reasoning', { reasoning })}
                error={errors[`issues[${i}].reasoning`]}
              />
              <TextAreaField
                id={fieldId(`issues[${i}].finding`)}
                label="Finding"
                rows={3}
                value={row.finding}
                onChange={(finding) => patchRow('issues', i, 'finding', { finding })}
                error={errors[`issues[${i}].finding`]}
              />
            </>
          )}
        />

        <RepeatableList
          id={fieldId('arguments')}
          title="Arguments"
          description="Students see these grouped by party. Within a party, they keep the order of this list."
          itemLabel="Argument"
          rows={form.arguments}
          max={CONTENT_LIMITS.arguments}
          error={errors.arguments}
          makeRow={() => emptyRow.arguments(form.arguments.at(-1)?.partyType)}
          onChange={(rows, order) => setList('arguments', rows, order)}
          renderRow={(row, i) => (
            <>
              <div className={styles.field}>
                <label htmlFor={fieldId(`arguments[${i}].partyType`)} className={styles.label}>
                  Party
                </label>
                <select
                  id={fieldId(`arguments[${i}].partyType`)}
                  className={styles.input}
                  value={row.partyType}
                  onChange={(event) =>
                    patchRow('arguments', i, 'partyType', { partyType: event.target.value as PartyType })
                  }
                  aria-invalid={errors[`arguments[${i}].partyType`] ? true : undefined}
                  aria-describedby={
                    errors[`arguments[${i}].partyType`] ? fieldId(`arguments[${i}].partyType-error`) : undefined
                  }
                >
                  {partyOptions(row.partyType).map((party) => (
                    <option key={party} value={party}>
                      {partyLabel(party)}
                    </option>
                  ))}
                </select>
                {errors[`arguments[${i}].partyType`] && (
                  <span id={fieldId(`arguments[${i}].partyType-error`)} className={styles.fieldError}>
                    {errors[`arguments[${i}].partyType`]}
                  </span>
                )}
              </div>
              <TextAreaField
                id={fieldId(`arguments[${i}].argument`)}
                label="Argument"
                required
                rows={3}
                value={row.argument}
                onChange={(argument) => patchRow('arguments', i, 'argument', { argument })}
                error={errors[`arguments[${i}].argument`]}
              />
            </>
          )}
        />

        <section aria-labelledby={fieldId('holding')} className={styles.editorSection}>
          <h2 id={fieldId('holding')} className={styles.editorSectionTitle}>
            Final holding
          </h2>
          <TextAreaField
            id={fieldId('finalHolding.summary')}
            label="Summary"
            rows={3}
            value={form.holdingSummary}
            onChange={(value) => setText('holdingSummary', value)}
            error={errors['finalHolding.summary']}
          />
          <TextField
            id={fieldId('finalHolding.outcome')}
            label="Outcome"
            hint={
              form.holdingOutcome.trim()
                ? `Shown as “${outcomeLabel(form.holdingOutcome)}”`
                : 'e.g. APPEAL_DISMISSED or plain text such as “Appeal dismissed”'
            }
            maxLength={CONTENT_LIMITS.outcome}
            value={form.holdingOutcome}
            onChange={(value) => setText('holdingOutcome', value)}
            error={errors['finalHolding.outcome']}
          />
        </section>

        <RepeatableList
          id={fieldId('ratioDecidendi')}
          title="Ratio decidendi"
          description="The binding legal reasoning the decision rests on."
          itemLabel="Ratio"
          rows={form.ratioDecidendi}
          max={CONTENT_LIMITS.ratioDecidendi}
          error={errors.ratioDecidendi}
          makeRow={emptyRow.ratioDecidendi}
          onChange={(rows, order) => setList('ratioDecidendi', rows, order)}
          renderRow={(row, i) => (
            <TextAreaField
              id={fieldId(`ratioDecidendi[${i}]`)}
              label="Text"
              required
              rows={3}
              value={row.text}
              onChange={(text) => patchRow('ratioDecidendi', i, null, { text })}
              error={errors[`ratioDecidendi[${i}]`]}
            />
          )}
        />

        <RepeatableList
          id={fieldId('obiterDicta')}
          title="Obiter dicta"
          description="Remarks made in passing. Not binding."
          itemLabel="Obiter dictum"
          rows={form.obiterDicta}
          max={CONTENT_LIMITS.obiterDicta}
          error={errors.obiterDicta}
          makeRow={emptyRow.obiterDicta}
          onChange={(rows, order) => setList('obiterDicta', rows, order)}
          renderRow={(row, i) => (
            <TextAreaField
              id={fieldId(`obiterDicta[${i}]`)}
              label="Text"
              required
              rows={3}
              value={row.text}
              onChange={(text) => patchRow('obiterDicta', i, null, { text })}
              error={errors[`obiterDicta[${i}]`]}
            />
          )}
        />

        <RepeatableList
          id={fieldId('importantProvisions')}
          title="Important provisions"
          description="Plain text. These are not linked to Bare Act sections."
          itemLabel="Provision"
          rows={form.importantProvisions}
          max={CONTENT_LIMITS.importantProvisions}
          error={errors.importantProvisions}
          makeRow={emptyRow.importantProvisions}
          onChange={(rows, order) => setList('importantProvisions', rows, order)}
          renderRow={(row, i) => (
            <>
              <div className={styles.fieldRow}>
                <TextField
                  id={fieldId(`importantProvisions[${i}].law`)}
                  label="Law"
                  hint="e.g. Constitution of India"
                  required
                  maxLength={CONTENT_LIMITS.provisionLaw}
                  value={row.law}
                  onChange={(law) => patchRow('importantProvisions', i, 'law', { law })}
                  error={errors[`importantProvisions[${i}].law`]}
                />
                <TextField
                  id={fieldId(`importantProvisions[${i}].provision`)}
                  label="Provision"
                  hint="e.g. Article 324"
                  required
                  maxLength={CONTENT_LIMITS.provisionName}
                  value={row.provision}
                  onChange={(provision) => patchRow('importantProvisions', i, 'provision', { provision })}
                  error={errors[`importantProvisions[${i}].provision`]}
                />
              </div>
              <TextAreaField
                id={fieldId(`importantProvisions[${i}].relevance`)}
                label="Relevance"
                rows={2}
                value={row.relevance}
                onChange={(relevance) => patchRow('importantProvisions', i, 'relevance', { relevance })}
                error={errors[`importantProvisions[${i}].relevance`]}
              />
            </>
          )}
        />

        <RepeatableList
          id={fieldId('legalPrinciples')}
          title="Legal principles"
          itemLabel="Principle"
          rows={form.legalPrinciples}
          max={CONTENT_LIMITS.legalPrinciples}
          error={errors.legalPrinciples}
          makeRow={emptyRow.legalPrinciples}
          onChange={(rows, order) => setList('legalPrinciples', rows, order)}
          renderRow={(row, i) => (
            <>
              <TextField
                id={fieldId(`legalPrinciples[${i}].title`)}
                label="Title"
                required
                maxLength={CONTENT_LIMITS.principleTitle}
                value={row.title}
                onChange={(value) => patchRow('legalPrinciples', i, 'title', { title: value })}
                error={errors[`legalPrinciples[${i}].title`]}
              />
              <TextAreaField
                id={fieldId(`legalPrinciples[${i}].explanation`)}
                label="Explanation"
                required
                rows={3}
                value={row.explanation}
                onChange={(explanation) => patchRow('legalPrinciples', i, 'explanation', { explanation })}
                error={errors[`legalPrinciples[${i}].explanation`]}
              />
            </>
          )}
        />

        <div className={`${styles.saveBar} ${styles.saveBarSticky}`}>
          <button type="submit" className={styles.primaryButton} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save content'}
          </button>
          <span className={styles.hint} aria-live="polite">
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
        </div>
      </form>

      {guard}
      {toast.element}
    </>
  );
}
