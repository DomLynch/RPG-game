// What the skull wall hangs (docs/briefs/skull-wall/BRIEF.md part B): pure data, no three, no DOM. Left panel: one skull per computer
// opponent beaten at any rank. Right panel: the real players this fighter beat in duels, latest win first. The record comes from Backend's two
// read-only RPCs (pit_ai_standing, pit_duel_beaten) for a signed-in fighter; a guest or an offline fighter falls back to loot.
import type { Loot } from '../loot.ts';

export type AiSkull = { opponent: string; ranks: number[]; wins: number; losses: number; draws: number; beaten: boolean };
export type DuelSkull = { key: string; name: string; level: number; gear: Record<string, string>; lastWinAt: string | null; wins: number; losses: number; draws: number };
export type Skulls = { ai: AiSkull[]; duels: DuelSkull[] };
export type SkullDb = { rpc(name: string): PromiseLike<{ data: unknown; error: unknown }> };

export const DUEL_SKULLS = 30, TEXT_MAX = 40, GEAR_MAX = 12;

// The opponent ids in legends order: every 10th portrait key `<opponent>-<rank>`.
export const opponentsOf = (keys: readonly string[]): string[] => keys.filter((_, i) => i % 10 === 0).map((key) => key.slice(0, key.lastIndexOf('-')));

const text = (v: unknown): string | null => (typeof v === 'string' && v.length ? v.slice(0, TEXT_MAX) : null);
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const rankOf = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 10 ? v : null);
const sorted = (ranks: Iterable<number>): number[] => [...new Set(ranks)].sort((a, b) => a - b);
const blank = (opponent: string): AiSkull => ({ opponent, ranks: [], wins: 0, losses: 0, draws: 0, beaten: false });
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// The guest / offline fallback: beaten if the opponent shows in loot.defeats, taken or declined. Rank when the record carries one; wins and losses are unknown (0).
export function skullsFromLoot(loot: Loot | null | undefined, opponents: readonly string[]): Skulls {
  const ranks = new Map<string, Set<number>>(opponents.map((o) => [o, new Set<number>()])), beaten = new Set<string>();
  const see = (opponent: unknown, rank?: unknown) => {
    if (typeof opponent !== 'string' || !ranks.has(opponent)) return;
    beaten.add(opponent);
    const r = rankOf(rank);
    if (r !== null) ranks.get(opponent)!.add(r);
  };
  const l = (isObject(loot) ? loot : {}) as Partial<Loot>;
  if (Array.isArray(l.defeats)) for (const key of l.defeats) { if (typeof key !== 'string') continue; const at = key.lastIndexOf('-'); see(key.slice(0, at), Number(key.slice(at + 1))); }
  if (isObject(l.taken)) for (const p of Object.values(l.taken)) if (isObject(p)) see(p.opponent, p.tier);
  if (Array.isArray(l.declined)) for (const p of l.declined) if (isObject(p)) see(p.opponent, p.tier);
  return { ai: opponents.map((o) => ({ ...blank(o), ranks: sorted(ranks.get(o)!), beaten: beaten.has(o) })), duels: [] };
}

// pit_ai_standing() rows and pit_duel_beaten() rows; a row that is not the shape is skipped, never thrown on.
export function skullsFromRows(aiRows: unknown, duelRows: unknown, opponents: readonly string[]): Skulls {
  const byOpponent = new Map<string, AiSkull>();
  if (Array.isArray(aiRows)) for (const row of aiRows) {
    if (!isObject(row)) continue;
    const opponent = text(row.opponent);
    if (!opponent || !opponents.includes(opponent)) continue;
    const ranks = sorted((Array.isArray(row.ranks_beaten) ? row.ranks_beaten : []).map(rankOf).filter((r): r is number => r !== null));
    byOpponent.set(opponent, { opponent, ranks, wins: count(row.wins), losses: count(row.losses), draws: count(row.draws), beaten: row.beaten === true || ranks.length > 0 });
  }
  const duels: DuelSkull[] = [];
  if (Array.isArray(duelRows)) for (const row of duelRows) {
    if (!isObject(row) || duels.length >= DUEL_SKULLS) continue;
    const key = text(row.opponent_key), name = text(row.opponent_name);
    if (!key || !name) continue;
    const gear: Record<string, string> = {};
    if (isObject(row.opponent_gear)) for (const [slot, id] of Object.entries(row.opponent_gear)) { if (typeof id === 'string' && Object.keys(gear).length < GEAR_MAX) gear[slot.slice(0, TEXT_MAX)] = id.slice(0, TEXT_MAX); }
    const at = typeof row.last_win_at === 'string' && !Number.isNaN(Date.parse(row.last_win_at)) ? row.last_win_at : null;
    duels.push({ key, name, level: count(row.opponent_level), gear, lastWinAt: at, wins: count(row.wins), losses: count(row.losses), draws: count(row.draws) });
  }
  return { ai: opponents.map((o) => byOpponent.get(o) ?? blank(o)), duels };
}

