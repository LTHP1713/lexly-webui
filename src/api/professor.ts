/**
 * `/professor/assessments/**` (contract §9.2, §9.5, C_PROFESSOR only). A professor sees only
 * their own assessments, in every status; anyone else's id is a `404`. Drafts are saved with
 * shape checks only; publishing checks completeness and answers with one `VALIDATION_ERROR`
 * path per problem.
 */
import { apiClient } from '@/api/client';
import type { Page } from '@/api/content';
import {
  ASSESSMENT_STATUSES,
  CELL_STATUSES,
  blankToNull,
  count,
  oneOf,
  stringField,
  toNumber,
  toSubjectRef,
  type AssessmentStatus,
  type CellStatus,
  type SubjectRef,
} from '@/api/assessments';

/** Mirrors `AssessmentDraftRequest`'s `@Size` / `@Max` constraints. */
export const ASSESSMENT_LIMITS = {
  title: 255,
  instructions: 10_000,
  questions: 50,
  questionText: 10_000,
  maxMarks: 100,
  wordLimit: 10_000,
} as const;

export interface AssessmentCounts {
  /** C_STUDENTs in the college. */
  students: number;
  /** students × questions. */
  answerSlots: number;
  submitted: number;
  /** Grading counts: 0 until backend P4. */
  pendingEvaluation: number;
  aiEvaluated: number;
  published: number;
  /** `answerSlots − submitted` once closed or removed, else 0. */
  notAttempted: number;
}

export interface AssessmentQuestion {
  id: string;
  position: number;
  /** Any of these may be missing on a draft. */
  text: string | null;
  maxMarks: number | null;
  wordLimit: number | null;
}

export interface AssessmentSummary {
  id: string;
  subject: SubjectRef;
  title: string;
  status: AssessmentStatus;
  dueAt: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** `null` when the professor was removed ("Former professor"). */
  createdBy: { id: string; fullName: string | null } | null;
  totalMarks: number;
  questionCount: number;
  counts: AssessmentCounts;
}

export interface AssessmentDetail extends AssessmentSummary {
  instructions: string | null;
  questions: AssessmentQuestion[];
}

type Dto = Record<string, unknown> & {
  subject?: Partial<SubjectRef> | null;
  createdBy?: { id: string; fullName: string | null } | null;
  counts?: Partial<Record<keyof AssessmentCounts, number>> | null;
  questions?: Partial<AssessmentQuestion>[] | null;
};

function toCounts(dto: Dto['counts']): AssessmentCounts {
  return {
    students: count(dto?.students),
    answerSlots: count(dto?.answerSlots),
    submitted: count(dto?.submitted),
    pendingEvaluation: count(dto?.pendingEvaluation),
    aiEvaluated: count(dto?.aiEvaluated),
    published: count(dto?.published),
    notAttempted: count(dto?.notAttempted),
  };
}

function toQuestion(dto: Partial<AssessmentQuestion>, index: number): AssessmentQuestion {
  return {
    id: dto.id ?? '',
    position: toNumber(dto.position) ?? index + 1,
    text: blankToNull(dto.text),
    maxMarks: toNumber(dto.maxMarks),
    wordLimit: toNumber(dto.wordLimit),
  };
}

export function toAssessmentSummary(dto: Dto): AssessmentSummary {
  const str = (key: string) => stringField(dto, key);
  const questions = Array.isArray(dto.questions) ? dto.questions : null;
  return {
    id: str('id') ?? '',
    subject: toSubjectRef(dto.subject),
    title: str('title') ?? '',
    status: oneOf(ASSESSMENT_STATUSES, dto.status),
    dueAt: str('dueAt'),
    publishedAt: str('publishedAt'),
    closedAt: str('closedAt'),
    removedAt: str('removedAt'),
    createdAt: str('createdAt') ?? '',
    updatedAt: str('updatedAt') ?? '',
    createdBy: dto.createdBy ? { id: dto.createdBy.id, fullName: blankToNull(dto.createdBy.fullName) } : null,
    totalMarks: count(dto.totalMarks),
    questionCount: toNumber(dto.questionCount) ?? questions?.length ?? 0,
    counts: toCounts(dto.counts),
  };
}

export function toAssessmentDetail(dto: Dto): AssessmentDetail {
  return {
    ...toAssessmentSummary(dto),
    instructions: blankToNull(stringField(dto, 'instructions')),
    questions: (dto.questions ?? []).map(toQuestion),
  };
}

