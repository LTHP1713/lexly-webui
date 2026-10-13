import { describe, expect, it } from 'vitest';
import { compareSectionNumbers, getSection, listSections } from '@/api/content';
import { API, http, json, server } from '@/test/server';

describe('compareSectionNumbers', () => {
  it('orders numerically, then by letter suffix', () => {
    const numbers = ['20', '19B', '2', '19AA', '10', '19', '19A', '1'];
    expect([...numbers].sort(compareSectionNumbers)).toEqual(['1', '2', '10', '19', '19A', '19AA', '19B', '20']);
  });

  it('puts blank numbers last', () => {
    expect(['', '3', '1'].sort(compareSectionNumbers)).toEqual(['1', '3', '']);
  });
});

describe('listSections', () => {
  it('keeps natural order even if the server sends string order', async () => {
    server.use(
      http.get(`${API}/acts/act-1/sections`, () =>
        json([
          { id: 'a', sectionNumber: '10', title: 'Ten' },
          { id: 'b', sectionNumber: '2', title: 'Two' },
          { id: 'c', sectionNumber: '1', title: 'One' },
        ]),
      ),
    );
    expect((await listSections('act-1')).map((s) => s.sectionNumber)).toEqual(['1', '2', '10']);
  });
});

describe('getSection (toSectionDetail)', () => {
  it('normalises missing study content to empty lists and nulls', async () => {
    server.use(
      http.get(`${API}/sections/s-1`, () =>
        json({ sectionNumber: '2', title: 'Interpretation-clause', bodyText: 'In this Act …', inSimpleWords: '   ' }),
      ),
    );
    const section = await getSection('s-1');
    expect(section).toMatchObject({
      id: 's-1',
      inSimpleWords: null,
      provisionMeaning: [],
      illustrations: [],
      exceptions: [],
      keyLegalTerms: [],
      actId: null,
      prev: null,
      next: null,
    });
  });

  it('drops blank illustrations and keeps the hypothetical flag, nested ones included', async () => {
    server.use(
      http.get(`${API}/sections/s-2`, () =>
        json({
          id: 's-2',
          sectionNumber: '10',
          title: null,
          bodyText: 'All agreements …',
          illustrations: [{ text: ' A offers … ', hypothetical: true }, { text: '  ' }, { text: 'From the Act' }],
          exceptions: [{ title: null, explanation: 'Unless …', illustrations: [{ text: 'X', hypothetical: false }, { text: '' }] }],
        }),
      ),
    );
    const section = await getSection('s-2');
    expect(section.illustrations).toEqual([
      { text: 'A offers …', hypothetical: true },
      { text: 'From the Act', hypothetical: false },
    ]);
    expect(section.exceptions[0].illustrations).toEqual([{ text: 'X', hypothetical: false }]);
  });
});
