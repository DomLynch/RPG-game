// Coach mode, slice 1 (Combat, docs/briefs/coach-mode.md; Lead's GO 2026-10-07: the four LIVE stance names, no extra instruction, Pit duels only): the player's side driven by the SAME brain that drives a
// warden. `decide()` (src/ai.ts) already works for either side of a duel, so a coach is that brain with a profile shaped by the stance the player picked (the stance battery's `bystance` brains: a
// human who picks Defensive guards and parries, an Aggressive one presses, a Trickster feints and kicks, Neutral plays it straight) and a player-level base profile.
// Outside SIM_FILES on purpose, like src/mobkit.ts: it reads a Duel and returns an Intent, writes nothing back. A coached fight's INTENTS are what the record stores, so a coached record is a played
// record: no RECORD_VERSION, same replay (tests/coach.test.ts replays one). The stance itself is the sim's (src/stance.ts, withStances), picked exactly as a human picks it.
// Human reaction, by construction identical to the AI's: the coach never overrides `reaction`, `tellReaction`, `anticipate`, `accuracy` or `discipline`, so it notices a cut after the same ticks the
// warden does at that level, and `decide()` applies the same reaction cap. tests/coach.test.ts pins that no stance brain touches them and that none is faster than the quickest AI profile.
import { decide, initialAi, type AiState } from './ai.ts';
import { idleIntent, type Duel, type Intent } from './duel.ts';
import { PROFILES, type AiProfile, type Level } from './moves.ts';
import { PICKS, type PickedStance } from './stance.ts';

// The knobs a stance brain may set: how it PLAYS (cadence, guard, feints, kicks), never how fast it sees. Numbers are the stance battery's BY_STANCE brains (scripts/stance-battery.mjs), which
// Strategy ruled (2026-10-07) are what a human who picks that stance plays; neutral is the player-level profile untouched.
export const COACH_BRAINS: Readonly<Record<PickedStance, Partial<AiProfile>>> = {
  neutral: { lapse: 0.5, read: 0.5 },
  aggressive: { aggression: 0.9, parry: 0.2, lapse: 0.6, read: 0.45 },
  defensive: { parry: 0.7, dodge: 0.1, aggression: 0.35, guard: 1, lapse: 0.4, read: 0.6 },
  trickster: { feint: 0.5, kick: 0.6, aggression: 0.7, parry: 0.2, lapse: 0.5, read: 0.5 },
};
// What a brain must leave alone: the noticing and timing limits it shares with the warden.
export const COACH_FIXED: readonly (keyof AiProfile)[] = ['reaction', 'tellReaction', 'anticipate', 'accuracy', 'discipline'];
// Per-foe strength (Combat, 2026-10-08, scripts/coach-battery.mjs n=100 at L6): one lapse for every foe left the coach winning 92-99 % against the easy ones and 29-47 % against the Plague Doctor. Strategy's target is 70-80 % in a good
// matchup, 35-45 % in a bad one, so the lapse (the share of cuts the coach does not answer) moves by foe, added to the stance's own. A foe not listed adds nothing. Only lapse moves: reaction, tell reaction, anticipate, accuracy and
// discipline stay the warden's own (COACH_FIXED), so the coach is never faster than the foe's eye.
export const FOE_LAPSE: Readonly<Record<string, number>> = { goblin: 0.15, nightborn: 0.08, executioner: 0.2, dwarf: 0.25, knight: 0.18, shieldmaiden: 0.08, plaguedoctor: -0.1 };
// The first n=100 table showed the stances answer lapse very differently: the defensive brain (it lives on its answers) fell from 62 % to 42 % against the Executioner on +0.2, while the aggressive one barely moved (99 % -> 93 %). So the
// per-foe amount is scaled by how much each stance leans on answering.
export const FOE_LAPSE_SCALE: Readonly<Record<PickedStance, number>> = { neutral: 1, aggressive: 1.8, defensive: 0.35, trickster: 0.8 };
const LAPSE_MIN = 0.1, LAPSE_MAX = 0.85;
export const coachProfile = (stance: PickedStance, level: Level = 'normal', foe?: string): AiProfile => {
  const p = { ...PROFILES[level], ...COACH_BRAINS[stance] }, add = foe ? FOE_LAPSE[foe] : undefined;
  return add ? { ...p, lapse: Math.min(LAPSE_MAX, Math.max(LAPSE_MIN, p.lapse + add * FOE_LAPSE_SCALE[stance])) } : p;
};

