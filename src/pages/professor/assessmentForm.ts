/**
 * Draft editor model (UI spec F3.2, F3.3): the assessment as editable text, back into an
 * `AssessmentDraft` body, the draft checks (shape only, mirroring the server's draft
 * constraints) and the publish checklist (completeness, TDD §6.1). Errors are keyed by request
 * path (`questions[2].maxMarks`), which is also what the server names in a `VALIDATION_ERROR`,
 * so client and server errors land on the same row.
 */
import { ASSESSMENT_LIMITS, type AssessmentDetail, type AssessmentDraftRequest } from '@/api/professor';
import { fromDateTimeLocal, toDateTimeLocal } from '@/lib/dateTimeLocal';
import { formatMarks } from '@/lib/format';

export interface QuestionRow {
  key: string;
  /** The server's id, sent back so a save keeps the question; null until first saved. */
  id: string | null;
  text: string;
  /** As typed; parsed and checked on save. */
  maxMarks: string;
  wordLimit: string;
}

export interface AssessmentForm {
  subjectId: string;
  title: string;
  instructions: string;
  /** `yyyy-MM-ddTHH:mm` in local time, or ''. */
  dueAt: string;
  questions: QuestionRow[];
}

export type FormErrors = Record<string, string>;

let nextKey = 0;
export function emptyQuestion(): QuestionRow {
  nextKey += 1;
  return { key: `q-${nextKey}`, id: null, text: '', maxMarks: '', wordLimit: '' };
}

/** A new assessment starts with one empty question (and the only subject, when there is one). */
export function emptyForm(subjectId = ''): AssessmentForm {
  return { subjectId, title: '', instructions: '', dueAt: '', questions: [emptyQuestion()] };
}

export function formFromAssessment(detail: AssessmentDetail): AssessmentForm {
  return {
    subjectId: detail.subject.id,
    title: detail.title,
    instructions: detail.instructions ?? '',
    dueAt: toDateTimeLocal(detail.dueAt),
    questions: detail.questions.map((q) => ({
      ...emptyQuestion(),
      id: q.id,
      text: q.text ?? '',
      maxMarks: q.maxMarks === null ? '' : formatMarks(q.maxMarks),
      wordLimit: q.wordLimit === null ? '' : String(q.wordLimit),
    })),
  };
}

/** After a save: the server's question ids onto the same rows (order is kept), so keys and focus survive. */
export function withSavedIds(form: AssessmentForm, saved: AssessmentDetail): AssessmentForm {
  return { ...form, questions: form.questions.map((row, i) => ({ ...row, id: saved.questions[i]?.id ?? row.id })) };
}

/** '' → null; anything else → a number (NaN when unreadable, which the checks reject first). */
function parseNumber(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

export function requestFromForm(form: AssessmentForm): AssessmentDraftRequest {
  return {
    subjectId: form.subjectId,
    title: form.title.trim(),
    instructions: form.instructions.trim() ? form.instructions : null,
    dueAt: fromDateTimeLocal(form.dueAt),
    questions: form.questions.map((row) => ({
      id: row.id,
      text: row.text.trim() ? row.text : null,
      maxMarks: parseNumber(row.maxMarks),
      wordLimit: parseNumber(row.wordLimit),
    })),
  };
}

/** What "unsaved changes" compares: the request the form would send. */
export function snapshot(form: AssessmentForm): string {
  return JSON.stringify(requestFromForm(form));
}

export function marksError(value: string): string | null {
  const marks = parseNumber(value);
  if (marks === null) return null;
  if (!Number.isFinite(marks) || marks <= 0 || marks > ASSESSMENT_LIMITS.maxMarks) {
    return `Enter marks from 0.5 to ${ASSESSMENT_LIMITS.maxMarks}.`;
  }
  if (!Number.isInteger(marks * 2)) return 'Use whole or half marks, such as 7.5.';
  return null;
}

export function wordLimitError(value: string): string | null {
  const words = parseNumber(value);
  if (words === null) return null;
  if (!Number.isInteger(words) || words < 1 || words > ASSESSMENT_LIMITS.wordLimit) {
    return 'Enter a whole number from 1 to 10,000.';
  }
  return null;
}

/** Draft save: only what the server checks on a draft, so a half-written draft can be saved. */
export function validateDraft(form: AssessmentForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.subjectId) errors.subjectId = 'Choose a subject.';
  if (!form.title.trim()) errors.title = 'Title is required.';
  else if (form.title.trim().length > ASSESSMENT_LIMITS.title) errors.title = 'Title must be at most 255 characters.';
  if (form.instructions.length > ASSESSMENT_LIMITS.instructions) {
    errors.instructions = 'Instructions must be at most 10,000 characters.';
  }
  if (form.dueAt.trim() && !fromDateTimeLocal(form.dueAt)) errors.dueAt = 'Enter a complete date and time.';
  if (form.questions.length > ASSESSMENT_LIMITS.questions) errors.questions = 'An assessment can have at most 50 questions.';
  form.questions.forEach((row, i) => {
    if (row.text.length > ASSESSMENT_LIMITS.questionText) {
      errors[`questions[${i}].text`] = 'A question must be at most 10,000 characters.';
    }
    const marks = marksError(row.maxMarks);
    if (marks) errors[`questions[${i}].maxMarks`] = marks;
    const words = wordLimitError(row.wordLimit);
    if (words) errors[`questions[${i}].wordLimit`] = words;
  });
  return errors;
}

