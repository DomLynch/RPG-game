import { loadRegistry, tableFromFile, type Manifest } from './core/registry.ts';
import PRESENT_MANIFEST from './present-rows.manifest.json' with { type: 'json' };
import PRESENT_ROWS from './present-rows.json' with { type: 'json' };

// The page's presentation numbers as rows (present-rows.json; Dom's data-layer rule 2026-10-13): the export clip, the portcullis lift, the live duel's drawn-hold catch-up, the coach's lapse
// bounds and the Lorarii patrol. Tests pin every default to the literal the code held before (tests/present-rows.test.ts).
const TABLE = tableFromFile(PRESENT_MANIFEST.tables[0] as Manifest, PRESENT_ROWS, 'present-rows.json');
loadRegistry([TABLE]);
const VALUES = new Map((TABLE.rows as unknown as { id: string; value: number }[]).map((r) => [r.id, r.value]));

/** The value of a present row; a missing id throws at load rather than answering NaN. */
export function present(id: string): number {
  const v = VALUES.get(id);
  if (v === undefined) throw new Error(`present-rows.json has no row "${id}"`);
  return v;
}
/** Every row whose id starts with `<prefix>.`, keyed by the rest of the id. */
export const presentGroup = (prefix: string): Record<string, number> =>
  Object.fromEntries([...VALUES].filter(([id]) => id.startsWith(`${prefix}.`)).map(([id, v]) => [id.slice(prefix.length + 1), v]));
