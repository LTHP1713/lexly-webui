/**
 * Contract §11b bodies and MSW handlers for Vocab & Maxims. Pass a resolver to vary the response.
 */
import { API, http, json } from './server';

export function vocabEntry(term: string, overrides: Record<string, unknown> = {}) {
  return {
    term,
    definition: `Meaning of ${term}.`,
    source: { sectionId: `sec-${term.toLowerCase()}`, sectionNumber: '2(d)', actId: 'act-ica', actShortCode: 'ICA' },
    ...overrides,
  };
}

export function maximEntry(title: string, overrides: Record<string, unknown> = {}) {
  return {
    title,
    explanation: `Explanation of ${title}.`,
    source: { caseLawId: `case-${title.toLowerCase()}`, caseTitle: 'ADR v. Election Commission of India' },
    ...overrides,
  };
}

export function page<T>(content: T[], overrides: { page?: number; totalElements?: number; totalPages?: number } = {}) {
  return {
    content,
    page: overrides.page ?? 0,
    size: 20,
    totalElements: overrides.totalElements ?? content.length,
    totalPages: overrides.totalPages ?? (content.length > 0 ? 1 : 0),
  };
}

type Resolver = Parameters<typeof http.get>[1];

export const vocabHandler = (resolver: Resolver = () => json(page([vocabEntry('Consideration')]))) =>
  http.get(`${API}/vocab`, resolver);
export const maximsHandler = (resolver: Resolver = () => json(page([maximEntry('Proportionality')]))) =>
  http.get(`${API}/maxims`, resolver);
