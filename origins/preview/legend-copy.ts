// What a player reads for one of the Pit's legends in the world (Combat, 2026-10-22; Strategy's two copy conditions: a legend is labelled as name, rank and title like the ladder, never as a mob / creature / monster; it is
// "defeated", never "slain", and its reward is never called loot or a drop). The words are rows (legend-copy.json); this file only recognises a legend and fills them. A legend is a zone spawn row whose `source` is
// `{ legendId }` (origins/region1/legend-foes.ts makes those rows' characters), so no legend, family or zone is named here; every other creature keeps its own copy. Pure.
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/registry.ts';
import type { MobRow } from '../../src/core/world/row.ts';
import { TITLES } from '../../src/core/career-ladder.ts';
import { ROSTER } from '../../src/roster.ts';
import COPY from './legend-copy.json' with { type: 'json' };
import MANIFEST from './legend-copy.manifest.json' with { type: 'json' };

const [COPY_MANIFEST, HINT_MANIFEST] = MANIFEST.tables as unknown as Manifest[];
const COPY_TABLE = tableFromFile(COPY_MANIFEST!, COPY, 'legend-copy.json'), HINT_TABLE = tableFromFile(HINT_MANIFEST!, COPY, 'legend-copy.json');
loadRegistry([COPY_TABLE, HINT_TABLE]);
const TEXT = new Map(COPY_TABLE.rows.map((r) => [r.id as string, r.text as string]));
const text = (id: string): string => { const t = TEXT.get(id); if (t === undefined) throw Error(`legend-copy.json: no copy row "${id}"`); return t; };
const HINTS = new Map(HINT_TABLE.rows.map((r) => [r.id as string, r as unknown as { walk: string; watch: string; arriving: string }]));

/** The legend a zone spawn row stands for (its `source.legendId`), or null for any other row. */
export const legendIdOf = (row: Pick<MobRow, 'source'> | undefined): string | null => (row?.source && 'legendId' in row.source ? row.source.legendId : null);

const fill = (template: string, vars: Readonly<Record<string, string | number>>): string => template.replace(/\{(\w+)\}/g, (_m, k: string) => { if (!(k in vars)) throw Error(`legend-copy: {${k}} has no value`); return String(vars[k]); });
const kindOf = (body: string): string => (ROSTER as unknown as Record<string, { name: string } | undefined>)[body]?.name.replace(/^the /, '') ?? body;

/** The creature card's three lines for a legend: line 2 keeps the con ring and danger word and adds "Rank N · <the ladder's rank title>", line 3 is the ladder's own kind line ("the Pitborn"), never rarity or pack size. A legend's world level IS its rank (1..10, the ladder's ten titles). */
export function legendCardLines(lines: readonly [string, string, string], rank: number, body: string): [string, string, string] {
  const title = TITLES[rank - 1] ?? '';
  return [lines[0], `${lines[1]} · ${fill(text('cardRank'), { rank, title })}`, fill(text('cardKind'), { kind: kindOf(body) })];
}

export type KillCopy = { readonly defeated: string; readonly reward: string; readonly noReward: string };
/** The words of a legend's kill toast: `defeated` takes {name}, `reward` takes {paid}. */
export const killCopy = (): KillCopy => ({ defeated: text('defeated'), reward: text('reward'), noReward: text('noReward') });
/** The kill toast head for a legend: "<name> is defeated." */
export const defeatedLine = (copy: KillCopy, name: string): string => fill(copy.defeated, { name });
/** The reward line under it: "Reward: +N CP · ...." or the no-reward row. */
export const rewardLine = (copy: KillCopy, paid: readonly string[]): string => (paid.length ? fill(copy.reward, { paid: paid.join(' · ') }) : copy.noReward);

/** A zone's own hint line (`walk`: the first-walk hint, `watch`: the line shown on arrival, `arriving`: the tap-while-loading toast), or undefined when its zone has no row (the page keeps its default). */
export const zoneHint = (zoneId: string, which: 'walk' | 'watch' | 'arriving'): string | undefined => HINTS.get(zoneId)?.[which];
