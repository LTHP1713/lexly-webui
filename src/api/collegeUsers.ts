/**
 * `/college/users/**` (contract §8.1–8.3, C_ADMIN only). The server scopes every call to the
 * caller's college, so no college id is ever sent; another college's user id (or a C_ADMIN's)
 * is a `404`. Every response is `no-store` on the server.
 */
import { apiClient } from '@/api/client';
import { toImportResult, type ImportResult } from '@/api/bulkImport';
import { toUserSummary, type UserSummary } from '@/api/colleges';
import type { Page } from '@/api/content';

/** The two roles a college admin manages. */
export type CollegeUserRole = 'C_STUDENT' | 'C_PROFESSOR';

/** The URL form of a role (`?role=professors`, `?kind=professors`, the import path). */
export type CollegeUserKind = 'students' | 'professors';

export const KIND_ROLES: Record<CollegeUserKind, CollegeUserRole> = {
  students: 'C_STUDENT',
  professors: 'C_PROFESSOR',
};

/** Anything but `professors` is the default, `students`. */
export function toUserKind(value: string | null): CollegeUserKind {
  return value === 'professors' ? 'professors' : 'students';
}

export function kindOf(role: CollegeUserRole | string | null): CollegeUserKind {
  return role === 'C_PROFESSOR' ? 'professors' : 'students';
}

/** What a role's login ID is called. */
export const LOGIN_ID_LABELS: Record<CollegeUserKind, string> = {
  students: 'Roll no',
  professors: 'Employee ID',
};

/** Mirrors `CreateCollegeUserRequest` / `UpdateCollegeUserRequest`. */
export const USER_LIMITS = { fullName: 255, email: 255, loginId: 50 } as const;

/** The sort whitelist of `GET /college/users` (anything else is a 400). */
export const USER_SORTS = ['fullName,asc', 'loginId,asc', 'createdAt,desc'] as const;
export type UserSort = (typeof USER_SORTS)[number];

export interface UserListQuery {
  role: CollegeUserRole;
  q?: string;
  page: number;
  size: number;
  sort?: UserSort;
}

type UserSummaryDto = Parameters<typeof toUserSummary>[0];

export async function listCollegeUsers(query: UserListQuery, signal?: AbortSignal): Promise<Page<UserSummary>> {
  const params = new URLSearchParams({ role: query.role, page: String(query.page), size: String(query.size) });
  if (query.q) params.set('q', query.q);
  if (query.sort) params.set('sort', query.sort);
  const page = await apiClient.get<Page<UserSummaryDto>>(`/college/users?${params}`, { signal });
  return { ...page, content: (page.content ?? []).map(toUserSummary) };
}

const userPath = (userId: string) => `/college/users/${encodeURIComponent(userId)}`;

export async function getCollegeUser(userId: string): Promise<UserSummary> {
  return toUserSummary(await apiClient.get<UserSummaryDto>(userPath(userId)));
}

export interface CollegeUserFields {
  fullName: string;
  email: string;
  loginId: string;
}

/** The first password is the login ID, and it must be changed at the first sign-in. */
export async function createCollegeUser(body: CollegeUserFields & { role: CollegeUserRole }): Promise<UserSummary> {
  return toUserSummary(await apiClient.post<UserSummaryDto>('/college/users', body));
}

/** Doesn't change the password or the role, even when `loginId` changes. */
export async function updateCollegeUser(userId: string, body: CollegeUserFields): Promise<UserSummary> {
  return toUserSummary(await apiClient.put<UserSummaryDto>(userPath(userId), body));
}

/** Back to the login ID with a forced change; signs the user out everywhere. */
export function resetCollegeUserPassword(userId: string) {
  return apiClient.post<void>(`${userPath(userId)}/reset-password`);
}

/** A hard delete (TDD §4.7). */
export function removeCollegeUser(userId: string) {
  return apiClient.delete<void>(userPath(userId));
}

/** Server limits for user imports (contract §8.2–8.3). */
export const USER_IMPORT_LIMITS = { maxBytes: 5 * 1024 * 1024, maxRows: 2000, extensions: ['.csv', '.xlsx'] } as const;

/**
 * `POST /college/users/import/{students|professors}`: one multipart `file` part, `.csv` or
 * `.xlsx`. Each row's `index` is its spreadsheet row number (the header is row 1) and `key` its
 * login ID. `IMPORT_FILE_INVALID` is a whole-file error.
 */
export async function importCollegeUsers(
  kind: CollegeUserKind,
  file: File,
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<ImportResult> {
  const body = new FormData();
  body.append('file', file);
  return toImportResult(await apiClient.upload<ImportResult>(`/college/users/import/${kind}`, body, options));
}

/**
 * The client checks of UI spec F2.6, before anything is uploaded: the extension, an empty file
 * and the 5 MB limit. Returns the message to show, or `null` when the file can be sent.
 */
export function checkUserImportFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!USER_IMPORT_LIMITS.extensions.some((extension) => name.endsWith(extension))) return 'Choose a .csv or .xlsx file.';
  if (file.size === 0) return 'This file is empty.';
  if (file.size > USER_IMPORT_LIMITS.maxBytes) return 'This file is larger than 5 MB. Split it into smaller files.';
  return null;
}
