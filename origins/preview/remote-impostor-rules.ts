// The remote-hero far tiers' numbers as data (World, Dom's data-layer rule 2026-10-13): how many figures stay full, how many take the middle tier, how far a remote hero is drawn at all, and the
// impostor atlas's size. One row each (id, value, unit) through the shared loader (src/core/registry.ts), the same shape as preview-rules.ts. None of these is read by the sim. Pure.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/index.ts';
import DEFS from './remote-impostor-defs.json' with { type: 'json' };
import MANIFEST from './remote-impostor-defs.manifest.json' with { type: 'json' };

export type ImpostorRule = { readonly id: string; readonly value: number; readonly unit: string };
const NAMED = ['tierFull', 'tierMid', 'tierRange', 'atlasCells', 'atlasCellW', 'atlasCellH', 'figureHeight', 'figureWidth', 'alphaCut', 'bakeFov', 'benchWalkSpeed', 'benchRingMin', 'benchNear', 'benchSpread', 'benchWindow', 'benchMax'] as const;
/** The one loader: a duplicate id or a missing or mistyped field is refused, every rule the tiers read by name must exist with a positive value. */
export function loadImpostorRules(raw: { rules?: readonly unknown[] }): readonly ImpostorRule[] {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'remote-impostor-defs.json')]);
  const rows = (raw.rules ?? []) as readonly ImpostorRule[];
  for (const r of rows) if (!(Number.isFinite(r.value) && r.value > 0)) throw Error(`remote-impostor "${r.id}": value is a number > 0`);
  for (const must of NAMED) if (!rows.some((r) => r.id === must)) throw Error(`remote-impostor: the tiers read the "${must}" rule by name, so it needs a row`);
  return rows;
}
export const IMPOSTOR_RULES: readonly ImpostorRule[] = loadImpostorRules(DEFS);
export const impostorRule = (id: (typeof NAMED)[number]): number => IMPOSTOR_RULES.find((r) => r.id === id)!.value;
