// The build reference a career fight record names (RV48, Wave A1): WHICH stored build the sheet in the record claims, so the sweep loads that exact (character, version) and compares
// `sheetOf(stored build, worn gear)` against the record's sheet. The page asks the writer for its own character (open) and that character's current build version (build_get, Backend's
// #2426); a guest, an offline writer, an unapplied migration or a character with no stored build gives null, and null means NO reference: the fight then records no sheet at all.
import { call, storedToken, writerBase } from './writer-call.ts';
import { openCharacter, type OpenDeps } from './open.ts';

export type BuildRef = { characterId: string; buildVersion: number };
const CHARACTER = /^pc:([A-Za-z0-9_-]{1,64})$/;   // the writer's character id; the record carries the part after `pc:` (the sweep asks for `pc:<id>`)
export const buildVersionOf = (result: unknown): number | null => {
  const v = (result as { version?: unknown } | null)?.version;
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : null;
};

export async function fetchBuildRef(d: OpenDeps): Promise<BuildRef | null> {
  const id = await openCharacter(d), m = id ? CHARACTER.exec(id) : null;
  if (!id || !m) return null;
  const got = await call('build_get', { character: id }, storedToken(d.storage, (d.now ?? Date.now)()), (result) => { const version = buildVersionOf(result); return version === null ? null : { version }; }, { base: writerBase(d.search), timeoutMs: d.timeoutMs ?? 8000, ...(d.fetch ? { fetch: d.fetch } : {}) });
  return 'offline' in got ? null : { characterId: m[1]!, buildVersion: got.version };
}
