/**
 * `POST /admin/bulk/{acts|sections|caselaws}` (contract §5.5). Since backend P0 every row runs on
 * its own: the response is always `200 BulkImportResult` with one outcome per row, and `400` only
 * for an invalid envelope. The client checks the envelope first so obvious mistakes never reach
 * the server.
 */
import { apiClient } from '@/api/client';

export type ImportKind = 'acts' | 'sections' | 'caselaws';

export const IMPORT_KINDS: readonly ImportKind[] = ['acts', 'sections', 'caselaws'];

export function isImportKind(value: unknown): value is ImportKind {
  return typeof value === 'string' && (IMPORT_KINDS as readonly string[]).includes(value);
}

interface KindConfig {
  path: string;
  /** The top-level list in the request. */
  listKey: string;
  max: number;
  /** Plural, lower case: "case laws". */
  noun: string;
}

export const IMPORT_CONFIG: Record<ImportKind, KindConfig> = {
  acts: { path: '/admin/bulk/acts', listKey: 'acts', max: 10, noun: 'acts' },
  sections: { path: '/admin/bulk/sections', listKey: 'sections', max: 100, noun: 'sections' },
  caselaws: { path: '/admin/bulk/caselaws', listKey: 'caseLaws', max: 10, noun: 'case laws' },
};

export type ImportRowStatus = 'CREATED' | 'REJECTED' | 'FAILED';

/** One outcome per request row, in request order. Shared with the user imports of F2 (`CONVERTED`). */
export interface ImportRow {
  /** 0-based position in the request list. */
  index: number;
  key: string | null;
  status: ImportRowStatus | string;
  /** The created item's id, for `CREATED` rows. */
  id: string | null;
  errors: string[];
}

export interface ImportResult {
  summary: { total: number; created: number; rejected: number; failed: number };
  rows: ImportRow[];
}

export type ImportEnvelope = Record<string, unknown>;

export type ParsedImport = { ok: true; body: ImportEnvelope; rowCount: number } | { ok: false; error: string };

/**
 * The client checks of UI spec F1.9: valid JSON, the kind's top-level list (and `actShortCode`
 * for sections), and the row limit. Row contents are left to the server, which reports them per row.
 */
export function parseImportSource(kind: ImportKind, source: string): ParsedImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unexpected input';
    return { ok: false, error: `This isn't valid JSON: ${detail}` };
  }
  const config = IMPORT_CONFIG[kind];
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: `For ${config.noun}, the JSON needs a top-level "${config.listKey}" list.` };
  }
  const body = parsed as ImportEnvelope;
  const rows = body[config.listKey];
  if (!Array.isArray(rows)) {
    return { ok: false, error: `For ${config.noun}, the JSON needs a top-level "${config.listKey}" list.` };
  }
  if (kind === 'sections' && (typeof body.actShortCode !== 'string' || !body.actShortCode.trim())) {
    return { ok: false, error: 'For sections, the JSON needs a top-level "actShortCode" naming the act.' };
  }
  if (rows.length === 0) {
    return { ok: false, error: `The "${config.listKey}" list is empty.` };
  }
  if (rows.length > config.max) {
    return { ok: false, error: `This batch has ${rows.length} rows; the limit is ${config.max}.` };
  }
  return { ok: true, body, rowCount: rows.length };
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export function toImportResult(dto: Partial<ImportResult> | null | undefined): ImportResult {
  const rows = (dto?.rows ?? []).map((row) => ({
    index: row.index,
    key: row.key?.trim() || null,
    status: row.status,
    id: row.id ?? null,
    errors: row.errors ?? [],
  }));
  return {
    summary: {
      total: count(dto?.summary?.total) || rows.length,
      created: count(dto?.summary?.created),
      rejected: count(dto?.summary?.rejected),
      failed: count(dto?.summary?.failed),
    },
    rows,
  };
}

export async function importBatch(kind: ImportKind, body: ImportEnvelope): Promise<ImportResult> {
  return toImportResult(await apiClient.post<ImportResult>(IMPORT_CONFIG[kind].path, body));
}

/**
 * The same envelope with only the rejected and failed rows, ready to fix and import again.
 * Created rows are left out, so a re-import never duplicates them.
 */
export function rejectedRowsEnvelope(kind: ImportKind, body: ImportEnvelope, result: ImportResult): ImportEnvelope {
  const listKey = IMPORT_CONFIG[kind].listKey;
  const rows = body[listKey] as unknown[];
  const keep = new Set(result.rows.filter((row) => row.status !== 'CREATED').map((row) => row.index));
  return { ...body, [listKey]: rows.filter((_, index) => keep.has(index)) };
}

/** The common "no such act" case for sections: every row is rejected for the same parent. */
export function unknownActShortCode(kind: ImportKind, body: ImportEnvelope, result: ImportResult): string | null {
  if (kind !== 'sections' || result.rows.length === 0) return null;
  const allMissing = result.rows.every(
    (row) => row.status === 'REJECTED' && row.errors.some((e) => e.startsWith('actShortCode: no bare act found')),
  );
  return allMissing && typeof body.actShortCode === 'string' ? body.actShortCode : null;
}
