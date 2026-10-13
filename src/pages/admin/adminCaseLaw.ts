import { getCaseLaw, type CaseLawDetail } from '@/api/caselaws';

/**
 * Admin editors load a case law (metadata and content) through the end-user `GET /caselaws/{id}`
 * — there is no admin read endpoint — revalidating past the browser cache so an admin always
 * edits the latest saved version.
 */
export function loadCaseLawForAdmin(caseLawId: string): Promise<CaseLawDetail> {
  return getCaseLaw(caseLawId, { cache: 'no-cache' });
}

/** Router state a screen hands to the content editor: a message to show once (e.g. "Case law created"). */
export interface ContentEditorHandoff {
  flash?: string;
}

/** After a save, refetch past the browser cache so the student-facing page shows the edit at once. */
export function refreshCachedCaseLaw(caseLawId: string) {
  void getCaseLaw(caseLawId, { cache: 'reload' }).catch(() => undefined);
}
