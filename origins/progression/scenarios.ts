// The proposal's worked examples as event lists (docs/specs/origins/progression-proposal.md §7). Shared by model.test.ts so the doc's
// numbers and the pinned numbers come from one place. Region and creature names are placeholders for the region-1 content lane.
import {
  DAY_S, MAX_LEVEL, TYPE_WEIGHTS, award, levelOfCredit, newCareer, nextLegend, tierOf, type CareerEvent, type CareerState, type TypeTable,
} from './model.ts';

export const MIN = 60;
export const HOUR = 3600;

let serial = 0;
const id = (p: string): string => `${p}-${++serial}`;

export type CreatureType = 'mob' | 'elite' | 'named';
export function mobs(
  at: number, every: number, count: number, target: string, type: CreatureType, targetLevel: number, partyLevels?: number[],
): CareerEvent[] {
  return Array.from({ length: count }, (_, i) => ({ kind: 'kill', id: id(target), at: at + i * every, type, target, targetLevel, partyLevels }));
}
export const boss = (eid: string, at: number, target: string, targetLevel: number, contributionPermille = 1000, partyLevels?: number[]): CareerEvent =>
  ({ kind: 'kill', id: eid, at, type: 'world-boss', target, targetLevel, contributionPermille, partyLevels });
const story = (eid: string, at: number, step: string, chapter = false): CareerEvent =>
  ({ kind: 'story', id: eid, at, step, type: chapter ? 'story-chapter' : 'story-step' });

// Example A: a Gladiator I (level 11, 10 Pit wins) plays region 1 (levels 11–16) and chapter one in one evening, about 2 h 40 min.
// Region 1 placeholder roster: ash hound 11, grave thrall 12, ferry wight 13, blood retainer 14 (ordinary); court sentinel 15
// (elite); vampire reeve 16 (named). Bosses: the Toll-Keeper 13, the Steward of Ash 15, the Count of the Ruin 16 (chapter boss).
// Chapter one, The Stolen Name: four story steps and the chapter (story credit, once ever).
export function regionClear(): CareerEvent[] {
  const t0 = 0;
  return [
    story('story-s1', t0, 'stolen-name/1'),
    ...mobs(t0 + 1 * MIN, 75, 12, 'ash-hound', 'mob', 11), // 15 min
    ...mobs(t0 + 16 * MIN, 90, 10, 'grave-thrall', 'mob', 12), // 15 min
    boss('boss-toll', t0 + 32 * MIN, 'toll-keeper', 13),
    story('story-s2', t0 + 33 * MIN, 'stolen-name/2'),
    ...mobs(t0 + 35 * MIN, 90, 10, 'ferry-wight', 'mob', 13),
    ...mobs(t0 + 52 * MIN, 90, 8, 'blood-retainer', 'mob', 14),
    story('story-s3', t0 + 65 * MIN, 'stolen-name/3'),
    ...mobs(t0 + 66 * MIN, 120, 6, 'court-sentinel', 'elite', 15),
    boss('boss-steward', t0 + 80 * MIN, 'steward-of-ash', 15),
    story('story-s4', t0 + 82 * MIN, 'stolen-name/4'),
    ...mobs(t0 + 85 * MIN, 120, 8, 'blood-retainer', 'mob', 14),
    ...mobs(t0 + 105 * MIN, 120, 6, 'court-sentinel', 'elite', 15),
    ...mobs(t0 + 125 * MIN, 300, 2, 'vampire-reeve', 'named', 16),
    boss('boss-count', t0 + 150 * MIN, 'count-of-the-ruin', 16),
    story('story-ch1', t0 + 155 * MIN, 'stolen-name/chapter', true),
  ];
}

