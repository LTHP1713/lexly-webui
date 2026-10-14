/**
 * Section editor model (UI spec F1.7): `AdminSection` → editable rows → the full-replace
 * `PUT /admin/sections/{id}` body, plus client validation. As in `contentForm.ts`, errors are keyed
 * by the request's field path (`exceptions[2].illustrations[0].text`), which is also what the
 * server names in a 400, and rows are never dropped when building the body, so a form index
 * always equals the request index.
 */
import { SECTION_LIMITS, type AdminSection, type SectionRequest } from '@/api/adminContent';
import type { ContentErrors } from './contentForm';

type Row<T> = T & { key: string };

let nextKey = 0;
function withKey<T extends object>(value: T): Row<T> {
  nextKey += 1;
  return { ...value, key: `section-row-${nextKey}` };
}

export interface ClauseRow {
  clause: string;
  title: string;
  explanation: string;
}
export interface IllustrationRow {
  text: string;
  hypothetical: boolean;
}
export interface ExceptionRow {
  title: string;
  explanation: string;
  illustrations: Row<IllustrationRow>[];
}
export interface TermRow {
  term: string;
  definition: string;
}

export interface SectionForm {
  sectionNumber: string;
  title: string;
  bodyText: string;
  inSimpleWords: string;
  provisionMeaning: Row<ClauseRow>[];
  illustrations: Row<IllustrationRow>[];
  exceptions: Row<ExceptionRow>[];
  keyLegalTerms: Row<TermRow>[];
}

export type SectionListName = 'provisionMeaning' | 'illustrations' | 'exceptions' | 'keyLegalTerms';

export const emptySectionRow = {
  provisionMeaning: (): Row<ClauseRow> => withKey({ clause: '', title: '', explanation: '' }),
  /** New illustrations default to "from the Act", matching the server's `hypothetical` default. */
  illustration: (): Row<IllustrationRow> => withKey({ text: '', hypothetical: false }),
  exceptions: (): Row<ExceptionRow> => withKey({ title: '', explanation: '', illustrations: [] }),
  keyLegalTerms: (): Row<TermRow> => withKey({ term: '', definition: '' }),
};

export function formFromSection(section: AdminSection): SectionForm {
  const illustrations = (list: AdminSection['illustrations']) =>
    list.map((item) => withKey({ text: item.text, hypothetical: item.hypothetical }));
  return {
    sectionNumber: section.sectionNumber,
    title: section.title ?? '',
    bodyText: section.bodyText,
    inSimpleWords: section.inSimpleWords ?? '',
    provisionMeaning: section.provisionMeaning.map((p) =>
      withKey({ clause: p.clause ?? '', title: p.title ?? '', explanation: p.explanation }),
    ),
    illustrations: illustrations(section.illustrations),
    exceptions: section.exceptions.map((ex) =>
      withKey({ title: ex.title ?? '', explanation: ex.explanation, illustrations: illustrations(ex.illustrations) }),
    ),
    keyLegalTerms: section.keyLegalTerms.map((t) => withKey({ term: t.term, definition: t.definition })),
  };
}

function optional(value: string): string | null {
  return value.trim() ? value : null;
}

/** Form → body: the whole section, nested lists included, with `displayOrder` = list position. */
export function requestFromSectionForm(form: SectionForm): SectionRequest {
  return {
    sectionNumber: form.sectionNumber.trim(),
    title: optional(form.title),
    bodyText: form.bodyText,
    inSimpleWords: optional(form.inSimpleWords),
    provisionMeaning: form.provisionMeaning.map((row, displayOrder) => ({
      clause: optional(row.clause),
      title: optional(row.title),
      explanation: row.explanation,
      displayOrder,
    })),
    illustrations: form.illustrations.map((row, displayOrder) => ({
      text: row.text,
      hypothetical: row.hypothetical,
      displayOrder,
    })),
    exceptions: form.exceptions.map((row, displayOrder) => ({
      title: optional(row.title),
      explanation: row.explanation,
      displayOrder,
      illustrations: row.illustrations.map((ill) => ({ text: ill.text, hypothetical: ill.hypothetical })),
    })),
    keyLegalTerms: form.keyLegalTerms.map((row, displayOrder) => ({
      term: row.term,
      definition: row.definition,
      displayOrder,
    })),
  };
}

