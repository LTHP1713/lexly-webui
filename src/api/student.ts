/**
 * `/student/**` (contract §9.3, §9.4, C_STUDENT only). A student sees the published and closed
 * assessments of their college; drafts, removed assessments and other colleges' ids are `404`.
 * Answers are one PDF per question: uploaded (replaceable), then submitted (locked).
 */
import { apiClient, type UploadOptions } from '@/api/client';
import type { Page } from '@/api/content';
import {
  ASSESSMENT_STATUSES,
  STUDENT_STATES,
  blankToNull,
  count,
  oneOf,
  stringField,
  toNumber,
  toSubjectRef,
  type AnswerStatus,
  type AssessmentStatus,
  type StudentAssessmentState,
  type SubjectRef,
} from '@/api/assessments';

export interface StudentAssessmentSummary {
  id: string;
  subject: SubjectRef;
  title: string;
  /** `null` for a removed professor. */
  professorName: string | null;
  status: AssessmentStatus;
  state: StudentAssessmentState;
  dueAt: string | null;
  questionCount: number;
  totalMarks: number;
  progress: { uploaded: number; submitted: number; resultsPublished: number };
}

export interface Answer {
  status: AnswerStatus;
  originalFilename: string;
  sizeBytes: number;
  pageCount: number;
  uploadedAt: string | null;
  submittedAt: string | null;
}

export interface StudentQuestion {
  id: string;
  position: number;
  text: string | null;
  maxMarks: number | null;
  wordLimit: number | null;
  /** `null` until something is uploaded. */
  answer: Answer | null;
  /** `false` until backend P4. */
  resultPublished: boolean;
}

export interface UploadLimits {
  maxFileMb: number;
  maxPages: number;
}

export interface StudentAssessmentDetail extends Omit<StudentAssessmentSummary, 'questionCount' | 'progress'> {
  instructions: string | null;
  /** The server's clock when it answered, to correct a skewed device clock for countdowns. */
  serverTime: string | null;
  uploadLimits: UploadLimits;
  questions: StudentQuestion[];
}

/** The decided limits (contract §0.6), used only if a response ever lacks `uploadLimits`. */
export const DEFAULT_UPLOAD_LIMITS: UploadLimits = { maxFileMb: 5, maxPages: 10 };

type Dto = Record<string, unknown> & {
  subject?: Partial<SubjectRef> | null;
  progress?: Partial<StudentAssessmentSummary['progress']> | null;
  uploadLimits?: Partial<UploadLimits> | null;
  questions?: (Partial<Omit<StudentQuestion, 'answer'>> & { answer?: Partial<Answer> | null })[] | null;
};


function toBase(dto: Dto) {
  return {
    id: stringField(dto, 'id') ?? '',
    subject: toSubjectRef(dto.subject),
    title: stringField(dto, 'title') ?? '',
    professorName: blankToNull(stringField(dto, 'professorName')),
    status: oneOf(ASSESSMENT_STATUSES, dto.status),
    state: oneOf(STUDENT_STATES, dto.state),
    dueAt: stringField(dto, 'dueAt'),
    totalMarks: count(dto.totalMarks),
  };
}

export function toStudentAssessmentSummary(dto: Dto): StudentAssessmentSummary {
  return {
    ...toBase(dto),
    questionCount: count(dto.questionCount),
    progress: {
      uploaded: count(dto.progress?.uploaded),
      submitted: count(dto.progress?.submitted),
      resultsPublished: count(dto.progress?.resultsPublished),
    },
  };
}

export function toAnswer(dto: Partial<Answer> | null | undefined): Answer | null {
  if (!dto) return null;
  return {
    status: dto.status === 'SUBMITTED' ? 'SUBMITTED' : 'UPLOADED',
    originalFilename: dto.originalFilename?.trim() || 'answer.pdf',
    sizeBytes: count(dto.sizeBytes),
    pageCount: count(dto.pageCount),
    uploadedAt: dto.uploadedAt ?? null,
    submittedAt: dto.submittedAt ?? null,
  };
}

