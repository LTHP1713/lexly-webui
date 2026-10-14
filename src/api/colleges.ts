/**
 * `/superadmin/colleges/**` and `/superadmin/admins/**` (contract §6, SUPERADMIN only). Colleges
 * are never deleted, only deactivated. Every response is `no-store` on the server.
 */
import { apiClient } from '@/api/client';
import type { Page } from '@/api/content';
import { toRole, type Role } from '@/auth/roles';

export interface CollegeCounts {
  admins: number;
  professors: number;
  students: number;
}

/** `CollegeSummary` and `CollegeDetail` have the same shape. */
export interface College {
  id: string;
  /** Upper case; immutable after creation because it is part of every college login. */
  code: string;
  name: string;
  active: boolean;
  counts: CollegeCounts;
  createdAt: string;
  updatedAt: string;
}

/** `UserSummary`, shared by every user list (contract §6.2). */
export interface UserSummary {
  id: string;
  fullName: string | null;
  email: string | null;
  role: Role | null;
  loginId: string | null;
  mustChangePassword: boolean;
  createdAt: string;
}

/** Mirrors `CreateCollegeRequest` / `CreateCollegeAdminRequest`. */
export const COLLEGE_LIMITS = {
  name: 255,
  fullName: 255,
  email: 255,
  passwordMin: 8,
} as const;

/** `[A-Za-z0-9]{2,20}` on the server, upper-cased before it is stored. */
export const COLLEGE_CODE_PATTERN = /^[A-Za-z0-9]{2,20}$/;

interface CollegeDto extends Omit<College, 'counts'> {
  counts: Partial<CollegeCounts> | null;
}

interface UserSummaryDto extends Omit<UserSummary, 'role'> {
  role: string | null;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export function toCollege(dto: CollegeDto): College {
  return {
    ...dto,
    counts: {
      admins: count(dto.counts?.admins),
      professors: count(dto.counts?.professors),
      students: count(dto.counts?.students),
    },
  };
}

export function toUserSummary(dto: UserSummaryDto): UserSummary {
  return {
    ...dto,
    fullName: dto.fullName?.trim() || null,
    email: dto.email?.trim() || null,
    role: toRole(dto.role),
    loginId: dto.loginId?.trim() || null,
    mustChangePassword: dto.mustChangePassword === true,
  };
}

/** The sort whitelist of `GET /superadmin/colleges` (anything else is a 400). */
export const COLLEGE_SORTS = ['name,asc', 'code,asc', 'createdAt,desc'] as const;
export type CollegeSort = (typeof COLLEGE_SORTS)[number];

export interface CollegeListQuery {
  q?: string;
  active?: boolean;
  page: number;
  size: number;
  sort: CollegeSort;
}

export async function listColleges(query: CollegeListQuery): Promise<Page<College>> {
  const params = new URLSearchParams({ page: String(query.page), size: String(query.size), sort: query.sort });
  if (query.q) params.set('q', query.q);
  if (query.active !== undefined) params.set('active', String(query.active));
  const page = await apiClient.get<Page<CollegeDto>>(`/superadmin/colleges?${params}`);
  return { ...page, content: (page.content ?? []).map(toCollege) };
}

const collegePath = (collegeId: string) => `/superadmin/colleges/${encodeURIComponent(collegeId)}`;

export async function getCollege(collegeId: string): Promise<College> {
  return toCollege(await apiClient.get<CollegeDto>(collegePath(collegeId)));
}

export async function createCollege(body: { code: string; name: string }): Promise<College> {
  return toCollege(await apiClient.post<CollegeDto>('/superadmin/colleges', body));
}

/** Both fields are required by the server, so a rename also sends the current `active`. */
export async function updateCollege(collegeId: string, body: { name: string; active: boolean }): Promise<College> {
  return toCollege(await apiClient.put<CollegeDto>(collegePath(collegeId), body));
}

/** A plain array, ordered by name. */
export async function listCollegeAdmins(collegeId: string): Promise<UserSummary[]> {
  return (await apiClient.get<UserSummaryDto[]>(`${collegePath(collegeId)}/admins`)).map(toUserSummary);
}

export async function createCollegeAdmin(
  collegeId: string,
  body: { fullName: string; email: string; temporaryPassword: string },
): Promise<UserSummary> {
  return toUserSummary(await apiClient.post<UserSummaryDto>(`${collegePath(collegeId)}/admins`, body));
}

/** Signs the admin out everywhere; they must change the password at their next sign-in. */
export function resetAdminPassword(userId: string, temporaryPassword: string) {
  return apiClient.post<void>(`/superadmin/admins/${encodeURIComponent(userId)}/reset-password`, { temporaryPassword });
}

export function removeAdmin(userId: string) {
  return apiClient.delete<void>(`/superadmin/admins/${encodeURIComponent(userId)}`);
}

/**
 * A random 12-character temporary password for the Generate button (UI spec F1.6), from the
 * Web Crypto RNG. No look-alike characters (0/O, 1/l/I), since it is read out or retyped.
 */
export function generateTemporaryPassword(length = 12): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}
