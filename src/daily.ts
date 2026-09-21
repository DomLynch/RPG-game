// The daily warden (beta plan brief 4). Everyone fights the same opponent on the same warden seed once a day: the server hands out the
// day, its number and the seed (migration 202609210003, `daily_fight()`; the seed hashes a secret nobody sees); the client rotates the
// live ladder by the number, starts the fight on that seed at normal, and a signed-in fighter posts the fight record once. Guests play
// and see the board but do not post. One attempt: the day is marked spent the moment the fight starts, so a reload mid-fight is the
// attempt. No marks, no scorecard: the daily is its own board. Pure: no DOM; main.ts wires the boot and the finish.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { HitLocation } from './blade.ts';
import type { OpponentId } from './roster.ts';
import type { StoragePort } from './profile.ts';
import type { FightRecord } from './record.ts';
import { encodeRecord } from './record.ts';

export type DailyFight = { day: string; number: number; seed: number };
export type DailyState = { day: string; started: boolean; submitted: boolean; outcome?: FightRecord['outcome']; ticks?: number };
export type DailyRow = { day: string; number: number; opponent: string; weapon: string; outcome: string; ticks: number; location: HitLocation | null; taken: number; verified: boolean; display_name: string | null };
const KEY = 'frankendom.daily.v1';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const dailyParam = (search: string): boolean => /[?&]daily=1(?:&|$)/.test(search);
// The day's opponent: the live ladder in order, one rung a day, round and round.
export const dailyOpponent = <T extends { id: OpponentId }>(fight: DailyFight, ladder: readonly T[]): T => ladder[((fight.number % ladder.length) + ladder.length) % ladder.length];

// The device's memory of today: fresh for another day, otherwise as saved. Unreadable storage is a fresh day (never a blocked fight).
export function loadDaily(storage: StoragePort, day: string): DailyState {
  try {
    const value = JSON.parse(storage.getItem(KEY) || 'null') as Partial<DailyState> | null;
    if (value && value.day === day) return { day, started: !!value.started, submitted: !!value.submitted, ...(typeof value.outcome === 'string' ? { outcome: value.outcome } : {}), ...(Number.isSafeInteger(value.ticks) ? { ticks: value.ticks } : {}) };
  } catch { /* fresh day */ }
  return { day, started: false, submitted: false };
}
export function saveDaily(storage: StoragePort, state: DailyState): boolean {
  try { storage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; }
}

// Today's fight from the server (a plain REST call with the public key: guests ask too). Refuses anything that is not a whole answer.
export async function fetchDaily(api: { url: string; key: string }, fetchFn: typeof fetch = fetch): Promise<DailyFight> {
  const response = await fetchFn(`${api.url}/rest/v1/rpc/daily_fight`, { method: 'POST', headers: { apikey: api.key, Authorization: `Bearer ${api.key}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: '{}' });
  if (!response.ok) throw Error(`the daily warden answered ${response.status}`);
  const body = await response.json() as unknown, row = (Array.isArray(body) ? body[0] : body) as Partial<DailyFight> | null;
  if (!row || typeof row.day !== 'string' || !DAY.test(row.day) || !Number.isSafeInteger(row.number) || !Number.isSafeInteger(row.seed)) throw Error('no daily warden today');
  return { day: row.day, number: row.number!, seed: (row.seed! >>> 0) };   // the server's signed 32-bit hash as the warden's unsigned seed
}

// The day's board, newest last; the client greys unverified rows.
export async function fetchDailyBoard(api: { url: string; key: string }, day: string, fetchFn: typeof fetch = fetch): Promise<DailyRow[]> {
  if (!DAY.test(day)) throw Error('not a day');
  const response = await fetchFn(`${api.url}/rest/v1/daily_board?select=*&day=eq.${day}&order=created_at.asc&limit=200`, { headers: { apikey: api.key, Authorization: `Bearer ${api.key}`, Accept: 'application/json' } });
  if (!response.ok) throw Error(`the daily board answered ${response.status}`);
  const rows = await response.json() as unknown;
  return Array.isArray(rows) ? rows.filter((r): r is DailyRow => !!r && typeof r === 'object' && typeof (r as DailyRow).outcome === 'string' && Number.isSafeInteger((r as DailyRow).ticks)) : [];
}

// A signed-in fighter's one post: the record and the facts the board shows. The server's primary key refuses a second one.
export async function postDaily(db: SupabaseClient, userId: string, fight: DailyFight, record: FightRecord, location: HitLocation | null, taken: number): Promise<void> {
  const text = await encodeRecord(record);
  const { error } = await db.from('daily_results').insert({ day: fight.day, user_id: userId, number: fight.number, opponent: record.opponent, weapon: record.weapon, outcome: record.outcome, ticks: record.ticks, location, taken, record: text });
  if (error) throw Error(error.code === '23505' ? 'today\'s result is already posted' : error.message || 'the daily warden refused the result');
}

// The board's five lines, from the day's rows (verified rows first when a tie is broken; nothing invented when a column is empty).
export function dailyBoard(rows: readonly DailyRow[]): { title: string; row: DailyRow | null }[] {
  const kills = rows.filter(r => r.outcome === 'killed'), deaths = rows.filter(r => r.outcome === 'died');
  const by = (list: readonly DailyRow[], key: (r: DailyRow) => number, min = true) => list.length ? [...list].sort((a, b) => (key(a) - key(b)) * (min ? 1 : -1) || Number(b.verified) - Number(a.verified))[0] : null;
  const where = deaths.length ? (['head', 'torso', 'legs'] as const).map(l => ({ l, n: deaths.filter(r => r.location === l).length })).sort((a, b) => b.n - a.n)[0] : null;
  return [
    { title: 'Fastest kill', row: by(kills, r => r.ticks) },
    { title: 'Cleanest kill', row: by(kills, r => r.taken) },
    { title: 'Longest survived', row: by(deaths, r => r.ticks, false) },
    { title: 'Fastest death', row: by(deaths, r => r.ticks) },
    { title: where ? `Where he killed people: ${where.l} (${where.n})` : 'Where he killed people', row: null },
  ];
}

// The Wordle-style share text: the day, the opponent, the result and a row of squares (one per twelve seconds; the last is the kill or
// the fall), then the kill link when there is one. Plain text for the share sheet.
export function dailyShareText(fight: DailyFight, opponentName: string, outcome: FightRecord['outcome'], ticks: number, link: string | null, hz = 60): string {
  const seconds = ticks / hz, bins = Math.max(1, Math.ceil(seconds / 12));
  const squares = '🟩'.repeat(Math.max(0, bins - 1)) + (outcome === 'killed' ? '🟨' : outcome === 'died' ? '🟥' : '⬛');
  const result = outcome === 'killed' ? `killed him in ${seconds.toFixed(1)} s` : outcome === 'died' ? `fell at ${seconds.toFixed(1)} s` : outcome === 'draw' ? `a double fall at ${seconds.toFixed(1)} s` : 'walked away';
  return `Frankendom Daily #${fight.number} · ${opponentName}\n${squares} ${result}${link ? `\n${link}` : ''}`;
}
