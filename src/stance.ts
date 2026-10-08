// Stances, defined ONCE (Dom's ruling 2026-10-07, docs/specs/origins/combat-study.md "stances and opponent mood"; one system: the AI's mood presets ARE these stances). A symmetric trade-off every fighter
// picks freely, never a timing change (no swing speed, parry window, i-frames, reach or input). Each entry is a signed per-mille delta on ONE quantity, read at its site in src/duel.ts through
// `stanced`, exactly as a patron perk is (`perked`): a fighter with no stance (Neutral) takes the unscaled value untouched, so no float drift and a stance-less fight is byte for byte as before.
// A sim file: no Math.random, no clock, no transcendental. The numbers are Dom's table; the damage delta starts at +-5% (Lead), his +-10% is the ceiling the battery may raise it to.
import { rollUnit } from './roll.ts';
export type StanceId = 'aggressive' | 'defensive' | 'trickster';
export type PickedStance = StanceId | 'neutral';   // what a player picks (and a record names): Neutral is a real pick, the safe middle
export const PICKS: readonly PickedStance[] = ['neutral', 'aggressive', 'defensive', 'trickster'];   // append only: the index is the record's 2-bit code
export type StanceKey = 'damage' | 'heavyDamage' | 'posture' | 'kickPosture' | 'block' | 'feint' | 'recover' | 'window' | 'counter';
export const STANCES: Readonly<Record<StanceId, Readonly<Partial<Record<StanceKey, number>>>>> = {
  aggressive: { damage: 50, posture: 100, block: 100 },   // +5% damage, +10% posture dealt; blocks cost 10% more stamina. Beats the Trickster
  defensive: { damage: -50, block: -60, window: 250, counter: 250 },   // RV40 trim (Strategy 2026-10-08, scripts/defensive-trim.mjs: it lifted the ladder win rate +8 to +11 at L6+, now within +5 of no stance): -5% damage; blocks cost 6% less stamina (Dom's table said 15%) and the posture-drain perk (was recover 250) is gone; the parry window and the guard-counter window a quarter longer (~4 ticks: Strategy's state-conditional counter, attack spam gets punished). Beats the Aggressive
  trickster: { heavyDamage: -50, feint: -500, kickPosture: 500 },   // -5% damage on heavies; feints cost half, a kick against a HELD guard deals 50% more posture, and only then (Strategy's state-conditional counter: guarding is the weak spot against a trickster). Beats the Defensive
};
// ERA (RV40, the Defensive trim): stances are LIVE (#1792), so v34..v39 records with a Defensive side (the player's pick or the foe's mood) were fought on the pre-trim row and must replay on it.
// FROZEN: never edit. Default ON (this build's fights and every headless run use STANCES); detmath.ts underRecord turns it off for a record older than FIRST_TRIM_VERSION, and Match.startClip does the same by hand.
export const FIRST_TRIM_VERSION = 40;
const DEFENSIVE_V39: Readonly<Partial<Record<StanceKey, number>>> = Object.freeze({ damage: -50, block: -150, recover: 250, window: 250, counter: 250 });
export let DEFENSIVE_TRIM = true;
export function setDefensiveTrim(on: boolean): void { DEFENSIVE_TRIM = on; }
export function underDefensiveTrim<T>(version: number, run: () => T): T {
  const outer = DEFENSIVE_TRIM; DEFENSIVE_TRIM = version >= FIRST_TRIM_VERSION;
  try { return run(); } finally { DEFENSIVE_TRIM = outer; }
}
export const stanced = (f: { stance?: StanceId }, key: StanceKey, x: number): number => { const d = f.stance && (f.stance === 'defensive' && !DEFENSIVE_TRIM ? DEFENSIVE_V39 : STANCES[f.stance])[key]; return d ? (x * (1000 + d)) / 1000 : x; };
// The AI's mood: drawn from the fight seed (a replay re-sims it exactly), 50% its home stance and 50% one of the other three picks. Home stances are the ruling's; every other opponent's home is Neutral.
const HOME: Readonly<Record<string, StanceId>> = { executioner: 'aggressive', shieldmaiden: 'defensive', goblin: 'trickster' };
export const homePick = (opponent: string): PickedStance => HOME[opponent] ?? 'neutral';
export function moodOf(seed: number, opponent: string): PickedStance {
  const home = homePick(opponent), u = rollUnit((seed ^ 0x3c6ef372) >>> 0, 0);
  if (u < 0.5) return home;
  const others = PICKS.filter(p => p !== home);
  return others[Math.min(others.length - 1, Math.floor((u - 0.5) * 2 * others.length))];
}
export const asStance = (pick: PickedStance): StanceId | undefined => (pick === 'neutral' ? undefined : pick);
