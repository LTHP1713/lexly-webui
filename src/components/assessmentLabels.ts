import type { AssessmentStatus, CellStatus } from '@/api/assessments';

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
