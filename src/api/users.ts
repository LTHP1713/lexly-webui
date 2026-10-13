/**
 * `/users/me/**` — the authenticated student's profile and learning progress. Only `GET /users/me`
 * exists in lexly-backend so far: the other request/response types below mirror the old
 * Home dashboard contract, which TDD v2 dropped (docs/Lexly-API-Contract.md §15), and each call is gated by a flag in
 * `src/config/features.ts`. Raw DTOs are mapped to UI models here so components never see
 * backend field quirks.
 */
import { apiClient } from '@/api/client';

// ---------- Current user ----------

export interface CurrentUserDto {
  id: string;
  email: string;
  /** Null when `fullName` is blank. */
  firstName: string | null;
  fullName: string | null;
  role?: string;
  /** ISO-8601 UTC, possibly with fractional seconds: parse with `new Date()`, never a fixed format. */
  createdAt?: string;
}

/** Also called by the session bootstrap (`src/api/auth.ts`), which doesn't check the feature flag. */
export function getCurrentUser() {
  return apiClient.get<CurrentUserDto>('/users/me');
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

// ---------- Bare act progress ----------

export interface BareActProgressDto {
  actId: string;
  actName: string;
  shortCode: string | null;
  totalSections: number;
  completedSections: number;
  completionPercentage: number;
  lastSectionId: string | null;
  lastSectionNumber: string | null;
  lastSectionTitle: string | null;
  lastAccessedAt: string | null;
}

export interface BareActProgressResponseDto {
  acts: BareActProgressDto[];
}

export interface BareActProgressItem {
  actId: string;
  actName: string;
  totalSections: number;
  completedSections: number;
  /** Whole-number percentage, clamped to 0–100. */
  percent: number;
  lastSection: { id: string; sectionNumber: string; title: string | null } | null;
}

export function toBareActProgressItems(dto: BareActProgressResponseDto): BareActProgressItem[] {
  return (dto.acts ?? []).map((act) => {
    const total = count(act.totalSections);
    const completed = Math.min(count(act.completedSections), total);
    return {
      actId: act.actId,
      actName: act.actName,
      totalSections: total,
      completedSections: completed,
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
      lastSection:
        act.lastSectionId && act.lastSectionNumber
          ? { id: act.lastSectionId, sectionNumber: act.lastSectionNumber, title: act.lastSectionTitle }
          : null,
    };
  });
}

export async function getBareActProgress(): Promise<BareActProgressItem[]> {
  return toBareActProgressItems(await apiClient.get<BareActProgressResponseDto>('/users/me/bare-act-progress'));
}

// ---------- Continue learning ----------

export type LearningContentType = 'SECTION' | 'CASE_LAW' | 'TOPIC';

export interface ContinueLearningDto {
  type: LearningContentType;
  id: string;
  subject: string | null;
  title: string;
  subtitle: string | null;
  progressPercentage: number | null;
  navigationPath: string | null;
  lastAccessedAt: string;
}

export interface ContinueLearningItem {
  type: LearningContentType;
  id: string;
  subject: string | null;
  title: string;
  subtitle: string | null;
  /** Null when progress isn't meaningful for this content type (e.g. a single case law). */
  percent: number | null;
  lastAccessedAt: string;
}

export function toContinueLearningItem(dto: ContinueLearningDto): ContinueLearningItem {
  return {
    type: dto.type,
    id: dto.id,
    subject: dto.subject,
    title: dto.title,
    subtitle: dto.subtitle,
    percent:
      typeof dto.progressPercentage === 'number'
        ? Math.max(0, Math.min(100, Math.round(dto.progressPercentage)))
        : null,
    lastAccessedAt: dto.lastAccessedAt,
  };
}

/** `204 No Content` means the student hasn't opened anything yet — mapped to `null`. */
export async function getContinueLearning(): Promise<ContinueLearningItem | null> {
  const dto = await apiClient.get<ContinueLearningDto | undefined>('/users/me/continue-learning');
  return dto ? toContinueLearningItem(dto) : null;
}

// ---------- Activity recording ----------

/**
 * Called when a section or case law detail screen is opened. Server-side this also upserts the
 * section's read/completion row, so the frontend makes one call, not two.
 */
export function recordLearningActivity(input: { contentType: LearningContentType; contentId: string }) {
  return apiClient.post<void>('/users/me/learning-activity', input);
}

export interface SectionProgressDto {
  sectionId: string;
  completed: boolean;
  completedAt: string | null;
}

/** Explicit mark-as-read / mark-as-unread (not used by the Home page yet). */
export function setSectionProgress(sectionId: string, completed: boolean) {
  return apiClient.put<SectionProgressDto>(`/users/me/sections/${encodeURIComponent(sectionId)}/progress`, {
    completed,
  });
}
