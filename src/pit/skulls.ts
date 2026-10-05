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
    const kill: Kill = { kind: 'ai', key: `${opponent}-${rank}`, name: nameOf(opponent, rank).slice(0, TEXT_MAX), level: rank, gear: {}, at: null, opponent, rank };
    kills.push(kill);
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

// Server kills first, then the loot kills the server rows do not cover (a loot kill whose legend key a server row already has is the same win), cut at 30.
// A fighter with old loot kills who wins once on the server keeps the old ones on the wall. `serverKeys`, when given, is filled with the server rows' keys.
const mergeKills = (server: Kills, local: Kills): Kills => {
  const seen = new Set(server.map((k) => k.key));
  return [...server, ...local.filter((k) => !seen.has(k.key))].slice(0, MAX_KILLS);
};
// Never throws: no client, an RPC error or throw all leave the local fallback; rows are merged with it.
export async function fetchKills(db: SkullDb | null | undefined, local: Kills, serverKeys?: Set<string>): Promise<Kills> {
  if (!db) return local;
  try {
    const r = await db.rpc('pit_recent_kills');
    if (r.error) return local;
    const server = killsFromRows(r.data);
    server.forEach((k) => serverKeys?.add(k.key));
    return server.length ? mergeKills(server, local) : local;
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
// Never throws; an rpc that has nothing yet (no wins) while the fallback knows kills leaves the fallback. Otherwise kills = the loot total plus the
// server's wins that the loot does not already count (`kills` is the merged wall list, `lootAll` every loot kill, uncapped); wins, losses, streak are the server's.
// Kills = server wins + the loot kills no server row covers (same rule as the wall). The count drifts past 30 server wins until the record RPC returns totals.
export async function fetchRecord(db: SkullDb | null | undefined, local: PitRecord, kills: Kills = [], lootAll: Kills = [], serverKeys: Set<string> = new Set()): Promise<PitRecord> {
  if (!db) return local;
  try {
    const r = await db.rpc('pit_record');
    if (r.error) return local;
    const rec = recordFromRows(r.data, kills);
    if (!rec || (!rec.wins && !rec.losses && (local.kills ?? 0) > 0)) return local;
    return { ...rec, kills: (rec.wins ?? 0) + lootAll.filter((k) => !serverKeys.has(k.key)).length };
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

// The wall of champions (docs/briefs/pit-walls/BRIEF.md section 4): today's daily board, from the public RPC daily_board_summary() (jsonb { day,
// fastest_kill, cleanest_kill, longest_survived, fastest_death, where, pending }; each headline a daily_board row or null; `where` a { location: deaths }
// object over verified deaths; verified rows rank first on the server). Up to five lines; an empty day is no lines at all.
export type ChampionKey = 'fastestKill' | 'cleanestKill' | 'longestSurvived' | 'fastestDeath' | 'where' | 'pending';
export type Champion = { key: ChampionKey; label: string; name: string; value: string; verified: boolean };
export const NAME_MAX = 16, TICKS_PER_SECOND = 60;
// A fighter's name on the board: control and bidi-override characters out, whitespace collapsed, at most NAME_MAX characters; 'Fighter' when nothing is left.
export const boardName = (v: unknown): string => {
  const s = typeof v === 'string' ? v.replace(/[\p{Cc}\u200b-\u200f\u202a-\u202e\u2066-\u2069]/gu, ' ').replace(/\s+/g, ' ').trim() : '';
  return s ? [...s].slice(0, NAME_MAX).join('').trim() : 'Fighter';
};
const seconds = (ticks: number): string => `${(ticks / TICKS_PER_SECOND).toFixed(1)} s`;
const metric = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const HEADLINES: [string, ChampionKey, string, (row: Record<string, unknown>) => string | null][] = [
  ['fastest_kill', 'fastestKill', 'Fastest kill', (r) => { const t = metric(r.ticks); return t === null ? null : seconds(t); }],
  ['cleanest_kill', 'cleanestKill', 'Cleanest kill', (r) => { const n = metric(r.taken); return n === null ? null : `${Math.floor(n)} hit${Math.floor(n) === 1 ? '' : 's'}`; }],
  ['longest_survived', 'longestSurvived', 'Longest survived', (r) => { const t = metric(r.ticks); return t === null ? null : seconds(t); }],
  ['fastest_death', 'fastestDeath', 'Fastest death', (r) => { const t = metric(r.ticks); return t === null ? null : seconds(t); }],
];
// The five lines, in the summary's order; a headline that is null or not the shape is skipped, never thrown on. The fifth is the deadliest place
// (verified deaths) when there is one, else the unverified count when there is one; an unverified row's name carries a trailing '*'.
export function championsFromSummary(json: unknown): Champion[] {
  let summary: unknown = Array.isArray(json) ? json[0] : json;
  if (typeof summary === 'string') { try { summary = JSON.parse(summary); } catch { return []; } }
  if (!isObject(summary)) return [];
  const lines: Champion[] = [];
  for (const [field, key, label, value] of HEADLINES) {
    const row = summary[field];
    if (!isObject(row)) continue;
    const v = value(row);
    if (v === null) continue;
    const verified = row.verified === true;
    lines.push({ key, label, name: `${boardName(row.display_name)}${verified ? '' : '*'}`, value: v, verified });
  }
  const where = isObject(summary.where) ? Object.entries(summary.where).flatMap(([place, n]) => { const c = metric(n); return c && Math.floor(c) > 0 && place.trim() ? [[boardName(place), Math.floor(c)] as const] : []; }) : [];
  where.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const pending = metric(summary.pending) ?? 0;
  if (where.length) lines.push({ key: 'where', label: 'Deadliest spot', name: where[0]![0], value: `${where[0]![1]} death${where[0]![1] === 1 ? '' : 's'}`, verified: true });
  else if (pending >= 1) lines.push({ key: 'pending', label: 'Pending', name: '', value: `${Math.floor(pending)} unverified today`, verified: false });
  return lines;
}
// One line as the board and its sheet read it: "Fastest kill  Wanderer  14.2 s".
export const championLine = (c: Champion): string => [c.label, c.name, c.value].filter(Boolean).join('  ');
export const NO_CHAMPIONS = 'No champions yet today.';
// Never throws: no client (a guest), an RPC error or a throw all leave an empty board.
export async function fetchChampions(db: SkullDb | null | undefined): Promise<Champion[]> {
  if (!db) return [];
  try {
    const r = await db.rpc('daily_board_summary');
    return r.error ? [] : championsFromSummary(r.data);
  } catch { return []; }
}
// The `&skulls=demo` look flag: a fixed day, one unverified row, so the board can be judged before real data exists.
export const demoChampions = (): Champion[] => championsFromSummary({
  fastest_kill: { display_name: 'Wanderer', ticks: 852, verified: true },
  cleanest_kill: { display_name: 'Ivy of the Reach', taken: 0, verified: true },
  longest_survived: { display_name: 'Marcus Vale', ticks: 4310, verified: true },
  fastest_death: { display_name: 'Dunmore', ticks: 410, verified: false },
  where: { gate: 3, pit: 1 }, pending: 2,
});

// The wall's and the board's fetched data, held together so the record always waits for the kills fetch it is fired beside (the record's Kills needs the
// server's kill keys, whichever RPC answers first), and a different signed-in fighter or a sign-out drops what the last one's fetches left.
export type FeedSource = { db: () => SkullDb | null | undefined; userId: () => string | null | undefined; loot: () => Loot | null | undefined; marks: () => number | null; nameOf?: NameOf };
export function createFeed(src: FeedSource) {
  let killCache: Kills | null = null, recordCache: PitRecord | null = null, inFlight: Promise<Kills> | null = null, owner: string | null = null;
  let keys = new Set<string>();
  const now = () => src.userId() ?? null;
  const own = () => { const id = now(); if (id !== owner) { owner = id; killCache = recordCache = inFlight = null; keys = new Set(); } };
  const local = () => killsFromLoot(src.loot(), src.nameOf), localRec = () => localRecord(src.loot(), src.marks(), src.nameOf);
  return {
    killsNow: (): Kills => (own(), killCache ?? local()),
    recordNow: (): PitRecord => (own(), recordCache ?? { ...localRec(), ...splitOf(killCache ?? local()) }),
    async kills(): Promise<Kills> {
      own();
      const mine = owner, fresh = new Set<string>();   // the live key set is replaced only by a fetch that answered, never emptied before it does
      const fetching = inFlight = fetchKills(src.db(), local(), fresh), kills = await fetching;
      if (inFlight === fetching && owner === mine) { killCache = kills; inFlight = null; if (fresh.size) keys = fresh; }
      return kills;
    },
    async record(): Promise<PitRecord> {
      own();
      const mine = owner, kills = await (inFlight ?? Promise.resolve(killCache ?? local()));
      const rec = await fetchRecord(src.db(), localRec(), kills, lootKills(src.loot(), src.nameOf), keys);
      if (now() !== mine) return localRec();   // the fighter changed while it was in flight: not theirs to cache or show
      return recordCache = rec;
    },
  };
}
