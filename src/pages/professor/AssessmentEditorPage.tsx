import { useId, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { errorMessage, hasCode } from '@/api/errors';
import {
  ASSESSMENT_LIMITS,
  createAssessment,
  deleteAssessment,
  getAssessment,
  publishAssessment,
  updateAssessment,
  type AssessmentDetail,
} from '@/api/professor';
import { listSubjects, type Subject } from '@/api/subjects';
import { AssessmentStatusBadge } from '@/components/AssessmentBadges';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DateTimeField, NumberField, TextAreaField, TextField } from '@/components/Field';
import { flash } from '@/components/flash';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { RepeatableList } from '@/components/RepeatableList';
import { useUnsavedChangesGuard } from '@/components/useUnsavedChangesGuard';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { fromDateTimeLocal, timeZoneLabel } from '@/lib/dateTimeLocal';
import { useNow } from '@/lib/deadline';
import { formatCount, formatInstant, formatListInstant, formatMarks } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { parseServerErrors, remapListErrors } from '@/pages/admin/contentForm';
import { NotFoundPage } from '@/pages/NotFoundPage';
import {
  describePath,
  emptyForm,
  emptyQuestion,
  formFromAssessment,
  publishChecklist,
  publishErrors,
  requestFromForm,
  snapshot,
  totalMarks,
  validateDraft,
  withSavedIds,
  type AssessmentForm,
  type CheckItem,
  type FormErrors,
  type QuestionRow,
} from './assessmentForm';
import { useRefreshAssessments } from './assessmentQueries';
import localStyles from '@/components/Assessment.module.css';
import styles from '@/components/ui.module.css';

/**
 * `/professor/assessments/new` and `/professor/assessments/:assessmentId/edit` (UI spec F3.2–F3.4).
 * The first save of a new assessment moves to its `/edit` URL; the page instance survives that
 * navigation (same route component), so the editor is kept as it is instead of reloading.
 */
export function AssessmentEditorPage() {
  const { assessmentId } = useParams();
  const [created, setCreated] = useState<AssessmentDetail | null>(null);
  const seeded = created && created.id === assessmentId ? created : null;
  const subjects = useCachedQuery(queryKeys.subjects.list(''), (signal) => listSubjects(undefined, signal));
  const query = useApiQuery(assessmentId && !seeded ? `professor-assessment:${assessmentId}` : null, () =>
    getAssessment(assessmentId ?? ''),
  );

  if (query.status === 'error' && hasCode(query.error, 'NOT_FOUND')) return <NotFoundPage />;
  const loaded = seeded ?? (query.status === 'success' ? query.data : null);
  if (loaded && loaded.status !== 'DRAFT') return <Navigate to={`/professor/assessments/${loaded.id}`} replace />;

  const failed = query.status === 'error' ? query : subjects.status === 'error' ? subjects : null;
  const ready = subjects.status === 'success' && (!assessmentId || loaded);
  if (ready && subjects.status === 'success') {
    return (
      <AssessmentEditor
        key={seeded ? 'new' : (assessmentId ?? 'new')}
        initial={loaded}
        subjects={subjects.data}
        onCreated={setCreated}
      />
    );
  }
  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/professor">Assessments</Link>
      </nav>
      <h1 className={styles.title}>{failed ? 'Assessment unavailable' : 'Loading assessment…'}</h1>
      {failed ? (
        <ErrorState error={failed.error} onRetry={failed.retry} />
      ) : (
        <LoadingState label="Loading assessment" lines={6} />
      )}
    </>
  );
}

type Busy = 'saving' | 'publishing' | 'deleting' | null;
type Banner = { message: string; openLink?: string } | null;

