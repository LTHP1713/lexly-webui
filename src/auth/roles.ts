/**
 * The five roles (contract §0.7) and everything the UI derives from a role: its label, its home,
 * which route areas it may open and its navigation (plan §3.2, UI spec §0.7 and F0.3). Role checks
 * here are only a convenience for routing; the server enforces access on every call.
 */
import type { ComponentType } from 'react';
import {
  BookIcon,
  ChecklistIcon,
  ClockIcon,
  CourthouseIcon,
  DocumentIcon,
  HomeIcon,
  UserIcon,
  UsersIcon,
} from '@/components/icons/Icons';

export const ROLES = ['SUPERADMIN', 'C_ADMIN', 'C_PROFESSOR', 'C_STUDENT', 'S_STUDENT'] as const;
export type Role = (typeof ROLES)[number];

/** Anything else (an unknown or missing role) is `null`: such a user gets the Library only. */
export function toRole(value: unknown): Role | null {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value) ? (value as Role) : null;
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: 'Super admin',
  C_ADMIN: 'College admin',
  C_PROFESSOR: 'Professor',
  C_STUDENT: 'Student',
  S_STUDENT: 'Student',
};

/** The only route reachable while `mustChangePassword` is set (contract §1.6). */
export const CHANGE_PASSWORD_PATH = '/change-password';

/** Shared read-only content every role may open. Also the home of a user with an unknown role. */
export const LIBRARY_HOME = '/acts';

/** Each role's home (UI spec §0.7, F1.4). The professor and student homes are placeholders until F3. */
const HOMES: Record<Role, string> = {
  SUPERADMIN: '/admin',
  C_ADMIN: '/college',
  C_PROFESSOR: '/professor',
  C_STUDENT: '/student',
  S_STUDENT: '/dashboard',
};

export function homeFor(role: Role | null): string {
  return role ? HOMES[role] : LIBRARY_HOME;
}

/** Route areas that belong to one role; every other signed-in route is open to all roles. */
const AREAS: { prefix: string; roles: readonly Role[] }[] = [
  { prefix: '/admin', roles: ['SUPERADMIN'] },
  { prefix: '/college', roles: ['C_ADMIN'] },
  { prefix: '/professor', roles: ['C_PROFESSOR'] },
  { prefix: '/student', roles: ['C_STUDENT'] },
  { prefix: '/dashboard', roles: ['S_STUDENT'] },
  { prefix: '/practice', roles: ['S_STUDENT'] },
];

function inArea(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Whether `role` may open `pathname` (used to honour a "from" location after sign-in). */
export function canOpen(role: Role | null, pathname: string): boolean {
  const area = AREAS.find((a) => inArea(pathname, a.prefix));
  return !area || (role !== null && area.roles.includes(role));
}

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  /** Path prefixes that count as "in" this item. */
  matches: string[];
}

const LIBRARY: NavItem = {
  to: LIBRARY_HOME,
  label: 'Library',
  icon: BookIcon,
  matches: ['/acts', '/sections', '/search', '/caselaws'],
};

/** A nav item is only listed once its screens exist (UI spec F0.3). At most 5 per role. */
const NAV: Record<Role, NavItem[]> = {
  SUPERADMIN: [
    { to: '/admin/colleges', label: 'Colleges', icon: CourthouseIcon, matches: ['/admin/colleges'] },
    {
      to: '/admin/acts',
      label: 'Content',
      icon: DocumentIcon,
      matches: ['/admin/acts', '/admin/sections', '/admin/caselaws', '/admin/import'],
    },
    { to: '/admin/audit', label: 'Audit', icon: ClockIcon, matches: ['/admin/audit'] },
    LIBRARY,
  ],
  C_ADMIN: [
    { to: '/college/users', label: 'Users', icon: UsersIcon, matches: ['/college/users'] },
    { to: '/college/subjects', label: 'Subjects', icon: DocumentIcon, matches: ['/college/subjects'] },
    { to: '/college/audit', label: 'Audit', icon: ClockIcon, matches: ['/college/audit'] },
    LIBRARY,
  ],
  C_PROFESSOR: [LIBRARY],
  C_STUDENT: [LIBRARY],
  S_STUDENT: [
    { to: '/dashboard', label: 'Home', icon: HomeIcon, matches: ['/dashboard'] },
    { to: '/acts', label: 'Bare Acts', icon: BookIcon, matches: ['/acts', '/sections'] },
    { to: '/practice', label: 'Practice', icon: ChecklistIcon, matches: ['/practice'] },
    { to: '/profile', label: 'Profile', icon: UserIcon, matches: ['/profile'] },
  ],
};

export function navFor(role: Role | null): NavItem[] {
  return role ? NAV[role] : [LIBRARY];
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.matches.some((prefix) => inArea(pathname, prefix));
}

/** Roles that see the Library sub-nav (Bare Acts · Case Laws · Search); S_STUDENT has its own tabs. */
export function hasLibrarySubNav(role: Role | null): boolean {
  return role !== 'S_STUDENT';
}
