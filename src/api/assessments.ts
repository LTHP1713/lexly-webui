/**
 * Types and mappers shared by the professor and student assessment modules (contract §9.1).
 * Marks come as JSON numbers with one decimal (`10.0` arrives as `10`); missing values are kept
 * as `null` because a draft may still lack them.
 */

export const ASSESSMENT_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED', 'REMOVED'] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const STUDENT_STATES = ['OPEN', 'PARTIALLY_SUBMITTED', 'SUBMITTED', 'CLOSED', 'RESULTS_AVAILABLE'] as const;
export type StudentAssessmentState = (typeof STUDENT_STATES)[number];

/** A grid cell (contract §9.5). `NOT_ATTEMPTED` only once the assessment is closed or removed. */
export const CELL_STATUSES = ['SUBMITTED', 'UPLOADED', 'NOT_UPLOADED', 'NOT_ATTEMPTED'] as const;
export type CellStatus = (typeof CELL_STATUSES)[number];

export type AnswerStatus = 'UPLOADED' | 'SUBMITTED';

export interface SubjectRef {
  id: string;
  code: string;
  name: string;
}

/** Unknown values fall back to the first entry, so a new backend value never breaks a screen. */
export function oneOf<T extends string>(values: readonly T[], value: unknown): T {
  return typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : values[0];
}

export function toSubjectRef(dto: Partial<SubjectRef> | null | undefined): SubjectRef {
  return { id: dto?.id ?? '', code: dto?.code ?? '', name: dto?.name ?? '' };
}

/** A number or `null` (never `NaN`). */
export function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function count(value: unknown): number {
  return toNumber(value) ?? 0;
}

export function blankToNull(value: string | null | undefined): string | null {
  return value?.trim() ? value : null;
}

/** A string field of a loosely typed DTO, or null. */
export function stringField(dto: Record<string, unknown>, key: string): string | null {
  return typeof dto[key] === 'string' ? (dto[key] as string) : null;
}