function AssessmentEditor({
  initial,
  subjects,
  onCreated,
}: {
  initial: AssessmentDetail | null;
  subjects: Subject[];
  onCreated: (assessment: AssessmentDetail) => void;
}) {
  const idPrefix = useId();
  const navigate = useNavigate();
  const refresh = useRefreshAssessments();
  const [assessment, setAssessment] = useState(initial);
  const [form, setForm] = useState<AssessmentForm>(() =>
    initial ? formFromAssessment(initial) : emptyForm(subjects.length === 1 ? subjects[0].id : ''),
  );
  // A new assessment counts as changed only once something is typed.
  const [baseline, setBaseline] = useState(() => snapshot(form));
  const [errors, setErrors] = useState<FormErrors>({});
  const [banner, setBanner] = useState<Banner>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [confirm, setConfirm] = useState<'publish' | 'delete' | null>(null);

  const now = useNow();
  const subjectIds = subjects.map((s) => s.id);
  const dirty = snapshot(form) !== baseline;
  const guard = useUnsavedChangesGuard(dirty && busy === null);
  const fieldId = (path: string) => `${idPrefix}-${path}`;
  const checklist = publishChecklist(form, now, subjectIds);
  const total = totalMarks(form);

  function clearError(path: string) {
    setErrors((current) => {
      if (!(path in current)) return current;
      const next = { ...current };
      delete next[path];
      return next;
    });
  }

  function setField(key: 'subjectId' | 'title' | 'instructions' | 'dueAt', value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    clearError(key);
  }

  function setQuestions(rows: QuestionRow[], order: number[]) {
    setForm((current) => ({ ...current, questions: rows }));
    setErrors((current) => {
      const next = remapListErrors(current, 'questions', order);
      delete next.questions;
      return next;
    });
  }

  function patchQuestion(index: number, field: 'text' | 'maxMarks' | 'wordLimit', value: string) {
    setForm((current) => ({
      ...current,
      questions: current.questions.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }));
    clearError(`questions[${index}].${field}`);
  }

  function focusSummary() {
    window.requestAnimationFrame(() => document.getElementById(fieldId('errors'))?.focus());
  }

  function focusField(path: string) {
    const target = document.getElementById(fieldId(path));
    target?.focus();
    target?.scrollIntoView({ block: 'center' });
  }

  function showSaveError(err: unknown, creating: boolean) {
    if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
      setErrors(parseServerErrors(err.message));
      focusSummary();
    } else if (hasCode(err, 'NOT_FOUND') && (creating || !subjectIds.includes(form.subjectId))) {
      setErrors({ subjectId: 'This subject is no longer one of yours. Choose another.' });
      focusSummary();
    } else if (hasCode(err, 'NOT_FOUND')) {
      setBanner({ message: 'This item no longer exists.' });
    } else if (hasCode(err, 'ASSESSMENT_NOT_EDITABLE') && assessment) {
      setBanner({ message: errorMessage(err), openLink: `/professor/assessments/${assessment.id}` });
    } else {
      setBanner({ message: errorMessage(err) });
    }
  }

  /** Draft save (shape checks only). Resolves to the saved assessment, or null when it didn't save. */
  async function save(): Promise<AssessmentDetail | null> {
    setBanner(null);
    const found = validateDraft(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      focusSummary();
      return null;
    }
    const sent = form;
    const creating = assessment === null;
    setBusy('saving');
    try {
      const body = requestFromForm(sent);
      const saved = assessment === null ? await createAssessment(body) : await updateAssessment(assessment.id, body);
      setAssessment(saved);
      setForm((current) => withSavedIds(current, saved));
      setBaseline(snapshot(withSavedIds(sent, saved)));
      refresh();
      flash('Draft saved.');
      if (creating) {
        onCreated(saved);
        navigate(`/professor/assessments/${saved.id}/edit`, { replace: true });
      }
      return saved;
    } catch (err) {
      showSaveError(err, creating);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    await save();
  }

  async function startPublish() {
    if (busy) return;
    setBanner(null);
    const failing = publishErrors(publishChecklist(form, Date.now(), subjectIds));
    const draftErrors = validateDraft(form);
    const found = { ...failing, ...draftErrors };
    if (Object.keys(found).length > 0) {
      setErrors(found);
      focusSummary();
      return;
    }
    if (assessment === null || dirty) {
      const saved = await save();
      if (!saved) return;
    }
    setConfirm('publish');
  }

  async function confirmPublish() {
    if (!assessment) return;
    setBusy('publishing');
    try {
      await publishAssessment(assessment.id);
      refresh();
      flash('Assessment published.');
      navigate(`/professor/assessments/${assessment.id}`);
    } catch (err) {
      setConfirm(null);
      showSaveError(err, false);
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    if (!assessment) return;
    setBusy('deleting');
    try {
      await deleteAssessment(assessment.id);
    } catch (err) {
      if (!hasCode(err, 'NOT_FOUND')) {
        setConfirm(null);
        setBusy(null);
        showSaveError(err, false);
        return;
      }
      // Already gone: same outcome as deleting it.
    }
    refresh(assessment.id);
    flash('Draft deleted.');
    navigate('/professor');
  }

  const errorEntries = Object.entries(errors);
  const knownSubject = subjects.find((s) => s.id === form.subjectId);
  const strayInitialSubject = !knownSubject && assessment && assessment.subject.id === form.subjectId ? assessment.subject : null;
  const dueIso = fromDateTimeLocal(form.dueAt);

  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/professor">Assessments</Link>
        <span aria-current="page"> / {assessment ? assessment.title || 'Untitled draft' : 'New assessment'}</span>
      </nav>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.eyebrow}>Professor</p>
          <h1 className={styles.title}>{assessment ? 'Edit draft' : 'New assessment'}</h1>
          {assessment && (
            <p className={styles.detailFacts}>
              <AssessmentStatusBadge status="DRAFT" />
              <span title={formatInstant(assessment.updatedAt)}>Last saved {formatListInstant(assessment.updatedAt)}</span>
            </p>
          )}
        </div>
        {assessment && (
          <div className={styles.headerLinks}>
            <button type="button" className={styles.dangerButton} onClick={() => setConfirm('delete')} disabled={busy !== null}>
              Delete draft
            </button>
          </div>
        )}
      </div>

      <div className={localStyles.editorGrid}>
        <form noValidate onSubmit={(event) => void handleSubmit(event)} className={styles.form}>
          {errorEntries.length > 0 && (
            <div id={fieldId('errors')} role="alert" tabIndex={-1} className={styles.errorSummary}>
              <p className={styles.errorSummaryTitle}>
                {errorEntries.length === 1 ? 'Fix this first:' : `Fix these ${errorEntries.length} things first:`}
              </p>
              <ul>
                {errorEntries.map(([path, message]) => (
                  <li key={path}>
                    {path ? (
                      <a
                        href={`#${fieldId(path)}`}
                        onClick={(event) => {
                          event.preventDefault();
                          focusField(path);
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
          <div role="alert">
            {banner && (
              <p className={styles.formError}>
                {banner.message}{' '}
                {banner.openLink && <Link to={banner.openLink}>Open assessment</Link>}
              </p>
            )}
          </div>

          <section aria-labelledby={fieldId('details-title')} className={styles.editorSection}>
            <h2 id={fieldId('details-title')} className={styles.editorSectionTitle}>
              Details
            </h2>
            <div className={styles.field}>
              <label htmlFor={fieldId('subjectId')} className={styles.label}>
                Subject<span className={styles.required}> (required)</span>
              </label>
              <select
                id={fieldId('subjectId')}
                className={styles.input}
                value={form.subjectId}
                onChange={(event) => setField('subjectId', event.target.value)}
                aria-invalid={errors.subjectId ? true : undefined}
                aria-describedby={errors.subjectId ? `${fieldId('subjectId')}-error` : undefined}
                aria-required
              >
                <option value="">Choose a subject</option>
                {strayInitialSubject && (
                  <option value={strayInitialSubject.id}>
                    {strayInitialSubject.code} · {strayInitialSubject.name} (no longer yours)
                  </option>
                )}
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.code} · {subject.name}
                  </option>
                ))}
              </select>
              {errors.subjectId && (
                <span id={`${fieldId('subjectId')}-error`} className={styles.fieldError}>
                  {errors.subjectId}
                </span>
              )}
            </div>
            <TextField
              id={fieldId('title')}
              label="Title"
              required
              maxLength={ASSESSMENT_LIMITS.title}
              value={form.title}
              onChange={(value) => setField('title', value)}
              error={errors.title}
            />
            <TextAreaField
              id={fieldId('instructions')}
              label="Instructions for students"
              hint="Shown above the questions. Line breaks are kept."
              rows={6}
              maxLength={ASSESSMENT_LIMITS.instructions}
              value={form.instructions}
              onChange={(value) => setField('instructions', value)}
              error={errors.instructions}
            />
            <DateTimeField
              id={fieldId('dueAt')}
              label="Due date and time"
              hint={`Your time zone: ${timeZoneLabel()}. Students can upload and submit until then. It can't be changed after publishing.`}
              value={form.dueAt}
              onChange={(value) => setField('dueAt', value)}
              error={errors.dueAt}
            />
          </section>

          <div id={fieldId('questions')} tabIndex={-1}>
            <RepeatableList
              id={fieldId('question-list')}
              title="Questions"
              description="Students answer each question with its own PDF, in this order."
              itemLabel="Question"
              rows={form.questions}
              max={ASSESSMENT_LIMITS.questions}
              error={errors.questions}
              makeRow={emptyQuestion}
              onChange={setQuestions}
              renderRow={(row, i) => (
                <>
                  <TextAreaField
                    id={fieldId(`questions[${i}].text`)}
                    label="Question"
                    rows={4}
                    maxLength={ASSESSMENT_LIMITS.questionText}
                    value={row.text}
                    onChange={(value) => patchQuestion(i, 'text', value)}
                    error={errors[`questions[${i}].text`]}
                  />
                  <div className={styles.fieldRow}>
                    <NumberField
                      id={fieldId(`questions[${i}].maxMarks`)}
                      label="Max marks"
                      step={0.5}
                      min={0.5}
                      max={ASSESSMENT_LIMITS.maxMarks}
                      inputMode="decimal"
                      value={row.maxMarks}
                      onChange={(value) => patchQuestion(i, 'maxMarks', value)}
                      error={errors[`questions[${i}].maxMarks`]}
                    />
                    <NumberField
                      id={fieldId(`questions[${i}].wordLimit`)}
                      label="Word limit"
                      step={1}
                      min={1}
                      max={ASSESSMENT_LIMITS.wordLimit}
                      value={row.wordLimit}
                      onChange={(value) => patchQuestion(i, 'wordLimit', value)}
                      error={errors[`questions[${i}].wordLimit`]}
                    />
                  </div>
                </>
              )}
            />
          </div>
          <p className={localStyles.totalMarks} aria-live="polite">
            Total: {formatMarks(total)} marks
          </p>

          <div className={`${styles.saveBar} ${styles.saveBarSticky}`}>
            <button type="submit" className={styles.secondaryButton} disabled={busy !== null}>
              {busy === 'saving' ? 'Saving…' : 'Save draft'}
            </button>
            <button type="button" className={styles.primaryButton} onClick={() => void startPublish()} disabled={busy !== null}>
              Publish…
            </button>
          </div>
        </form>

        <aside className={localStyles.checklistAside} aria-label="Before you publish">
          <Checklist items={checklist} onFocus={focusField} fieldId={fieldId} />
        </aside>
      </div>

      <ConfirmDialog
        open={confirm === 'publish'}
        title={`Publish “${form.title.trim()}”?`}
        confirmLabel={busy === 'publishing' ? 'Publishing…' : 'Publish'}
        busy={busy === 'publishing'}
        onConfirm={() => void confirmPublish()}
        onCancel={() => setConfirm(null)}
      >
        <p>
          Students at your college can see it and upload answers until {formatInstant(dueIso)}. Once published, nothing
          can be edited and the due date can&rsquo;t be extended.
        </p>
        <p>
          {formatCount(form.questions.length)} {form.questions.length === 1 ? 'question' : 'questions'} ·{' '}
          {formatMarks(total)} marks.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this draft?"
        confirmLabel={busy === 'deleting' ? 'Deleting…' : 'Delete draft'}
        destructive
        busy={busy === 'deleting'}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirm(null)}
      >
        <p>
          &ldquo;{assessment?.title || 'Untitled draft'}&rdquo; and its questions are deleted. This can&rsquo;t be undone.
        </p>
      </ConfirmDialog>
      {guard}
    </>
  );
}

/** "Before you publish" (UI spec F3.3): ✓ / ✗ and text on every line; failing lines link to their field. */
function Checklist({
  items,
  onFocus,
  fieldId,
}: {
  items: CheckItem[];
  onFocus: (path: string) => void;
  fieldId: (path: string) => string;
}) {
  const failing = items.filter((item) => !item.ok).length;
  return (
    <section className={localStyles.checklist} aria-labelledby={fieldId('checklist-title')}>
      <h2 id={fieldId('checklist-title')} className={localStyles.checklistTitle}>
        Before you publish
      </h2>
      <p className={styles.hint}>{failing === 0 ? 'Ready to publish.' : `${failing} to do.`}</p>
      <ul>
        {items.map((item) => (
          <li key={item.id} className={`${localStyles.checkItem} ${item.ok ? localStyles.checkOk : localStyles.checkFail}`}>
            <span aria-hidden="true">{item.ok ? '✓' : '✕'}</span>
            <span>
              <span className={styles.visuallyHidden}>{item.ok ? 'Done: ' : 'To do: '}</span>
              {item.ok ? (
                item.text
              ) : (
                <a
                  href={`#${fieldId(item.path)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onFocus(item.path);
                  }}
                >
                  {item.text}
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
