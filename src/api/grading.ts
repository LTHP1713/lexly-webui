/**
 * `/professor/answers/**` (contract §10.1–10.3, C_PROFESSOR only): one submitted answer of the
 * professor's own assessment, its grade, history and neighbours. Anything else (not submitted,
 * another professor's, a removed professor's) is a `404`. Answers of a removed assessment can be
 * read but not graded (`409 ASSESSMENT_NOT_EDITABLE`). Approve = publish: the student sees it at
 * once and it is final (`409 GRADE_PUBLISHED` afterwards).
 *
 * `grade.ai` is not mapped yet; F5 adds it.
 */
import { apiClient } from '@/api/client';
import {
  ASSESSMENT_STATUSES,
  GRADE_STATUSES,
  blankToNull,
  count,
  oneOf,
  toNumber,
  type AssessmentStatus,
  type GradeStatus,
  type ReviewOrder,
} from '@/api/assessments';
import { toRole, type Role } from '@/auth/roles';

/** Mirrors `GradeRequest`'s `@Size`. */
export const FEEDBACK_MAX = 10_000;

export interface Grade {
  status: GradeStatus;
  /** One decimal; the draft value until published. */
  finalMarks: number | null;
  finalFeedback: string | null;
  /** The approving professor; `null` before approval or once they were removed. */
  gradedBy: { id: string; fullName: string | null } | null;
  publishedAt: string | null;
}

export const HISTORY_EVENTS = ['DRAFT_SAVED', 'AI_EVALUATED', 'AI_FAILED', 'PUBLISHED'] as const;
export type HistoryEvent = (typeof HISTORY_EVENTS)[number];

export interface GradeHistoryEntry {
  event: HistoryEvent;
  /** The values saved by this event. */
  marks: number | null;
  feedback: string | null;
  /** `null` for AI results and removed users. */
  actor: { id: string; fullName: string | null; role: Role | null } | null;
  createdAt: string | null;
}

export interface AnswerReview {
  id: string;
  assessment: { id: string; title: string; status: AssessmentStatus };
  question: { id: string; position: number; text: string | null; maxMarks: number; wordLimit: number | null };
  student: { id: string; fullName: string | null; loginId: string | null };
  file: { originalFilename: string; sizeBytes: number; pageCount: number };
  submittedAt: string | null;
  /** Set by the first PDF download; enables AI Evaluate (F5). */
  professorDownloadedAt: string | null;
  grade: Grade;
  /** Oldest first. */
  history: GradeHistoryEntry[];
  /** Within the assessment in the requested order; each `null` at the end (no wrap-around). */
  navigation: { previousAnswerId: string | null; nextAnswerId: string | null; nextUngradedAnswerId: string | null };
}

type GradeDto = Partial<Omit<Grade, 'status'>> & { status?: string };

export function toGrade(dto: GradeDto | null | undefined): Grade {
  return {
    status: oneOf(GRADE_STATUSES, dto?.status),
    finalMarks: toNumber(dto?.finalMarks),
    finalFeedback: blankToNull(dto?.finalFeedback),
    gradedBy: dto?.gradedBy?.id ? { id: dto.gradedBy.id, fullName: blankToNull(dto.gradedBy.fullName) } : null,
    publishedAt: dto?.publishedAt ?? null,
  };
}

type ReviewDto = {
  id?: string;
  assessment?: { id?: string; title?: string; status?: string } | null;
  question?: Partial<AnswerReview['question']> | null;
  student?: Partial<AnswerReview['student']> | null;
  file?: Partial<AnswerReview['file']> | null;
  submittedAt?: string | null;
  professorDownloadedAt?: string | null;
  grade?: GradeDto | null;
  history?: (Omit<Partial<GradeHistoryEntry>, 'event' | 'actor'> & {
    event?: string;
    actor?: { id?: string; fullName?: string | null; role?: string | null } | null;
  })[] | null;
  navigation?: Partial<AnswerReview['navigation']> | null;
};

export function toAnswerReview(dto: ReviewDto): AnswerReview {
  return {
    id: dto.id ?? '',
    assessment: {
      id: dto.assessment?.id ?? '',
      title: dto.assessment?.title ?? '',
      status: oneOf(ASSESSMENT_STATUSES, dto.assessment?.status),
    },
    question: {
      id: dto.question?.id ?? '',
      position: toNumber(dto.question?.position) ?? 1,
      text: blankToNull(dto.question?.text),
      maxMarks: count(dto.question?.maxMarks),
      wordLimit: toNumber(dto.question?.wordLimit),
    },
    student: {
      id: dto.student?.id ?? '',
      fullName: blankToNull(dto.student?.fullName),
      loginId: blankToNull(dto.student?.loginId),
    },
    file: {
      originalFilename: dto.file?.originalFilename?.trim() || 'answer.pdf',
      sizeBytes: count(dto.file?.sizeBytes),
      pageCount: count(dto.file?.pageCount),
    },
    submittedAt: dto.submittedAt ?? null,
    professorDownloadedAt: dto.professorDownloadedAt ?? null,
    grade: toGrade(dto.grade),
    history: (dto.history ?? []).map((entry) => ({
      event: oneOf(HISTORY_EVENTS, entry.event),
      marks: toNumber(entry.marks),
      feedback: blankToNull(entry.feedback),
      actor: entry.actor?.id
        ? { id: entry.actor.id, fullName: blankToNull(entry.actor.fullName), role: toRole(entry.actor.role) }
        : null,
      createdAt: entry.createdAt ?? null,
    })),
    navigation: {
      previousAnswerId: dto.navigation?.previousAnswerId ?? null,
      nextAnswerId: dto.navigation?.nextAnswerId ?? null,
      nextUngradedAnswerId: dto.navigation?.nextUngradedAnswerId ?? null,
    },
  };
}

const answerPath = (answerId: string) => `/professor/answers/${encodeURIComponent(answerId)}`;

export async function getAnswerReview(answerId: string, order: ReviewOrder, signal?: AbortSignal): Promise<AnswerReview> {
  return toAnswerReview(await apiClient.get<ReviewDto>(`${answerPath(answerId)}?order=${order}`, { signal }));
}

/** Streams the PDF; the first call sets `professorDownloadedAt`. */
export function answerReviewFilePath(answerId: string) {
  return `${answerPath(answerId)}/file`;
}

/** Both fields replace what is saved (an omitted one becomes `null`), for a draft and for approve. */
export interface GradeRequest {
  finalMarks: number | null;
  finalFeedback: string | null;
}

/** A draft: not visible to the student, status unchanged. */
export async function saveGradeDraft(answerId: string, body: GradeRequest): Promise<Grade> {
  return toGrade(await apiClient.put<GradeDto>(`${answerPath(answerId)}/grade`, body));
}

/** Saves `body` and publishes in one step; needs marks and non-blank feedback. */
export async function approveGrade(answerId: string, body: GradeRequest): Promise<Grade> {
  return toGrade(await apiClient.post<GradeDto>(`${answerPath(answerId)}/approve`, body));
}
