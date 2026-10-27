// The kit's view rules as rows (kit-view.json; Web lane, Lead 2026-10-22: "castShadow by name regex is itself a hard-coded rule"). One row per kit-node kind, matched by the node name's prefix (the first row whose prefix the name starts with
// wins; the last row has the empty prefix and is the default for every other node): does the kind cast a shadow, and the two radii (metres from the walker, 0 = unlimited = today's behaviour): `shadowRadius`, only the instances within it cast
// (the rest are left out of the shadow pass by a small shadow-proxy InstancedMesh, frontier-kit-view.ts), and `drawRadius`, only the instances within it are drawn at all. View only: no sim, no record.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/index.ts';
import MANIFEST from './kit-view.manifest.json' with { type: 'json' };
import RAW from './kit-view.json' with { type: 'json' };

export type KitViewRule = { readonly prefix: string; readonly castShadow: boolean; readonly shadowRadius: number; readonly drawRadius: number };

/** The one loader: the registry's duplicate / missing / mistyped checks, then what the manifest cannot say: a text prefix, a boolean, radii of 0 or more, exactly one empty-prefix default row and it last. */
export function loadKitViewRules(raw: unknown): readonly KitViewRule[] {
  const table = tableFromFile(MANIFEST.tables[0] as Manifest, raw, 'kit-view.json');
  loadRegistry([table]);
  const rules = (table.rows as unknown as { id: string; fields: Record<string, unknown> }[]).map(({ id, fields: f }) => {
    if (typeof f.prefix !== 'string') throw new Error(`kit-view "${id}": prefix is text (empty = the default row)`);
    if (typeof f.castShadow !== 'boolean') throw new Error(`kit-view "${id}": castShadow is true or false`);
    for (const k of ['shadowRadius', 'drawRadius'] as const) if (typeof f[k] !== 'number' || !(f[k] >= 0)) throw new Error(`kit-view "${id}": ${k} is a number of metres, 0 or more (0 = unlimited)`);
    return { prefix: f.prefix, castShadow: f.castShadow, shadowRadius: f.shadowRadius as number, drawRadius: f.drawRadius as number };
  });
  if (rules.filter((r) => r.prefix === '').length !== 1 || rules[rules.length - 1].prefix !== '') throw new Error('kit-view: exactly one default row (empty prefix), and it is the last');
  return rules;
}
export const KIT_VIEW: readonly KitViewRule[] = loadKitViewRules(RAW);

/** The rule for a kit node's name: the first row whose prefix it starts with, else the default row. Pure. */
export const kitViewFor = (name: string, rules: readonly KitViewRule[] = KIT_VIEW): KitViewRule => rules.find((r) => r.prefix !== '' && name.startsWith(r.prefix)) ?? rules[rules.length - 1];
