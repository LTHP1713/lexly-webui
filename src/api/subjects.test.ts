import { describe, expect, it } from 'vitest';
import { toSubject } from './subjects';

describe('toSubject', () => {
  it('normalises blanks, missing lists and counts', () => {
    expect(
      toSubject({
        id: 's1',
        code: 'CON-101',
        name: 'Constitutional Law I',
        description: '   ',
        professors: null,
        assessmentCount: null,
        createdAt: '',
        updatedAt: '',
      }),
    ).toMatchObject({ description: null, professors: [], assessmentCount: 0 });
  });

  it('keeps the server order of professors and the description as written', () => {
    const subject = toSubject({
      id: 's1',
      code: 'CON-101',
      name: 'Constitutional Law I',
      description: 'Line one\nLine two',
      professors: [
        { id: 'p2', fullName: 'Dr. K. Menon' },
        { id: 'p1', fullName: ' ' },
      ],
      assessmentCount: 3,
      createdAt: '',
      updatedAt: '',
    });
    expect(subject.description).toBe('Line one\nLine two');
    expect(subject.professors).toEqual([
      { id: 'p2', fullName: 'Dr. K. Menon' },
      { id: 'p1', fullName: null },
    ]);
    expect(subject.assessmentCount).toBe(3);
  });
});
