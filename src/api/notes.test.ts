import { describe, expect, it } from 'vitest';
import { checkNoteFile, noteKind, sharedBy, toSubjectNote, withNoteType } from '@/api/notes';
import { DOCX_TYPE, PDF_TYPE, PPTX_TYPE, docxFile, note, pdfFile } from '@/test/notes';

describe('checkNoteFile', () => {
  it('accepts a PDF, a DOCX and a PPTX', async () => {
    expect(await checkNoteFile(pdfFile())).toBeNull();
    expect(await checkNoteFile(docxFile())).toBeNull();
    expect(await checkNoteFile(new File(['PK\x03\x04'], 'a.pptx', { type: PPTX_TYPE }))).toBeNull();
  });

  it('rejects other extensions, including the legacy Office ones', async () => {
    for (const name of ['a.txt', 'a.doc', 'a.ppt', 'a.docm', 'a.pptm', 'noextension']) {
      expect(await checkNoteFile(new File(['PK\x03\x04'], name))).toBe('Choose a PDF, Word (.docx) or PowerPoint (.pptx) file.');
    }
  });

  it('rejects an empty file and one over 20 MB', async () => {
    expect(await checkNoteFile(new File([], 'a.pdf'))).toBe('This file is empty.');
    const big = new File(['%PDF-'], 'big.pdf');
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 });
    expect(await checkNoteFile(big)).toBe('This file is 21 MB. Files can be at most 20 MB.');
  });

  it('rejects a renamed file whose first bytes do not match', async () => {
    expect(await checkNoteFile(new File(['just text'], 'a.docx'))).toBe("This doesn't look like a real Word file.");
    expect(await checkNoteFile(new File(['PK\x03\x04'], 'a.pdf'))).toBe("This doesn't look like a real PDF file.");
  });
});

describe('withNoteType', () => {
  it('gives a DOCX with an empty File.type its content type, and keeps the file', () => {
    const wrapped = withNoteType(docxFile('a.docx', ''));
    expect(wrapped.type).toBe(DOCX_TYPE);
    expect(wrapped.name).toBe('a.docx');
  });

  it('leaves a correctly typed file and an unknown extension alone', () => {
    const pdf = pdfFile();
    expect(withNoteType(pdf)).toBe(pdf);
    const other = new File(['x'], 'a.txt', { type: '' });
    expect(withNoteType(other)).toBe(other);
  });
});

describe('note mapping', () => {
  it('maps the content type to a kind, blank descriptions to null and a removed uploader', () => {
    expect(noteKind(PDF_TYPE)).toBe('pdf');
    expect(noteKind(DOCX_TYPE)).toBe('word');
    expect(noteKind(PPTX_TYPE)).toBe('powerpoint');
    expect(noteKind('text/plain')).toBeNull();
    const mapped = toSubjectNote(note({ description: '  ', uploadedBy: null }) as Parameters<typeof toSubjectNote>[0]);
    expect(mapped.description).toBeNull();
    expect(sharedBy(mapped)).toBe('Shared by a former professor');
  });
});
