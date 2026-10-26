/** F5b: Vocab and Maxims against mocked §11b endpoints (F5b.5). */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { listVocab, parseGlossaryLetter, toVocabSummary } from '@/api/vocab';
import { apiError, json, server } from '@/test/server';
import { renderApp, signedInAs } from '@/test/renderApp';
import { mockStudyHub } from '@/test/homes';
import { maximEntry, maximsHandler, page, vocabEntry, vocabHandler } from '@/test/glossary';
import { glossaryCount } from './glossaryFormat';

const college = { id: 'c1', code: 'NLSIU', name: 'National Law School' };

/** Records every `/vocab` query string the screen sends. */
function recordVocab(body: (url: URL) => unknown = () => page([vocabEntry('Consideration')])) {
  const seen: URL[] = [];
  server.use(
    vocabHandler(({ request }) => {
      const url = new URL(request.url);
      seen.push(url);
      return json(body(url) as never);
    }),
  );
  return seen;
}

beforeEach(() => {
  signedInAs({ id: 'u1', role: 'C_STUDENT', loginId: 'R001', college });
});

describe('vocab api (F5b.1)', () => {
  it('encodes # as %23 and leaves out empty filters', async () => {
    const seen = recordVocab(() => page([]));
    await listVocab({ letter: '#', page: 0, size: 20 });
    await listVocab({ query: 'void', letter: null, page: 2, size: 20 });
    expect(seen[0].search).toBe('?page=0&size=20&letter=%23');
    expect(seen[0].searchParams.get('letter')).toBe('#');
    expect(seen[1].searchParams.get('q')).toBe('void');
    expect(seen[1].searchParams.has('letter')).toBe(false);
  });

  it('keeps the server fields and parses letters', () => {
    expect(toVocabSummary(vocabEntry('Contract') as never).source.actShortCode).toBe('ICA');
    expect(parseGlossaryLetter('k')).toBe('K');
    expect(parseGlossaryLetter('#')).toBe('#');
    expect(parseGlossaryLetter('AB')).toBeNull();
    expect(parseGlossaryLetter('')).toBeNull();
  });

  it('words the count line', () => {
    const noun = { singular: 'term', plural: 'terms' };
    expect(glossaryCount(1, noun, null, '')).toBe('1 term');
    expect(glossaryCount(1240, noun, 'K', 'void')).toBe("1,240 terms under K matching 'void'");
  });
});

