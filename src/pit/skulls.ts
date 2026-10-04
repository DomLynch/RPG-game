// What the Pit's walls hang (docs/briefs/pit-walls/BRIEF.md sections 1 and 2): pure data, no three, no DOM. KILLS: one per win, computer or real
// player, newest first, at most 30 (the skull wall's 6 x 5 niches). RECORD: the totals carved on the board. Both come from Backend's read-only
// RPCs (pit_recent_kills, pit_record) for a signed-in fighter; a guest, an offline fighter or a missing migration falls back to loot.
import type { Loot } from '../loot.ts';

export type Kill = { kind: 'ai' | 'duel'; key: string; name: string; level: number; gear: Record<string, string>; at: string | null; opponent?: string; rank?: number | null };
export type Kills = Kill[];
export type PitRecord = { kills: number | null; wins: number | null; losses: number | null; streak: number | null; highestRank: number | null; computerKills: number | null; duelKills: number | null };
export type SkullDb = { rpc(name: string): PromiseLike<{ data: unknown; error: unknown }> };
export type NameOf = (opponent: string, rank: number | null) => string;

export const MAX_KILLS = 30, TEXT_MAX = 40, GEAR_MAX = 12;

const text = (v: unknown): string | null => (typeof v === 'string' && v.length ? v.slice(0, TEXT_MAX) : null);
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const whole = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);
const rankOf = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 10 ? v : null);
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const dateOf = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);
// A legend key `<opponent>-<rank>`: the opponent id and the rank, null when the rank is missing or out of 1..10.
export function splitKey(key: string): { opponent: string; rank: number | null } {
  const at = key.lastIndexOf('-');
  return at < 1 ? { opponent: key, rank: null } : { opponent: key.slice(0, at), rank: rankOf(Number(key.slice(at + 1))) };
}

// The guest / offline fallback: every take and every refusal is a kill (loot.taken, loot.declined), newest first by the provenance's day (ties:
// the later entry first, a missing day last); then the defeats keys no take covers (same opponent and rank), which have no date. All of them, uncapped.
export function lootKills(loot: Loot | null | undefined, nameOf: NameOf = (opponent) => opponent): Kills {
  const l = (isObject(loot) ? loot : {}) as Partial<Loot>, rows: { kill: Kill; seq: number }[] = [], covered = new Set<string>();
  const see = (p: unknown) => {
    if (!isObject(p) || typeof p.opponent !== 'string' || !p.opponent) return;
    const rank = rankOf(p.tier), opponent = p.opponent.slice(0, TEXT_MAX);
    covered.add(`${opponent}-${rank ?? 0}`);
    rows.push({ seq: rows.length, kill: { kind: 'ai', key: rank ? `${opponent}-${rank}` : opponent, name: nameOf(opponent, rank).slice(0, TEXT_MAX), level: rank ?? 0, gear: {}, at: typeof p.day === 'string' && p.day ? p.day : null, opponent, rank } });
  };
  if (isObject(l.taken)) for (const p of Object.values(l.taken)) see(p);
  if (Array.isArray(l.declined)) for (const p of l.declined) see(p);
  rows.sort((a, b) => (b.kill.at ?? '').localeCompare(a.kill.at ?? '') || b.seq - a.seq);
  const kills = rows.map((r) => r.kill);
  if (Array.isArray(l.defeats)) for (const key of l.defeats) {
    if (typeof key !== 'string') continue;
    const { opponent, rank } = splitKey(key);
    if (!opponent || rank === null || covered.has(`${opponent}-${rank}`)) continue;
    covered.add(`${opponent}-${rank}`);
    kills.push({ kind: 'ai', key: `${opponent}-${rank}`, name: nameOf(opponent, rank).slice(0, TEXT_MAX), level: rank, gear: {}, at: null, opponent, rank });
  }
  return kills;
}
export const killsFromLoot = (loot: Loot | null | undefined, nameOf?: NameOf): Kills => lootKills(loot, nameOf).slice(0, MAX_KILLS);

// pit_recent_kills() rows; a row that is not the shape is skipped, never thrown on. The server's order (newest first) is kept.
export function killsFromRows(rows: unknown): Kills {
  const kills: Kills = [];
  if (!Array.isArray(rows)) return kills;
  for (const row of rows) {
    if (!isObject(row) || kills.length >= MAX_KILLS || (row.kind !== 'ai' && row.kind !== 'duel')) continue;
    const key = text(row.opponent_key), name = text(row.opponent_name);
    if (!key || !name) continue;
    const gear: Record<string, string> = {};
    if (isObject(row.opponent_gear)) for (const [slot, id] of Object.entries(row.opponent_gear)) { if (typeof id === 'string' && Object.keys(gear).length < GEAR_MAX) gear[slot.slice(0, TEXT_MAX)] = id.slice(0, TEXT_MAX); }
    const kill: Kill = { kind: row.kind, key, name, level: count(row.opponent_level), gear, at: dateOf(row.created_at) };
    if (row.kind === 'ai') { const { opponent, rank } = splitKey(key); kill.opponent = opponent; kill.rank = rank; }
    kills.push(kill);
  }
  return kills;
}

