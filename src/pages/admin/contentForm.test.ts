import { describe, expect, it } from 'vitest';
import type { CaseLawDetail } from '@/api/caselaws';
import { formFromDetail, parseServerErrors, remapListErrors, requestFromForm, validateContent } from './contentForm';

describe('parseServerErrors', () => {
  it('splits comma-joined path: reason pairs onto their paths', () => {
    expect(parseServerErrors('arguments[0].partyType: must not be null, issues[1].question: must not be blank')).toEqual({
      'arguments[0].partyType': 'Must not be null.',
      'issues[1].question': 'Must not be blank.',
    });
  });

  it('keeps commas inside a reason', () => {
    expect(parseServerErrors('title: must be short, clear and unique')).toEqual({ title: 'Must be short, clear and unique.' });
  });

  it('maps an unreadable-body message to its path', () => {
    expect(parseServerErrors('Unknown value at arguments[2].partyType')).toEqual({ 'arguments[2].partyType': 'Unknown value' });
  });

  it('puts anything unrecognised under the empty key', () => {
    expect(parseServerErrors('Something odd happened')).toEqual({ '': 'Something odd happened' });
  });
});

describe('remapListErrors', () => {
  it('moves errors with their rows and drops a removed row’s errors', () => {
    const errors = { 'issues[0].question': 'A', 'issues[2].question': 'C', background: 'B' };
    // New order: old row 2 first, then old row 1; old row 0 removed.
    expect(remapListErrors(errors, 'issues', [2, 1])).toEqual({ 'issues[0].question': 'C', background: 'B' });
  });
});

describe('content form round trip', () => {
  const detail = {
    onlineSummary: 'Summary',
    background: null,
    finalHolding: { summary: null, outcome: 'APPEAL_DISMISSED' },
    issues: [{ issueNumber: 1, question: 'Q?', reasoning: null, finding: 'F' }],
    arguments: { PETITIONER: ['P1', 'P2'], RESPONDENT: ['R1'] },
    ratioDecidendi: ['Ratio'],
    obiterDicta: [],
    importantProvisions: [{ law: 'ICA', provision: 'Section 11', relevance: null }],
    legalPrinciples: [{ title: 'T', explanation: 'E' }],
  } as unknown as CaseLawDetail;

  it('loads and saves unchanged into an identical body', () => {
    expect(requestFromForm(formFromDetail(detail))).toEqual({
      onlineSummary: 'Summary',
      background: null,
      finalHolding: { summary: null, outcome: 'APPEAL_DISMISSED' },
      issues: [{ question: 'Q?', reasoning: null, finding: 'F' }],
      arguments: [
        { partyType: 'PETITIONER', argument: 'P1' },
        { partyType: 'PETITIONER', argument: 'P2' },
        { partyType: 'RESPONDENT', argument: 'R1' },
      ],
      ratioDecidendi: ['Ratio'],
      obiterDicta: [],
      importantProvisions: [{ law: 'ICA', provision: 'Section 11', relevance: null }],
      legalPrinciples: [{ title: 'T', explanation: 'E' }],
    });
  });

  it('flags required and over-long fields by request path', () => {
    const form = formFromDetail(detail);
    form.issues[0].question = ' ';
    form.importantProvisions[0].provision = 'x'.repeat(101);
    expect(validateContent(form)).toEqual({
      'issues[0].question': 'The question is required.',
      'importantProvisions[0].provision': 'The provision must be at most 100 characters.',
    });
  });
});
