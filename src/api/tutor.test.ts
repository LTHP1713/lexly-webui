import { describe, expect, it } from 'vitest';
import {
  toAiUsageDaily,
  toTutorAnswer,
  toTutorConversation,
  toTutorConversationDetail,
  toTutorIndexRun,
  toTutorMessage,
  toTutorQuota,
} from '@/api/tutor';
import { answerMessage, askResponse, conversation, indexRun, usage, usageDay, userMessage } from '@/test/tutor';

describe('tutor mappers', () => {
  it('maps a conversation and keeps the messages in the server order', () => {
    const detail = toTutorConversationDetail({
      ...conversation({ title: '  ' }),
      messages: [userMessage('Q', 'm1'), answerMessage({ id: 'm2' })],
    } as never);
    expect(detail.title).toBe('Untitled chat');
    expect(detail.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(toTutorConversationDetail({ ...conversation() } as never).messages).toEqual([]);
  });

  it('maps citations: library sources keep their id, FILE has none, blanks become null', () => {
    const message = toTutorMessage(answerMessage() as never);
    expect(message.citations).toEqual([
      {
        ref: 1,
        sourceType: 'SECTION',
        sourceId: 'sec-11',
        label: 'Section 11, Indian Contract Act, 1872',
        location: null,
        snippet: 'Every person is competent to contract who is of the age of majority …',
      },
      {
        ref: 2,
        sourceType: 'FILE',
        sourceId: null,
        label: 'Contract notes.pdf',
        location: 'page 4',
        snippet: 'Minors cannot ratify agreements on attaining majority.',
      },
    ]);
    expect(toTutorMessage({ ...answerMessage(), citations: null } as never).citations).toEqual([]);
  });

  it('never gives a question citations or the not-found flag', () => {
    const question = toTutorMessage({ ...userMessage('Q'), notFound: true, citations: [{ ref: 1 }] } as never);
    expect(question).toMatchObject({ role: 'USER', notFound: false, citations: [] });
  });

  it('maps the ask response and the quota', () => {
    const answer = toTutorAnswer(askResponse('Is a contract with a minor void?') as never);
    expect(answer.conversation.id).toBe('conv-1');
    expect(answer.question).toMatchObject({ role: 'USER', content: 'Is a contract with a minor void?' });
    expect(answer.answer.role).toBe('ASSISTANT');
    expect(answer.quota).toEqual({ limit: 10, used: 4, remaining: 6, resetsAt: '2026-10-20T18:30:00Z' });
    expect(toTutorQuota({ limit: 10, used: 10 })).toMatchObject({ remaining: 0, resetsAt: null });
    expect(toTutorConversation(null).id).toBe('');
  });

  it('maps an index run, including a removed starter and running counts', () => {
    expect(toTutorIndexRun(indexRun() as never)).toMatchObject({
      status: 'SUCCEEDED',
      startedBy: { id: 'admin-1', fullName: 'Lexly Admin' },
      files: { ingested: 6, failed: ['Scan.pdf'] },
      chunks: { embedded: 41, reused: 912, removed: 3 },
    });
    const running = toTutorIndexRun({ id: 'r', status: 'RUNNING', startedBy: null, files: null } as never);
    expect(running).toMatchObject({ startedBy: null, files: { ingested: 0, failed: [] }, finishedAt: null });
  });

  it('maps the daily usage, accepting decimals as strings', () => {
    const mapped = toAiUsageDaily({
      ...usage('2026-10-19', '2026-10-20', [usageDay('2026-10-19'), usageDay('2026-10-20', { questions: 2, cost: 0.0123 })]),
      rates: { inputPerMillion: '1.125', outputPerMillion: 5.625, embeddingPerMillion: 0.2 },
    } as never);
    expect(mapped.rates.inputPerMillion).toBe(1.125);
    expect(mapped.days.map((d) => d.date)).toEqual(['2026-10-19', '2026-10-20']);
    expect(mapped.totals).toMatchObject({ questions: 2, cost: 0.0123 });
  });
});
