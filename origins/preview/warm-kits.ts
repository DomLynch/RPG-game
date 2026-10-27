import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/index.ts';
import MANIFEST from './warm-kits.manifest.json' with { type: 'json' };
import KITS from './warm-kits.json' with { type: 'json' };
import type { Worn } from './dress-remote.ts';

// The remote-player warm-up list (donors: Claudecraft's per-kind warm gates, already ours in warm-plan.ts). Another player's gear is drawn by dressRemote through the player's own `wear`, so a piece whose render PROGRAM the zone has not compiled
// links at the remote's first sight: the T4 count (scripts/remote-programs-check.mjs, 2026-10-16) found 10 such programs across the 66 materials the loot kits use, owned by these slots. One row per slot to dress on a warm-up clone: `worn` is a
// dressRemote worn set ({ slot: loot id }), `programs` the program(s) it brings (names as renderInfo() shows them, for the reader: nothing reads them). A new loot piece with a new program is a new row, found by the same check.
export type WarmKit = { readonly id: string; readonly worn: Worn; readonly programs: readonly string[] };

/** The one loader: the registry's duplicate / missing / mistyped checks, then the row rules the manifest cannot say (a worn set of non-empty slot -> id pairs, at least one listed program). */
export function loadWarmKits(raw: unknown): readonly WarmKit[] {
  const table = tableFromFile(MANIFEST.tables[0] as Manifest, raw, 'warm-kits.json');
  loadRegistry([table]);
  return (table.rows as unknown as { id: string; fields: Record<string, unknown> }[]).map(({ id, fields }) => {
    const worn = fields.worn as Record<string, unknown> | undefined, programs = fields.programs as unknown;
    if (!worn || typeof worn !== 'object' || !Object.keys(worn).length || !Object.entries(worn).every(([slot, loot]) => slot && typeof loot === 'string' && loot)) throw new Error(`warm-kits "${id}": worn is { slot: loot id } with at least one entry`);
    if (!Array.isArray(programs) || !programs.length || !programs.every((p) => typeof p === 'string' && p)) throw new Error(`warm-kits "${id}": programs lists the render program names the set brings`);
    return { id, worn: worn as Worn, programs: programs as string[] };
  });
}

const ALL = loadWarmKits(KITS);
/** The rows the zone warm-up dresses. */
export const warmKits = (): readonly WarmKit[] => ALL;