/** Mirrors the server's `@NotBlank` / `@Size` constraints on `SectionRequest`. */
export function validateSection(form: SectionForm): ContentErrors {
  const errors: ContentErrors = {};
  const required = (path: string, value: string, label: string) => {
    if (!value.trim()) errors[path] = `${label} is required.`;
  };
  const max = (path: string, value: string, limit: number, label: string) => {
    if (!errors[path] && value.trim().length > limit) errors[path] = `${label} must be at most ${limit} characters.`;
  };
  const L = SECTION_LIMITS;

  required('sectionNumber', form.sectionNumber, 'The section number');
  max('sectionNumber', form.sectionNumber, L.sectionNumber, 'The section number');
  max('title', form.title, L.title, 'The title');
  required('bodyText', form.bodyText, 'The section text');

  form.provisionMeaning.forEach((row, i) => {
    max(`provisionMeaning[${i}].clause`, row.clause, L.clause, 'The clause');
    max(`provisionMeaning[${i}].title`, row.title, L.clauseTitle, 'The title');
    required(`provisionMeaning[${i}].explanation`, row.explanation, 'The explanation');
  });
  form.illustrations.forEach((row, i) => required(`illustrations[${i}].text`, row.text, 'The illustration'));
  form.exceptions.forEach((row, i) => {
    max(`exceptions[${i}].title`, row.title, L.exceptionTitle, 'The title');
    required(`exceptions[${i}].explanation`, row.explanation, 'The explanation');
    row.illustrations.forEach((ill, j) =>
      required(`exceptions[${i}].illustrations[${j}].text`, ill.text, 'The illustration'),
    );
  });
  form.keyLegalTerms.forEach((row, i) => {
    required(`keyLegalTerms[${i}].term`, row.term, 'The term');
    max(`keyLegalTerms[${i}].term`, row.term, L.term, 'The term');
    required(`keyLegalTerms[${i}].definition`, row.definition, 'The definition');
  });
  return errors;
}

/** The editor's groups, in page order, and the error paths that belong to each (for the index). */
export const SECTION_GROUPS = [
  { id: 'section', label: 'Section', paths: ['sectionNumber', 'title', 'bodyText'] },
  { id: 'inSimpleWords', label: 'In simple words', paths: ['inSimpleWords'] },
  { id: 'provisionMeaning', label: 'Clause by clause', paths: ['provisionMeaning'] },
  { id: 'illustrations', label: 'Illustrations', paths: ['illustrations'] },
  { id: 'exceptions', label: 'Exceptions', paths: ['exceptions'] },
  { id: 'keyLegalTerms', label: 'Key legal terms', paths: ['keyLegalTerms'] },
] as const;

export function errorCountFor(errors: ContentErrors, paths: readonly string[]): number {
  return Object.keys(errors).filter((path) =>
    paths.some((p) => path === p || path.startsWith(`${p}[`) || path.startsWith(`${p}.`)),
  ).length;
}

const ITEM_LABELS: Record<string, string> = {
  provisionMeaning: 'Clause',
  illustrations: 'Illustration',
  exceptions: 'Exception',
  keyLegalTerms: 'Term',
};

const FIELD_LABELS: Record<string, string> = {
  sectionNumber: 'Section number',
  title: 'title',
  bodyText: 'Section text',
  inSimpleWords: 'In simple words',
  clause: 'clause',
  explanation: 'explanation',
  text: 'text',
  term: 'term',
  definition: 'definition',
  hypothetical: 'source',
};

/** `exceptions[2].illustrations[0].text` → "Exception 3, illustration 1, text" (error summary). */
export function describeSectionPath(path: string): string {
  const top = FIELD_LABELS[path];
  if (top && !path.includes('[')) return path === 'title' ? 'Title' : top;
  const match = /^(\w+)\[(\d+)\](?:\.illustrations\[(\d+)\])?(?:\.(\w+))?$/.exec(path);
  if (match && match[1] in ITEM_LABELS) {
    const parts = [`${ITEM_LABELS[match[1]]} ${Number(match[2]) + 1}`];
    if (match[3] !== undefined) parts.push(`illustration ${Number(match[3]) + 1}`);
    if (match[4]) parts.push(FIELD_LABELS[match[4]] ?? match[4]);
    return parts.join(', ');
  }
  if (path in ITEM_LABELS) return `${ITEM_LABELS[path]} list`;
  return path;
}