// Never throws: no client, an RPC error or throw, or no rows while the fallback has kills, all leave the local fallback.
export async function fetchKills(db: SkullDb | null | undefined, local: Kills): Promise<Kills> {
  if (!db) return local;
  try {
    const r = await db.rpc('pit_recent_kills');
    if (r.error) return local;
    const kills = killsFromRows(r.data);
    return kills.length || !local.length ? kills : local;
  } catch { return local; }
}

// The record. The computer / duel split is of the kills handed in (the latest 30): exact only up to 30.
export const splitOf = (kills: Kills): Pick<PitRecord, 'computerKills' | 'duelKills'> => ({ computerKills: kills.filter((k) => k.kind === 'ai').length, duelKills: kills.filter((k) => k.kind === 'duel').length });
export const blankRecord = (): PitRecord => ({ kills: null, wins: null, losses: null, streak: null, highestRank: null, computerKills: null, duelKills: null });

// The fallback: kills = every take, refusal and uncovered defeat; wins = the career's victory marks (a number the caller passes, null when unknown);
// losses and streak are unknown; the highest rank from the tiers on record.
export function localRecord(loot: Loot | null | undefined, marks: number | null, nameOf?: NameOf): PitRecord {
  const all = lootKills(loot, nameOf), ranks = all.flatMap((k) => (k.rank ? [k.rank] : []));
  return { ...blankRecord(), kills: all.length, wins: whole(marks), highestRank: ranks.length ? Math.max(...ranks) : null, ...splitOf(all.slice(0, MAX_KILLS)) };
}
// pit_record() returns one row (an array of one, or the bare object); anything else is null.
export function recordFromRows(rows: unknown, kills: Kills = []): PitRecord | null {
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!isObject(row)) return null;
  const wins = whole(row.wins), losses = whole(row.losses);
  if (wins === null || losses === null) return null;
  return { kills: wins, wins, losses, streak: whole(row.streak), highestRank: rankOf(row.highest_rank), ...splitOf(kills) };
}
// Never throws; an rpc that has nothing yet (no wins) while the fallback knows kills leaves the fallback.
export async function fetchRecord(db: SkullDb | null | undefined, local: PitRecord, kills: Kills = []): Promise<PitRecord> {
  if (!db) return local;
  try {
    const r = await db.rpc('pit_record');
    if (r.error) return local;
    const rec = recordFromRows(r.data, kills);
    return !rec || (!rec.wins && !rec.losses && (local.kills ?? 0) > 0) ? local : rec;
  } catch { return local; }
}

// The `&skulls=demo` look flag: a deterministic fake set so the wall and the board can be judged before real data exists. Never the default path.
const DEMO_AI: [string, number | null, string][] = [
  ['veteran', 3, '2026-10-04'], ['pitborn', 5, '2026-10-02'], ['witch', 9, '2026-09-30'], ['knight', 2, '2026-09-27'],
  ['goblin', 1, '2026-09-25'], ['nightborn', 7, '2026-09-22'], ['dwarf', null, '2026-09-18'], ['executioner', 4, '2026-09-15'],
];
const DEMO_DUELS: [string, number, Record<string, string>, string][] = [
  ['Marcus Vale', 24, { head: 'knight.Helmet', chest: 'knight.Body', weapon: 'veteran.Trident' }, '2026-10-03T19:20:00Z'],
  ['Ivy of the Reach', 31, { head: 'witch.Hat', chest: 'witch.Robe', weapon: 'witch.Staff' }, '2026-10-01T21:05:00Z'],
  ['Sable', 40, { head: 'executioner.Hood', chest: 'executioner.Body', legs: 'executioner.Greaves', weapon: 'executioner.Axe' }, '2026-09-26T17:15:00Z'],
  ['Dunmore', 8, { chest: 'goblin.Vest', weapon: 'goblin.Dagger' }, '2026-09-20T08:40:00Z'],
];
export function demoKills(nameOf: NameOf = (opponent) => opponent): Kills {
  const ai = DEMO_AI.map(([opponent, rank, day]): Kill => ({ kind: 'ai', key: rank ? `${opponent}-${rank}` : opponent, name: nameOf(opponent, rank), level: rank ?? 0, gear: {}, at: day, opponent, rank }));
  const duels = DEMO_DUELS.map(([name, level, gear, at], i): Kill => ({ kind: 'duel', key: `demo-${i}`, name, level, gear: { ...gear }, at }));
  return [...ai, ...duels].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
}
export const demoRecord = (): PitRecord => ({ kills: 73, wins: 73, losses: 19, streak: 4, highestRank: 9, ...splitOf(demoKills()) });
