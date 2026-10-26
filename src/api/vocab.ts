/**
 * Vocab & Maxims (contract §11b, LIVE since P5b): read-only glossaries for every role, derived
 * on the server from section key terms and case-law principles. The server removes duplicates
 * (same term after collapsing whitespace and ignoring case) and sorts A–Z, so the list order is
 * kept as returned and the lower-cased term is a unique key. From P8a an S_STUDENT without a
 * trial or plan gets `402 PLAN_REQUIRED` here.
 */
import { apiClient, type RequestOptions } from '@/api/client';
import type { Page } from '@/api/content';

/** One key legal term (contract §11b.1), with the section it was first taken from. */
export interface VocabSummary {
  term: string;
  definition: string;
  source: { sectionId: string; sectionNumber: string; actId: string; actShortCode: string };
}

/** One legal principle (contract §11b.2), with the case law it was first taken from. */
export interface MaximSummary {
  title: string;
  explanation: string;
  source: { caseLawId: string; caseTitle: string };
}

/** `A`–`Z`, or `#` for anything that doesn't start with A–Z (digits, symbols, accented letters). */
export type GlossaryLetter = string;

export const GLOSSARY_LETTERS: GlossaryLetter[] = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];

/** Mirrors the server's `q` limit (contract §11b). */
export const GLOSSARY_QUERY_MAX = 100;

/** The letter from the URL, upper-cased, or `null` when it isn't one the server accepts. */
export function parseGlossaryLetter(value: string | null): GlossaryLetter | null {
  if (!value) return null;
  const letter = value.toUpperCase();
  return GLOSSARY_LETTERS.includes(letter) ? letter : null;
}

export interface GlossaryQuery {
  query?: string;
  letter?: GlossaryLetter | null;
  page: number;
  size: number;
}

/** `URLSearchParams` encodes `#` as `%23`; sent raw it would end the URL and mean "all letters". */
function glossaryParams(input: GlossaryQuery): URLSearchParams {
  const params = new URLSearchParams({ page: String(input.page), size: String(input.size) });
  if (input.query) params.set('q', input.query);
  if (input.letter) params.set('letter', input.letter);
  return params;
}

function text(value: string | null | undefined): string {
  return value ?? '';
}

export function toVocabSummary(dto: VocabSummary): VocabSummary {
  const source: Partial<VocabSummary['source']> = dto.source ?? {};
  return {
    term: text(dto.term),
    definition: text(dto.definition),
    source: {
      sectionId: text(source.sectionId),
      sectionNumber: text(source.sectionNumber),
      actId: text(source.actId),
      actShortCode: text(source.actShortCode),
    },
  };
}

export function toMaximSummary(dto: MaximSummary): MaximSummary {
  const source: Partial<MaximSummary['source']> = dto.source ?? {};
  return {
    title: text(dto.title),
    explanation: text(dto.explanation),
    source: { caseLawId: text(source.caseLawId), caseTitle: text(source.caseTitle) },
  };
}

function toPage<D, T>(page: Page<D>, map: (dto: D) => T): Page<T> {
  return { ...page, content: (page.content ?? []).map(map) };
}

export async function listVocab(input: GlossaryQuery, init?: RequestOptions): Promise<Page<VocabSummary>> {
  return toPage(await apiClient.get<Page<VocabSummary>>(`/vocab?${glossaryParams(input)}`, init), toVocabSummary);
}

export async function listMaxims(input: GlossaryQuery, init?: RequestOptions): Promise<Page<MaximSummary>> {
  return toPage(await apiClient.get<Page<MaximSummary>>(`/maxims?${glossaryParams(input)}`, init), toMaximSummary);
}
