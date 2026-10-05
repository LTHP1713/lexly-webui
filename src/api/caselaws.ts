import { ApiError, apiClient } from '@/api/client';
import type { Page } from '@/api/content';

export type CaseLawImportance = 'LANDMARK' | 'IMPORTANT' | 'STANDARD';

export interface CaseLawSummary {
  id: string;
  title: string;
  citation: string | null;
  court: string | null;
  importance: CaseLawImportance;
  isFree: boolean;
}

export interface CaseSummaryText {
  facts: string | null;
  issues: string | null;
  held: string | null;
  analysis: string | null;
}

export interface RelatedSection {
  id: string;
  sectionNumber: string;
  title: string | null;
  isFree: boolean;
}

export interface CaseLawDetail extends CaseLawSummary {
  /** ISO date (`yyyy-MM-dd`). */
  decidedOn: string | null;
  sourcePdfUrl: string | null;
  summary: CaseSummaryText | null;
  relatedSections: RelatedSection[];
}

/** The teaser fields the backend flattens into its 403 `PRO_REQUIRED` body for a locked case. */
export interface LockedCaseLawTeaser {
  id: string;
  title: string;
  citation: string | null;
  court: string | null;
  importance: CaseLawImportance | null;
  message: string;
}

export type CaseLawResult =
  | { access: 'full'; caseLaw: CaseLawDetail }
  | { access: 'locked'; teaser: LockedCaseLawTeaser };

export function listCaseLaws(input: {
  query?: string;
  importance?: CaseLawImportance;
  sectionId?: string;
  page: number;
  size: number;
}) {
  const params = new URLSearchParams({ page: String(input.page), size: String(input.size) });
  if (input.query) params.set('q', input.query);
  if (input.importance) params.set('importance', input.importance);
  if (input.sectionId) params.set('sectionId', input.sectionId);
  return apiClient.get<Page<CaseLawSummary>>(`/caselaws?${params}`);
}

/** Same gating pattern as `getSection`: a 403 `PRO_REQUIRED` is a `locked` result, not a failure. */
export async function getCaseLaw(caseLawId: string): Promise<CaseLawResult> {
  try {
    const caseLaw = await apiClient.get<CaseLawDetail>(`/caselaws/${encodeURIComponent(caseLawId)}`);
    return { access: 'full', caseLaw: { ...caseLaw, relatedSections: caseLaw.relatedSections ?? [] } };
  } catch (err) {
    if (err instanceof ApiError && err.status === 403 && err.code === 'PRO_REQUIRED') {
      const body = (err.body ?? {}) as Partial<LockedCaseLawTeaser>;
      return {
        access: 'locked',
        teaser: {
          id: body.id ?? caseLawId,
          title: body.title ?? 'Case law',
          citation: body.citation ?? null,
          court: body.court ?? null,
          importance: body.importance ?? null,
          message: err.message,
        },
      };
    }
    throw err;
  }
}

export const importanceLabel: Record<CaseLawImportance, string> = {
  LANDMARK: 'Landmark',
  IMPORTANT: 'Important',
  STANDARD: 'Standard',
};
