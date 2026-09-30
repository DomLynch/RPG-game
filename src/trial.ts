import type { Practice } from './combat.ts';
import type { StoragePort } from './profile.ts';

// Control trial tally: fights, wins, rematches, duel length and damage on this device, shown under the combat debug view.
// The right-thumb grammar is the thumb cluster (v5), locked in by the owner on 2026-09-16 and confirmed on 2026-09-20 when the v8
// strike circle was retired ("I tried both and prefer buttons"; one grammar means every control feature is built and tested once).
// A card saved by the per-scheme trial (`{ scheme, card: { cluster, ring8 } }`) loads as its cluster tally; the ring's numbers are dropped.
type Tally = { fights: number; wins: number; rematches: number; ticks: number; dealt: number; taken: number; active: number };   // active: real unpaused wall-clock ms (hit-stop included); ticks is simulation time
export type Trial = { card: Tally };
const KEY = 'frankendom.controls.v1';
const isTally = (t: unknown): t is Tally => typeof t === 'object' && t !== null && ['fights', 'wins', 'rematches', 'ticks', 'dealt', 'taken'].every(k => Number.isFinite((t as Record<string, unknown>)[k]));
const empty = (): Tally => ({ fights: 0, wins: 0, rematches: 0, ticks: 0, dealt: 0, taken: 0, active: 0 });

export function loadTrial(storage: StoragePort): Trial {
  try {
    const value = JSON.parse(storage.getItem(KEY) || 'null'), card = isTally(value?.card) ? value.card : value?.card?.cluster;
    return { card: isTally(card) ? { ...card, active: Number.isFinite(card.active) ? card.active : 0 } : empty() };   // cards from before the wall-clock field load with 0
  } catch { return { card: empty() }; }
}
export function saveTrial(storage: StoragePort, trial: Trial): boolean {
  try { storage.setItem(KEY, JSON.stringify(trial)); return true; } catch { return false; }
}
export function recordFight(trial: Trial, won: boolean, ticks: number, dealt: number, taken: number, activeMs = 0): void {
  const t = trial.card; t.fights++; if (won) t.wins++; t.ticks += ticks; t.dealt += dealt; t.taken += taken; t.active += activeMs;
}
export function recordPractice(trial: Trial, practice: Practice, activeMs: number): void {
  recordFight(trial, !!practice.finish && practice.finish.victim === 1 && !practice.finish.draw,
    practice.duel.tick, practice.enemyMaxHealth - practice.health, practice.maxHealth - practice.playerHealth, activeMs);
}
export function recordRematch(trial: Trial): void { trial.card.rematches++; }
// The "did I want to duel again" numbers, one line.
export function formatCard(trial: Trial, hz = 60): string {
  const t = trial.card;
  if (!t.fights && !t.rematches) return 'No fights recorded yet.';
  const avg = t.fights ? Math.round(t.ticks / t.fights / hz) : 0, real = t.fights && t.active ? Math.round(t.active / t.fights / 1000) : 0;
  return `${t.fights} fights · ${t.wins} won · ${t.rematches} rematches · ${avg} s avg${real ? ` (${real} s real)` : ''} · dealt ${t.dealt} / taken ${t.taken}`;
}