describe('vocab screen (F5b.3)', () => {
  it('lists entries with their section source and the Library sub-nav', async () => {
    server.use(vocabHandler(() => json(page([vocabEntry('Consideration'), vocabEntry('Contract')]))));
    await renderApp('/vocab');
    expect(await screen.findByRole('heading', { level: 1, name: 'Vocab' })).toBeInTheDocument();
    expect(await screen.findByText('Consideration')).toBeInTheDocument();
    expect(screen.getByText('Meaning of Consideration.')).toBeInTheDocument();
    expect(screen.getByText('2 terms')).toBeInTheDocument();
    const link = screen.getAllByRole('link', { name: 'ICA · s. 2(d)' })[0];
    expect(link).toHaveAttribute('href', '/sections/sec-consideration');
    const library = screen.getByRole('navigation', { name: 'Library' });
    expect(within(library).getByRole('link', { name: 'Vocab' })).toHaveAttribute('aria-current', 'page');
    expect(within(library).getByRole('link', { name: 'Maxims' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Glossary' })).not.toBeInTheDocument();
  });

  it('filters by letter, combines it with the search and resets the page', async () => {
    const seen = recordVocab((url) =>
      page([vocabEntry('Kartavya')], { totalElements: 3, page: Number(url.searchParams.get('page')), totalPages: 3 }),
    );
    const router = await renderApp('/vocab?q=duty&page=2');
    const ui = userEvent.setup();
    expect(await screen.findByText("3 terms matching 'duty'")).toBeInTheDocument();
    expect(seen.at(-1)?.searchParams.get('page')).toBe('1');

    await ui.click(screen.getByRole('button', { name: 'K' }));
    await waitFor(() => expect(router.state.location.search).toBe('?q=duty&letter=K'));
    expect(await screen.findByText("3 terms under K matching 'duty'")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'K' })).toHaveAttribute('aria-pressed', 'true');
    expect(seen.at(-1)?.searchParams.get('letter')).toBe('K');
    expect(seen.at(-1)?.searchParams.get('page')).toBe('0');

    await ui.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() => expect(router.state.location.search).toBe('?q=duty'));
  });

  it('moves along the letter bar with the arrow keys', async () => {
    recordVocab();
    await renderApp('/vocab');
    const ui = userEvent.setup();
    await screen.findByText('Consideration');
    const all = screen.getByRole('button', { name: 'All' });
    expect(all).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('tabindex', '-1');
    all.focus();
    await ui.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'A' })).toHaveFocus();
    await ui.keyboard('{End}');
    expect(screen.getByRole('button', { name: 'Other: not starting with A to Z' })).toHaveFocus();
    await ui.keyboard('{Home}');
    expect(all).toHaveFocus();
  });

  it('sends the # bucket and shows its empty state', async () => {
    const seen = recordVocab(() => page([]));
    const router = await renderApp('/vocab?letter=%23');
    const ui = userEvent.setup();
    expect(await screen.findByText('No terms under #.')).toBeInTheDocument();
    expect(seen.at(-1)?.searchParams.get('letter')).toBe('#');
    await ui.click(screen.getByRole('button', { name: 'Show all letters' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('drops a letter the server would refuse', async () => {
    const seen = recordVocab();
    const router = await renderApp('/vocab?letter=xy');
    await screen.findByText('Consideration');
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(seen.every((url) => !url.searchParams.has('letter'))).toBe(true);
  });

  it('debounces the search into the URL, and offers to clear a search with no results', async () => {
    const seen = recordVocab((url) => (url.searchParams.get('q') ? page([]) : page([vocabEntry('Consideration')])));
    const router = await renderApp('/vocab');
    const ui = userEvent.setup();
    await screen.findByText('Consideration');
    const box = screen.getByRole('searchbox', { name: 'Search terms' });
    expect(box).toHaveAttribute('maxLength', '100');
    await ui.type(box, 'zzz');
    await waitFor(() => expect(router.state.location.search).toBe('?q=zzz'));
    expect(await screen.findByText("No terms match 'zzz'.")).toBeInTheDocument();
    expect(seen.filter((url) => url.searchParams.get('q') === 'zzz')).toHaveLength(1);
    await ui.click(screen.getByRole('button', { name: 'Clear search' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findByText('Consideration')).toBeInTheDocument();
  });

  it('pages with Previous / Next', async () => {
    recordVocab((url) =>
      page([vocabEntry(url.searchParams.get('page') === '1' ? 'Damages' : 'Consideration')], {
        page: Number(url.searchParams.get('page')),
        totalElements: 40,
        totalPages: 2,
      }),
    );
    const router = await renderApp('/vocab');
    const ui = userEvent.setup();
    await screen.findByText('Consideration');
    await ui.click(screen.getByRole('button', { name: 'Next →' }));
    expect(await screen.findByText('Damages')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=2');
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('shows bad filters as such, and other errors with Try again', async () => {
    server.use(vocabHandler(() => apiError(400, 'VALIDATION_ERROR', 'q: size must be between 0 and 100')));
    const router = await renderApp('/vocab?q=x');
    const ui = userEvent.setup();
    expect(await screen.findByText("These filters can't be used.")).toBeInTheDocument();
    server.use(vocabHandler(() => json(page([vocabEntry('Consideration')]))));
    await ui.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findByText('Consideration')).toBeInTheDocument();
  });

  it('shows the generic error for a 402 until F8a', async () => {
    server.use(vocabHandler(() => apiError(402, 'PLAN_REQUIRED', 'Your trial has ended. Choose a plan to continue.')));
    await renderApp('/vocab');
    expect(await screen.findByText('Your trial has ended. Choose a plan to continue.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows the empty glossary', async () => {
    server.use(vocabHandler(() => json(page([]))));
    await renderApp('/vocab');
    expect(await screen.findByText('No terms yet.')).toBeInTheDocument();
  });
});

describe('maxims screen (F5b.3)', () => {
  it('lists maxims with their case-law source', async () => {
    server.use(maximsHandler(() => json(page([maximEntry('Proportionality')]))));
    await renderApp('/maxims');
    expect(await screen.findByRole('heading', { level: 1, name: 'Maxims' })).toBeInTheDocument();
    expect(await screen.findByText('Proportionality')).toBeInTheDocument();
    expect(screen.getByText('1 maxim')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ADR v. Election Commission of India' })).toHaveAttribute(
      'href',
      '/caselaws/case-proportionality',
    );
  });
});

describe('S_STUDENT entry (F5b.2)', () => {
  it('reaches Vocab from the Study hub and switches to Maxims', async () => {
    signedInAs({ id: 'u2', role: 'S_STUDENT' });
    mockStudyHub({ vocabTotal: 1240 });
    server.use(maximsHandler());
    const router = await renderApp('/dashboard');
    const ui = userEvent.setup();
    const placard = await screen.findByRole('link', { name: /Legal terms/ });
    expect(await within(placard).findByText('1,240')).toBeInTheDocument();

    server.use(vocabHandler());
    await ui.click(placard);
    expect(await screen.findByRole('heading', { level: 1, name: 'Vocab' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Library' })).not.toBeInTheDocument();
    const glossary = screen.getByRole('navigation', { name: 'Glossary' });
    await ui.click(within(glossary).getByRole('link', { name: 'Maxims' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Maxims' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/maxims');
  });
});