export interface AssessmentListQuery {
  subjectId?: string;
  status?: AssessmentStatus;
  page: number;
  size: number;
}

export async function listAssessments(query: AssessmentListQuery, signal?: AbortSignal): Promise<Page<AssessmentSummary>> {
  const params = new URLSearchParams({ page: String(query.page), size: String(query.size) });
  if (query.subjectId) params.set('subjectId', query.subjectId);
  if (query.status) params.set('status', query.status);
  const page = await apiClient.get<Page<Dto>>(`/professor/assessments?${params}`, { signal });
  return { ...page, content: (page.content ?? []).map(toAssessmentSummary) };
}

const assessmentPath = (id: string) => `/professor/assessments/${encodeURIComponent(id)}`;

export async function getAssessment(id: string, signal?: AbortSignal): Promise<AssessmentDetail> {
  return toAssessmentDetail(await apiClient.get<Dto>(assessmentPath(id), { signal }));
}

/** `AssessmentDraft`: the whole assessment; question order is list order, `id: null` for a new one. */
export interface AssessmentDraftRequest {
  subjectId: string;
  title: string;
  instructions: string | null;
  dueAt: string | null;
  questions: { id: string | null; text: string | null; maxMarks: number | null; wordLimit: number | null }[];
}

export async function createAssessment(body: AssessmentDraftRequest): Promise<AssessmentDetail> {
  return toAssessmentDetail(await apiClient.post<Dto>('/professor/assessments', body));
}

/** Full replace; `409 ASSESSMENT_NOT_EDITABLE` unless it is a draft. */
export async function updateAssessment(id: string, body: AssessmentDraftRequest): Promise<AssessmentDetail> {
  return toAssessmentDetail(await apiClient.put<Dto>(assessmentPath(id), body));
}

/** Drafts only. */
export function deleteAssessment(id: string) {
  return apiClient.delete<void>(assessmentPath(id));
}

export async function publishAssessment(id: string): Promise<AssessmentDetail> {
  return toAssessmentDetail(await apiClient.post<Dto>(`${assessmentPath(id)}/publish`));
}

/** Published or closed only; unsubmitted uploads are deleted. */
export async function removeAssessment(id: string): Promise<AssessmentDetail> {
  return toAssessmentDetail(await apiClient.post<Dto>(`${assessmentPath(id)}/remove`));
}

// ---------- Submissions grid ----------

export interface GridCell {
  questionId: string;
  position: number;
  /** Only for submitted answers: professors never see unsubmitted files. */
  answerId: string | null;
  cellStatus: CellStatus;
  submittedAt: string | null;
}

export interface GridRow {
  student: { id: string; fullName: string | null; loginId: string | null };
  /** In question order. */
  cells: GridCell[];
}

type GridRowDto = {
  student?: { id: string; fullName?: string | null; loginId?: string | null } | null;
  cells?: (Partial<GridCell> & { cellStatus?: string })[] | null;
};

export function toGridRow(dto: GridRowDto): GridRow {
  return {
    student: {
      id: dto.student?.id ?? '',
      fullName: blankToNull(dto.student?.fullName),
      loginId: blankToNull(dto.student?.loginId),
    },
    cells: (dto.cells ?? []).map((cell, index) => ({
      questionId: cell.questionId ?? '',
      position: toNumber(cell.position) ?? index + 1,
      answerId: cell.answerId ?? null,
      // An unknown (e.g. a P4 grade-era) value reads as not uploaded rather than breaking the grid.
      cellStatus: CELL_STATUSES.includes(cell.cellStatus as CellStatus) ? (cell.cellStatus as CellStatus) : 'NOT_UPLOADED',
      submittedAt: cell.submittedAt ?? null,
    })),
  };
}

export interface GridQuery {
  questionId?: string;
  status?: CellStatus;
  q?: string;
  page: number;
  size: number;
}

/** Paged by student, sorted by name; every current student of the college has a row. */
export async function listSubmissions(assessmentId: string, query: GridQuery, signal?: AbortSignal): Promise<Page<GridRow>> {
  const params = new URLSearchParams({ page: String(query.page), size: String(query.size) });
  if (query.questionId) params.set('questionId', query.questionId);
  if (query.status) params.set('status', query.status);
  if (query.q) params.set('q', query.q);
  const page = await apiClient.get<Page<GridRowDto>>(`${assessmentPath(assessmentId)}/answers?${params}`, { signal });
  return { ...page, content: (page.content ?? []).map(toGridRow) };
}
