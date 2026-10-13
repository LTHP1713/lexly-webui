import { apiClient, type RequestOptions } from '@/api/client';
import type { Page } from '@/api/content';

export type CaseLawImportance = 'LANDMARK' | 'IMPORTANT' | 'STANDARD';

export interface CaseLawSummary {
  id: string;
  title: string;
  citation: string | null;
  court: string | null;
  importance: CaseLawImportance;
  /**
   * Names of the Acts the case deals with. Not sent by `GET /caselaws` yet: until it is, the list
   * derives them from the detail via `caseLawActs`.
   */
  acts?: string[];
}

export interface RelatedSection {
  id: string;
  sectionNumber: string;
  title: string | null;
}

/** The party types the backend knows today; `arguments` keys are typed as `string` so a new one still renders. */
export type PartyType = 'PETITIONER' | 'APPELLANT' | 'RESPONDENT' | 'STATE' | 'INTERVENOR' | 'AMICUS';

export const PARTY_TYPES: PartyType[] = ['PETITIONER', 'APPELLANT', 'RESPONDENT', 'STATE', 'INTERVENOR', 'AMICUS'];

export interface CaseIssue {
  /** 1-based, derived server-side from list position. */
  issueNumber: number;
  question: string;
  reasoning: string | null;
  finding: string | null;
}

export interface FinalHolding {
  summary: string | null;
  /** Usually a code like `SIR_UPHELD_WITH_DIRECTIONS`; display through `humanizeCode`. */
  outcome: string | null;
}

export interface ImportantProvision {
  law: string;
  provision: string;
  relevance: string | null;
}

export interface LegalPrinciple {
  title: string;
  explanation: string;
}

export interface CaseLawDetail extends CaseLawSummary {
  caseNumber: string | null;
  /** ISO date (`yyyy-MM-dd`). */
  decidedOn: string | null;
  bench: string | null;
  /** One display string, e.g. "Surya Kant, CJI; Joymalya Bagchi, J." */
  judges: string | null;
  jurisdiction: string | null;
  /** Usually a code like `WRIT_PETITION`; display through `caseTypeLabel`. */
  caseType: string | null;
  sourcePdfUrl: string | null;
  onlineSummary: string | null;
  background: string | null;
  issues: CaseIssue[];
  /**
   * Keyed by party, in the backend's display order (object key order is preserved — never
   * re-sort). Only parties with arguments are present; each list is already ordered.
   */
  arguments: Record<string, string[]>;
  finalHolding: FinalHolding | null;
  ratioDecidendi: string[];
  obiterDicta: string[];
  importantProvisions: ImportantProvision[];
  legalPrinciples: LegalPrinciple[];
  relatedSections: RelatedSection[];
}

/**
 * `init` lets the admin screens pass `{ cache: 'no-cache' }`: content GETs are browser-cached for
 * 5 minutes, and an admin must see their own edits immediately.
 */
export function listCaseLaws(
  input: {
    query?: string;
    importance?: CaseLawImportance;
    sectionId?: string;
    page: number;
    size: number;
  },
  init?: RequestOptions,
) {
  const params = new URLSearchParams({ page: String(input.page), size: String(input.size) });
  if (input.query) params.set('q', input.query);
  if (input.importance) params.set('importance', input.importance);
  if (input.sectionId) params.set('sectionId', input.sectionId);
  return apiClient.get<Page<CaseLawSummary>>(`/caselaws?${params}`, init);
}

function text(value: string | null | undefined): string | null {
  return value?.trim() ? value : null;
}

function texts(values: (string | null)[] | null | undefined): string[] {
  return (values ?? []).filter((value): value is string => Boolean(value?.trim()));
}

/**
 * The backend guarantees lists are present, but a blank string or an empty party list would
 * still render an empty heading, so blanks are normalized away here: a blank scalar becomes
 * `null`, and empty entries / parties / holdings are dropped.
 */
export function toCaseLawDetail(dto: CaseLawDetail): CaseLawDetail {
  const argumentsByParty: Record<string, string[]> = {};
  for (const [party, list] of Object.entries(dto.arguments ?? {})) {
    const cleaned = texts(list);
    if (cleaned.length > 0) argumentsByParty[party] = cleaned;
  }
  const holding = dto.finalHolding
    ? { summary: text(dto.finalHolding.summary), outcome: text(dto.finalHolding.outcome) }
    : null;

  return {
    ...dto,
    citation: text(dto.citation),
    court: text(dto.court),
    caseNumber: text(dto.caseNumber),
    decidedOn: text(dto.decidedOn),
    bench: text(dto.bench),
    judges: text(dto.judges),
    jurisdiction: text(dto.jurisdiction),
    caseType: text(dto.caseType),
    sourcePdfUrl: text(dto.sourcePdfUrl),
    onlineSummary: text(dto.onlineSummary),
    background: text(dto.background),
    issues: (dto.issues ?? [])
      .filter((issue) => issue.question?.trim())
      .map((issue) => ({ ...issue, reasoning: text(issue.reasoning), finding: text(issue.finding) })),
    arguments: argumentsByParty,
    finalHolding: holding && (holding.summary || holding.outcome) ? holding : null,
    ratioDecidendi: texts(dto.ratioDecidendi),
    obiterDicta: texts(dto.obiterDicta),
    importantProvisions: (dto.importantProvisions ?? []).map((p) => ({ ...p, relevance: text(p.relevance) })),
    legalPrinciples: dto.legalPrinciples ?? [],
    relatedSections: dto.relatedSections ?? [],
  };
}

export async function getCaseLaw(caseLawId: string, init?: RequestOptions): Promise<CaseLawDetail> {
  return toCaseLawDetail(await apiClient.get<CaseLawDetail>(`/caselaws/${encodeURIComponent(caseLawId)}`, init));
}

/** Distinct Act names from a case's important provisions, in first-seen order. */
export function caseLawActs(caseLaw: Pick<CaseLawDetail, 'importantProvisions'>): string[] {
  const seen = new Map<string, string>();
  for (const { law } of caseLaw.importantProvisions) {
    const name = law?.trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()];
}

export const importanceLabel: Record<CaseLawImportance, string> = {
  LANDMARK: 'Landmark',
  IMPORTANT: 'Important',
  STANDARD: 'Standard',
};