// Beaten if either says so, ranks the union, the counts the server's (never below the local ones), the duels the server's.
export function mergeSkulls(local: Skulls, remote: Skulls): Skulls {
  const there = new Map(remote.ai.map((a) => [a.opponent, a] as const));
  const ai = local.ai.map((a) => {
    const r = there.get(a.opponent);
    if (!r) return a;
    return { opponent: a.opponent, ranks: sorted([...a.ranks, ...r.ranks]), wins: Math.max(a.wins, r.wins), losses: Math.max(a.losses, r.losses), draws: Math.max(a.draws, r.draws), beaten: a.beaten || r.beaten };
  });
  return { ai, duels: remote.duels };
}

// Never throws: no client, an RPC error or a throw all leave the local fallback.
export async function fetchSkulls(db: SkullDb | null | undefined, local: Skulls, opponents: readonly string[]): Promise<Skulls> {
  if (!db) return local;
  try {
    const [ai, duels] = await Promise.all([db.rpc('pit_ai_standing'), db.rpc('pit_duel_beaten')]);
    if (ai.error || duels.error) return local;
    return mergeSkulls(local, skullsFromRows(ai.data, duels.data, opponents));
  } catch { return local; }
}

// The `&skulls=demo` look flag: a deterministic fake set so the wall can be judged before real data exists. Never the default path.
const DEMO_RANKS = [[1, 2, 3, 5], [1, 2], [1, 2, 3], [1], [1, 2, 4, 6, 7], [1, 3]];
const DEMO_DUELS: [string, number, Record<string, string>, string, number, number][] = [
  ['Marcus Vale', 24, { head: 'knight.Helmet', chest: 'knight.Body', weapon: 'veteran.Trident' }, '2026-10-03T19:20:00Z', 3, 1],
  ['Ivy of the Reach', 31, { head: 'witch.Hat', chest: 'witch.Robe', weapon: 'witch.Staff' }, '2026-10-02T21:05:00Z', 2, 2],
  ['Dunmore', 8, { chest: 'goblin.Vest', weapon: 'goblin.Dagger' }, '2026-10-01T08:40:00Z', 1, 0],
  ['Sable', 40, { head: 'executioner.Hood', chest: 'executioner.Body', legs: 'executioner.Greaves', weapon: 'executioner.Axe' }, '2026-09-30T17:15:00Z', 4, 3],
  ['Brannoch', 17, { head: 'dwarf.Helmet', weapon: 'dwarf.Hammer' }, '2026-09-28T12:00:00Z', 2, 1],
  ['Oona Reed', 12, { chest: 'pitborn.Body', weapon: 'pitborn.Spear' }, '2026-09-26T20:30:00Z', 1, 1],
  ['Hask', 3, { weapon: 'veteran.Sword' }, '2026-09-24T09:10:00Z', 1, 0],
  ['The Grey Mare', 29, { head: 'shieldmaiden.Helmet', chest: 'shieldmaiden.Body', weapon: 'shieldmaiden.Axe' }, '2026-09-22T18:45:00Z', 5, 2],
  ['Tolliver', 21, { head: 'plaguedoctor.Mask', chest: 'plaguedoctor.Coat' }, '2026-09-20T22:00:00Z', 2, 0],
];
export function demoSkulls(opponents: readonly string[]): Skulls {
  const ai = opponents.map((opponent, i): AiSkull => {
    const ranks = i < DEMO_RANKS.length ? DEMO_RANKS[i]! : [];
    return ranks.length ? { opponent, ranks: [...ranks], wins: ranks.length * 2 + (i % 3), losses: (i * 2) % 5, draws: 0, beaten: true } : blank(opponent);
  });
  const duels = DEMO_DUELS.map(([name, level, gear, lastWinAt, wins, losses], i): DuelSkull => ({ key: `demo-${i}`, name, level, gear: { ...gear }, lastWinAt, wins, losses, draws: 0 }));
  return { ai, duels };
}
