/**
 * Subject notes (contract §11c). Professors share PDF, DOCX or PPTX files per subject they teach;
 * every C_STUDENT of the college reads them and the C_ADMIN lists and deletes them (metadata
 * only, there is no download for that role). Every response is `no-store`.
 */
import { apiClient, type Download, type UploadOptions } from '@/api/client';
import type { Page } from '@/api/content';
import { blankToNull, toNumber, toSubjectRef, type SubjectRef } from '@/api/assessments';
import { readHead } from '@/api/student';
import { formatBytes } from '@/lib/format';

export type NoteKind = 'pdf' | 'word' | 'powerpoint';

export interface SubjectNote {
  id: string;
  subject: SubjectRef;
  title: string;
  /** `null` when blank. */
  description: string | null;
  file: { originalFilename: string; contentType: string; sizeBytes: number };
  /** `null` once that professor was removed ("Former professor"). */
  uploadedBy: { id: string; fullName: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

/** "Shared by Dr. Iyer" / "Shared by a former professor". */
export function sharedBy(note: SubjectNote): string {
  return note.uploadedBy ? `Shared by ${note.uploadedBy.fullName ?? 'a professor'}` : 'Shared by a former professor';
}

/** Mirrors the backend's `@Size` limits. */
export const NOTE_LIMITS = { title: 200, description: 2000 } as const;
export const NOTE_MAX_FILE_BYTES = 20 * 1024 * 1024;

const PDF_TYPE = 'application/pdf';
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PPTX_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

const KIND_BY_EXTENSION: Record<string, { kind: NoteKind; type: string }> = {
  pdf: { kind: 'pdf', type: PDF_TYPE },
  docx: { kind: 'word', type: DOCX_TYPE },
  pptx: { kind: 'powerpoint', type: PPTX_TYPE },
};

export const NOTE_KIND_LABELS: Record<NoteKind, string> = { pdf: 'PDF', word: 'Word', powerpoint: 'PowerPoint' };

/** What the server's canonical `contentType` means for the UI; anything unknown is treated as a download. */
export function noteKind(contentType: string): NoteKind | null {
  if (contentType === PDF_TYPE) return 'pdf';
  if (contentType === DOCX_TYPE) return 'word';
  if (contentType === PPTX_TYPE) return 'powerpoint';
  return null;
}

interface NoteDto extends Omit<SubjectNote, 'description' | 'uploadedBy' | 'subject' | 'file'> {
  subject?: Partial<SubjectRef> | null;
  description?: string | null;
  file?: Partial<SubjectNote['file']> | null;
  uploadedBy?: { id: string; fullName?: string | null } | null;
}

export function toSubjectNote(dto: NoteDto): SubjectNote {
  return {
    id: dto.id,
    subject: toSubjectRef(dto.subject),
    title: dto.title,
    description: blankToNull(dto.description),
    file: {
      originalFilename: dto.file?.originalFilename ?? 'note',
      contentType: dto.file?.contentType ?? '',
      sizeBytes: toNumber(dto.file?.sizeBytes) ?? 0,
    },
    uploadedBy: dto.uploadedBy ? { id: dto.uploadedBy.id, fullName: blankToNull(dto.uploadedBy.fullName)?.trim() ?? null } : null,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

async function toNotePage(promise: Promise<Page<NoteDto>>): Promise<Page<SubjectNote>> {
  const page = await promise;
  return { ...page, content: (page.content ?? []).map(toSubjectNote) };
}

export const NOTES_PAGE_SIZE = 20;

function listParams(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

const noteFilePath = (area: 'professor' | 'student', id: string) => `/${area}/notes/${encodeURIComponent(id)}/file`;

// ---------- Professor (§11c.1) ----------

export interface ProfessorNotesQuery {
  subjectId?: string;
  /** 0-based. */
  page: number;
}

/** Every note of the caller's mapped subjects, any uploader. `404` for a subject that isn't mapped to the caller. */
export function listProfessorNotes(query: ProfessorNotesQuery, signal?: AbortSignal) {
  const params = listParams({ subjectId: query.subjectId, page: query.page, size: NOTES_PAGE_SIZE });
  return toNotePage(apiClient.get<Page<NoteDto>>(`/professor/notes?${params}`, { signal }));
}

export interface NoteUpload {
  subjectId: string;
  title: string;
  description: string;
  file: File;
}

/**
 * The browser gives some systems an empty `File.type` for `.docx` / `.pptx`, and the server picks
 * the kind from the part's declared type (contract §11c). Re-wrap such a file with the type its
 * extension implies; any other extension is left alone, so the server rejects it.
 */
export function withNoteType(file: File): File {
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  const known = KIND_BY_EXTENSION[extension];
  return known && file.type !== known.type ? new File([file], file.name, { type: known.type }) : file;
}

export async function uploadNote(upload: NoteUpload, options: UploadOptions = {}): Promise<SubjectNote> {
  const form = new FormData();
  form.append('file', withNoteType(upload.file));
  form.append('subjectId', upload.subjectId);
  form.append('title', upload.title.trim());
  if (upload.description.trim()) form.append('description', upload.description);
  return toSubjectNote(await apiClient.upload<NoteDto>('/professor/notes', form, options));
}

/** A blank description clears it. */
export async function updateNote(id: string, body: { title: string; description: string }): Promise<SubjectNote> {
  return toSubjectNote(
    await apiClient.put<NoteDto>(`/professor/notes/${encodeURIComponent(id)}`, {
      title: body.title.trim(),
      description: body.description.trim() ? body.description : null,
    }),
  );
}

export async function replaceNoteFile(id: string, file: File, options: UploadOptions = {}): Promise<SubjectNote> {
  const form = new FormData();
  form.append('file', withNoteType(file));
  return toSubjectNote(
    await apiClient.upload<NoteDto>(`/professor/notes/${encodeURIComponent(id)}/file`, form, { ...options, method: 'PUT' }),
  );
}

export function deleteNote(id: string) {
  return apiClient.delete<void>(`/professor/notes/${encodeURIComponent(id)}`);
}

export const professorNoteFilePath = (id: string) => noteFilePath('professor', id);

// ---------- Student (§11c.2) ----------

export interface StudentNotesQuery {
  subjectId?: string;
  q?: string;
  page: number;
}

/** Newest first. A `subjectId` of another college gives an empty page. */
export function listStudentNotes(query: StudentNotesQuery, signal?: AbortSignal) {
  const params = listParams({ subjectId: query.subjectId, q: query.q, page: query.page, size: NOTES_PAGE_SIZE });
  return toNotePage(apiClient.get<Page<NoteDto>>(`/student/notes?${params}`, { signal }));
}

export const studentNoteFilePath = (id: string) => noteFilePath('student', id);

// ---------- C_ADMIN (§11c.3) ----------

export interface CollegeNotesQuery {
  subjectId?: string;
  professorId?: string;
  page: number;
}

export function listCollegeNotes(query: CollegeNotesQuery, signal?: AbortSignal) {
  const params = listParams({
    subjectId: query.subjectId,
    professorId: query.professorId,
    page: query.page,
    size: NOTES_PAGE_SIZE,
  });
  return toNotePage(apiClient.get<Page<NoteDto>>(`/college/notes?${params}`, { signal }));
}

export function deleteCollegeNote(id: string) {
  return apiClient.delete<void>(`/college/notes/${encodeURIComponent(id)}`);
}

// ---------- Files ----------

/** The kinds a note may be, as an `accept` value for the file picker. */
export const NOTE_ACCEPT = '.pdf,.docx,.pptx';

const KIND_NAMES: Record<string, string> = { pdf: 'PDF', docx: 'Word', pptx: 'PowerPoint' };

/**
 * The client-side check before any request (UI spec F5c, "File field"): extension, size, not
 * empty, and the first bytes matching the extension (`%PDF-` or the zip header `PK\x03\x04`).
 * Only the zip header is checked for Word and PowerPoint; the server checks the package and
 * rejects macros. Returns the problem to show, or null.
 */
export async function checkNoteFile(file: File): Promise<string | null> {
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  if (!(extension in KIND_BY_EXTENSION) || !file.name.includes('.')) {
    return 'Choose a PDF, Word (.docx) or PowerPoint (.pptx) file.';
  }
  if (file.size === 0) return 'This file is empty.';
  if (file.size > NOTE_MAX_FILE_BYTES) return `This file is ${formatBytes(file.size)}. Files can be at most 20 MB.`;
  try {
    const head = await readHead(file, 5);
    const matches = extension === 'pdf' ? head === '%PDF-' : head.startsWith('PK\x03\x04');
    if (!matches) return `This doesn't look like a real ${KIND_NAMES[extension]} file.`;
  } catch {
    return "This file couldn't be read. Choose it again.";
  }
  return null;
}

/** Saves a download as a file (Word, PowerPoint): an object URL on a throwaway `<a download>`, revoked at once. */
export function saveDownload(download: Download, fallbackName: string) {
  const url = URL.createObjectURL(download.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = download.filename ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadStudentNote(id: string) {
  return apiClient.download(studentNoteFilePath(id));
}

export function downloadProfessorNote(id: string) {
  return apiClient.download(professorNoteFilePath(id));
}
