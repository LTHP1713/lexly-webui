/**
 * Grade panel model (UI spec F4.2): the marks and feedback as typed, back into a `GradeRequest`,
 * the checks for Save draft and for Approve (which mirror the server's), and server errors onto
 * the two fields. Errors are keyed by request field (`finalMarks`, `finalFeedback`), which is also
 * what the server names.
 */
import { ApiError } from '@/api/client';
import { errorMessage } from '@/api/errors';
import { FEEDBACK_MAX, type Grade, type GradeRequest } from '@/api/grading';
import { formatMarks } from '@/lib/format';
import { parseServerErrors } from '@/pages/admin/contentForm';

export interface GradeForm {
  /** As typed; parsed and checked on save. */
  marks: string;
  feedback: string;
  /** The browser couldn't read the typed marks (e.g. "7,5"), so `marks` is `''` but isn't blank. */
  marksUnreadable?: boolean;
}

export type GradeErrors = Partial<Record<'finalMarks' | 'finalFeedback', string>>;

export function formFromGrade(grade: Grade): GradeForm {
  return {
    marks: grade.finalMarks === null ? '' : formatMarks(grade.finalMarks),
    feedback: grade.finalFeedback ?? '',
  };
}

export function requestFromGradeForm(form: GradeForm): GradeRequest {
  return {
    finalMarks: form.marks.trim() === '' ? null : Number(form.marks),
    finalFeedback: form.feedback.trim() ? form.feedback : null,
  };
}

/** What "unsaved changes" compares: the request the form would send. */
export function gradeSnapshot(form: GradeForm): string {
  return JSON.stringify(requestFromGradeForm(form));
}

export function marksRangeMessage(maxMarks: number): string {
  return `Enter marks from 0 to ${formatMarks(maxMarks)}, in whole or half marks.`;
}

/** 0 ≤ marks ≤ max, a multiple of 0.5 (`INVALID_MARKS` on the server). Blank is not an error here. */
export function gradeMarksError(value: string, maxMarks: number): string | null {
  if (value.trim() === '') return null;
  const marks = Number(value);
  if (!Number.isFinite(marks) || marks < 0 || marks > maxMarks || !Number.isInteger(marks * 2)) {
    return marksRangeMessage(maxMarks);
  }
  return null;
}

const FEEDBACK_TOO_LONG = 'Feedback must be at most 10,000 characters.';
export const MARKS_REQUIRED = 'Enter the marks.';
export const FEEDBACK_REQUIRED = 'Write feedback for the student.';

/** Save draft: either field may be blank, so a half-done grade can be saved. */
export function validateDraft(form: GradeForm, maxMarks: number): GradeErrors {
  const errors: GradeErrors = {};
  const marks = form.marksUnreadable ? marksRangeMessage(maxMarks) : gradeMarksError(form.marks, maxMarks);
  if (marks) errors.finalMarks = marks;
  if (form.feedback.length > FEEDBACK_MAX) errors.finalFeedback = FEEDBACK_TOO_LONG;
  return errors;
}

/** Approve: both are required, as on the server. */
export function validateApprove(form: GradeForm, maxMarks: number): GradeErrors {
  const errors = validateDraft(form, maxMarks);
  if (!errors.finalMarks && form.marks.trim() === '') errors.finalMarks = MARKS_REQUIRED;
  if (!errors.finalFeedback && !form.feedback.trim()) errors.finalFeedback = FEEDBACK_REQUIRED;
  return errors;
}

/**
 * A failed save or approve as field errors, or `null` when it has no field (the caller shows a
 * banner). Server reasons are replaced by the panel's own copy, never shown raw.
 */
export function gradeFieldErrors(err: unknown, maxMarks: number): GradeErrors | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === 'INVALID_MARKS') return { finalMarks: marksRangeMessage(maxMarks) };
  if (err.code !== 'VALIDATION_ERROR') return null;
  const parsed = parseServerErrors(err.message);
  const errors: GradeErrors = {};
  if (parsed.finalMarks) {
    errors.finalMarks = /null/i.test(parsed.finalMarks) ? MARKS_REQUIRED : marksRangeMessage(maxMarks);
  }
  if (parsed.finalFeedback) {
    errors.finalFeedback = /blank|null|empty/i.test(parsed.finalFeedback) ? FEEDBACK_REQUIRED : FEEDBACK_TOO_LONG;
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

/** The banner for an error without a field. */
export function gradeBanner(err: unknown): string {
  if (err instanceof ApiError && err.code === 'ASSESSMENT_NOT_EDITABLE') {
    return "This assessment was removed, so its answers can't be graded any more.";
  }
  return errorMessage(err);
}
