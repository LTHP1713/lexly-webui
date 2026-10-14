/**
 * `/admin/acts/**` and `/admin/sections/**` (contract §5.1–§5.2, SUPERADMIN only). The editors
 * load the admin read endpoints (`GET /admin/acts/{id}`, `GET /admin/sections/{id}`) so they edit
 * exactly what they `PUT`. A section `PUT` is a full replace, nested lists included, so the
 * per-item illustration / exception endpoints (§5.3) aren't used.
 */
import { apiClient } from '@/api/client';
import { getSection, listActs, listSections } from '@/api/content';

/** Server-side `@Size` limits, mirrored by the forms. */
export const ACT_LIMITS = { title: 255, shortCode: 50 } as const;

export const SECTION_LIMITS = {
  sectionNumber: 20,
  title: 500,
  provisionMeaning: 100,
  clause: 20,
  clauseTitle: 300,
  illustrations: 50,
  exceptions: 50,
  exceptionTitle: 300,
  exceptionIllustrations: 50,
  keyLegalTerms: 100,
  term: 200,
} as const;

// ---------- Acts ----------

/** Body of `POST /admin/acts` and `PUT /admin/acts/{id}`. `PUT` replaces `description` too. */
export interface ActRequest {
  title: string;
  shortCode: string | null;
  description: string | null;
}

export interface ActAdmin extends ActRequest {
  id: string;
  createdAt: string;
}

function toActAdmin(dto: ActAdmin): ActAdmin {
  return {
    id: dto.id,
    title: dto.title,
    shortCode: dto.shortCode?.trim() || null,
    description: dto.description?.trim() ? dto.description : null,
    createdAt: dto.createdAt,
  };
}

const actPath = (actId: string) => `/admin/acts/${encodeURIComponent(actId)}`;

export async function getAdminAct(actId: string): Promise<ActAdmin> {
  return toActAdmin(await apiClient.get<ActAdmin>(actPath(actId), { cache: 'no-store' }));
}

export async function createAct(body: ActRequest): Promise<ActAdmin> {
  return toActAdmin(await apiClient.post<ActAdmin>('/admin/acts', body));
}

export async function updateAct(actId: string, body: ActRequest): Promise<ActAdmin> {
  return toActAdmin(await apiClient.put<ActAdmin>(actPath(actId), body));
}

/** Cascades to the act's sections, their study content and their case-law links. */
export function deleteAct(actId: string) {
  return apiClient.delete<void>(actPath(actId));
}

// ---------- Sections ----------

export interface IllustrationInput {
  text: string;
  /** True = written by Lexly; false = printed in the Act. */
  hypothetical: boolean;
}

/**
 * Body of `POST /admin/acts/{actId}/sections` and `PUT /admin/sections/{id}`. `displayOrder` is
 * the list position, sent explicitly so the order never depends on the server's default.
 */
export interface SectionRequest {
  sectionNumber: string;
  title: string | null;
  bodyText: string;
  inSimpleWords: string | null;
  provisionMeaning: { clause: string | null; title: string | null; explanation: string; displayOrder: number }[];
  illustrations: (IllustrationInput & { displayOrder: number })[];
  exceptions: { title: string | null; explanation: string; displayOrder: number; illustrations: IllustrationInput[] }[];
  keyLegalTerms: { term: string; definition: string; displayOrder: number }[];
}

/** UI model of `AdminSectionResponse`: item ids and `sectionId`s dropped, lists in display order. */
export interface AdminSection {
  id: string;
  actId: string;
  sectionNumber: string;
  title: string | null;
  bodyText: string;
  inSimpleWords: string | null;
  provisionMeaning: { clause: string | null; title: string | null; explanation: string }[];
  illustrations: IllustrationInput[];
  exceptions: { title: string | null; explanation: string; illustrations: IllustrationInput[] }[];
  keyLegalTerms: { term: string; definition: string }[];
}

interface IllustrationDto {
  text: string | null;
  hypothetical: boolean | null;
}

interface AdminSectionDto {
  id: string;
  bareActId: string;
  sectionNumber: string;
  title: string | null;
  bodyText: string | null;
  inSimpleWords: string | null;
  provisionMeaning: { clause: string | null; title: string | null; explanation: string | null }[] | null;
  illustrations: IllustrationDto[] | null;
  exceptions: { title: string | null; explanation: string | null; illustrations: IllustrationDto[] | null }[] | null;
  keyLegalTerms: { term: string | null; definition: string | null }[] | null;
}

function toIllustrations(list: IllustrationDto[] | null): IllustrationInput[] {
  return (list ?? []).map((item) => ({ text: item.text ?? '', hypothetical: item.hypothetical === true }));
}

export function toAdminSection(dto: AdminSectionDto): AdminSection {
  return {
    id: dto.id,
    actId: dto.bareActId,
    sectionNumber: dto.sectionNumber,
    title: dto.title ?? null,
    bodyText: dto.bodyText ?? '',
    inSimpleWords: dto.inSimpleWords ?? null,
    provisionMeaning: (dto.provisionMeaning ?? []).map((p) => ({
      clause: p.clause ?? null,
      title: p.title ?? null,
      explanation: p.explanation ?? '',
    })),
    illustrations: toIllustrations(dto.illustrations),
    exceptions: (dto.exceptions ?? []).map((ex) => ({
      title: ex.title ?? null,
      explanation: ex.explanation ?? '',
      illustrations: toIllustrations(ex.illustrations),
    })),
    keyLegalTerms: (dto.keyLegalTerms ?? []).map((t) => ({ term: t.term ?? '', definition: t.definition ?? '' })),
  };
}

const sectionPath = (sectionId: string) => `/admin/sections/${encodeURIComponent(sectionId)}`;

export async function getAdminSection(sectionId: string): Promise<AdminSection> {
  return toAdminSection(await apiClient.get<AdminSectionDto>(sectionPath(sectionId), { cache: 'no-store' }));
}

export async function createSection(actId: string, body: SectionRequest): Promise<AdminSection> {
  return toAdminSection(await apiClient.post<AdminSectionDto>(`${actPath(actId)}/sections`, body));
}

export async function updateSection(sectionId: string, body: SectionRequest): Promise<AdminSection> {
  return toAdminSection(await apiClient.put<AdminSectionDto>(sectionPath(sectionId), body));
}

/** Deletes its illustrations, exceptions and study content; linked case laws lose the link. */
export function deleteSection(sectionId: string) {
  return apiClient.delete<void>(sectionPath(sectionId));
}

// ---------- Reader cache ----------

/**
 * `/acts`, `/acts/{id}/sections` and `/sections/{id}` are cached for 5 minutes. After an admin
 * write, refetch them past the cache (`reload` overwrites the entry), so the reader shows the
 * change at once on this browser.
 */
export function refreshReaderCache(target: { actList?: boolean; actId?: string; sectionId?: string }) {
  const reload = { cache: 'reload' } as const;
  if (target.actList) void listActs(reload).catch(() => undefined);
  if (target.actId) void listSections(target.actId, reload).catch(() => undefined);
  if (target.sectionId) void getSection(target.sectionId, reload).catch(() => undefined);
}
