import { describe, expect, it } from 'vitest';
import { canOpen, hasLibrarySubNav, homeFor, isNavItemActive, LIBRARY_HOME, navFor, ROLES, sidebarFor, toRole } from '@/auth/roles';

describe('toRole', () => {
  it('accepts the five P1 roles only', () => {
    for (const role of ROLES) expect(toRole(role)).toBe(role);
    for (const legacy of ['ADMIN', 'STUDENT', 'LAWYER', '', null, 42]) expect(toRole(legacy)).toBeNull();
  });
});

describe('homeFor', () => {
  it('sends an unknown role to the Library', () => {
    expect(homeFor(null)).toBe(LIBRARY_HOME);
    expect(homeFor('S_STUDENT')).toBe('/dashboard');
    expect(homeFor('SUPERADMIN')).toBe('/admin');
    expect(homeFor('C_ADMIN')).toBe('/college');
    expect(homeFor('C_PROFESSOR')).toBe('/professor');
    expect(homeFor('C_STUDENT')).toBe('/student');
  });

  it('gives every role a home it may open', () => {
    for (const role of ROLES) expect(canOpen(role, homeFor(role))).toBe(true);
  });
});

describe('canOpen', () => {
  it('keeps role areas to their role and leaves the Library open', () => {
    expect(canOpen('SUPERADMIN', '/admin/caselaws/123')).toBe(true);
    expect(canOpen('C_ADMIN', '/admin/caselaws')).toBe(false);
    expect(canOpen('S_STUDENT', '/admin')).toBe(false);
    expect(canOpen('SUPERADMIN', '/dashboard')).toBe(false);
    expect(canOpen(null, '/acts')).toBe(true);
    expect(canOpen('C_STUDENT', '/caselaws/1')).toBe(true);
  });

  it('matches whole path segments only', () => {
    expect(canOpen('S_STUDENT', '/administrator-guide')).toBe(true);
  });
});

describe('navFor', () => {
  it('keeps S_STUDENT’s existing tabs and gives other roles the Library', () => {
    expect(navFor('S_STUDENT').map((i) => i.label)).toEqual(['Home', 'Bare Acts', 'Practice', 'Tutor', 'Profile']);
    for (const role of ROLES.filter((r) => r !== 'S_STUDENT')) {
      expect(navFor(role).map((i) => i.label)).toContain('Library');
    }
  });

  it('gives every role the Tutor; SUPERADMIN’s also covers the tutor admin', () => {
    for (const role of ROLES) expect(navFor(role).map((i) => i.to)).toContain('/tutor');
    const tutor = navFor('SUPERADMIN').find((i) => i.to === '/tutor');
    expect(tutor && isNavItemActive(tutor, '/admin/tutor')).toBe(true);
    expect(navFor(null).map((i) => i.label)).toEqual(['Library']);
    expect(navFor(null).map((i) => i.label)).toEqual(['Library']);
  });

  it('never lists more than 5 items or an item the role may not open', () => {
    for (const role of ROLES) {
      const items = navFor(role);
      expect(items.length).toBeLessThanOrEqual(5);
      for (const item of items) expect(canOpen(role, item.to)).toBe(true);
    }
  });

  it('shows the Library sub-nav to every role but S_STUDENT', () => {
    expect(hasLibrarySubNav('S_STUDENT')).toBe(false);
    expect(hasLibrarySubNav('C_PROFESSOR')).toBe(true);
  });
});

describe('sidebarFor', () => {
  it('puts the role home first and keeps every nav item', () => {
    expect(sidebarFor('C_ADMIN').map((i) => i.label)).toEqual(['Overview', 'Users', 'Subjects', 'Audit', 'Tutor', 'Library']);
    expect(sidebarFor('S_STUDENT').map((i) => i.label)).toEqual(['Study hub', 'Bare Acts', 'Practice', 'Tutor', 'Profile']);
    expect(sidebarFor(null).map((i) => i.label)).toEqual(['Library']);
    for (const role of ROLES) for (const item of sidebarFor(role)) expect(canOpen(role, item.to)).toBe(true);
  });

  it('lights a home item only on the home itself', () => {
    const [overview] = sidebarFor('SUPERADMIN');
    expect(isNavItemActive(overview, '/admin')).toBe(true);
    expect(isNavItemActive(overview, '/admin/colleges')).toBe(false);
  });
});
