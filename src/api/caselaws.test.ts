import { describe, expect, it } from 'vitest';
import { caseLawActs, toCaseLawDetail, type CaseLawDetail } from '@/api/caselaws';

function detail(overrides: Partial<CaseLawDetail> = {}): CaseLawDetail {
  return {
    id: 'c-1',
    title: 'Mohori Bibee v. Dharmodas Ghose',
    citation: '(1903) 30 IA 114',
    court: 'Privy Council',
    caseNumber: null,
    decidedOn: null,
    bench: null,
    judges: null,
    jurisdiction: null,
    caseType: null,
    importance: 'LANDMARK',
    sourcePdfUrl: null,
    onlineSummary: null,
    background: null,
    issues: [],
    arguments: {},
    finalHolding: null,
    ratioDecidendi: [],
    obiterDicta: [],
    importantProvisions: [],
    legalPrinciples: [],
    relatedSections: [],
    ...overrides,
  } as CaseLawDetail;
}

describe('toCaseLawDetail', () => {
  it('turns blank scalars into null', () => {
    const result = toCaseLawDetail(detail({ court: '  ', background: '' }));
    expect(result.court).toBeNull();
    expect(result.background).toBeNull();
  });

  it('drops empty parties, blank entries and issues without a question', () => {
    const result = toCaseLawDetail(
      detail({
        arguments: { PETITIONER: ['First', ' '], RESPONDENT: ['  '] },
        ratioDecidendi: ['Binding', ''],
        issues: [
          { issueNumber: 1, question: 'Is a minor’s agreement void?', reasoning: ' ', finding: 'Yes' },
          { issueNumber: 2, question: '  ', reasoning: null, finding: null },
        ],
      }),
    );
    expect(result.arguments).toEqual({ PETITIONER: ['First'] });
    expect(result.ratioDecidendi).toEqual(['Binding']);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].reasoning).toBeNull();
  });

  it('drops a final holding with neither summary nor outcome', () => {
    expect(toCaseLawDetail(detail({ finalHolding: { summary: ' ', outcome: '' } })).finalHolding).toBeNull();
    expect(toCaseLawDetail(detail({ finalHolding: { summary: null, outcome: 'APPEAL_DISMISSED' } })).finalHolding).toEqual({
      summary: null,
      outcome: 'APPEAL_DISMISSED',
    });
  });
});

describe('caseLawActs', () => {
  it('lists distinct act names in first-seen order', () => {
    const acts = caseLawActs({
      importantProvisions: [
        { law: 'Indian Contract Act, 1872', provision: 'Section 11', relevance: null },
        { law: 'Transfer of Property Act, 1882', provision: 'Section 7', relevance: null },
        { law: 'Indian Contract Act, 1872', provision: 'Section 64', relevance: null },
      ],
    });
    expect(acts).toEqual(['Indian Contract Act, 1872', 'Transfer of Property Act, 1882']);
  });
});
