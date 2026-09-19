import type { Practice } from './combat.ts';
import type { StoragePort } from './profile.ts';

// Control-scheme trial: which right-thumb control the owner is testing, and a per-scheme scorecard kept in the browser.
// The owner locked in the thumb cluster (v5) on 2026-09-16 after trying the square grid, three weapon-disc grammars, an invisible
// field and a segmented disc; the flick disc (v1) stays as the one alternative. v7 (guard ring) and v8 (one strike circle: tap/hold/flick)
// are owner trials of 2026-09-18. Any other stored scheme falls back to the cluster.
export type Scheme = 'cluster' | 'ring8';
export const SCHEMES: Scheme[] = ['cluster', 'ring8'];
export const LABELS: Record<Scheme, string> = { cluster: 'thumb cluster', ring8: 'guard ring · v8' };
export type Tally = { fights: number; wins: number; rematches: number; ticks: number; dealt: number; taken: number; active: number };   // active: real unpaused wall-clock ms (hit-stop included); ticks is simulation time
export type Trial = { scheme: Scheme; card: Partial<Record<Scheme, Tally>> };
const KEY = 'frankendom.controls.v1';
const isTally = (t: unknown): t is Tally => typeof t === 'object' && t !== null && ['fights', 'wins', 'rematches', 'ticks', 'dealt', 'taken'].every(k => Number.isFinite((t as Record<string, unknown>)[k]));

export function loadTrial(storage: StoragePort): Trial {
  try {
    const value = JSON.parse(storage.getItem(KEY) || 'null');
    const scheme: Scheme = SCHEMES.includes(value?.scheme) ? value.scheme : 'cluster', card: Trial['card'] = {};
    for (const s of SCHEMES) if (isTally(value?.card?.[s])) card[s] = { ...value.card[s], active: Number.isFinite(value.card[s].active) ? value.card[s].active : 0 };   // cards from before the wall-clock field
    return { scheme, card };
  } catch { return { scheme: 'cluster', card: {} }; }
}
export function saveTrial(storage: StoragePort, trial: Trial): boolean {
  try { storage.setItem(KEY, JSON.stringify(trial)); return true; } catch { return false; }
}
const tally = (trial: Trial, scheme: Scheme): Tally => (trial.card[scheme] ??= { fights: 0, wins: 0, rematches: 0, ticks: 0, dealt: 0, taken: 0, active: 0 });
export function recordFight(trial: Trial, scheme: Scheme, won: boolean, ticks: number, dealt: number, taken: number, activeMs = 0): void {
  const t = tally(trial, scheme); t.fights++; if (won) t.wins++; t.ticks += ticks; t.dealt += dealt; t.taken += taken; t.active += activeMs;
}
export function recordPractice(trial: Trial, scheme: Scheme, practice: Practice, activeMs: number): void {
  recordFight(trial, scheme, !!practice.finish && practice.finish.victim === 1 && !practice.finish.draw,
    practice.duel.tick, practice.enemyMaxHealth - practice.health, practice.maxHealth - practice.playerHealth, activeMs);
}
export function recordRematch(trial: Trial, scheme: Scheme): void { tally(trial, scheme).rematches++; }
// One line per scheme that has been played: the "did I want to duel again" numbers.
export function formatCard(trial: Trial, hz = 60): string {
  const lines = SCHEMES.filter(s => trial.card[s]?.fights || trial.card[s]?.rematches).map(s => {
    const t = trial.card[s]!, avg = t.fights ? Math.round(t.ticks / t.fights / hz) : 0, real = t.fights && t.active ? Math.round(t.active / t.fights / 1000) : 0;
    return `${LABELS[s]} — ${t.fights} fights · ${t.wins} won · ${t.rematches} rematches · ${avg} s avg${real ? ` (${real} s real)` : ''} · dealt ${t.dealt} / taken ${t.taken}`;
  });
  return lines.length ? lines.join('\n') : 'No fights recorded yet. Each scheme keeps its own tally on this device.';
}
