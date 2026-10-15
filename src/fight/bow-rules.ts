import { loadRegistry, tableFromFile, type Manifest } from '../core/registry.ts';
import { worldRule } from './world-rules.ts';
import DEFS from './bow-rules-defs.json' with { type: 'json' };
import MANIFEST from './bow-rules-defs.manifest.json' with { type: 'json' };

// The bow, step 1 (docs/specs/combat/bows.md; SANDBOX ONLY: Lead 2026-10-15, preview behind bow-preview.html, nothing in the Pit, no RV/WSV): a held draw with a charge fraction, then one arrow that flies for a time.
// Every number is a row (bow-rules-defs.json); the minimum range is the world's engage ring (world-rules `engage`), not a second literal. Pure: ticks in, state out, no clock and no randomness, so a still and a test
// reproduce the same shot. Left for step 2: ammo, the crossbow, lock-on, a moving target.
export type BowRule = { readonly id: string; readonly value: number; readonly unit: string };
const NAMED = ['minDraw', 'fullDraw', 'minMult', 'fullMult', 'arrowSpeed', 'maxRange', 'recovery', 'hitRadius', 'heavyShare', 'dummyHealth', 'dummyDistance', 'tickRate'] as const;
export function loadBowRules(raw: { rules?: readonly unknown[] }): readonly BowRule[] {
  loadRegistry([tableFromFile(MANIFEST.tables[0] as unknown as Manifest, raw, 'bow-rules-defs.json')]);
  const rows = (raw.rules ?? []) as readonly BowRule[];
  for (const r of rows) if (!(Number.isFinite(r.value) && r.value > 0)) throw Error(`bow-rules "${r.id}": value is a number > 0`);
  for (const must of NAMED) if (!rows.some((r) => r.id === must)) throw Error(`bow-rules: the bow reads the "${must}" rule by name, so it needs a row`);
  const of = (id: string) => rows.find((r) => r.id === id)!.value;
  if (of('fullDraw') <= of('minDraw')) throw Error('bow-rules: fullDraw is longer than minDraw');
  if (of('fullMult') < of('minMult')) throw Error('bow-rules: fullMult is at least minMult');
  return rows;
}
export const BOW_RULES: readonly BowRule[] = loadBowRules(DEFS);
const of = (id: (typeof NAMED)[number]): number => BOW_RULES.find((r) => r.id === id)!.value;
export const BOW = Object.freeze({
  minDraw: of('minDraw'), fullDraw: of('fullDraw'), minMult: of('minMult'), fullMult: of('fullMult'), arrowSpeed: of('arrowSpeed'), maxRange: of('maxRange'), minRange: worldRule('engage'),
  recovery: of('recovery'), hitRadius: of('hitRadius'), heavyShare: of('heavyShare'), dummyHealth: of('dummyHealth'), dummyDistance: of('dummyDistance'), tickRate: of('tickRate'),
});

export type Arrow = { readonly launched: number; readonly arrives: number; readonly distance: number; readonly lateral: number; readonly charge: number; readonly damage: number };
export type BowEvent = { readonly tick: number; readonly type: 'draw' | 'cancel' | 'release' | 'hit' | 'miss' | 'recovered'; readonly charge?: number; readonly damage?: number };
export type BowState = { readonly tick: number; readonly phase: 'ready' | 'draw' | 'recover'; readonly drawn: number; readonly recoverLeft: number; readonly arrow: Arrow | null; readonly health: number; readonly events: readonly BowEvent[] };
export const newBow = (): BowState => ({ tick: 0, phase: 'ready', drawn: 0, recoverLeft: 0, arrow: null, health: BOW.dummyHealth, events: [] });

/** The charge fraction of a draw held for `drawn` ticks: 0 at the minimum draw, 1 at the full draw. */
export const chargeOf = (drawn: number): number => Math.max(0, Math.min(1, (drawn - BOW.minDraw) / (BOW.fullDraw - BOW.minDraw)));
export const multOf = (charge: number): number => BOW.minMult + (BOW.fullMult - BOW.minMult) * charge;
/** The bow draws only with the foe in the band: past the engage ring (the melee takes over inside it) and inside the max range. */
export const inBand = (distance: number): boolean => distance >= BOW.minRange && distance <= BOW.maxRange;
/** Ticks the arrow flies: the distance over the arrow speed, rounded up to a whole tick. */
export const flightTicks = (distance: number): number => Math.ceil(distance / BOW.arrowSpeed * BOW.tickRate);
/** How far along its line the arrow is at `tick` (metres from the archer). */
export const arrowAt = (a: Arrow, tick: number): number => Math.min(a.distance, BOW.arrowSpeed * (tick - a.launched) / BOW.tickRate);

/** One tick. `hold` is the draw button; `target` is the dummy's distance along the line and its sideways offset at the time the arrow arrives (a still dummy: 0). */
export function stepBow(s: BowState, hold: boolean, target: { distance: number; lateral: number }): BowState {
  const tick = s.tick + 1, events: BowEvent[] = [];
  let { phase, drawn, recoverLeft, arrow, health } = s;
  if (arrow && tick >= arrow.arrives) {
    if (Math.abs(arrow.lateral) <= BOW.hitRadius) { health = Math.max(0, health - arrow.damage); events.push({ tick, type: 'hit', charge: arrow.charge, damage: arrow.damage }); } else events.push({ tick, type: 'miss', charge: arrow.charge });
    arrow = null;
  }
  if (phase === 'recover') { recoverLeft--; if (recoverLeft <= 0) { phase = 'ready'; recoverLeft = 0; events.push({ tick, type: 'recovered' }); } }
  else if (phase === 'ready') { if (hold && !arrow && inBand(target.distance)) { phase = 'draw'; drawn = 1; events.push({ tick, type: 'draw' }); } }
  else if (hold) { drawn = Math.min(BOW.fullDraw, drawn + 1); if (!inBand(target.distance)) { phase = 'ready'; drawn = 0; events.push({ tick, type: 'cancel' }); } }
  else if (drawn < BOW.minDraw) { phase = 'ready'; drawn = 0; events.push({ tick, type: 'cancel' }); }
  else {
    const charge = chargeOf(drawn), damage = Math.round(BOW.heavyShare * BOW.dummyHealth * multOf(charge));
    arrow = { launched: tick, arrives: tick + flightTicks(target.distance), distance: target.distance, lateral: target.lateral, charge, damage };
    events.push({ tick, type: 'release', charge, damage }); phase = 'recover'; recoverLeft = BOW.recovery; drawn = 0;
  }
  return { tick, phase, drawn, recoverLeft, arrow, health, events };
}
