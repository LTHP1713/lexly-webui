/** F5a.4: the SUPERADMIN tutor admin, index and spend tabs (F5a.6). */
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API, apiError, http, json, server } from '@/test/server';
import { renderApp, signedInAs } from '@/test/renderApp';
import { indexRun, indexRunsHandler, startIndexRunHandler, usage, usageDay, usageHandler } from '@/test/tutor';
import { POLL_MS } from './IndexTab';

beforeEach(() => {
  signedInAs({ id: 'sa', role: 'SUPERADMIN' });
  server.use(
    http.get(`${API}/superadmin/colleges`, () =>
      json({ content: [{ id: 'c1', code: 'NLSIU', name: 'National Law School', active: true }], page: 0, size: 100, totalElements: 1, totalPages: 1 }),
    ),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('index tab', () => {
  it('shows the latest run and the earlier ones', async () => {
    server.use(
      indexRunsHandler(() =>
        json([
          indexRun({ status: 'FAILED', error: 'The PDF folder is not mounted.' }),
          indexRun({ id: 'run-0', startedBy: null }),
        ]),
      ),
    );
    await renderApp('/admin/tutor');
    expect(await screen.findByRole('heading', { level: 1, name: 'Tutor admin' })).toBeInTheDocument();
    const latest = await screen.findByRole('region', { name: 'Latest run' });
    expect(within(latest).getByText('Failed')).toBeInTheDocument();
    expect(within(latest).getByRole('alert')).toHaveTextContent('The PDF folder is not mounted.');
    expect(within(latest).getByText(/by Lexly Admin/)).toBeInTheDocument();
    expect(within(latest).getByText('4 min 12 s')).toBeInTheDocument();
    expect(within(latest).getByText('Scan.pdf')).toBeInTheDocument();
    expect(within(latest).getByText('41 embedded · 912 reused · 3 removed')).toBeInTheDocument();
    const previous = screen.getByRole('region', { name: 'Previous runs' });
    expect(within(previous).getByText('Removed user')).toBeInTheDocument();
  });

  it('re-indexes after confirming, polls while running and stops when the run finishes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let gets = 0;
    let started = false;
    server.use(
      indexRunsHandler(() => {
        gets += 1;
        if (!started) return json([indexRun({ id: 'run-0' })]);
        // The second poll after starting sees it finish.
        return json(
          gets >= 3
            ? [indexRun({ id: 'run-1' }), indexRun({ id: 'run-0' })]
            : [indexRun({ id: 'run-1', status: 'RUNNING', finishedAt: null }), indexRun({ id: 'run-0' })],
        );
      }),
      startIndexRunHandler(() => {
        started = true;
        return json(indexRun({ id: 'run-1', status: 'RUNNING', finishedAt: null, chunks: { embedded: 0, reused: 0, removed: 0 } }), 202);
      }),
    );
    await renderApp('/admin/tutor');
    const ui = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await screen.findByRole('region', { name: 'Latest run' });
    expect(gets).toBe(1);

    await ui.click(screen.getAllByRole('button', { name: 'Re-index…' })[0]);
    expect(screen.getByText(/re-reads the PDF folder and the whole library/)).toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: 'Re-index' }));

    const latest = await screen.findByRole('region', { name: 'Latest run' });
    expect(await within(latest).findByText('Running')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Re-index…' })[0]).toBeDisabled();

    await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
    await waitFor(() => expect(gets).toBe(2));
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
    await waitFor(() => expect(gets).toBe(3));
    expect(await within(screen.getByRole('region', { name: 'Latest run' })).findByText('Succeeded')).toBeInTheDocument();
    expect(screen.getByText('Re-index finished: Succeeded.')).toBeInTheDocument();

    // Finished: no more polling.
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS * 3));
    expect(gets).toBe(3);
  });

  it('treats INDEX_RUN_IN_PROGRESS as "already running" and shows that run', async () => {
    let calls = 0;
    server.use(
      indexRunsHandler(() =>
        json(++calls === 1 ? [] : [indexRun({ status: 'RUNNING', finishedAt: null })]),
      ),
      startIndexRunHandler(() => apiError(409, 'INDEX_RUN_IN_PROGRESS')),
    );
    await renderApp('/admin/tutor');
    const ui = userEvent.setup();
    expect(await screen.findByText(/hasn.t been indexed yet/)).toBeInTheDocument();
    await ui.click(screen.getAllByRole('button', { name: 'Re-index…' })[0]);
    await ui.click(screen.getByRole('button', { name: 'Re-index' }));
    expect(await screen.findByText('A re-index is already running.')).toBeInTheDocument();
    expect(await within(await screen.findByRole('region', { name: 'Latest run' })).findByText('Running')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('spend tab', () => {
  it('loads the totals and chart, and puts the filters in the URL', async () => {
    const requests: URL[] = [];
    server.use(
      usageHandler(({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        const from = url.searchParams.get('from') ?? '';
        const to = url.searchParams.get('to') ?? '';
        return json(
          usage(from, to, [
            usageDay(from, { questions: 3, inputTokens: 1000, cost: 0.0102 }),
            usageDay(to, { questions: 39, indexRuns: 1, cost: 0.6345 }),
          ]),
        );
      }),
    );
    const router = await renderApp('/admin/tutor?tab=spend');
    const ui = userEvent.setup();
    expect(await screen.findByText('$0.6447')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Daily AI cost from .* total \$0\.6447$/ })).toBeInTheDocument();
    expect(requests[0].searchParams.has('collegeId')).toBe(false);
    expect(screen.getByText(/Rates now: \$1\.125 \/ \$5\.625 \/ \$0\.2 per million/)).toBeInTheDocument();
    expect(screen.queryByText(/Index runs aren.t tied to a college or role/)).not.toBeInTheDocument();

    await ui.selectOptions(screen.getByLabelText('Role'), 'C_STUDENT');
    await ui.selectOptions(await screen.findByLabelText('College'), 'c1');
    await waitFor(() => expect(router.state.location.search).toContain('collegeId=c1'));
    expect(router.state.location.search).toContain('role=C_STUDENT');
    expect(router.state.location.search).toContain('tab=spend');
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('collegeId')).toBe('c1'));
    expect(requests.at(-1)?.searchParams.get('role')).toBe('C_STUDENT');
    expect(await screen.findByText(/Index runs aren.t tied to a college or role, so they.re excluded\./)).toBeInTheDocument();

    // The chart's tooltip follows the keyboard.
    screen.getByRole('img', { name: /Daily AI cost/ }).focus();
    await ui.keyboard('{Home}');
    expect(screen.getByText(/ · \$0\.0102 · 3 questions$/)).toBeInTheDocument();

    await ui.click(screen.getByRole('button', { name: 'Show as table' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('checks the date range before asking the server', async () => {
    const requests: URL[] = [];
    server.use(
      usageHandler(({ request }) => {
        requests.push(new URL(request.url));
        return json(usage('2026-10-01', '2026-10-01', [usageDay('2026-10-01')]));
      }),
    );
    await renderApp('/admin/tutor?tab=spend&from=2026-10-05&to=2026-10-01');
    expect(await screen.findByText('The start date must be on or before the end date.')).toBeInTheDocument();
    expect(screen.getByLabelText('From')).toHaveAttribute('aria-invalid', 'true');
    expect(requests).toHaveLength(0);
  });

  it('refuses a range over 366 days', async () => {
    server.use(usageHandler(() => json({})));
    await renderApp('/admin/tutor?tab=spend&from=2025-01-01&to=2026-10-01');
    expect(await screen.findByText('Choose a range of at most 366 days.')).toBeInTheDocument();
  });
});
