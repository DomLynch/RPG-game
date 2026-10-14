import { loadRegistry, tableFromFile, type Manifest } from './core/registry.ts';
import UI_MANIFEST from './ui-rows.manifest.json' with { type: 'json' };
import UI_ROWS from './ui-rows.json' with { type: 'json' };

// The page's view-layer tunables as rows (ui-rows.json; Dom's data-layer rule 2026-10-13): wall-clock timers, the replay window and the HUD layout breakpoints.
// None of them is read by the sim, a record or the digest (the sim-steering numbers in first-loss.ts, tutorial.ts and main.ts AFK_CAP stay in code, see scripts/as-data/allow/src.json; the per-contact impact numbers are Combat's, src/fight/hit-stop-defs.json).
const TABLE = tableFromFile(UI_MANIFEST.tables[0] as Manifest, UI_ROWS, 'ui-rows.json');
loadRegistry([TABLE]);
const VALUES = new Map((TABLE.rows as unknown as { id: string; value: number }[]).map((r) => [r.id, r.value]));

/** The value of a ui row; a missing id is a bug in the caller, so it throws at load rather than returning NaN. */
export function ui(id: string): number {
  const v = VALUES.get(id);
  if (v === undefined) throw new Error(`ui-rows.json has no row "${id}"`);
  return v;
}
