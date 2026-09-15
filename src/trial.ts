import type { StoragePort } from './profile.ts';

// Control-scheme trial: which right-thumb control the owner is testing, and a per-scheme scorecard kept in the browser.
export type Scheme = 'buttons' | 'flick' | 'drag' | 'charge';
export const SCHEMES: Scheme[] = ['buttons', 'flick', 'drag', 'charge'];
export const LABELS: Record<Scheme, string> = { buttons: 'buttons', flick: 'disc · flick (v1)', drag: 'disc · drag & release (v2)', charge: 'disc · drag & release · hold to charge (v3)' };
export type Tally = { fights: number; wins: number; rematches: number; ticks: number; dealt: number; taken: number };
export type Trial = { scheme: Scheme; card: Partial<Record<Scheme, Tally>> };
const KEY = 'frankendom.controls.v1';
const isTally = (t: unknown): t is Tally => typeof t === 'object' && t !== null && ['fights', 'wins', 'rematches', 'ticks', 'dealt', 'taken'].every(k => Number.isFinite((t as Record<string, unknown>)[k]));

export function loadTrial(storage: StoragePort): Trial {
  try {
    const value = JSON.parse(storage.getItem(KEY) || 'null');
    const scheme: Scheme = SCHEMES.includes(value?.scheme) ? value.scheme : 'buttons', card: Trial['card'] = {};
    for (const s of SCHEMES) if (isTally(value?.card?.[s])) card[s] = value.card[s];
    return { scheme, card };
  } catch { return { scheme: 'buttons', card: {} }; }
}
export function saveTrial(storage: StoragePort, trial: Trial): boolean {
  try { storage.setItem(KEY, JSON.stringify(trial)); return true; } catch { return false; }
}
const tally = (trial: Trial, scheme: Scheme): Tally => (trial.card[scheme] ??= { fights: 0, wins: 0, rematches: 0, ticks: 0, dealt: 0, taken: 0 });
export function recordFight(trial: Trial, scheme: Scheme, won: boolean, ticks: number, dealt: number, taken: number): void {
  const t = tally(trial, scheme); t.fights++; if (won) t.wins++; t.ticks += ticks; t.dealt += dealt; t.taken += taken;
}
export function recordRematch(trial: Trial, scheme: Scheme): void { tally(trial, scheme).rematches++; }
// One line per scheme that has been played: the "did I want to duel again" numbers.
export function formatCard(trial: Trial, hz = 60): string {
  const lines = SCHEMES.filter(s => trial.card[s]?.fights || trial.card[s]?.rematches).map(s => {
    const t = trial.card[s]!, avg = t.fights ? Math.round(t.ticks / t.fights / hz) : 0;
    return `${LABELS[s]} — ${t.fights} fights · ${t.wins} won · ${t.rematches} rematches · ${avg} s avg · dealt ${t.dealt} / taken ${t.taken}`;
  });
  return lines.length ? lines.join('\n') : 'No fights recorded yet. Each scheme keeps its own tally on this device.';
}
