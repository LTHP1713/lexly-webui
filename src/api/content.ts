import { apiClient } from '@/api/client';

export interface ActSummary {
  id: string;
  title: string;
  shortCode: string | null;
}

export interface SectionSummary {
  id: string;
  sectionNumber: string;
  title: string | null;
}

export interface SectionIllustration {
  text: string;
  /** True for an example written by Lexly rather than one printed in the Act. */
  hypothetical: boolean;
}

/** Plain-language explanation of one clause, e.g. `(a)` "Proposal (offer)". */
export interface ProvisionMeaning {
  clause: string;
  title: string;
  explanation: string;
}

export interface SectionException {
  title: string;
  explanation: string;
  illustrations: SectionIllustration[];
}

export interface KeyLegalTerm {
  term: string;
  definition: string;
}

/**
 * UI model for `GET /sections/{id}`. All lists keep the backend's order (display_order) — do not
 * re-sort. Sections without study content yet simply have empty lists / a null summary.
 */
export interface SectionDetail {
  id: string;
  sectionNumber: string;
  title: string | null;
  bodyText: string;
  inSimpleWords: string | null;
  provisionMeaning: ProvisionMeaning[];
  illustrations: SectionIllustration[];
  exceptions: SectionException[];
  keyLegalTerms: KeyLegalTerm[];
  /** The act this section belongs to. */
  actId: string | null;
  actTitle: string | null;
  /** Neighbours in the act's natural order; null at the start/end of the act. */
  prev: SectionSummary | null;
  next: SectionSummary | null;
}

/** Raw response: the study-content fields may be absent or null for sections not enriched yet. */
interface SectionDetailDto {
  id?: string;
  sectionNumber: string;
  title: string | null;
  bodyText: string;
  actId?: string | null;
  actTitle?: string | null;
  prev?: SectionSummary | null;
  next?: SectionSummary | null;
  inSimpleWords?: string | null;
  provisionMeaning?: ProvisionMeaning[] | null;
  illustrations?: Partial<SectionIllustration>[] | null;
  exceptions?: (Omit<SectionException, 'illustrations'> & { illustrations?: Partial<SectionIllustration>[] | null })[] | null;
  keyLegalTerms?: KeyLegalTerm[] | null;
}

function toIllustrations(list: Partial<SectionIllustration>[] | null | undefined): SectionIllustration[] {
  return (list ?? [])
    .filter((item) => item.text?.trim())
    .map((item) => ({ text: item.text!.trim(), hypothetical: item.hypothetical === true }));
}

function toSectionDetail(dto: SectionDetailDto, fallbackId: string): SectionDetail {
  return {
    id: dto.id ?? fallbackId,
    sectionNumber: dto.sectionNumber,
    title: dto.title,
    bodyText: dto.bodyText ?? '',
    inSimpleWords: dto.inSimpleWords?.trim() || null,
    provisionMeaning: dto.provisionMeaning ?? [],
    illustrations: toIllustrations(dto.illustrations),
    exceptions: (dto.exceptions ?? []).map((ex) => ({
      title: ex.title,
      explanation: ex.explanation,
      illustrations: toIllustrations(ex.illustrations),
    })),
    keyLegalTerms: dto.keyLegalTerms ?? [],
    actId: dto.actId ?? null,
    actTitle: dto.actTitle ?? null,
    prev: dto.prev ?? null,
    next: dto.next ?? null,
  };
}

export interface SectionSearchHit extends SectionSummary {
  snippet: string;
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export function listActs() {
  return apiClient.get<ActSummary[]>('/acts');
}

const sectionNumberOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * Natural order by section number, the same order the backend uses: numeric part first, then
 * the letter suffix — 19 < 19A < 19AA < 19B < 20, not the string order 1, 10, 11, 2. Sections
 * without a leading number go last.
 */
export function compareSectionNumbers(a: string, b: string): number {
  if (!a || !b) return a ? -1 : b ? 1 : 0;
  return sectionNumberOrder.compare(a, b);
}

/** The backend returns natural order; the sort is kept as a safety net and must agree with it. */
export async function listSections(actId: string): Promise<SectionSummary[]> {
  const sections = await apiClient.get<SectionSummary[]>(`/acts/${encodeURIComponent(actId)}/sections`);
  return [...sections].sort((a, b) => compareSectionNumbers(a.sectionNumber, b.sectionNumber));
}

export async function getSection(sectionId: string): Promise<SectionDetail> {
  const dto = await apiClient.get<SectionDetailDto>(`/sections/${encodeURIComponent(sectionId)}`);
  return toSectionDetail(dto, sectionId);
}

export function searchSections(input: { query: string; page: number; size: number }) {
  const params = new URLSearchParams({
    q: input.query,
    page: String(input.page),
    size: String(input.size),
  });
  return apiClient.get<Page<SectionSearchHit>>(`/sections/search?${params}`);
}
