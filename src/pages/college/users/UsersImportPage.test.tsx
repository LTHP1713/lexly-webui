/** F2.6 user import: client file checks, all four row outcomes and a whole-file error (F2.9). */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { API, apiError, http, json, server } from '@/test/server';
import { renderApp, signedInAs } from '@/test/renderApp';

beforeEach(() => {
  signedInAs({ role: 'C_ADMIN', college: { id: 'c1', code: 'NLSIU', name: 'National Law School' } });
});

const csv = () => new File(['full_name,email,roll_no\nAsha,a@x.in,R1\n'], 'students.csv', { type: 'text/csv' });

async function chooseFile(file: File) {
  const input = document.querySelector<HTMLInputElement>('input[type=file]')!;
  await userEvent.setup().upload(input, file);
}

describe('user import', () => {
  it('refuses a file that is not .csv or .xlsx without uploading it', async () => {
    let called = false;
    server.use(
      http.post(`${API}/college/users/import/students`, () => {
        called = true;
        return json({});
      }),
    );
    await renderApp('/college/users/import');
    expect(await screen.findByRole('heading', { level: 1, name: 'Import users' })).toBeInTheDocument();
    await userEvent.setup({ applyAccept: false }).upload(
      document.querySelector<HTMLInputElement>('input[type=file]')!,
      new File(['x'], 'students.txt'),
    );
    expect(screen.getByText('Choose a .csv or .xlsx file.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    expect(called).toBe(false);
  });

  it('shows every outcome with spreadsheet row numbers, the converted note and links', async () => {
    server.use(
      http.post(`${API}/college/users/import/students`, () =>
        json({
          summary: { total: 4, created: 1, converted: 1, rejected: 1, failed: 1 },
          rows: [
            { index: 2, key: 'R1', status: 'CREATED', id: 'u1', errors: [] },
            { index: 3, key: 'R2', status: 'CONVERTED', id: 'u2', errors: [] },
            { index: 4, key: 'R1', status: 'REJECTED', id: null, errors: ['roll_no: duplicate of row 2', 'email: must be a well-formed email address'] },
            { index: 5, key: null, status: 'FAILED', id: null, errors: ['Unexpected error while saving'] },
          ],
        }),
      ),
    );
    await renderApp('/college/users/import');
    await screen.findByRole('heading', { level: 1, name: 'Import users' });
    expect(screen.getByRole('link', { name: /^CSV/ })).toHaveAttribute('href', '/templates/students.csv');
    await chooseFile(csv());
    expect(screen.getByText('students.csv')).toBeInTheDocument();
    const ui = userEvent.setup();
    await ui.click(screen.getByRole('button', { name: 'Import' }));

    expect(
      await screen.findByText('1 created · 1 converted · 1 rejected · 1 failed, out of 4.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Fix these rows in your file and import it again/)).toBeInTheDocument();

    // Rows that need attention come first; the row number is the spreadsheet's.
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Roll no' })).toBeInTheDocument();
    const rejected = within(table).getByText('Rejected').closest('tr')!;
    expect(within(rejected).getAllByRole('cell')[0]).toHaveTextContent('4');
    expect(within(rejected).getByText('roll_no: duplicate of row 2')).toBeInTheDocument();
    expect(within(table).getByText('Failed').closest('tr')!).toHaveTextContent('—');

    await ui.click(screen.getByRole('button', { name: /^All/ }));
    const converted = within(table).getByText('Converted').closest('tr')!;
    expect(within(converted).getByText(/personal Lexly account was converted/)).toBeInTheDocument();
    expect(within(converted).getByRole('link', { name: 'Open R2' })).toHaveAttribute('href', '/college/users/u2');
    expect(within(within(table).getByText('Created').closest('tr')!).getByRole('link')).toHaveAttribute(
      'href',
      '/college/users/u1',
    );
  });

  it('shows IMPORT_FILE_INVALID under the file, with the server reason', async () => {
    server.use(
      http.post(`${API}/college/users/import/professors`, () =>
        apiError(400, 'IMPORT_FILE_INVALID', 'Missing column employee_id'),
      ),
    );
    await renderApp('/college/users/import?kind=professors');
    await screen.findByRole('heading', { level: 1, name: 'Import users' });
    expect(screen.getByRole('radio', { name: 'Professors' })).toBeChecked();
    await chooseFile(new File(['a'], 'staff.xlsx'));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Import' }));
    expect(await screen.findByText("This file can't be imported: Missing column employee_id")).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Results' })).not.toBeInTheDocument();
  });
});
