/**
 * Universal search. The response type is the target `GET /search` contract
 * (docs/HOME_DASHBOARD_API_CONTRACT.md §B). Until that endpoint exists, `universalSearch` builds
 * the same shape by fanning out to the existing `/sections/search`, `/caselaws?q=` and `/acts`
 * endpoints. Switching over is the `backendFeatures.unifiedSearch` flag — callers don't change.
 */
import { listCaseLaws, importanceLabel } from '@/api/caselaws';
import { ApiError, apiClient } from '@/api/client';
import { listActs, searchSections, type ActSummary } from '@/api/content';
import { backendFeatures } from '@/config/features';
import { sectionLabel } from '@/pages/content/navigation';

export type SearchResultType = 'ACT' | 'SECTION' | 'CASE_LAW' | 'TOPIC' | 'QUESTION';

export interface SearchResult {
  id: string;
  title: string;
  subtitle: string | null;
  /** May contain `<b>…</b>` highlight markup only. */
  snippet: string | null;
  isFree: boolean;
  navigationPath: string | null;
}

export interface SearchGroup {
  type: SearchResultType;
  label: string;
  results: SearchResult[];
  /** Total matches for this type (may exceed `results.length`). */
  totalResults: number;
}

export interface UniversalSearchResponse {
  query: string;
  groups: SearchGroup[];
  totalResults: number;
  /**
   * Frontend-only: types whose source request failed during fan-out, so the UI can say so
   * instead of implying "no matches". Never set by the unified endpoint.
   */
  failedTypes?: SearchResultType[];
}

export const SEARCH_MIN_QUERY_LENGTH = 2;
export const SEARCH_LIMIT_PER_TYPE = 5;

export const searchTypeLabel: Record<SearchResultType, string> = {
  ACT: 'Bare Acts',
  SECTION: 'Sections',
  CASE_LAW: 'Case Laws',
  TOPIC: 'Topics',
  QUESTION: 'Questions',
};

export function universalSearch(query: string): Promise<UniversalSearchResponse> {
  const q = query.trim();
  if (backendFeatures.unifiedSearch) {
    const params = new URLSearchParams({ q, limit: String(SEARCH_LIMIT_PER_TYPE) });
    return apiClient.get<UniversalSearchResponse>(`/search?${params}`);
  }
  return fanOutSearch(q);
}

// ---------- Temporary fan-out adapter ----------

/** The act list is small and static per session — fetch it once rather than per keystroke. */
let actsPromise: Promise<ActSummary[]> | null = null;
function cachedActs(): Promise<ActSummary[]> {
  if (!actsPromise) {
    actsPromise = listActs().catch((err: unknown) => {
      actsPromise = null;
      throw err;
    });
  }
  return actsPromise;
}

function matchActs(acts: ActSummary[], q: string): ActSummary[] {
  const needle = q.toLowerCase();
  const scored = acts
    .map((act) => {
      const title = act.title.toLowerCase();
      const code = act.shortCode?.toLowerCase() ?? '';
      if (code === needle || title === needle) return { act, score: 0 };
      if (title.startsWith(needle) || code.startsWith(needle)) return { act, score: 1 };
      if (title.includes(needle) || code.includes(needle)) return { act, score: 2 };
      return null;
    })
    .filter((entry): entry is { act: ActSummary; score: number } => entry !== null);
  scored.sort((a, b) => a.score - b.score || a.act.title.localeCompare(b.act.title));
  return scored.map((entry) => entry.act);
}

async function fanOutSearch(q: string): Promise<UniversalSearchResponse> {
  const [sections, caseLaws, acts] = await Promise.allSettled([
    searchSections({ query: q, page: 0, size: SEARCH_LIMIT_PER_TYPE }),
    listCaseLaws({ query: q, page: 0, size: SEARCH_LIMIT_PER_TYPE }),
    cachedActs(),
  ]);

  const groups: SearchGroup[] = [];
  const failedTypes: SearchResultType[] = [];

  if (sections.status === 'fulfilled') {
    groups.push({
      type: 'SECTION',
      label: searchTypeLabel.SECTION,
      totalResults: sections.value.totalElements,
      results: sections.value.content.map((hit) => ({
        id: hit.id,
        title: sectionLabel(hit.sectionNumber, hit.title),
        // `/sections/search` doesn't return the act's name; the unified endpoint will.
        subtitle: null,
        snippet: hit.snippet || null,
        isFree: hit.isFree,
        navigationPath: `/sections/${hit.id}`,
      })),
    });
  } else failedTypes.push('SECTION');

  if (caseLaws.status === 'fulfilled') {
    groups.push({
      type: 'CASE_LAW',
      label: searchTypeLabel.CASE_LAW,
      totalResults: caseLaws.value.totalElements,
      results: caseLaws.value.content.map((c) => ({
        id: c.id,
        title: c.title,
        subtitle: [importanceLabel[c.importance], c.citation, c.court].filter(Boolean).join(' • ') || null,
        snippet: null,
        isFree: c.isFree,
        navigationPath: `/caselaws/${c.id}`,
      })),
    });
  } else failedTypes.push('CASE_LAW');

  if (acts.status === 'fulfilled') {
    const matched = matchActs(acts.value, q);
    groups.push({
      type: 'ACT',
      label: searchTypeLabel.ACT,
      totalResults: matched.length,
      results: matched.slice(0, SEARCH_LIMIT_PER_TYPE).map((act) => ({
        id: act.id,
        title: act.title,
        subtitle: act.shortCode,
        snippet: null,
        isFree: true,
        navigationPath: `/acts/${act.id}`,
      })),
    });
  } else failedTypes.push('ACT');

  // Every source failed: surface it as a real error rather than "no results".
  if (failedTypes.length === 3) {
    const first = [sections, caseLaws, acts].find((r) => r.status === 'rejected');
    const reason = first?.status === 'rejected' ? first.reason : undefined;
    throw reason instanceof ApiError
      ? reason
      : new ApiError('UNKNOWN_ERROR', 'Search is unavailable right now. Please try again.', 0);
  }

  const nonEmpty = groups.filter((g) => g.results.length > 0);
  return {
    query: q,
    groups: nonEmpty,
    totalResults: nonEmpty.reduce((sum, g) => sum + g.totalResults, 0),
    failedTypes: failedTypes.length ? failedTypes : undefined,
  };
}
