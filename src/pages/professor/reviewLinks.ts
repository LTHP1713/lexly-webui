import type { ReviewOrder } from '@/api/assessments';

/** The grading order's labels (UI spec F4.3), shared by the grid and the review. */
export const ORDER_LABELS: Record<ReviewOrder, string> = { byStudent: 'By student', byQuestion: 'By question' };

/** The review URL: only ids and the order, never names or marks (plan §9 rule 3). */
export function answerReviewLink(answerId: string, order: ReviewOrder): string {
  return `/professor/answers/${encodeURIComponent(answerId)}?order=${order}`;
}

/** Back to the submissions grid in the same grading order. */
export function submissionsLink(assessmentId: string, order: ReviewOrder): string {
  return `/professor/assessments/${encodeURIComponent(assessmentId)}?order=${order}`;
}
