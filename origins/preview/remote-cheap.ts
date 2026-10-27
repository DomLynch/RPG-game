// What a CHEAP remote figure (remote-heroes.ts: beyond the full count) does not draw (T4 profile 2026-10-17: a figure is about 14 separate skinned meshes, and at 4x CPU the cost is draw submission per mesh,
// not animation). The part names are a ROW (remote-cheap.json), read once here: Lead's default until Characters rules on the art (body, head, wrap/gambeson and the weapon stay; eyes, teeth, steel, heraldry
// and the boot / body detail go). Pure.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/index.ts';
import MANIFEST from './remote-cheap.manifest.json' with { type: 'json' };
import RULES from './remote-cheap.json' with { type: 'json' };

/** The one loader: the registry's duplicate / missing / mistyped checks, then the rule it cannot say (a list of distinct, non-blank part names). */
export function loadCheapParts(raw: unknown): readonly string[] {
  const table = tableFromFile(MANIFEST.tables[0] as Manifest, raw, 'remote-cheap.json');
  loadRegistry([table]);
  const fields = (table.rows as unknown as { id: string; fields: Record<string, unknown> }[]).find((r) => r.id === 'cheap')?.fields;
  if (!fields) throw new Error('remote-cheap: the "cheap" row is missing');
  const list = fields.hideParts;
  if (!Array.isArray(list) || list.some((n) => typeof n !== 'string' || !n.trim()) || new Set(list).size !== list.length) throw new Error('remote-cheap: hideParts is a list of distinct part names');
  return list as string[];
}
export const CHEAP_PARTS: ReadonlySet<string> = new Set(loadCheapParts(RULES));
