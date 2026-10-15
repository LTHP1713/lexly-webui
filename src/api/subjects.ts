/**
 * `/college/subjects/**` (contract §8.4). C_ADMIN manages its college's subjects; C_PROFESSOR
 * reads only the subjects it is mapped to, and C_STUDENT reads all of its college's. Out of
 * scope is a `404`. Lists are small, so they come back as plain arrays ordered by name.
 */
import { apiClient } from '@/api/client';

export interface SubjectProfessor {
  id: string;
  fullName: string | null;
}

export interface Subject {
  id: string;
  /** Upper case, unique within the college. */
  code: string;
  name: string;
  description: string | null;
  /** Ordered by name on the server. */
  professors: SubjectProfessor[];
  /** `0` until assessments exist (P3). */
  assessmentCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors `SubjectRequest`. */
export const SUBJECT_LIMITS = { code: 30, name: 255, description: 2000 } as const;

interface SubjectDto extends Omit<Subject, 'professors' | 'description' | 'assessmentCount'> {
  description: string | null;
  professors: SubjectProfessor[] | null;
  assessmentCount: number | null;
}

export function toSubject(dto: SubjectDto): Subject {
  return {
    ...dto,
    description: dto.description?.trim() ? dto.description : null,
    professors: (dto.professors ?? []).map((p) => ({ id: p.id, fullName: p.fullName?.trim() || null })),
    assessmentCount:
      typeof dto.assessmentCount === 'number' && dto.assessmentCount > 0 ? dto.assessmentCount : 0,
  };
}

export async function listSubjects(q?: string, signal?: AbortSignal): Promise<Subject[]> {
  const params = q ? `?${new URLSearchParams({ q })}` : '';
  return (await apiClient.get<SubjectDto[]>(`/college/subjects${params}`, { signal })).map(toSubject);
}

const subjectPath = (subjectId: string) => `/college/subjects/${encodeURIComponent(subjectId)}`;

export async function getSubject(subjectId: string, signal?: AbortSignal): Promise<Subject> {
  return toSubject(await apiClient.get<SubjectDto>(subjectPath(subjectId), { signal }));
}

export interface SubjectFields {
  code: string;
  name: string;
  description: string | null;
}

export async function createSubject(body: SubjectFields): Promise<Subject> {
  return toSubject(await apiClient.post<SubjectDto>('/college/subjects', body));
}

export async function updateSubject(subjectId: string, body: SubjectFields): Promise<Subject> {
  return toSubject(await apiClient.put<SubjectDto>(subjectPath(subjectId), body));
}

/** `409 SUBJECT_IN_USE` once the subject has assessments. */
export function deleteSubject(subjectId: string) {
  return apiClient.delete<void>(subjectPath(subjectId));
}

/** Replaces the whole mapping (`[]` clears it). */
export async function setSubjectProfessors(subjectId: string, professorIds: string[]): Promise<Subject> {
  return toSubject(await apiClient.put<SubjectDto>(`${subjectPath(subjectId)}/professors`, { professorIds }));
}
