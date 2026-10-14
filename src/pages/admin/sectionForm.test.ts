import { describe, expect, it } from 'vitest';
import { toAdminSection, type SectionRequest } from '@/api/adminContent';
import { parseServerErrors, remapListErrors } from './contentForm';
import {
  describeSectionPath,
  emptySectionRow,
  errorCountFor,
  formFromSection,
  requestFromSectionForm,
  validateSection,
} from './sectionForm';

/** An `AdminSectionResponse` as the backend sends it (contract §5.2). */
const dto = {
  id: 'sec-2',
  bareActId: 'act-1',
  sectionNumber: '2',
  title: 'Interpretation-clause',
  bodyText: 'In this Act the following words …',
  createdAt: '2026-10-13T09:15:00Z',
  inSimpleWords: 'This section defines the building blocks of a contract.',
  provisionMeaning: [
    { clause: '(a)', title: 'Proposal', explanation: 'An offer.' },
    { clause: null, title: null, explanation: 'The rest.' },
  ],
  illustrations: [
    { id: 'i1', sectionId: 'sec-2', text: 'A offers to sell …', hypothetical: true, displayOrder: 0 },
    { id: 'i2', sectionId: 'sec-2', text: 'B accepts …', hypothetical: false, displayOrder: 1 },
  ],
  exceptions: [
    {
      id: 'e1',
      sectionId: 'sec-2',
      title: 'Agreements without consideration',
      explanation: 'Void unless …',
      displayOrder: 0,
      illustrations: [{ id: 'ei1', text: 'A promises …', hypothetical: false }],
    },
  ],
  keyLegalTerms: [{ term: 'Promisor', definition: 'The person making the proposal.' }],
};

const expectedBody: SectionRequest = {
  sectionNumber: '2',
  title: 'Interpretation-clause',
  bodyText: 'In this Act the following words …',
  inSimpleWords: 'This section defines the building blocks of a contract.',
  provisionMeaning: [
    { clause: '(a)', title: 'Proposal', explanation: 'An offer.', displayOrder: 0 },
    { clause: null, title: null, explanation: 'The rest.', displayOrder: 1 },
  ],
  illustrations: [
    { text: 'A offers to sell …', hypothetical: true, displayOrder: 0 },
    { text: 'B accepts …', hypothetical: false, displayOrder: 1 },
  ],
  exceptions: [
    {
      title: 'Agreements without consideration',
      explanation: 'Void unless …',
      displayOrder: 0,
      illustrations: [{ text: 'A promises …', hypothetical: false }],
    },
  ],
  keyLegalTerms: [{ term: 'Promisor', definition: 'The person making the proposal.', displayOrder: 0 }],
};

describe('section editor round trip (F1.11)', () => {
  it('load → save unchanged sends exactly what was loaded', () => {
    const section = toAdminSection(dto);
    expect(section.actId).toBe('act-1');
    expect(requestFromSectionForm(formFromSection(section))).toEqual(expectedBody);
  });

  it('a second round trip is identical (no drift through the form)', () => {
    const once = requestFromSectionForm(formFromSection(toAdminSection(dto)));
    const reloaded = toAdminSection({ ...dto, ...once, illustrations: once.illustrations, exceptions: once.exceptions });
    expect(requestFromSectionForm(formFromSection(reloaded))).toEqual(once);
  });

  it('blank optional text becomes null; list order becomes displayOrder', () => {
    const form = formFromSection(toAdminSection(dto));
    form.title = '   ';
    form.inSimpleWords = '';
    form.illustrations.reverse();
    const body = requestFromSectionForm(form);
    expect(body.title).toBeNull();
    expect(body.inSimpleWords).toBeNull();
    expect(body.illustrations.map((i) => [i.text, i.displayOrder])).toEqual([
      ['B accepts …', 0],
      ['A offers to sell …', 1],
    ]);
  });
});

describe('validateSection', () => {
  it('mirrors the server’s required fields and limits, nested lists included', () => {
    const form = formFromSection(toAdminSection(dto));
    form.sectionNumber = 'x'.repeat(21);
    form.bodyText = ' ';
    form.exceptions[0].illustrations.push(emptySectionRow.illustration());
    form.keyLegalTerms.push(emptySectionRow.keyLegalTerms());
    expect(validateSection(form)).toEqual({
      sectionNumber: 'The section number must be at most 20 characters.',
      bodyText: 'The section text is required.',
      'exceptions[0].illustrations[1].text': 'The illustration is required.',
      'keyLegalTerms[1].term': 'The term is required.',
      'keyLegalTerms[1].definition': 'The definition is required.',
    });
  });
});

describe('errors and paths', () => {
  it('server paths land on the same rows, nested ones too', () => {
    expect(
      parseServerErrors('exceptions[0].illustrations[1].text: must not be blank, provisionMeaning[1].explanation: must not be blank'),
    ).toEqual({
      'exceptions[0].illustrations[1].text': 'Must not be blank.',
      'provisionMeaning[1].explanation': 'Must not be blank.',
    });
  });

  it('nested errors follow their row when it moves', () => {
    const errors = { 'exceptions[1].illustrations[0].text': 'Required.', 'exceptions[1].explanation': 'Required.' };
    // Swap the nested illustrations 0 and 1 of exception 1.
    expect(remapListErrors(errors, 'exceptions[1].illustrations', [1, 0])).toEqual({
      'exceptions[1].illustrations[1].text': 'Required.',
      'exceptions[1].explanation': 'Required.',
    });
    // Move exception 1 to the top.
    expect(remapListErrors(errors, 'exceptions', [1, 0])).toEqual({
      'exceptions[0].illustrations[0].text': 'Required.',
      'exceptions[0].explanation': 'Required.',
    });
  });

  it('counts errors per group and describes paths for the summary', () => {
    const errors = { sectionNumber: 'x', 'exceptions[0].illustrations[1].text': 'x', 'exceptions[2].title': 'x' };
    expect(errorCountFor(errors, ['exceptions'])).toBe(2);
    expect(errorCountFor(errors, ['sectionNumber', 'title', 'bodyText'])).toBe(1);
    expect(describeSectionPath('exceptions[0].illustrations[1].text')).toBe('Exception 1, illustration 2, text');
    expect(describeSectionPath('keyLegalTerms[3].definition')).toBe('Term 4, definition');
    expect(describeSectionPath('sectionNumber')).toBe('Section number');
  });
});
