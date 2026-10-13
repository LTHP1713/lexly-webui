/**
 * Optional router `state` passed when navigating into a section, so the detail screen can offer a
 * "Back to …" link to wherever the user came from (e.g. search results). It is only a hint: the
 * section response itself carries `actId`/`actTitle`/`prev`/`next`, so the act breadcrumb, sidebar
 * and Previous / Next work without it (deep link, reload, Continue Learning).
 */
export interface SectionLinkState {
  backTo?: { to: string; label: string };
}

/** Router `state` passed from the acts list, so the sections screen can title itself instantly. */
export interface ActLinkState {
  actTitle?: string;
}

export function sectionLabel(sectionNumber: string, title: string | null): string {
  const number = sectionNumber ? `Section ${sectionNumber}` : 'Section';
  return title ? `${number} — ${title}` : number;
}

/**
 * Web route for a piece of learning content. Routes are decided here from `type` + `id` rather
 * than from a backend-supplied path, so the same API responses can serve the mobile app too.
 * Returns null for types with no screen yet (topics, questions).
 */
export function contentPath(type: string, id: string): string | null {
  switch (type) {
    case 'ACT':
      return `/acts/${encodeURIComponent(id)}`;
    case 'SECTION':
      return `/sections/${encodeURIComponent(id)}`;
    case 'CASE_LAW':
      return `/caselaws/${encodeURIComponent(id)}`;
    default:
      return null;
  }
}
