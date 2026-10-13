/**
 * Content editor model: the read-side `CaseLawDetail` mapped into editable rows, back into a
 * `PUT .../content` body, plus client validation and server error mapping. Errors are keyed
 * by the request's field path (`issues[2].question`, `ratioDecidendi[0]`), which is also what
 * the server names in a 400 — so both kinds land on the same form row. Rows are never dropped
 * when building the body, so a form index always equals the request index.
 */
import { CONTENT_LIMITS, type CaseLawContentRequest } from '@/api/adminCaseLaws';
import type { CaseLawDetail, PartyType } from '@/api/caselaws';

/** A stable React key per row, so reordering moves DOM nodes (and focus) instead of re-labelling them. */
type Row<T> = T & { key: string };

let nextKey = 0;
function withKey<T extends object>(value: T): Row<T> {
  nextKey += 1;
  return { ...value, key: `row-${nextKey}` };
}

export interface IssueRow {
  question: string;
  reasoning: string;
  finding: string;
}
export interface ArgumentRow {
  partyType: PartyType;
  argument: string;
}
export interface TextRow {
  text: string;
}
export interface ProvisionRow {
  law: string;
  provision: string;
  relevance: string;
}
export interface PrincipleRow {
  title: string;
  explanation: string;
}

export interface ContentForm {
  onlineSummary: string;
  background: string;
  holdingSummary: string;
  holdingOutcome: string;
  issues: Row<IssueRow>[];
  arguments: Row<ArgumentRow>[];
  ratioDecidendi: Row<TextRow>[];
  obiterDicta: Row<TextRow>[];
  importantProvisions: Row<ProvisionRow>[];
  legalPrinciples: Row<PrincipleRow>[];
}

export type ListName = Exclude<keyof ContentForm, 'onlineSummary' | 'background' | 'holdingSummary' | 'holdingOutcome'>;

export const emptyRow = {
  issues: (): Row<IssueRow> => withKey({ question: '', reasoning: '', finding: '' }),
  arguments: (partyType: PartyType = 'PETITIONER'): Row<ArgumentRow> => withKey({ partyType, argument: '' }),
  ratioDecidendi: (): Row<TextRow> => withKey({ text: '' }),
  obiterDicta: (): Row<TextRow> => withKey({ text: '' }),
  importantProvisions: (): Row<ProvisionRow> => withKey({ law: '', provision: '', relevance: '' }),
  legalPrinciples: (): Row<PrincipleRow> => withKey({ title: '', explanation: '' }),
};

/** Read shape → form. `arguments` ({party: [..]}, in display order) is flattened into rows. */
export function formFromDetail(detail: CaseLawDetail): ContentForm {
  return {
    onlineSummary: detail.onlineSummary ?? '',
    background: detail.background ?? '',
    holdingSummary: detail.finalHolding?.summary ?? '',
    holdingOutcome: detail.finalHolding?.outcome ?? '',
    issues: detail.issues.map((issue) =>
      withKey({ question: issue.question, reasoning: issue.reasoning ?? '', finding: issue.finding ?? '' }),
    ),
    arguments: Object.entries(detail.arguments).flatMap(([party, list]) =>
      list.map((argument) => withKey({ partyType: party as PartyType, argument })),
    ),
    ratioDecidendi: detail.ratioDecidendi.map((text) => withKey({ text })),
    obiterDicta: detail.obiterDicta.map((text) => withKey({ text })),
    importantProvisions: detail.importantProvisions.map((p) =>
      withKey({ law: p.law, provision: p.provision, relevance: p.relevance ?? '' }),
    ),
    legalPrinciples: detail.legalPrinciples.map((p) => withKey({ title: p.title, explanation: p.explanation })),
  };
}

function optional(value: string): string | null {
  return value.trim() ? value : null;
}

