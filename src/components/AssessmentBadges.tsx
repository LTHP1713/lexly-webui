import type { AssessmentStatus, CellStatus, GradeStatus, StudentAssessmentState } from '@/api/assessments';
import { formatMarks } from '@/lib/format';
import { ASSESSMENT_STATUS_LABELS, CELL_LABELS, GRADE_LABELS } from './assessmentLabels';
import { StatusBadge, type BadgeTone } from './StatusBadge';
import styles from './Assessment.module.css';

const ASSESSMENT_STATUS_TONES: Record<AssessmentStatus, BadgeTone> = {
  DRAFT: 'neutral',
  PUBLISHED: 'info',
  CLOSED: 'neutral',
  REMOVED: 'danger',
};

/** UI spec F3 shared components. */
export function AssessmentStatusBadge({ status }: { status: AssessmentStatus }) {
  return <StatusBadge tone={ASSESSMENT_STATUS_TONES[status]}>{ASSESSMENT_STATUS_LABELS[status]}</StatusBadge>;
}

const STATE_BADGES: Record<StudentAssessmentState, [BadgeTone, string]> = {
  OPEN: ['info', 'Open'],
  PARTIALLY_SUBMITTED: ['warning', 'In progress'],
  SUBMITTED: ['success', 'All submitted'],
  CLOSED: ['neutral', 'Closed'],
  RESULTS_AVAILABLE: ['success', 'Results available'],
};

export function StudentStateBadge({ state }: { state: StudentAssessmentState }) {
  const [tone, label] = STATE_BADGES[state];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

const CELL_ICONS: Record<CellStatus, string> = {
  SUBMITTED: '✓',
  UPLOADED: '◐',
  NOT_UPLOADED: '○',
  NOT_ATTEMPTED: '✕',
};

/** A grid cell: an icon and its text, so the colour is never the only signal. */
export function CellStatusLabel({ status, title }: { status: CellStatus; title?: string }) {
  return (
    <span className={`${styles.cell} ${styles[`cell_${status}`]}`} title={title}>
      <span aria-hidden="true" className={styles.cellIcon}>
        {CELL_ICONS[status]}
      </span>
      {CELL_LABELS[status]}
    </span>
  );
}

/**
 * A submitted answer's grade (UI spec F4 `GradeStatusLabel`): "To grade", or the published
 * marks out of the maximum with "Published" in the `title`. Icon + text, never colour alone.
 */
export function GradeStatusLabel({
  status,
  finalMarks,
  maxMarks,
}: {
  status: GradeStatus;
  finalMarks: number | null;
  maxMarks: number | null;
}) {
  const published = status === 'PUBLISHED';
  const text =
    published && finalMarks !== null
      ? `${formatMarks(finalMarks)} / ${maxMarks === null ? '—' : formatMarks(maxMarks)}`
      : GRADE_LABELS[status];
  return (
    <span className={`${styles.cell} ${styles[`grade_${status}`]}`} title={published ? 'Published' : undefined}>
      <span aria-hidden="true" className={styles.cellIcon}>
        {published ? '✓' : '●'}
      </span>
      {text}
    </span>
  );
}