export interface CheckItem {
  id: string;
  ok: boolean;
  /** The line as shown: what's needed (passing) or what's missing (failing). */
  text: string;
  /** The field a failing line links to. */
  path: string;
}

const MISSING_LABELS = { text: 'its text', maxMarks: 'max marks', wordLimit: 'a word limit' } as const;

function joinList(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** The "Before you publish" lines (UI spec F3.3). `subjectIds` are the professor's subjects. */
export function publishChecklist(form: AssessmentForm, now: number, subjectIds: readonly string[]): CheckItem[] {
  const due = fromDateTimeLocal(form.dueAt);
  const items: CheckItem[] = [
    {
      id: 'subject',
      ok: Boolean(form.subjectId) && subjectIds.includes(form.subjectId),
      text: form.subjectId && !subjectIds.includes(form.subjectId) ? 'Choose a subject you teach.' : 'A subject you teach is chosen.',
      path: 'subjectId',
    },
    { id: 'title', ok: Boolean(form.title.trim()), text: 'The title is filled in.', path: 'title' },
    {
      id: 'due',
      ok: due !== null && new Date(due).getTime() > now,
      text: due !== null && new Date(due).getTime() <= now ? 'The due date must be in the future.' : 'The due date is set and in the future.',
      path: 'dueAt',
    },
    {
      id: 'count',
      ok: form.questions.length >= 1 && form.questions.length <= ASSESSMENT_LIMITS.questions,
      text: 'There are 1–50 questions.',
      path: 'questions',
    },
  ];
  const incomplete = form.questions
    .map((row, i) => {
      const missing = (['text', 'maxMarks', 'wordLimit'] as const).filter((field) => {
        if (field === 'text') return !row.text.trim();
        if (field === 'maxMarks') return !row.maxMarks.trim() || marksError(row.maxMarks) !== null;
        return !row.wordLimit.trim() || wordLimitError(row.wordLimit) !== null;
      });
      return { i, missing };
    })
    .filter((entry) => entry.missing.length > 0);
  if (incomplete.length === 0) {
    items.push({ id: 'questions', ok: true, text: 'Every question has its text, max marks and word limit.', path: 'questions' });
  } else {
    for (const { i, missing } of incomplete) {
      items.push({
        id: `question-${i}`,
        ok: false,
        text: `Question ${i + 1} needs ${joinList(missing.map((field) => MISSING_LABELS[field]))}.`,
        path: `questions[${i}].${missing[0]}`,
      });
    }
  }
  return items;
}

/** The failing checklist lines as errors for the summary, keyed by the field each links to. */
export function publishErrors(items: CheckItem[]): FormErrors {
  return Object.fromEntries(items.filter((item) => !item.ok).map((item) => [item.path, item.text]));
}

/** Sum of the questions' max marks; rows without (valid) marks are left out. */
export function totalMarks(form: AssessmentForm): number {
  return form.questions.reduce((sum, row) => {
    const marks = parseNumber(row.maxMarks);
    return marks !== null && marksError(row.maxMarks) === null ? sum + marks : sum;
  }, 0);
}

const FIELD_LABELS: Record<string, string> = {
  subjectId: 'Subject',
  title: 'Title',
  instructions: 'Instructions',
  dueAt: 'Due date',
  questions: 'Questions',
};

const QUESTION_FIELD_LABELS: Record<string, string> = { text: 'Question', maxMarks: 'Max marks', wordLimit: 'Word limit' };

/** "Question 3 · Max marks" for the error summary. */
export function describePath(path: string): string {
  const match = /^questions\[(\d+)\]\.?(\w*)$/.exec(path);
  if (match) {
    const field = QUESTION_FIELD_LABELS[match[2]];
    return field ? `Question ${Number(match[1]) + 1} · ${field}` : `Question ${Number(match[1]) + 1}`;
  }
  return FIELD_LABELS[path] ?? 'Assessment';
}