/** Form → `PUT .../content` body: the whole content, in list order; no sequence fields. */
export function requestFromForm(form: ContentForm): CaseLawContentRequest {
  const holdingSummary = optional(form.holdingSummary);
  const holdingOutcome = optional(form.holdingOutcome);
  return {
    onlineSummary: optional(form.onlineSummary),
    background: optional(form.background),
    finalHolding: holdingSummary || holdingOutcome ? { summary: holdingSummary, outcome: holdingOutcome } : null,
    issues: form.issues.map((row) => ({
      question: row.question,
      reasoning: optional(row.reasoning),
      finding: optional(row.finding),
    })),
    arguments: form.arguments.map((row) => ({ partyType: row.partyType, argument: row.argument })),
    ratioDecidendi: form.ratioDecidendi.map((row) => row.text),
    obiterDicta: form.obiterDicta.map((row) => row.text),
    importantProvisions: form.importantProvisions.map((row) => ({
      law: row.law,
      provision: row.provision,
      relevance: optional(row.relevance),
    })),
    legalPrinciples: form.legalPrinciples.map((row) => ({ title: row.title, explanation: row.explanation })),
  };
}

/** Field path → message. */
export type ContentErrors = Record<string, string>;

/** Mirrors the server's `@NotBlank` / `@Size` constraints on the content body. */
export function validateContent(form: ContentForm): ContentErrors {
  const errors: ContentErrors = {};
  const required = (path: string, value: string, label: string) => {
    if (!value.trim()) errors[path] = `${label} is required.`;
  };
  const max = (path: string, value: string, limit: number, label: string) => {
    if (value.length > limit) errors[path] = `${label} must be at most ${limit} characters.`;
  };

  max('finalHolding.outcome', form.holdingOutcome, CONTENT_LIMITS.outcome, 'Outcome');
  form.issues.forEach((row, i) => required(`issues[${i}].question`, row.question, 'The question'));
  form.arguments.forEach((row, i) => required(`arguments[${i}].argument`, row.argument, 'The argument'));
  form.ratioDecidendi.forEach((row, i) => required(`ratioDecidendi[${i}]`, row.text, 'This entry'));
  form.obiterDicta.forEach((row, i) => required(`obiterDicta[${i}]`, row.text, 'This entry'));
  form.importantProvisions.forEach((row, i) => {
    required(`importantProvisions[${i}].law`, row.law, 'The law');
    max(`importantProvisions[${i}].law`, row.law, CONTENT_LIMITS.provisionLaw, 'The law');
    required(`importantProvisions[${i}].provision`, row.provision, 'The provision');
    max(`importantProvisions[${i}].provision`, row.provision, CONTENT_LIMITS.provisionName, 'The provision');
  });
  form.legalPrinciples.forEach((row, i) => {
    required(`legalPrinciples[${i}].title`, row.title, 'The title');
    max(`legalPrinciples[${i}].title`, row.title, CONTENT_LIMITS.principleTitle, 'The title');
    required(`legalPrinciples[${i}].explanation`, row.explanation, 'The explanation');
  });
  return errors;
}

/**
 * A `VALIDATION_ERROR` message → field errors. The server joins `path: message` pairs with
 * ", " (`arguments[0].partyType: must not be null, issues[1].question: must not be blank`);
 * an unreadable body ends in "… at path". Anything unrecognised comes back under `''`.
 */
export function parseServerErrors(message: string): ContentErrors {
  const errors: ContentErrors = {};
  const unreadable = /^(.*) at ([A-Za-z][\w.[\]]*)$/.exec(message);
  if (unreadable) {
    errors[unreadable[2]] = unreadable[1];
    return errors;
  }
  for (const part of message.split(/, (?=[A-Za-z][\w.[\]]*: )/)) {
    const match = /^([A-Za-z][\w.[\]]*): (.+)$/.exec(part);
    if (match) errors[match[1]] = sentence(match[2]);
    else errors[''] = errors[''] ? `${errors['']} ${part}` : part;
  }
  return errors;
}

function sentence(value: string): string {
  const trimmed = value.trim();
  const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

/**
 * Errors keep pointing at the right row when rows move: the server/validation paths use indexes,
 * so after a reorder the errors for that list are remapped from old to new positions.
 */
export function remapListErrors(errors: ContentErrors, list: ListName, order: number[]): ContentErrors {
  const prefix = `${list}[`;
  const next: ContentErrors = {};
  for (const [path, message] of Object.entries(errors)) {
    if (!path.startsWith(prefix)) {
      next[path] = message;
      continue;
    }
    const match = /^[^[]+\[(\d+)\](.*)$/.exec(path);
    if (!match) {
      next[path] = message;
      continue;
    }
    const newIndex = order.indexOf(Number(match[1]));
    // A removed row's errors go with it.
    if (newIndex >= 0) next[`${list}[${newIndex}]${match[2]}`] = message;
  }
  return next;
}
