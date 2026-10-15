// The pit's geometry as data (World & Audio, Dom's data-layer day 2026-10-14): the play radius and camera clamp, the sand tile, the podium wall, the five tiers, the colonnade, the parapet, the ring
// segment count and the prop texture caps, one row each (id, value, unit) through the shared loader (src/core/registry.ts). Every default equals the literal it replaced (tests/arena-rules.test.ts
// pins them). None is read by the sim, so this table is NOT part of the world digest. Pure, no three.js: the texture worker may import it.
import { loadRegistry, tableFromFile, type Manifest } from './core/registry.ts';
import DEFS from './arena-rules-defs.json' with { type: 'json' };
import MANIFEST from './arena-rules-defs.manifest.json' with { type: 'json' };

export type ArenaRule = { readonly id: string; readonly value: number; readonly unit: string };
const NAMED = ['playRadius', 'cameraClamp', 'sandTile', 'wallInner', 'wallOuter', 'wallTop', 'tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tierDepth', 'gateWidth', 'colonnade', 'parapetInner', 'parapetOuter', 'rungsPerArena', 'rubbleTiers', 'moteFloor', 'parapetTop', 'segments', 'propTextureFull', 'propTexturePhone'] as const;
/** The one loader: rows keyed by id (a duplicate id or a missing or mistyped field is refused), every rule the pit reads by name must exist, with a positive value. */
export function loadArenaRules(raw: { rules?: readonly unknown[] }): readonly ArenaRule[] {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'arena-rules-defs.json')]);
  const rows = (raw.rules ?? []) as readonly ArenaRule[];
  for (const r of rows) if (!(Number.isFinite(r.value) && r.value > 0)) throw Error(`arena-rules "${r.id}": value is a number > 0`);
  for (const must of NAMED) if (!rows.some((r) => r.id === must)) throw Error(`arena-rules: the pit reads the "${must}" rule by name, so it needs a row`);
  return rows;
}
export const ARENA_RULES: readonly ArenaRule[] = loadArenaRules(DEFS);
export const arenaRule = (id: (typeof NAMED)[number]): number => ARENA_RULES.find((r) => r.id === id)!.value;
/** The pit's layout, the same object arena.ts had (the gate faces the hero's start, heading pi). */
export const layoutRules = () => ({ wall: { inner: arenaRule('wallInner'), outer: arenaRule('wallOuter'), top: arenaRule('wallTop') }, tiers: [arenaRule('tier1'), arenaRule('tier2'), arenaRule('tier3'), arenaRule('tier4'), arenaRule('tier5')], tierDepth: arenaRule('tierDepth'), gate: Math.PI, gateWidth: arenaRule('gateWidth'), colonnade: arenaRule('colonnade'), parapet: { inner: arenaRule('parapetInner'), outer: arenaRule('parapetOuter'), top: arenaRule('parapetTop') }, segments: arenaRule('segments') });
export const propTextureCap = () => ({ full: arenaRule('propTextureFull'), phone: arenaRule('propTexturePhone') });
