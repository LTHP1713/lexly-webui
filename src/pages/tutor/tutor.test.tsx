/** F5a.3: the tutor screen against mocked §11a endpoints (F5a.6). */
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiError, HttpResponse, json, server } from '@/test/server';
import { renderApp, signedInAs } from '@/test/renderApp';
import { mockStudyHub } from '@/test/homes';
import {
  answerMessage,
  askHandler,
  askResponse,
  conversation,
  conversationHandler,
  conversationsHandler,
  deleteConversationHandler,
  quota,
  quotaHandler,
  userMessage,
} from '@/test/tutor';

const college = { id: 'c1', code: 'NLSIU', name: 'National Law School' };
const QUESTION = 'Is a contract with a minor void?';

function composer() {
  return screen.getByRole('textbox', { name: 'Your question' });
}

beforeEach(() => {
  signedInAs({ id: 'u1', role: 'C_STUDENT', loginId: 'R001', college });
  server.use(quotaHandler(), conversationsHandler());
});

describe('tutor (F5a.3)', () => {
  it('asks in a new chat: pending message, cited answer, URL gets the id, quota from the response', async () => {
    let release: () => void = () => undefined;
    const answered = new Promise<void>((resolve) => {
      release = resolve;
    });
    let body: unknown;
    server.use(
      askHandler(async ({ request }) => {
        body = await request.json();
        await answered;
        return json(askResponse(QUESTION));
      }),
      conversationHandler(() =>
        json({ ...conversation(), messages: [userMessage(QUESTION), answerMessage()] }),
      ),
    );
    const router = await renderApp('/tutor');
    const ui = userEvent.setup();
    expect(await screen.findByRole('heading', { level: 1, name: 'Ask the tutor' })).toBeInTheDocument();
    expect(await screen.findByText(/7 of 10 questions left today · resets at/)).toBeInTheDocument();
    expect(screen.getByText('No chats in the last 24 hours.')).toBeInTheDocument();

    await ui.type(composer(), QUESTION);
    await ui.keyboard('{Enter}');

    expect(await screen.findAllByText('Answering… this can take up to a minute')).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'New chat' })).toBeDisabled();
    expect(composer()).toHaveValue('');
    expect(body).toEqual({ conversationId: null, question: QUESTION });

    release();
    expect(await screen.findByRole('button', { name: /^Source 1: Section 11/ })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutor/conv-1'));
    expect(router.state.historyAction).toBe('REPLACE');
    expect(screen.getByText(/6 of 10 questions left today/)).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });

  it('links library sources and leaves study-material files unlinked', async () => {
    server.use(conversationHandler(() => json({ ...conversation(), messages: [userMessage(QUESTION), answerMessage()] })));
    await renderApp('/tutor/conv-1');
    const sources = await screen.findByRole('region', { name: 'Sources' });
    expect(within(sources).getByRole('link', { name: 'Section 11, Indian Contract Act, 1872' })).toHaveAttribute(
      'href',
      '/sections/sec-11',
    );
    expect(within(sources).getByText(/Contract notes\.pdf · page 4/)).toBeInTheDocument();
    expect(within(sources).getAllByRole('link')).toHaveLength(1);

    // A marker focuses its source.
    await userEvent.setup().click(screen.getByRole('button', { name: /^Source 2: Contract notes/ }));
    expect(document.activeElement?.id).toBe('source-m-a-2');
  });

  it('turns a case-law citation into a case-law link', async () => {
    server.use(
      conversationHandler(() =>
        json({
          ...conversation(),
          messages: [
            userMessage(QUESTION),
            answerMessage({
              content: 'See [1].',
              citations: [{ ref: 1, sourceType: 'CASE_LAW', sourceId: 'cl-9', label: 'Mohori Bibee v. Dharmodas Ghose', location: null, snippet: null }],
            }),
          ],
        }),
      ),
    );
    await renderApp('/tutor/conv-1');
    expect(await screen.findByRole('link', { name: 'Mohori Bibee v. Dharmodas Ghose' })).toHaveAttribute(
      'href',
      '/caselaws/cl-9',
    );
  });

  it('shows a not-found answer as a note with no sources', async () => {
    server.use(
      conversationHandler(() =>
        json({
          ...conversation(),
          messages: [
            userMessage('What is the GST rate on pizza?'),
            answerMessage({ content: "I couldn't find this in Lexly's sources.", notFound: true, citations: [] }),
          ],
        }),
      ),
    );
    await renderApp('/tutor/conv-1');
    expect(await screen.findByText("I couldn't find this in Lexly's sources.")).toBeInTheDocument();
    expect(screen.getByText('Try naming the act or section.')).toBeInTheDocument();
    expect(screen.getByText('This still used one of today’s questions.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Sources' })).not.toBeInTheDocument();
  });

  it('on QUOTA_EXCEEDED disables the composer, keeps the question and shows the reset time', async () => {
    let quotaCalls = 0;
    server.use(
      quotaHandler(() => json(++quotaCalls === 1 ? quota({ used: 9, remaining: 1 }) : quota({ used: 10, remaining: 0 }))),
      askHandler(() => apiError(429, 'QUOTA_EXCEEDED', "You have used today's 10 questions.")),
    );
    await renderApp('/tutor');
    const ui = userEvent.setup();
    await screen.findByText(/1 of 10 questions left today/);
    await ui.type(composer(), QUESTION);
    await ui.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText(/You’ve used today’s 10 questions\. They reset at midnight India time \(/)).toBeInTheDocument();
    expect(composer()).toHaveValue(QUESTION);
    expect(composer()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await waitFor(() => expect(quotaCalls).toBe(2));
    expect(await screen.findByText(/0 of 10 questions left today/)).toBeInTheDocument();
  });

  it('on AI_UNAVAILABLE marks the question failed, and Try again resends it', async () => {
    const bodies: unknown[] = [];
    server.use(
      askHandler(async ({ request }) => {
        bodies.push(await request.json());
        return bodies.length === 1 ? apiError(503, 'AI_UNAVAILABLE') : json(askResponse(QUESTION));
      }),
      conversationHandler(() => json({ ...conversation(), messages: [userMessage(QUESTION), answerMessage()] })),
    );
    const router = await renderApp('/tutor');
    const ui = userEvent.setup();
    await screen.findByText(/questions left today/);
    await ui.type(composer(), QUESTION);
    await ui.keyboard('{Enter}');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The tutor couldn’t answer just now. Your question wasn’t counted.');
    expect(screen.getByText(QUESTION)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();

    await ui.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutor/conv-1'));
    expect(bodies).toEqual([
      { conversationId: null, question: QUESTION },
      { conversationId: null, question: QUESTION },
    ]);
  });

  it('after a lost connection, says the tutor may have answered and refreshes the chats', async () => {
    let listCalls = 0;
    server.use(
      conversationsHandler(() => {
        listCalls += 1;
        return json([]);
      }),
      askHandler(() => HttpResponse.error()),
    );
    await renderApp('/tutor');
    const ui = userEvent.setup();
    await screen.findByText(/questions left today/);
    const before = listCalls;
    await ui.type(composer(), QUESTION);
    await ui.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The answer didn’t reach you. The tutor may still have answered, so check Your chats before trying again.',
    );
    await waitFor(() => expect(listCalls).toBeGreaterThan(before));
  });

  it('Edit question puts a failed question back in the composer', async () => {
    server.use(askHandler(() => apiError(503, 'AI_UNAVAILABLE')));
    await renderApp('/tutor');
    const ui = userEvent.setup();
    await screen.findByText(/questions left today/);
    await ui.type(composer(), QUESTION);
    await ui.keyboard('{Enter}');
    await ui.click(await screen.findByRole('button', { name: 'Edit question' }));
    expect(composer()).toHaveValue(QUESTION);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('checks a blank question and Shift+Enter adds a line instead of sending', async () => {
    await renderApp('/tutor');
    const ui = userEvent.setup();
    await screen.findByText(/questions left today/);
    await ui.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Type a question first.')).toBeInTheDocument();
    await ui.type(composer(), 'Line one{Shift>}{Enter}{/Shift}Line two');
    expect(composer()).toHaveValue('Line one\nLine two');
    expect(screen.getByText('17 / 2,000')).toBeInTheDocument();
  });

  it('a conversation that expired before sending goes back to a new chat with the question kept', async () => {
    server.use(
      conversationHandler(() => json({ ...conversation(), messages: [userMessage(QUESTION), answerMessage()] })),
      askHandler(() => apiError(404, 'NOT_FOUND')),
    );
    const router = await renderApp('/tutor/conv-1');
    const ui = userEvent.setup();
    await screen.findByRole('region', { name: 'Sources' });
    await ui.type(composer(), 'And a follow-up?');
    await ui.keyboard('{Enter}');
    expect(await screen.findByText(/This conversation has expired or was deleted\. Your question is still below/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/tutor');
    expect(composer()).toHaveValue('And a follow-up?');
  });

  it('opening an expired conversation offers a new chat', async () => {
    server.use(conversationHandler(() => apiError(404, 'NOT_FOUND')));
    const router = await renderApp('/tutor/gone');
    expect(await screen.findByRole('heading', { name: 'This conversation has expired or was deleted.' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Page not found' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getAllByRole('button', { name: 'New chat' })[1]);
    expect(router.state.location.pathname).toBe('/tutor');
  });

  it('lists chats with their expiry and deletes one after confirming', async () => {
    let deleted = false;
    server.use(
      conversationsHandler(() => json(deleted ? [] : [conversation()])),
      conversationHandler(() => json({ ...conversation(), messages: [userMessage(QUESTION), answerMessage()] })),
      deleteConversationHandler(() => {
        deleted = true;
        return new Response(null, { status: 204 });
      }),
    );
    const router = await renderApp('/tutor/conv-1');
    const ui = userEvent.setup();
    const chats = await screen.findByRole('complementary', { name: 'Your chats' });
    const link = await within(chats).findByRole('link', { name: /Is a contract with a minor void\?/ });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(within(link).getByText('deletes in 23 h')).toBeInTheDocument();

    await ui.click(within(chats).getByRole('button', { name: `Delete chat: ${QUESTION}` }));
    expect(screen.getByText(/This chat will be deleted now\./)).toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: 'Delete chat' }));
    expect(await screen.findByText('Chat deleted.')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/tutor'));
    expect(await within(chats).findByText('No chats in the last 24 hours.')).toBeInTheDocument();
  });

  it('fills the composer from an example question', async () => {
    await renderApp('/tutor');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'When can a court grant anticipatory bail?' }));
    expect(composer()).toHaveValue('When can a court grant anticipatory bail?');
    expect(composer()).toHaveFocus();
  });
});

describe('tutor access', () => {
  it('is in every role’s nav, and only SUPERADMIN sees the admin link', async () => {
    await renderApp('/tutor');
    await screen.findByRole('heading', { level: 1, name: 'Ask the tutor' });
    expect(screen.getAllByRole('link', { name: 'Tutor' })[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Tutor admin' })).not.toBeInTheDocument();
  });

  it('keeps a non-SUPERADMIN out of the tutor admin', async () => {
    signedInAs({ role: 'S_STUDENT', firstName: 'Priya' });
    mockStudyHub();
    const router = await renderApp('/admin/tutor');
    expect(await screen.findByRole('heading', { level: 1, name: 'Study hub' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(screen.queryByRole('heading', { name: 'Tutor admin' })).not.toBeInTheDocument();
  });

  it('shows SUPERADMIN the admin link', async () => {
    signedInAs({ id: 'sa', role: 'SUPERADMIN' });
    await renderApp('/tutor');
    expect(await screen.findByRole('link', { name: 'Tutor admin' })).toHaveAttribute('href', '/admin/tutor');
  });
});
