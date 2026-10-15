import { describe, expect, it } from 'vitest';
import {
  parseImportSource,
  rejectedRowsEnvelope,
  toImportResult,
  unknownActShortCode,
  type ImportResult,
} from '@/api/bulkImport';

describe('parseImportSource', () => {
  it('rejects invalid JSON with the parser message', () => {
    const parsed = parseImportSource('acts', '{ "acts": [ }');
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.error).toMatch(/^This isn't valid JSON: /);
  });

  it('needs the kind’s top-level list', () => {
    expect(parseImportSource('caselaws', '{"acts": []}')).toEqual({
      ok: false,
      error: 'For case laws, the JSON needs a top-level "caseLaws" list.',
    });
    expect(parseImportSource('acts', '[1, 2]')).toMatchObject({ ok: false });
  });

  it('needs actShortCode for sections', () => {
    expect(parseImportSource('sections', '{"sections": [{}]}')).toEqual({
      ok: false,
      error: 'For sections, the JSON needs a top-level "actShortCode" naming the act.',
    });
  });

  it('enforces the row limit and rejects an empty list', () => {
    const tooMany = JSON.stringify({ acts: Array.from({ length: 11 }, () => ({})) });
    expect(parseImportSource('acts', tooMany)).toEqual({ ok: false, error: 'This batch has 11 rows; the limit is 10.' });
    expect(parseImportSource('acts', '{"acts": []}')).toEqual({ ok: false, error: 'The "acts" list is empty.' });
  });

  it('accepts a valid envelope as it is', () => {
    const body = { actShortCode: 'ICA', sections: [{ sectionNumber: '2' }, { sectionNumber: '3' }] };
    expect(parseImportSource('sections', JSON.stringify(body))).toEqual({ ok: true, body, rowCount: 2 });
  });
});

const mixed: ImportResult = toImportResult({
  summary: { total: 4, created: 1, converted: 0, rejected: 2, failed: 1 },
  rows: [
    { index: 0, key: 'ICA-2', status: 'CREATED', id: 'id-2', errors: [] },
    { index: 1, key: 'ICA-2', status: 'REJECTED', id: null, errors: ["sectionNumber: 'ICA-2' is a duplicate of row 0"] },
    { index: 2, key: 'ICA-4', status: 'REJECTED', id: null, errors: ['bodyText: must not be blank'] },
    { index: 3, key: 'ICA-5', status: 'FAILED', id: null, errors: ['Unexpected error while saving'] },
  ],
});

describe('rejectedRowsEnvelope', () => {
  it('keeps the envelope and only the rows that were not created, in order', () => {
    const body = { actShortCode: 'ICA', sections: [{ n: 2 }, { n: '2 again' }, { n: 4 }, { n: 5 }] };
    expect(rejectedRowsEnvelope('sections', body, mixed)).toEqual({
      actShortCode: 'ICA',
      sections: [{ n: '2 again' }, { n: 4 }, { n: 5 }],
    });
  });
});

describe('unknownActShortCode', () => {
  it('names the code when every row was rejected for a missing act', () => {
    const result = toImportResult({
      rows: [0, 1].map((index) => ({
        index,
        key: `XYZ-${index}`,
        status: 'REJECTED',
        id: null,
        errors: ["actShortCode: no bare act found with short code 'XYZ'"],
      })),
    });
    expect(unknownActShortCode('sections', { actShortCode: 'XYZ', sections: [] }, result)).toBe('XYZ');
    expect(unknownActShortCode('sections', { actShortCode: 'ICA', sections: [] }, mixed)).toBeNull();
  });
});

describe('toImportResult', () => {
  it('fills missing lists and counts', () => {
    expect(toImportResult({ rows: [{ index: 0, key: ' ', status: 'CREATED', id: 'a', errors: undefined as never }] })).toEqual({
      summary: { total: 1, created: 0, converted: 0, rejected: 0, failed: 0 },
      rows: [{ index: 0, key: null, status: 'CREATED', id: 'a', errors: [] }],
    });
  });
});
