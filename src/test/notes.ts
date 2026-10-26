/** Contract §11c bodies for the notes tests (F5c). */

export const PDF_TYPE = 'application/pdf';
export const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PPTX_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export function note(overrides: Record<string, unknown> = {}) {
  return {
    id: 'n1',
    subject: { id: 's1', code: 'CON-101', name: 'Constitutional Law I' },
    title: 'Basic structure — lecture 4',
    description: 'Kesavananda and after',
    file: { originalFilename: 'lecture-4.pdf', contentType: PDF_TYPE, sizeBytes: 2_483_019 },
    uploadedBy: { id: 'user-1', fullName: 'Dr. Meera Iyer' },
    createdAt: '2026-10-20T09:00:00Z',
    updatedAt: '2026-10-21T09:00:00Z',
    ...overrides,
  };
}

export function notesPage(content: unknown[], overrides: Record<string, unknown> = {}) {
  return { content, page: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0, ...overrides };
}

export function subjectDto(overrides: Record<string, unknown> = {}) {
  return {
    id: 's1',
    code: 'CON-101',
    name: 'Constitutional Law I',
    description: null,
    professors: [],
    assessmentCount: 0,
    createdAt: '2026-10-14T09:00:00Z',
    updatedAt: '2026-10-14T09:00:00Z',
    ...overrides,
  };
}

/** A file whose first bytes are right for its extension, so it passes the client check. */
export function pdfFile(name = 'notes.pdf') {
  return new File(['%PDF-1.7 body'], name, { type: PDF_TYPE });
}

export function docxFile(name = 'notes.docx', type = DOCX_TYPE) {
  return new File(['PK\x03\x04 body'], name, { type });
}
