// Pure: the account's grimoire (programme 2b). A VERIFIED win against a boss legend takes that legend's spell: one row per (account, legend), the legend id carried on the `spell-taken` ledger row.
// The server enforces the same once-per-legend rule in migration 0027 (primary key, on conflict do nothing); `takeSpell` is its reference model and what the tests pin.
import { BOSS_BRICKS } from '../../src/fight/server.ts';
import type { Json } from './store.ts';

export type Grimoire = Readonly<Record<string, readonly string[]>>;   // legend id -> the bricks that legend taught
export type Taking = { grimoire: Grimoire; reason: 'spell-taken' | 'already-taken' | 'no-spell'; legend: string };

export function takeSpell(grimoire: Grimoire, legend: string, bricks: readonly string[] | undefined): Taking {
  if (bricks === undefined || bricks.length === 0) return { grimoire, reason: 'no-spell', legend };
  if (Object.hasOwn(grimoire, legend)) return { grimoire, reason: 'already-taken', legend };
  return { grimoire: { ...grimoire, [legend]: bricks }, reason: 'spell-taken', legend };
}

// The fight id a boss legend is fought under: `boss:<legend>`. Anything else teaches nothing.
export const legendOfFight = (fight: string | null): string | null => { const m = fight === null ? null : /^boss:([a-z][a-z0-9_.:-]{0,63})$/.exec(fight); return m && Object.hasOwn(BOSS_BRICKS, m[1]!) ? m[1]! : null; };

// The lines for origins_encounter_settle's p_spells; [] when the fight is no legend's or the legend has no brick list.
export function spellLines(fight: string | null): Json[] {
  const legend = legendOfFight(fight);
  return legend === null ? [] : [{ legend, bricks: [...BOSS_BRICKS[legend]!], key: `spell:${legend}` }];
}
