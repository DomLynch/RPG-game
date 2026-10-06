// The proposal's worked examples as event lists (docs/specs/origins/progression-proposal.md §6). Shared by model.test.ts so the doc's
// numbers and the pinned numbers come from one place. Region and creature names are placeholders for the region-1 content lane.
import type { CareerEvent, MobClass } from './model.ts';

export const MIN = 60;
export const HOUR = 3600;

let serial = 0;
const id = (p: string): string => `${p}-${++serial}`;

export function mobs(
  at: number, every: number, count: number, mob: string, mobClass: MobClass, mobLevel: number, partyLevels?: number[],
): CareerEvent[] {
  return Array.from({ length: count }, (_, i) => ({ kind: 'mob', id: id(mob), at: at + i * every, mob, mobClass, mobLevel, partyLevels }));
}

// Example A: a Gladiator I (level 11, 10 Pit wins) plays region 1 (levels 11–16) and chapter one in one evening, about 2 h 40 min.
// Region 1 placeholder roster: ash hound 11, grave thrall 12, ferry wight 13, blood retainer 14 (ordinary); court sentinel 15
// (elite); vampire reeve 16 (named). Bosses: the Toll-Keeper 13, the Steward of Ash 15, the Count of the Ruin 16 (chapter boss).
// Chapter one, The Stolen Name: four stage completions at 100 CP and the chapter at 500 CP (story credit, once ever).
export function regionClear(): CareerEvent[] {
  const t0 = 0;
  return [
    { kind: 'story', id: 'story-s1', at: t0, step: 'stolen-name/1', cp: 100 },
    ...mobs(t0 + 1 * MIN, 75, 12, 'ash-hound', 'ordinary', 11), // 15 min
    ...mobs(t0 + 16 * MIN, 90, 10, 'grave-thrall', 'ordinary', 12), // 15 min
    { kind: 'boss', id: 'boss-toll', at: t0 + 32 * MIN, boss: 'toll-keeper', bossLevel: 13, contributionPermille: 1000 },
    { kind: 'story', id: 'story-s2', at: t0 + 33 * MIN, step: 'stolen-name/2', cp: 100 },
    ...mobs(t0 + 35 * MIN, 90, 10, 'ferry-wight', 'ordinary', 13),
    ...mobs(t0 + 52 * MIN, 90, 8, 'blood-retainer', 'ordinary', 14),
    { kind: 'story', id: 'story-s3', at: t0 + 65 * MIN, step: 'stolen-name/3', cp: 100 },
    ...mobs(t0 + 66 * MIN, 120, 6, 'court-sentinel', 'elite', 15),
    { kind: 'boss', id: 'boss-steward', at: t0 + 80 * MIN, boss: 'steward-of-ash', bossLevel: 15, contributionPermille: 1000 },
    { kind: 'story', id: 'story-s4', at: t0 + 82 * MIN, step: 'stolen-name/4', cp: 100 },
    ...mobs(t0 + 85 * MIN, 120, 8, 'blood-retainer', 'ordinary', 14),
    ...mobs(t0 + 105 * MIN, 120, 6, 'court-sentinel', 'elite', 15),
    ...mobs(t0 + 125 * MIN, 300, 2, 'vampire-reeve', 'named', 16),
    { kind: 'boss', id: 'boss-count', at: t0 + 150 * MIN, boss: 'count-of-the-ruin', bossLevel: 16, contributionPermille: 1000 },
    { kind: 'story', id: 'story-ch1', at: t0 + 155 * MIN, step: 'stolen-name/chapter', cp: 500 },
  ];
}

// Example B: a Praetorian V (level 30, 29 Pit wins). B1: one hour on region-1 ash hounds (level 11), one every 30 s. B2: one hour on
// a single level-25 kind, one every 30 s. B3: a bot on even-level (30) ordinary mobs, 20 kinds in rotation, one kill every 15 s, 24 h.
export const farmGrey = (t0: number): CareerEvent[] => mobs(t0, 30, 120, 'ash-hound', 'ordinary', 11);
export const farmLow = (t0: number): CareerEvent[] => mobs(t0, 30, 120, 'marsh-ghoul', 'ordinary', 25);
export function botDay(t0: number, hours = 24): CareerEvent[] {
  const out: CareerEvent[] = [];
  const kills = (hours * HOUR) / 15;
  for (let i = 0; i < kills; i++) {
    const mob = `even-kind-${i % 20}`;
    out.push({ kind: 'mob', id: id('bot'), at: t0 + i * 15, mob, mobClass: 'ordinary', mobLevel: 30 });
  }
  return out;
}
