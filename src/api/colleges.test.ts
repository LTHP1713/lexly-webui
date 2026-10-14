import { describe, expect, it } from 'vitest';
import { generateTemporaryPassword, listColleges, toCollege, toUserSummary } from '@/api/colleges';
import { API, http, json, server } from '@/test/server';

describe('college mappers', () => {
  it('fills missing counts with 0', () => {
    const college = toCollege({
      id: 'c1',
      code: 'NLSIU',
      name: 'NLS',
      active: true,
      counts: null,
      createdAt: '2026-10-13T09:15:00Z',
      updatedAt: '2026-10-13T09:15:00Z',
    });
    expect(college.counts).toEqual({ admins: 0, professors: 0, students: 0 });
  });

  it('normalises blank fields and unknown roles', () => {
    expect(
      toUserSummary({
        id: 'u1',
        fullName: ' ',
        email: 'meera@nlsiu.ac.in',
        role: 'ADMIN',
        loginId: null,
        mustChangePassword: true,
        createdAt: '2026-10-13T09:15:00Z',
      }),
    ).toMatchObject({ fullName: null, role: null, mustChangePassword: true });
  });
});

describe('listColleges', () => {
  it('sends only the filters that are set, with page, size and sort', async () => {
    let url: URL | null = null;
    server.use(
      http.get(`${API}/superadmin/colleges`, ({ request }) => {
        url = new URL(request.url);
        return json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 });
      }),
    );
    await listColleges({ q: 'nls', active: false, page: 2, size: 20, sort: 'createdAt,desc' });
    expect(Object.fromEntries(url!.searchParams)).toEqual({
      q: 'nls',
      active: 'false',
      page: '2',
      size: '20',
      sort: 'createdAt,desc',
    });
    await listColleges({ page: 0, size: 20, sort: 'name,asc' });
    expect([...url!.searchParams.keys()].sort()).toEqual(['page', 'size', 'sort']);
  });
});

describe('generateTemporaryPassword', () => {
  it('is 12 characters with no look-alikes, and differs each time', () => {
    const a = generateTemporaryPassword();
    expect(a).toMatch(/^[A-HJ-NP-Za-km-z2-9]{12}$/);
    expect(a).not.toMatch(/[0O1lI]/);
    expect(generateTemporaryPassword()).not.toBe(a);
  });
});
