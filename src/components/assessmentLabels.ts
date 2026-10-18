import type { AssessmentStatus, CellStatus, GradeStatus } from '@/api/assessments';
import { formatMarks } from '@/lib/format';

/** Display text for the assessment statuses (UI spec F3 `AssessmentStatusBadge`, list filter). */
export const ASSESSMENT_STATUS_LABELS: Record<AssessmentStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  CLOSED: 'Closed',
  REMOVED: 'Removed',
};

/** Display text for the submissions grid cells (UI spec F3.8). */
export const CELL_LABELS: Record<CellStatus, string> = {
  SUBMITTED: 'Submitted',
  UPLOADED: 'Uploaded',
  NOT_UPLOADED: 'Not uploaded',
  NOT_ATTEMPTED: 'Not attempted',
};

/** A submitted answer's grade in the grid (UI spec F4 `GradeStatusLabel`); F5 restyles the AI ones. */
export const GRADE_LABELS: Record<GradeStatus, string> = {
  PENDING: 'To grade',
  AI_EVALUATING: 'AI evaluating',
  AI_EVALUATED: 'AI evaluated',
  AI_FAILED: 'AI failed',
  PUBLISHED: 'Published',
};

/** The grid's grade-status filter options (F4.5); the AI ones arrive with F5. */
export const GRADE_FILTERS = ['PENDING', 'PUBLISHED'] as const satisfies readonly GradeStatus[];

/** The grade's words for an accessible name: "Published, 7.5 of 10" or "To grade". */
export function gradeStatusText(status: GradeStatus, finalMarks: number | null, maxMarks: number | null): string {
  if (status === 'PUBLISHED' && finalMarks !== null) {
    return `Published, ${formatMarks(finalMarks)}${maxMarks === null ? '' : ` of ${formatMarks(maxMarks)}`}`;
  }
  return GRADE_LABELS[status];
}
