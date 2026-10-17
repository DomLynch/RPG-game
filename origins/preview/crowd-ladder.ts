// The remote-crowd cost ladder (crowd-ladder.json + manifest through the registry): rung 0 is the full treatment, each later rung is cheaper. Read by remote-heroes.ts with the frame governor's level. Pure.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/index.ts';   // page code takes the registry from the core's page door (index.ts), not server.ts (core-boundary C1)
import DEFS from './crowd-ladder.json' with { type: 'json' };
import MANIFEST from './crowd-ladder.manifest.json' with { type: 'json' };

export type Rung = { readonly id: string; readonly full: number; readonly every: number };
/** The one loader: a duplicate id or a missing field is refused; a rung needs `full` >= 0 and `every` >= 1, and no rung may be MORE expensive than the one before (fewer or equal full figures, an equal or longer pose gap). */
export function loadLadder(raw: { rungs?: readonly unknown[] }): readonly Rung[] {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'crowd-ladder.json')]);
  const rungs = (raw.rungs ?? []) as readonly Rung[];
  if (!rungs.length) throw Error('crowd-ladder: at least one rung');
  rungs.forEach((r, i) => {
    if (!(r.full >= 0 && r.every >= 1)) throw Error(`crowd-ladder "${r.id}": full is >= 0 and every is >= 1`);
    if (i > 0 && (r.full > rungs[i - 1]!.full || r.every < rungs[i - 1]!.every)) throw Error(`crowd-ladder "${r.id}" costs more than the rung before it`);
  });
  return rungs;
}
export const CROWD_LADDER: readonly Rung[] = loadLadder(DEFS);
