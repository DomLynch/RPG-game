// Special Moves presentation (the Hades pilot, docs/briefs/special-moves-hades-pilot.md; Combat owns the timing seam, Finishers the effects).
// Pure: read from the sim's own state and events, never written back, so a fight steps the same whether or not anything is drawn.
// The seam: SpecialStarted (the windup begins; the strike lands RULES.special.windup ticks later, the cast tick included), SpecialLanded
// (the strike), SpecialFizzled (the caster fell during the windup), then SPECIAL_RECOVER ticks of presentation after the strike.
import { RULES } from './moves.ts';
import type { Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';

export const SPECIAL_RECOVER = 45;   // the cloud tears away and the caster returns to stance (Finishers, 2026-09-29: 30 read as a pop at phone size)
export const SPECIAL_STRUCK = 45;   // the target's head-hit stagger after the strike (presentation only: the sim does not stagger him)

// `?special=hades` / `?special=nyx` / `?special=centurion` (his rank-9 Charge, charge-fx.ts; Nyx's Nightfall, nightfall-fx.ts, is rank 10 = LEVELS 46): a sparring fight (no record, rewards or writes) against the named warden at his rank's level, with Special Moves on for
// that page only. Rank 9 is level 41 (career.ts: level = 1 + wins, five sub-ranks a title). `first`: on this page the first cast waits 3 s,
// not the rule's 20 s, so the move is seen before a level-41 warden ends the fight; every cast after it keeps the 20 s cooldown.
export const SPECIAL_TESTS = { hades: { opponent: 'nightborn', level: 41, first: 180 }, nyx: { opponent: 'nightborn', level: 46, first: 180 }, centurion: { opponent: 'veteran', level: 41, first: 180 } } as const satisfies Record<string, { opponent: OpponentId; level: number; first: number }>;
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
