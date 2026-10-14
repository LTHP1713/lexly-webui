/** Shared by the short-form dialogs: turning a failed save into field errors or a banner. */
import { ApiError } from '@/api/client';
import { conflictFieldError, errorMessage } from '@/api/errors';
import { parseServerErrors } from '@/pages/admin/contentForm';

export type FieldErrors = Record<string, string>;

/**
 * Field errors from a failed save (a `*_ALREADY_EXISTS` conflict, or `VALIDATION_ERROR` paths
 * among `fields`), plus a banner for anything that has no field.
 */
export function saveErrors(err: unknown, fields: readonly string[]): { fields: FieldErrors; banner: string | null } {
  const conflict = conflictFieldError(err);
  if (conflict) return { fields: conflict, banner: null };
  if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
    const parsed = parseServerErrors(err.message);
    const known = Object.fromEntries(Object.entries(parsed).filter(([path]) => fields.includes(path)));
    if (Object.keys(known).length > 0) return { fields: known, banner: null };
  }
  return { fields: {}, banner: errorMessage(err) };
}
