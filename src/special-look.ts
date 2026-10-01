// Special Moves presentation (the Hades pilot, docs/briefs/special-moves-hades-pilot.md; Combat owns the timing seam, Finishers the effects).
// Pure: read from the sim's own state and events, never written back, so a fight steps the same whether or not anything is drawn.
// The seam: SpecialStarted (the windup begins; the strike lands RULES.special.windup ticks later, the cast tick included), SpecialLanded
// (the strike), SpecialFizzled (the caster fell during the windup), then SPECIAL_RECOVER ticks of presentation after the strike.
import { RULES } from './moves.ts';
import type { Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';

export const SPECIAL_RECOVER = 45;   // the cloud tears away and the caster returns to stance (Finishers, 2026-09-29: 30 read as a pop at phone size)
export const SPECIAL_STRUCK = 45;   // the target's head-hit stagger after the strike (presentation only: the sim does not stagger him)

// `?special=set` is rank 8's Red Wind (level 36: (8 − 1) × 5 + 1); the same lunge special, its own art (special-fx-wind.ts).
// `?special=hades`: a sparring fight (no record, rewards or writes) against the named warden at his rank's level, with Special Moves on for
// that page only. Rank 9 is level 41 (career.ts: level = 1 + wins, five sub-ranks a title). `first`: on this page the first cast waits 3 s,
// not the rule's 20 s, so the move is seen before a level-41 warden ends the fight; every cast after it keeps the 20 s cooldown.
// `?special=set` is the Nightborn's rank-8 Red Wind (special-fx-wind.ts); `?special=tithe` is the Centurion's rank-10 Blood Tithe (Mars, special-tithe.ts); `?special=shield` is the Centurion's rank-8 Shield Quake (Ajax; docs/briefs/specials/centurion-l8-l10-2026-10-01.md): the ground ripple, special-fx-quake.ts; `?special=centurion` is his rank-9 Charge (Alexander): the dust line, charge-fx.ts.
export const SPECIAL_TESTS = { hades: { opponent: 'nightborn', level: 41, first: 180 }, set: { opponent: 'nightborn', level: 36, first: 180 }, shield: { opponent: 'veteran', level: 36, first: 180 }, tithe: { opponent: 'veteran', level: 46, first: 180 }, centurion: { opponent: 'veteran', level: 41, first: 180 }, hobnail: { opponent: 'veteran', level: 21, first: 180 }, standfast: { opponent: 'veteran', level: 21, first: 180 },
  // The boss grey-boxes (Multi Chars, special-fx-boss.ts), by the legend's own rank (level (rank − 1) × 5 + 1): the Witch's and the Plague Doctor's.
  mist: { opponent: 'witch', level: 36, first: 180 }, echo: { opponent: 'witch', level: 41, first: 180 }, price: { opponent: 'witch', level: 46, first: 180 },
  flies: { opponent: 'plaguedoctor', level: 36, first: 180 }, stain: { opponent: 'plaguedoctor', level: 41, first: 180 }, breath: { opponent: 'plaguedoctor', level: 46, first: 180 },
  // The Goblin's rank 8, 9, 10 bosses (Reynard the Fox, Hermes, Loki: levels 36, 41, 46), grey-box previews (special-fx-goblin.ts; special-modes.ts).
  reynard: { opponent: 'goblin', level: 36, first: 180 }, hermes: { opponent: 'goblin', level: 41, first: 180 }, loki: { opponent: 'goblin', level: 46, first: 180 }, arawn: { opponent: 'executioner', level: 36, first: 180 }, thanatos: { opponent: 'executioner', level: 41, first: 180 }, reaper: { opponent: 'executioner', level: 46, first: 180 } } as const satisfies Record<string, { opponent: OpponentId; level: number; first: number }>;
export type SpecialTest = keyof typeof SPECIAL_TESTS;
export const specialParam = (search: string): SpecialTest | null => {
  const value = /[?&]special=(\w+)/i.exec(search)?.[1]?.toLowerCase();
  return value && Object.hasOwn(SPECIAL_TESTS, value) ? (value as SpecialTest) : null;
};

// Where a fighter stands in his own special: winding up (progress 0..1 to the strike), or recovering after it (0..1). Null otherwise. The
// recovery is read off the cooldown the cast spent (RULES.special.cooldown at the cast tick, one less every tick after), so it needs no memory.
export function specialStage(f: Pick<Fighter, 'specialShare' | 'special' | 'skillCooldown' | 'health'>): { stage: 'windup' | 'recover'; progress: number } | null {
  if (f.specialShare === undefined || !f.health) return null;
  if (f.special) return { stage: 'windup', progress: 1 - f.special / RULES.special.windup };
  const since = RULES.special.cooldown - RULES.special.windup + 1 - f.skillCooldown;   // 0 on the strike tick
  return since >= 0 && since < SPECIAL_RECOVER ? { stage: 'recover', progress: since / SPECIAL_RECOVER } : null;
}
