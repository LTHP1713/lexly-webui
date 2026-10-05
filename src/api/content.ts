import { ApiError, apiClient } from '@/api/client';

export interface ActSummary {
  id: string;
  title: string;
  shortCode: string | null;
}

export interface SectionSummary {
  id: string;
  sectionNumber: string;
  title: string | null;
  isFree: boolean;
}

export interface SectionEntry {
  id: string;
  text: string;
}

export interface SectionDetail {
  id: string;
  sectionNumber: string;
  title: string | null;
  bodyText: string;
  /** Already ordered by the backend (display_order) — do not re-sort. */
  illustrations: SectionEntry[];
  /** Already ordered by the backend (display_order) — do not re-sort. */
  exceptions: SectionEntry[];
}

/** The teaser fields the backend flattens into its 403 `PRO_REQUIRED` body for a locked section. */
export interface LockedSectionTeaser {
  id: string;
  sectionNumber: string;
  title: string | null;
  message: string;
}

export type SectionResult =
  | { access: 'full'; section: SectionDetail }
  | { access: 'locked'; teaser: LockedSectionTeaser };

/**
 * Known backend gap: `snippet` is currently returned in full even for locked (`isFree: false`)
 * results — the intended redaction isn't implemented. Render whatever comes back.
 */
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

export function listSections(actId: string) {
  return apiClient.get<SectionSummary[]>(`/acts/${encodeURIComponent(actId)}/sections`);
}

/**
 * A 403 `PRO_REQUIRED` here is an expected outcome, not a failure: it is turned into a
 * `locked` result carrying the teaser so the detail screen can render an upsell.
 */
export async function getSection(sectionId: string): Promise<SectionResult> {
  try {
    const section = await apiClient.get<SectionDetail>(`/sections/${encodeURIComponent(sectionId)}`);
    return { access: 'full', section };
  } catch (err) {
    if (err instanceof ApiError && err.status === 403 && err.code === 'PRO_REQUIRED') {
      const body = (err.body ?? {}) as Partial<LockedSectionTeaser>;
      return {
        access: 'locked',
        teaser: {
          id: body.id ?? sectionId,
          sectionNumber: body.sectionNumber ?? '',
          title: body.title ?? null,
          message: err.message,
        },
      };
    }
    throw err;
  }
}

export function searchSections(input: { query: string; page: number; size: number }) {
  const params = new URLSearchParams({
    q: input.query,
    page: String(input.page),
    size: String(input.size),
  });
  return apiClient.get<Page<SectionSearchHit>>(`/sections/search?${params}`);
}
