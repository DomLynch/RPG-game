// Reads the as-data allow list: a directory of per-root files (scripts/as-data/allow/<root>.json) or one file. Split out of check.ts so a test can read it without running the checker.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type Allow = { file: string; literal: string; reason: string };
// A keeper is `exempt` (stays in code by design: a server mirror, a wire format, a version stamp, a schema default; a specific reason, no expiry) or `debt` (still owed as a row: an owner and a REAL sunset date).
// --gate goes red on a debt past its sunset and warns for 14 days before it.
export type TunableAllow = { file: string; name: string; kind: 'exempt' | 'debt'; reason: string; owner?: string; sunset?: string };
// A VERB is a closed list kept in code on purpose (Strategy's verb rulings): named with the function that dispatches on it and the day it goes (sunset null = it stays). Listed apart, never counted; a verb whose declaration is gone is stale.
export type Verb = { file: string; name: string; dispatch: string; sunset: string | null };
export type AllowData = { allow: Allow[]; verbs?: Verb[]; tunables?: TunableAllow[] };
// A directory is every *.json in it, in name order: `allow` and `verbs` concatenate in that order (they live in _lists.json, which sorts first), `tunables` merge sorted by (file, name), so the
// report is the same whatever the split. A single file (the old shape, and the tests' fixtures) is read as it is.
export function loadAllow(path: string): AllowData {
  if (!statSync(path).isDirectory()) return JSON.parse(readFileSync(path, 'utf8')) as AllowData;
  const parts = readdirSync(path).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(join(path, f), 'utf8')) as Partial<AllowData>);
  const by = (a: TunableAllow, b: TunableAllow) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  return { allow: parts.flatMap((p) => p.allow ?? []), verbs: parts.flatMap((p) => p.verbs ?? []), tunables: parts.flatMap((p) => p.tunables ?? []).sort(by) };
}
