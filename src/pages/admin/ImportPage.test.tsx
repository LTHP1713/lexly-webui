/** F1.9 bulk import: client checks, a batch with mixed outcomes, and a rejected envelope (F1.11). */
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { API, apiError, http, json, server } from '@/test/server';
import { renderApp, signedInAs } from '@/test/renderApp';

const batch = {
  actShortCode: 'ICA',
  sections: [
    { sectionNumber: '2', bodyText: 'a' },
    { sectionNumber: '2', bodyText: 'b' },
    { sectionNumber: '4', bodyText: '' },
  ],
};

beforeEach(() => {
  signedInAs({ role: 'SUPERADMIN' });
});

function setSource(text: string) {
  // `fireEvent.change` rather than typing: user-event treats `{` and `[` as key descriptors.
  fireEvent.change(screen.getByLabelText('JSON'), { target: { value: text } });
}

describe('import page', () => {
  it('checks the envelope on the client and sends nothing when it is wrong', async () => {
    let called = false;
    server.use(
      http.post(`${API}/admin/bulk/sections`, () => {
        called = true;
        return json({});
      }),
    );
    await renderApp('/admin/import?kind=sections');
    expect(await screen.findByText('Up to 100 sections of one act per batch.')).toBeInTheDocument();
    setSource('{"sections": [');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Import' }));
    expect(screen.getByText(/^This isn't valid JSON: /)).toBeInTheDocument();
    expect(screen.getByLabelText('JSON')).toHaveFocus();
    expect(called).toBe(false);
  });

  it('shows the per-row result, rejected and failed rows first', async () => {
    let sent: unknown = null;
    server.use(
      http.post(`${API}/admin/bulk/sections`, async ({ request }) => {
        sent = await request.json();
        return json({
          summary: { total: 3, created: 1, rejected: 1, failed: 1 },
          rows: [
            { index: 0, key: 'ICA-2', status: 'CREATED', id: 'sec-2', errors: [] },
            { index: 1, key: 'ICA-2', status: 'REJECTED', id: null, errors: ["sectionNumber: 'ICA-2' is a duplicate of row 0"] },
            { index: 2, key: 'ICA-4', status: 'FAILED', id: null, errors: ['Unexpected error while saving'] },
          ],
        });
      }),
      http.get(`${API}/acts`, () => json([])),
    );
    await renderApp('/admin/import?kind=sections');
    await screen.findByRole('heading', { level: 1, name: 'Import content' });
    setSource(JSON.stringify(batch));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(await screen.findByText('1 created · 1 rejected · 1 failed, out of 3.')).toBeInTheDocument();
    expect(sent).toEqual(batch);
    expect(screen.getByRole('button', { name: 'Rejected (1)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Failed (1)' })).toHaveAttribute('aria-pressed', 'true');
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText("sectionNumber: 'ICA-2' is a duplicate of row 0")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download rejected rows' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All (3)' }));
    expect(within(screen.getByRole('table')).getByRole('link', { name: 'Open ICA-2' })).toHaveAttribute(
      'href',
      '/admin/sections/sec-2',
    );
  });

  it('a 400 for the envelope shows the server message and no results', async () => {
    server.use(
      http.post(`${API}/admin/bulk/sections`, () =>
        apiError(400, 'VALIDATION_ERROR', 'sections: size must be between 1 and 100'),
      ),
    );
    await renderApp('/admin/import?kind=sections');
    await screen.findByRole('heading', { level: 1, name: 'Import content' });
    setSource(JSON.stringify(batch));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Import' }));
    expect(
      await screen.findByText('The batch was rejected: sections: size must be between 1 and 100'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Results' })).not.toBeInTheDocument();
  });
});
