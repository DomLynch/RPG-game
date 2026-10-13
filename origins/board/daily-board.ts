// Discovery entries and the daily board as data rows (top-30 item 20). Nothing is wired: Backend reads these later. Pure: the day and the seed come in, no clock, no storage.
// A `discovery` row names a landmark in a zone and the reward for the first find (`firstFind`, a `board-reward` row). A `board-task` row is one kind of daily job (kind, target, count, reward, weight);
// a `board-rule` row says how many are on the board (slots), whether the kinds must differ, how many past days a task stays off, the seed salt, the completion cap and the UTC reset hour.
// Donor: AzerothCore marks a quest QUEST_FLAGS_DAILY, caps completions per day (PLAYER_MAX_DAILY_QUESTS 25) and resets them at one world time (World::InitDailyQuestResetTime); the quest the player sees is a fixed row.
// 2004Scape has no daily board and nothing that rewards a first find (its exploration is quest steps), so the rotating pick from a weighted pool and the first-find reward are ours: the pick is a pure function of (seed, day), so
// every client and the server agree with nothing stored.
import { loadRegistry, nextRandom, tableFromFile, type Manifest } from '../../src/core/server.ts';
import DATA from './daily-board.json' with { type: 'json' };
import MANIFEST from './daily-board.manifest.json' with { type: 'json' };

const makeRng = (seed: number) => { let s = seed >>> 0; return () => { const [v, next] = nextRandom(s); s = next; return v; }; };   // the core's mulberry32 (same stream as the engine's makeRng)

export type BoardReward = { id: string; kind: string; amount: number; item?: string };
export type Discovery = { id: string; zone: string; landmark: string; firstFind: string };
export type BoardTask = { id: string; kind: string; target: string; count: number; reward: string; weight: number };
export type BoardRule = { id: string; slots: number; distinctKinds: boolean; noRepeatDays: number; anchorEvery: number; seedSalt: number; completionCap: number; resetHourUtc: number };

// The registry checks types and refs; these are the relations in the board rule (a zero here would make the board recurse forever or never reset).
export function checkBoardRelations(data: { boards: BoardRule[]; tasks: BoardTask[] }): void {
  const bad: string[] = [];
  for (const r of data.boards) {
    if (!(r.anchorEvery >= 1)) bad.push(`${r.id}: anchorEvery must be >= 1 (0 gives d % 0 = NaN and the board never stops recursing)`);
    if (!(r.slots >= 0) || !(r.noRepeatDays >= 0)) bad.push(`${r.id}: slots and noRepeatDays must be >= 0`);
    if (!(r.resetHourUtc >= 0 && r.resetHourUtc <= 23)) bad.push(`${r.id}: resetHourUtc must be 0..23`);
    if (!(r.completionCap >= 1)) bad.push(`${r.id}: completionCap must be >= 1`);
  }
  for (const t of data.tasks) if (!(t.count >= 1) || !(t.weight >= 1)) bad.push(`${t.id}: count and weight must be >= 1`);
  if (bad.length) throw new Error(`daily-board relations: ${bad.join('; ')}`);
}
export const loadDailyBoard = (data: unknown = DATA) => {
  const reg = loadRegistry((MANIFEST.tables as unknown as Manifest[]).map((m) => tableFromFile(m, data, 'daily-board.json')));
  checkBoardRelations(data as { boards: BoardRule[]; tasks: BoardTask[] });
  return reg;
};
loadDailyBoard();
export const BOARD_REWARDS: readonly BoardReward[] = DATA.rewards;
export const DISCOVERIES: readonly Discovery[] = DATA.discoveries;
export const BOARD_TASKS: readonly BoardTask[] = DATA.tasks;
export const BOARD_RULES: readonly BoardRule[] = DATA.boards;
export const discoveryById = (id: string): Discovery | null => DISCOVERIES.find((d) => d.id === id) ?? null;
export const rewardById = (id: string): BoardReward | null => BOARD_REWARDS.find((r) => r.id === id) ?? null;
export const boardRule = (id = 'daily'): BoardRule | null => BOARD_RULES.find((r) => r.id === id) ?? null;
// The reward for first-finding a landmark (null for an unknown discovery id; the server checks the player has not found it yet).
export const firstFindReward = (id: string): BoardReward | null => { const d = discoveryById(id); return d ? rewardById(d.firstFind) : null; };

const hash = (seed: number, day: number, salt: number): number => { let h = (seed ^ Math.imul(day | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b); return (h ^ (h >>> 16)) >>> 0; };

// One day's draw, ignoring the no-repeat rule: weighted draws without replacement from `pool`, a kind not yet on the board first while any remains (when `distinctKinds`).
function drawnOn(pool: readonly BoardTask[], rule: BoardRule, seed: number, day: number): BoardTask[] {
  const rnd = makeRng(hash(seed, day, rule.seedSalt)), left = [...pool], out: BoardTask[] = [];
  while (out.length < rule.slots && left.length > 0) {
    const fresh = rule.distinctKinds ? left.filter((t) => !out.some((o) => o.kind === t.kind)) : left;
    const from = fresh.length > 0 ? fresh : left;
    let roll = rnd() * from.reduce((n, t) => n + t.weight, 0), chosen = from[from.length - 1]!;
    for (const t of from) { roll -= t.weight; if (roll < 0) { chosen = t; break; } }
    out.push(chosen); left.splice(left.indexOf(chosen), 1);
  }
  return out;
}

// The board for `day` (whole days since the epoch, reset at the rule's UTC hour; the caller makes the day number): the same (seed, day) always gives the same tasks in the same order.
// slots 0 gives an empty board; noRepeatDays 0 bars nothing. A task shown on any of the previous `noRepeatDays` days stays off, unless that would leave fewer tasks (or, with distinctKinds, fewer kinds) than slots (then the rule is waived so the board is never short). With no stored history the chain
// is rebuilt from the last anchor day (day % anchorEvery == 0), which has no yesterday: so the rule holds on every day but an anchor, and an anchor may repeat a task from the day before.
export function dailyBoardFor(seed: number, day: number, rule: BoardRule | null = boardRule(), tasks: readonly BoardTask[] = BOARD_TASKS): BoardTask[] {
  if (!rule) return [];
  const memo = new Map<number, BoardTask[]>();
  const shown = (d: number): BoardTask[] => {
    const hit = memo.get(d); if (hit) return hit;
    const barred = new Set<string>();
    if (((d % rule.anchorEvery) + rule.anchorEvery) % rule.anchorEvery !== 0) for (let back = 1; back <= rule.noRepeatDays; back++) for (const t of shown(d - back)) barred.add(t.id);
    const open = tasks.filter((t) => !barred.has(t.id)), out = drawnOn(open.length >= rule.slots && (!rule.distinctKinds || new Set(open.map((t) => t.kind)).size >= rule.slots) ? open : tasks, rule, seed, d);
    memo.set(d, out); return out;
  };
  return shown(day);
}
// The day number for a wall-clock time under the rule's reset hour.
export const boardDay = (epochMs: number, rule: BoardRule | null = boardRule()): number => Math.floor((epochMs - (rule?.resetHourUtc ?? 0) * 3_600_000) / 86_400_000);
