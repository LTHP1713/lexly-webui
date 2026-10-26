/** F5c: professor, student and C_ADMIN notes screens, and the subject-in-use dialog. */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderApp, signedInAs } from '@/test/renderApp';
import { API, apiError, http, HttpResponse, json, server } from '@/test/server';
import { DOCX_TYPE, PPTX_TYPE, docxFile, note, notesPage, subjectDto } from '@/test/notes';

const college = { id: 'c1', code: 'NLSIU', name: 'National Law School' };

const pdfNote = note();
const docxNote = note({
  id: 'n2',
  title: 'Case digest',
  file: { originalFilename: 'digest.docx', contentType: DOCX_TYPE, sizeBytes: 12_000 },
  uploadedBy: { id: 'other', fullName: 'Prof. L. Iyer' },
});

const realCreate = URL.createObjectURL;
const realRevoke = URL.revokeObjectURL;
beforeEach(() => {
  URL.createObjectURL = () => 'blob:note';
  URL.revokeObjectURL = () => undefined;
});
afterEach(() => {
  URL.createObjectURL = realCreate;
  URL.revokeObjectURL = realRevoke;
});

describe('professor notes', () => {
  function professor() {
    signedInAs({ role: 'C_PROFESSOR', loginId: 'EMP7', college });
  }

  it('offers Edit, Replace and Delete only on the professor’s own notes', async () => {
    professor();
    server.use(
      http.get(`${API}/college/subjects`, () => json([subjectDto()])),
      http.get(`${API}/professor/notes`, () => json(notesPage([pdfNote, docxNote]))),
    );
    await renderApp('/professor/notes');
    const own = await screen.findByRole('article', { name: pdfNote.title });
    expect(within(own).getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(within(own).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(own).getByRole('button', { name: 'Replace file' })).toBeInTheDocument();
    const colleague = screen.getByRole('article', { name: 'Case digest' });
    expect(within(colleague).getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(within(colleague).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(within(colleague).getByText(/Shared by Prof\. L\. Iyer/)).toBeInTheDocument();
  });

  it('says so, and disables Upload, when no subjects are assigned', async () => {
    professor();
    server.use(http.get(`${API}/college/subjects`, () => json([])));
    await renderApp('/professor/notes');
    expect(await screen.findByText(/Your college admin assigns subjects to professors/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload note' })).toBeDisabled();
  });

  it('shows the not-found state for a subject that is no longer mapped', async () => {
    professor();
    server.use(
      http.get(`${API}/college/subjects`, () => json([subjectDto()])),
      http.get(`${API}/professor/notes`, () => apiError(404, 'NOT_FOUND')),
    );
    await renderApp('/professor/notes?subjectId=gone');
    expect(await screen.findByText('You no longer teach this subject, or it was removed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all subjects' })).toBeInTheDocument();
  });

  it('checks the file before any request, then uploads a DOCX with its type and the form fields', async () => {
    professor();
    let sent: FormData | null = null;
    server.use(
      http.get(`${API}/college/subjects`, () => json([subjectDto()])),
      http.get(`${API}/professor/notes`, () => json(notesPage([]))),
      http.post(`${API}/professor/notes`, async ({ request }) => {
        sent = await request.formData();
        return json(note({ id: 'n9', title: 'Handout' }), 201);
      }),
    );
    await renderApp('/professor/notes');
    const ui = userEvent.setup({ applyAccept: false });
    await ui.click(await screen.findByRole('button', { name: 'Upload note' }));
    const dialog = await screen.findByRole('dialog', { name: 'Upload a note' });
    const input = dialog.querySelector<HTMLInputElement>('input[type=file]')!;

    await ui.upload(input, new File(['hello'], 'notes.txt'));
    expect(await within(dialog).findByText('Choose a PDF, Word (.docx) or PowerPoint (.pptx) file.')).toBeInTheDocument();
    await ui.click(within(dialog).getByRole('button', { name: 'Upload' }));
    expect(await within(dialog).findByText('Choose a subject.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a title.')).toBeInTheDocument();
    expect(sent).toBeNull();

    await ui.selectOptions(within(dialog).getByLabelText(/Subject/), 's1');
    await ui.type(within(dialog).getByLabelText(/Title/), '  Handout ');
    await ui.upload(input, docxFile('handout.docx', ''));
    await ui.click(within(dialog).getByRole('button', { name: 'Upload' }));

    await waitFor(() => expect(sent).not.toBeNull());
    const form = sent as unknown as FormData;
    expect(form.get('subjectId')).toBe('s1');
    expect(form.get('title')).toBe('Handout');
    expect(form.has('description')).toBe(false);
    expect((form.get('file') as File).type).toBe(DOCX_TYPE);
    expect(await screen.findByText("'Handout' shared with students.")).toBeInTheDocument();
  });

  it('shows the server’s reason under the file for INVALID_FILE', async () => {
    professor();
    server.use(
      http.get(`${API}/college/subjects`, () => json([subjectDto()])),
      http.get(`${API}/professor/notes`, () => json(notesPage([]))),
      http.post(`${API}/professor/notes`, () => apiError(400, 'INVALID_FILE', 'file: must not contain macros')),
    );
    await renderApp('/professor/notes?subjectId=s1');
    const ui = userEvent.setup({ applyAccept: false });
    await ui.click(await screen.findByRole('button', { name: 'Upload note' }));
    const dialog = await screen.findByRole('dialog', { name: 'Upload a note' });
    await ui.type(within(dialog).getByLabelText(/Title/), 'Macro');
    await ui.upload(dialog.querySelector<HTMLInputElement>('input[type=file]')!, new File(['PK\x03\x04'], 'm.pptx', { type: PPTX_TYPE }));
    await ui.click(within(dialog).getByRole('button', { name: 'Upload' }));
    expect(await within(dialog).findByText("This file can't be used: must not contain macros")).toBeInTheDocument();
  });

  it('asks before discarding an upload that has input', async () => {
    professor();
    server.use(
      http.get(`${API}/college/subjects`, () => json([subjectDto()])),
      http.get(`${API}/professor/notes`, () => json(notesPage([]))),
    );
    await renderApp('/professor/notes');
    const ui = userEvent.setup();
    await ui.click(await screen.findByRole('button', { name: 'Upload note' }));
    const dialog = await screen.findByRole('dialog', { name: 'Upload a note' });
    await ui.type(within(dialog).getByLabelText(/Title/), 'Draft');
    await ui.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    const confirm = await screen.findByRole('dialog', { name: 'Discard this note?' });
    await ui.click(within(confirm).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Upload a note' })).not.toBeInTheDocument());
  });

  it('deletes an own note and refreshes the list', async () => {
    professor();
    let deleted = false;
    server.use(
      http.get(`${API}/college/subjects`, () => json([subjectDto()])),
      http.get(`${API}/professor/notes`, () => json(notesPage(deleted ? [] : [pdfNote]))),
      http.delete(`${API}/professor/notes/n1`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await renderApp('/professor/notes');
    const ui = userEvent.setup();
    await ui.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: `Delete '${pdfNote.title}'?` });
    await ui.click(within(dialog).getByRole('button', { name: 'Delete note' }));
    expect(await screen.findByText(/No notes yet/)).toBeInTheDocument();
    expect(screen.getByText('Note deleted.')).toBeInTheDocument();
  });
});

describe('student notes', () => {
  function student() {
    signedInAs({ role: 'C_STUDENT', loginId: '21BAL042', college });
  }

  it('lists notes, downloads a Word file and views a PDF inline', async () => {
    student();
    let fileRequests = 0;
    server.use(
      http.get(`${API}/college/subjects`, () => json([subjectDto()])),
      http.get(`${API}/student/notes`, () => json(notesPage([pdfNote, docxNote]))),
      http.get(`${API}/student/notes/:id/file`, () => {
        fileRequests += 1;
        return new HttpResponse('bytes', {
          headers: { 'Content-Type': DOCX_TYPE, 'Content-Disposition': 'attachment; filename="digest.docx"' },
        });
      }),
    );
    await renderApp('/student/notes');
    const word = await screen.findByRole('article', { name: 'Case digest' });
    expect(within(word).getByText('Word')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    const ui = userEvent.setup();
    await ui.click(within(word).getByRole('button', { name: 'Download' }));
    await waitFor(() => expect(fileRequests).toBe(1));

    const pdf = screen.getByRole('article', { name: pdfNote.title });
    await ui.click(within(pdf).getByRole('button', { name: 'View' }));
    expect(await screen.findByRole('dialog', { name: pdfNote.title })).toBeInTheDocument();
    await waitFor(() => expect(fileRequests).toBe(2));
  });

  it('sends the filters to the server and shows the filtered empty state', async () => {
    student();
    const seen: URLSearchParams[] = [];
    server.use(
      http.get(`${API}/college/subjects`, () => json([subjectDto()])),
      http.get(`${API}/student/notes`, ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return json(notesPage([]));
      }),
    );
    await renderApp('/student/notes?subjectId=s1&q=basic');
    expect(await screen.findByText('No notes match these filters.')).toBeInTheDocument();
    expect(seen[0].get('subjectId')).toBe('s1');
    expect(seen[0].get('q')).toBe('basic');
    expect(screen.getAllByRole('button', { name: 'Clear filters' }).length).toBeGreaterThan(0);
  });

  it('shows the unfiltered empty state', async () => {
    student();
    server.use(
      http.get(`${API}/college/subjects`, () => json([subjectDto()])),
      http.get(`${API}/student/notes`, () => json(notesPage([]))),
    );
    await renderApp('/student/notes');
    expect(await screen.findByText('Your professors haven’t shared any notes yet.')).toBeInTheDocument();
  });

  it('refreshes the list when a note is gone', async () => {
    student();
    server.use(
      http.get(`${API}/college/subjects`, () => json([subjectDto()])),
      http.get(`${API}/student/notes`, () => json(notesPage([docxNote]))),
      http.get(`${API}/student/notes/n2/file`, () => apiError(404, 'NOT_FOUND')),
    );
    await renderApp('/student/notes');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Download' }));
    expect(await screen.findByText('This note no longer exists. The list has been refreshed.')).toBeInTheDocument();
  });
});

describe('college notes (C_ADMIN)', () => {
  function admin() {
    signedInAs({ role: 'C_ADMIN', college });
  }

  it('lists metadata only, names a former professor and has no View or Download', async () => {
    admin();
    server.use(
      http.get(`${API}/college/subjects`, () => json([subjectDto()])),
      http.get(`${API}/college/users`, () => json(notesPage([]))),
      http.get(`${API}/college/notes`, () => json(notesPage([note({ uploadedBy: null })]))),
    );
    await renderApp('/college/notes');
    const table = await screen.findByRole('table', { name: 'Study notes' });
    expect(within(table).getByText('Former professor')).toBeInTheDocument();
    expect(within(table).getByText('PDF')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View|Download/ })).not.toBeInTheDocument();
  });

  it('deletes a note after naming its uploader and subject', async () => {
    admin();
    let deleted = false;
    server.use(
      http.get(`${API}/college/subjects`, () => json([subjectDto()])),
      http.get(`${API}/college/users`, () => json(notesPage([]))),
      http.get(`${API}/college/notes`, () => json(notesPage(deleted ? [] : [pdfNote]))),
      http.delete(`${API}/college/notes/n1`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await renderApp('/college/notes');
    const ui = userEvent.setup();
    await ui.click(await screen.findByRole('button', { name: `Delete ${pdfNote.title}` }));
    const dialog = await screen.findByRole('dialog', { name: `Delete '${pdfNote.title}'?` });
    expect(within(dialog).getByText(/Shared by Dr\. Meera Iyer for CON-101/)).toBeInTheDocument();
    await ui.click(within(dialog).getByRole('button', { name: 'Delete note' }));
    expect(await screen.findByText('No professor has shared notes yet.')).toBeInTheDocument();
  });

  it('shows the not-found state for a removed filter', async () => {
    admin();
    server.use(
      http.get(`${API}/college/subjects`, () => json([])),
      http.get(`${API}/college/users`, () => json(notesPage([]))),
      http.get(`${API}/college/notes`, () => apiError(404, 'NOT_FOUND')),
    );
    await renderApp('/college/notes?professorId=gone');
    expect(await screen.findByText('This subject or professor no longer exists.')).toBeInTheDocument();
  });

  it('explains a subject that cannot be deleted because it has notes', async () => {
    admin();
    server.use(
      http.get(`${API}/college/subjects/s1`, () => json(subjectDto())),
      http.delete(`${API}/college/subjects/s1`, () => apiError(409, 'SUBJECT_IN_USE')),
      http.get(`${API}/college/subjects`, () => json([subjectDto()])),
    );
    await renderApp('/college/subjects/s1');
    const ui = userEvent.setup();
    expect(await screen.findByRole('link', { name: 'Study notes →' })).toHaveAttribute('href', '/college/notes?subjectId=s1');
    await ui.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete Constitutional Law I?' });
    await ui.click(within(confirm).getByRole('button', { name: 'Delete subject' }));
    const blocked = await screen.findByRole('dialog', { name: "Constitutional Law I can't be deleted" });
    expect(within(blocked).getByText(/Professors have shared study notes/)).toBeInTheDocument();
    expect(within(blocked).getByRole('link', { name: 'View notes' })).toHaveAttribute('href', '/college/notes?subjectId=s1');
  });
});

describe('audit summaries', () => {
  it('describes note events from the file name', async () => {
    const { auditSummary } = await import('@/pages/audit/auditFormat');
    const event = (action: string) => ({
      id: 'e', createdAt: '', actor: null, college: null, action, entityType: 'SUBJECT_NOTE', entityId: null,
      details: { subjectId: 's1', fileName: 'a.pdf' },
    });
    expect(auditSummary(event('NOTE_UPLOADED'))).toBe('Note a.pdf shared');
    expect(auditSummary(event('NOTE_REPLACED'))).toBe('Note file replaced with a.pdf');
    expect(auditSummary(event('NOTE_DELETED'))).toBe('Note a.pdf deleted');
  });
});

