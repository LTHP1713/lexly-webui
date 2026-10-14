/** The 0-based page from a 1-based `?page=` value; anything invalid is the first page (plan §1.2). */
export function pageFromParam(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page - 1 : 0;
}
