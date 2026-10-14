import { describe, expect, it } from 'vitest';
import { API, http, json, server } from '@/test/server';
import { checkUserImportFile, kindOf, listCollegeUsers, toUserKind } from './collegeUsers';

function file(name: string, size: number) {
  const f = new File(['x'], name);
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('college users', () => {
  it('maps the URL kind and the role both ways', () => {
    expect(toUserKind(null)).toBe('students');
    expect(toUserKind('anything')).toBe('students');
    expect(toUserKind('professors')).toBe('professors');
    expect(kindOf('C_PROFESSOR')).toBe('professors');
    expect(kindOf('C_STUDENT')).toBe('students');
  });

  it('sends role, page, size and sort, and q only when set', async () => {
    let query: URLSearchParams | null = null;
    server.use(
      http.get(`${API}/college/users`, ({ request }) => {
        query = new URL(request.url).searchParams;
        return json({
          content: [{ id: 'u1', fullName: ' Asha Rao ', email: 'a@x.in', role: 'C_STUDENT', loginId: 'R1', mustChangePassword: true, createdAt: '' }],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        });
      }),
    );
    const page = await listCollegeUsers({ role: 'C_STUDENT', page: 0, size: 20, sort: 'loginId,asc' });
    expect(Object.fromEntries(query!)).toEqual({ role: 'C_STUDENT', page: '0', size: '20', sort: 'loginId,asc' });
    expect(page.content[0].fullName).toBe('Asha Rao');
  });

  it('checks an import file before upload: extension, empty, 5 MB', () => {
    expect(checkUserImportFile(file('students.txt', 10))).toBe('Choose a .csv or .xlsx file.');
    expect(checkUserImportFile(file('students.CSV', 0))).toBe('This file is empty.');
    expect(checkUserImportFile(file('students.xlsx', 5 * 1024 * 1024 + 1))).toBe(
      'This file is larger than 5 MB. Split it into smaller files.',
    );
    expect(checkUserImportFile(file('students.xlsx', 5 * 1024 * 1024))).toBeNull();
  });
});
