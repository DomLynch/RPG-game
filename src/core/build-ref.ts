// The player's own stored build and the reference a career fight record names (RV48, Wave A1): WHICH stored build the sheet in the record claims, so the sweep loads that exact (character, version)
// and compares `sheetOf(stored build, worn gear)` against the record's sheet. The page asks the writer for its own character (open) and that character's current build (build_get, Backend's #2426).
// A character that never saved a build answers version 0 with the default build: the record then names NO reference (a sheet with none claims the default build, build-check.ts). A guest, an
// offline writer, an unapplied migration or a malformed answer gives null, and null means the page records no sheet at all.
import { call, storedToken, writerBase } from './writer-call.ts';
import { openCharacter, type OpenDeps } from './open.ts';

export type BuildRef = { characterId: string; buildVersion: number };
export type OwnBuild = { level: number; placed: Record<string, number>; ref: BuildRef | null };   // ref null = version 0, the default build
const CHARACTER = /^pc:([A-Za-z0-9_-]{1,64})$/;   // the writer's character id; the record carries the part after `pc:` (the sweep asks for `pc:<id>`)
// build_get's reply: { level, placed, version, ... }. Shape only; the rows' own validator (validateBuild) judges legality on the fight side.
export function ownBuildOf(result: unknown, characterId: string): OwnBuild | null {
  const r = result as { level?: unknown; placed?: unknown; version?: unknown } | null;
  if (!r || !Number.isInteger(r.level) || !Number.isInteger(r.version) || (r.version as number) < 0 || !r.placed || typeof r.placed !== 'object' || Array.isArray(r.placed)) return null;
  const placed: Record<string, number> = {};
  for (const [id, n] of Object.entries(r.placed)) { if (!Number.isInteger(n)) return null; placed[id] = n as number; }
  return { level: r.level as number, placed, ref: r.version === 0 ? null : { characterId, buildVersion: r.version as number } };
}

export async function fetchOwnBuild(d: OpenDeps): Promise<OwnBuild | null> {
  const id = await openCharacter(d), m = id ? CHARACTER.exec(id) : null;
  if (!id || !m) return null;
  const got = await call('build_get', { character: id }, storedToken(d.storage, (d.now ?? Date.now)()), (result) => ownBuildOf(result, m[1]!), { base: writerBase(d.search), timeoutMs: d.timeoutMs ?? 8000, ...(d.fetch ? { fetch: d.fetch } : {}) });
  return 'offline' in got ? null : got;
}