export type Coach = { stance: PickedStance; level: Level; step(duel: Duel): Intent };
// The coach is the player's side (fighters[0]): a fresh brain state per fight from the fight's seed, so a coached fight is a pure function of (seed, stance, level) and the record's intents.
export function createCoach(stance: PickedStance, seed: number, level: Level = 'normal', side: 0 | 1 = 0, foe?: string): Coach {
  const profile = coachProfile(stance, level, foe);
  let ai: AiState = initialAi((seed * 2654435761) >>> 0);
  return {
    stance, level,
    // A player starts sheathed and taps Fight: any attack press draws (src/duel.ts), so the coach opens with a light press, then the brain takes over (decide() idles against a sheathed side).
    step(duel) { if (duel.fighters[side].phase === 'sheathed') return { ...idleIntent(), action: 'light' }; const r = decide(duel, side, ai, profile); ai = r.ai; return r.intent; },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The on/off switch and the mid-fight hand-over (TOP10 row 8; Web builds the toggle, the "Coached" tag and the menu against this).
// ONE input source per tick: every tick the fight takes exactly one Intent, the coach's or the player's, never both. `pick` is that rule:
// while the coach is on it returns the coach's intent, and the player's only when the coach is off. A press (a fight button, the HUD tag, the menu toggle) calls `stop` BEFORE that tick's `pick`,
// so the tap that caused the hand-over IS that tick's player input (nothing dropped) and the coach is not stepped that tick (nothing doubled). What the coach had already started (a swing in its windup,
// a roll) is sim state and plays out under the sim's rules; what it was HOLDING (guard, a heavy charge) is an Intent field, and an Intent is per tick, so it is released the tick the player's own
// intent takes over unless the player holds that same button. Display data only: `spans` feed the "Coached" marker and Watch again through the record's `build` string (below); no sim file reads them.
export type CoachStopReason = 'tap' | 'tag' | 'menu' | 'end';
export type CoachSpan = { from: number; to: number | null };   // [from, to) in ticks; null = still coached
export type CoachDriver = {
  readonly on: boolean; readonly stance: PickedStance; readonly spans: readonly CoachSpan[];
  start(tick: number): void;
  stop(tick: number): void;
  pick(duel: Duel, player: Intent): Intent;
};
export function createCoachDriver(stance: PickedStance, seed: number, level: Level = 'normal', side: 0 | 1 = 0, foe?: string): CoachDriver {
  const coach = createCoach(stance, seed, level, side, foe), spans: CoachSpan[] = [];
  const isOn = (): boolean => spans.length > 0 && spans[spans.length - 1]!.to === null;
  return {
    get on() { return isOn(); }, stance, spans,
    start(tick) { if (!isOn()) spans.push({ from: tick, to: null }); },
    stop(tick) { if (isOn()) spans[spans.length - 1]!.to = tick; },
    pick(duel, player) { return isOn() ? coach.step(duel) : player; },
  };
}

// The record's `build` string (Backend, 2026-10-08): `<label> coach:<stance>@<a>-<b>,<c>-<d> kit:<tag>`. A coached duel counts on the ladder and the rankings like a played one (Dom's ruling, 2026-10-08), so the verifier does not refuse it; the tag only marks which ticks the coach played. kitOfBuild reads the tail,
// so the kit tag stays LAST. `build` is encoded as len u8 + ascii (src/record.ts), so the whole string is at most 255 bytes: when the spans would push it past that, `coach:<stance>@*` (coached, spans not listed)
// is written instead and a span is never cut in half. An open span (coached to the finish) is `<a>-`.
export const BUILD_MAX = 255;
const spanText = (s: CoachSpan): string => `${s.from}-${s.to ?? ''}`;
export function coachBuild(label: string, stance: PickedStance, spans: readonly CoachSpan[], kit: string | null): string {
  if (spans.length === 0) return kit ? `${label} kit:${kit}` : label;
  const tail = kit ? ` kit:${kit}` : '';
  const listed = `${label} coach:${stance}@${spans.map(spanText).join(',')}${tail}`;
  return listed.length <= BUILD_MAX ? listed : `${label} coach:${stance}@*${tail}`;
}
// Read back: the stance and the spans (null spans = not listed), or null for a record the coach did not play.
export function coachOfBuild(build: string): { stance: PickedStance; spans: CoachSpan[] | null } | null {
  const m = /(?:^| )coach:([a-z]+)@(\*|[0-9,-]*)(?= |$)/.exec(build);
  if (!m || !(PICKS as readonly string[]).includes(m[1]!)) return null;
  if (m[2] === '*') return { stance: m[1] as PickedStance, spans: null };
  const spans = m[2]!.split(',').filter(Boolean).map((t) => { const [a, b] = t.split('-'); return { from: Number(a), to: b === '' || b === undefined ? null : Number(b) }; });
  return { stance: m[1] as PickedStance, spans };
}
