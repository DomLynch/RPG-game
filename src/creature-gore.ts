// What a finisher may cut, and how a creature bleeds, for the roster's creatures (wolf, boar, bear, goblin), keyed by the ROSTER id. No data lives here: the catalogue row is the ONE
// source (src/fight/catalogue-rows.ts: finisher.cut, blood, finishers, shape), and this reads it. The finisher path reads a row through creatureGore(id), so a new creature is one catalogue
// row and one test pass (tests/creature-gore.test.ts, which re-reads the GLBs). Characters, 2026-10-09, for Release K (Combat's S7 wires it). The beasts carry the neck cuts only: the Dwarf
// rule (src/roster.ts) keeps a finisher off a body until a clip is measured on it; a beast falls back to plainDeath when the picked one is not on its row.
import { CATALOGUE } from './fight/catalogue-rows.ts';
import type { Cut, Shape } from './fight/catalogue.ts';
import type { FinisherId } from './fight/finishers.ts';
import { ROSTER } from './roster.ts';

export type { Shape };
export type CreatureGore = {
  shape: Shape;
  glb: string;                                              // the rig the bones were read from (the row's engine asset, path from the repo root)
  cut: Cut;                                                 // bone names to sever at: head, neck, upper spine, limbs by limb id
  blood: { start: string; end: string; amount: number };   // the colour over a drop's life (as BLOOD start/end) and the multiple of the Pit's particle counts
  finishers: readonly FinisherId[];                         // in preference order; the last is always the safe fallback
};

// A creature is a roster row that bites (a beast) or stands on the goblin rig.
const isCreature = (id: string): boolean => { const r = (ROSTER as Record<string, { weapon: string; rig: string }>)[id]; return !!r && (r.weapon === 'bite' || r.rig === 'goblin'); };

export const CREATURE_GORE: Readonly<Record<string, CreatureGore>> = Object.fromEntries(CATALOGUE.flatMap((r) =>
  isCreature(r.id) && r.finisher.cut && r.blood ? [[r.id, { shape: r.shape, glb: r.engine.asset, cut: r.finisher.cut, blood: r.blood, finishers: r.finisher.finishers }]] : []));
export type CreatureId = string;
export const creatureGore = (id: string): CreatureGore | null => CREATURE_GORE[id] ?? null;