export function toStudentAssessmentDetail(dto: Dto): StudentAssessmentDetail {
  const limits = dto.uploadLimits;
  return {
    ...toBase(dto),
    instructions: blankToNull(stringField(dto, 'instructions')),
    serverTime: stringField(dto, 'serverTime'),
    uploadLimits: {
      maxFileMb: toNumber(limits?.maxFileMb) ?? DEFAULT_UPLOAD_LIMITS.maxFileMb,
      maxPages: toNumber(limits?.maxPages) ?? DEFAULT_UPLOAD_LIMITS.maxPages,
    },
    questions: (dto.questions ?? []).map((q, index) => ({
      id: q.id ?? '',
      position: toNumber(q.position) ?? index + 1,
      text: blankToNull(q.text),
      maxMarks: toNumber(q.maxMarks),
      wordLimit: toNumber(q.wordLimit),
      answer: toAnswer(q.answer),
      resultPublished: q.resultPublished === true,
    })),
  };
}

export async function listStudentAssessments(
  query: { subjectId?: string; page: number; size: number },
  signal?: AbortSignal,
): Promise<Page<StudentAssessmentSummary>> {
  const params = new URLSearchParams({ page: String(query.page), size: String(query.size) });
  if (query.subjectId) params.set('subjectId', query.subjectId);
  const page = await apiClient.get<Page<Dto>>(`/student/assessments?${params}`, { signal });
  return { ...page, content: (page.content ?? []).map(toStudentAssessmentSummary) };
}

export async function getStudentAssessment(id: string, signal?: AbortSignal): Promise<StudentAssessmentDetail> {
  return toStudentAssessmentDetail(await apiClient.get<Dto>(`/student/assessments/${encodeURIComponent(id)}`, { signal }));
}

const answerPath = (questionId: string) => `/student/questions/${encodeURIComponent(questionId)}/answer`;

/** Uploads or replaces the PDF (multipart part `file`). */
export async function uploadAnswer(
  questionId: string,
  file: File,
  options: Pick<UploadOptions, 'onProgress' | 'signal'> = {},
): Promise<Answer> {
  const body = new FormData();
  // Some systems give a .pdf no MIME type; the server requires `application/pdf` on the part.
  body.append('file', file.type === 'application/pdf' ? file : new Blob([file], { type: 'application/pdf' }), file.name);
  const answer = toAnswer(await apiClient.upload<Partial<Answer>>(answerPath(questionId), body, { ...options, method: 'PUT' }));
  if (!answer) throw new Error('Empty upload response');
  return answer;
}

export async function submitAnswer(questionId: string): Promise<Answer> {
  const answer = toAnswer(await apiClient.post<Partial<Answer>>(`${answerPath(questionId)}/submit`));
  if (!answer) throw new Error('Empty submit response');
  return answer;
}

/** The size message, shared with the server's multipart-ceiling error. */
export function tooLargeMessage(limits: UploadLimits): string {
  return `This file is larger than ${limits.maxFileMb} MB. Scan fewer pages or at a lower resolution.`;
}

async function readHead(file: Blob, length: number): Promise<string> {
  const head = file.slice(0, length);
  const buffer =
    typeof head.arrayBuffer === 'function'
      ? await head.arrayBuffer()
      : await new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(head);
        });
  return String.fromCharCode(...new Uint8Array(buffer));
}

/**
 * The checks the browser can make before uploading (UI spec F3.6): a PDF by type or name, not
 * empty, within the size limit, starting with `%PDF-`. The page count is left to the server.
 * Returns the problem to show, or null.
 */
export async function checkAnswerFile(file: File, limits: UploadLimits): Promise<string | null> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return 'Choose a PDF file.';
  if (file.size === 0) return 'This file is empty.';
  if (file.size > limits.maxFileMb * 1024 * 1024) return tooLargeMessage(limits);
  try {
    if ((await readHead(file, 5)) !== '%PDF-') return "This file isn't a readable PDF.";
  } catch {
    return "This file couldn't be read. Choose it again.";
  }
  return null;
}

/** The student's own file; works after closing too. */
export function answerFilePath(questionId: string) {
  return `${answerPath(questionId)}/file`;
}