// Example B: a Praetorian V (level 30, 29 Pit wins). B1: one hour on region-1 ash hounds (level 11), one every 30 s. B2: one hour on
// a single level-25 kind, one every 30 s. B3: a bot on even-level (30) ordinary mobs, 20 kinds in rotation, one kill every 15 s, 24 h.
export const farmGrey = (t0: number): CareerEvent[] => mobs(t0, 30, 120, 'ash-hound', 'mob', 11);
export const farmLow = (t0: number): CareerEvent[] => mobs(t0, 30, 120, 'marsh-ghoul', 'mob', 25);
export function botDay(t0: number, hours = 24): CareerEvent[] {
  const out: CareerEvent[] = [];
  const kills = (hours * HOUR) / 15;
  for (let i = 0; i < kills; i++) {
    out.push({ kind: 'kill', id: id('bot'), at: t0 + i * 15, type: 'mob', target: `even-kind-${i % 20}`, targetLevel: 30 });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Days to each title for two players (proposal §2.1). Deterministic: wins come from permille accumulators, never a random number.
// Assumptions (stated in the doc): today's Pit — the ten opponents, each a legend once at each level (the live dial fights at your
// level); "enough world content" — a world boss the player has not beaten is always available at their own level, fought solo;
// creatures at their own level across 20 mob and 5 elite kinds (never hot); four story steps and a chapter per title. Pit and world-boss
// win rate by title tier: 80% at Recruit, five points lower each title (40% at Invictus, 35% at Origin). World content opens at
// Gladiator I (WORLD_FROM): below it the Pit is the game.
export const WORLD_FROM = 11;
export type Player = {
  name: string; pitFights: number; bossFights: number; mobs: number; elites: number; storyEvery: number;
};
export const CASUAL: Player = { name: 'casual, 30 min a day', pitFights: 4, bossFights: 1, mobs: 12, elites: 1, storyEvery: 3 };
export const HEAVY: Player = { name: 'heavy, 3 h a day', pitFights: 20, bossFights: 6, mobs: 80, elites: 10, storyEvery: 1 };
export const winPermille = (tier: number): number => Math.max(350, 800 - 50 * (tier - 1));
export type Source = 'pit' | 'boss' | 'story' | 'mob';
export type PlayerRun = {
  dayReached: Record<number, number>; credit: Record<Source, number>; finalLevel: number;
  byLevel: Record<number, Record<Source, number>>; // credit earned while at each level (for the Pit-share table)
};

export function playerDays(
  p: Player, opponents: readonly string[], maxDays: number, cap: number = MAX_LEVEL, start: CareerState = newCareer(0, 0, cap),
  types: TypeTable = TYPE_WEIGHTS,
): PlayerRun {
  let s = start;
  let pitAcc = 0;
  let bossAcc = 0;
  let bossSerial = 0;
  const storySteps: Record<number, number> = {};
  const credit: Record<Source, number> = { pit: 0, boss: 0, story: 0, mob: 0 };
  const byLevel: Record<number, Record<Source, number>> = {};
  const level = (): number => levelOfCredit(s.credit, cap);
  const dayReached: Record<number, number> = { [level()]: 0 };
  const take = (e: CareerEvent, source: Source): void => {
    const l = level();
    const a = award(s, e, cap, types);
    s = a.state;
    credit[source] += a.cp;
    const row = (byLevel[l] ??= { pit: 0, boss: 0, story: 0, mob: 0 });
    row[source] += a.cp;
  };
  for (let d = 0; d < maxDays && level() < cap; d++) {
    let t = d * DAY_S + 18 * HOUR;
    for (let f = 0; f < p.pitFights; f++, t += 180) {
      const opponent = nextLegend(s, opponents, d * 97 + f, cap);
      if (opponent === null) break; // every opponent at this level is beaten: the Pit waits for the world
      pitAcc += winPermille(tierOf(level()));
      if (pitAcc < 1000) continue; // a loss: the same legend again next time
      pitAcc -= 1000;
      take({ kind: 'arena-win', id: `pit-${d}-${f}`, at: t, opponent }, 'pit');
    }
    for (let b = 0; b < p.bossFights && level() >= WORLD_FROM; b++, t += 600) {
      bossAcc += winPermille(tierOf(level()));
      if (bossAcc < 1000) continue;
      bossAcc -= 1000;
      take(boss(`b-${d}-${b}`, t, `world-${bossSerial++}`, level()), 'boss');
    }
    for (let i = 0; i < p.mobs + p.elites && level() >= WORLD_FROM; i++, t += 30) {
      const elite = i >= p.mobs;
      take({ kind: 'kill', id: `m-${d}-${i}`, at: t, type: elite ? 'elite' : 'mob', target: elite ? `e${i % 5}` : `o${i % 20}`, targetLevel: level() }, 'mob');
    }
    if (d % p.storyEvery === 0 && level() >= WORLD_FROM) {
      const tier = tierOf(level());
      const step = (storySteps[tier] ?? 0) + 1;
      if (step <= 5) {
        storySteps[tier] = step;
        take(story(`st-${tier}-${step}`, t, `title${tier}/${step}`, step === 5), 'story');
      }
    }
    for (let l = 1; l <= level(); l++) if (!(l in dayReached)) dayReached[l] = d + 1;
  }
  return { dayReached, credit, finalLevel: level(), byLevel };
}
