/**
 * `/admin/caselaws/**` — SUPERADMIN only (403 `FORBIDDEN` otherwise). There is no admin read
 * endpoint: admins load a case law (metadata and content) through `GET /caselaws/{id}`.
 */
import { apiClient } from '@/api/client';
import {
  toCaseLawDetail,
  type CaseLawDetail,
  type CaseLawImportance,
  type PartyType,
  type RelatedSection,
} from '@/api/caselaws';

/** Server-side `@Size` limits, mirrored by the admin forms. */
export const CASE_LAW_LIMITS = {
  title: 500,
  citation: 500,
  court: 255,
  caseNumber: 500,
  bench: 100,
  judges: 500,
  jurisdiction: 100,
  caseType: 100,
  sourcePdfUrl: 500,
} as const;

export const CONTENT_LIMITS = {
  issues: 50,
  arguments: 100,
  ratioDecidendi: 50,
  obiterDicta: 50,
  importantProvisions: 100,
  legalPrinciples: 50,
  outcome: 255,
  provisionLaw: 255,
  provisionName: 100,
  principleTitle: 255,
} as const;

/** Body of `POST /admin/caselaws` and `PUT /admin/caselaws/{id}`. Optional fields are sent as `null` when empty. */
export interface CaseLawMetadataRequest {
  title: string;
  citation: string | null;
  court: string | null;
  caseNumber: string | null;
  /** ISO date (`yyyy-MM-dd`). */
  decidedOn: string | null;
  bench: string | null;
  judges: string | null;
  jurisdiction: string | null;
  caseType: string | null;
  importance: CaseLawImportance;
  sourcePdfUrl: string | null;
}

export interface CaseLawAdmin extends CaseLawMetadataRequest {
  id: string;
  linkedSections: RelatedSection[];
  createdAt: string;
}

/**
 * Body of `PUT /admin/caselaws/{id}/content`: a full replace, so anything omitted is deleted.
 * Order is list position (issue numbers, per-party argument order, …); never send sequence fields.
 */
export interface CaseLawContentRequest {
  onlineSummary: string | null;
  background: string | null;
  finalHolding: { summary: string | null; outcome: string | null } | null;
  issues: { question: string; reasoning: string | null; finding: string | null }[];
  arguments: { partyType: PartyType; argument: string }[];
  ratioDecidendi: string[];
  obiterDicta: string[];
  importantProvisions: { law: string; provision: string; relevance: string | null }[];
  legalPrinciples: { title: string; explanation: string }[];
}

const path = (caseLawId: string) => `/admin/caselaws/${encodeURIComponent(caseLawId)}`;

export function createCaseLaw(body: CaseLawMetadataRequest) {
  return apiClient.post<CaseLawAdmin>('/admin/caselaws', body);
}

export function updateCaseLaw(caseLawId: string, body: CaseLawMetadataRequest) {
  return apiClient.put<CaseLawAdmin>(path(caseLawId), body);
}

/** Cascades to the case law's structured content and section links. */
export function deleteCaseLaw(caseLawId: string) {
  return apiClient.delete<void>(path(caseLawId));
}

/** Idempotent. Returns the case law's linked sections after the change (contract §5.4). */
export function linkSection(caseLawId: string, sectionId: string) {
  return apiClient.post<RelatedSection[]>(`${path(caseLawId)}/sections/${encodeURIComponent(sectionId)}`);
}

export function unlinkSection(caseLawId: string, sectionId: string) {
  return apiClient.delete<RelatedSection[]>(`${path(caseLawId)}/sections/${encodeURIComponent(sectionId)}`);
}

/** Returns the full read-side detail, used to refresh the editor after a save. */
export async function replaceCaseLawContent(caseLawId: string, body: CaseLawContentRequest): Promise<CaseLawDetail> {
  return toCaseLawDetail(await apiClient.put<CaseLawDetail>(`${path(caseLawId)}/content`, body));
}
