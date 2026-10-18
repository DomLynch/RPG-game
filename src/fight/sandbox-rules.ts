import { loadRegistry, tableFromFile, type Manifest } from '../core/registry.ts';
import DEFS from './sandbox-rules-defs.json' with { type: 'json' };
import MANIFEST from './sandbox-rules-defs.manifest.json' with { type: 'json' };

// The combat sandbox's rule rows, ported to trunk in slices (Lead's plan, 2026-10-18; Donor: the combat sandbox, sandbox/page @678a31f0d, read-only). Slice (c) declared the melee-special families; slice (e) (RV77) turns the
// windup / react rules on in duel.ts, so this is a sim file: no clock, no Math.random. Each family is a table through the registry (sandbox-rules-defs.manifest.json), one number per row.
const SANDBOX_TABLES = MANIFEST.tables.map((t) => tableFromFile(t as unknown as Manifest, DEFS, 'sandbox-rules-defs.json'));
loadRegistry(SANDBOX_TABLES);
const sandboxRows = (table: string): readonly Record<string, unknown>[] => SANDBOX_TABLES.find((t) => t.manifest.table === table)?.rows ?? [];
const sandboxRule = (id: string): number => (sandboxRows('sandboxRule').find((r) => r.id === id)?.value as number | undefined) ?? 0;

//   specialMeleeWindup (Dom 2026-10-17: "it takes like two seconds, it is not a long-distance spell, same speed as the stab, slash or heavy"): ticks a MELEE special (no spell) is committed before it lands; 0 = the special's own windup rule.
export const SPECIAL_MELEE_WINDUP = sandboxRule('specialMeleeWindup');
//   specialMeleeReach / specialMeleeSlack (Dom 2026-10-18: "short-mid distance, a tad more than a normal attack, nothing crazy"; a special landed from across the arena): cm. A MELEE special (no spell) is pressed only inside the reach (else a specialCue "far" cue,
//   nothing spent) and still lands at release only inside reach + slack (the foe may step); 0 = the special's own reach (RULES.special.reach) and no release check.
export const SPECIAL_MELEE_REACH = sandboxRule('specialMeleeReach'), SPECIAL_MELEE_SLACK = sandboxRule('specialMeleeSlack');
//   percentScale / centimetresPerMetre: the unit rows (100 and 100) the percent rows and the cm rows divide by, so no unit literal sits in the sim.
const PERCENT = sandboxRule('percentScale'), CENTIMETRES_PER_METRE = sandboxRule('centimetresPerMetre');
export const percentScaled = (value: number, percent: number): number => value * percent / PERCENT;
export const meleeSpecialReach = (trunk: number): number => (SPECIAL_MELEE_REACH ? SPECIAL_MELEE_REACH / CENTIMETRES_PER_METRE : trunk);   // metres
export const meleeSpecialRelease = (): number => (SPECIAL_MELEE_REACH + SPECIAL_MELEE_SLACK) / CENTIMETRES_PER_METRE;   // metres: the farthest a released melee special still lands
//   specialCue: rows { id, text }, the short text the HUD floats over the caster when the sim refused a special press (the "far" cue).
export const specialCueText = (id: string): string => (sandboxRows('specialCue').find((r) => r.id === id)?.text as string | undefined) ?? id;
//   specialReact (Strategy 2026-10-17: the victim's stagger is a sim reaction from the move's row, not a canned animation): 1 = a landed melee special applies its move row's stagger, knockback and posture to the victim like a landed blow; 0 = damage only.
export const SPECIAL_REACT = sandboxRule('specialReact');
//   specialReactStagger / specialReactKnock / specialReactPosture (percent of the move row's own stagger, knockback and posture; 100 = as the row says): how hard a landed melee special hits the victim.
export const SPECIAL_REACT_STAGGER = sandboxRule('specialReactStagger'), SPECIAL_REACT_KNOCK = sandboxRule('specialReactKnock'), SPECIAL_REACT_POSTURE = sandboxRule('specialReactPosture');
//   specialReactFloor (Dom 2026-10-18: Lunge showed no reaction, its move row has stagger 0 so a percent of it is 0): rows { id (skill id), stagger (ticks) }, the least stagger a landed melee special of that skill gives, whatever its move row says. No row = the percent alone.
export const specialReactFloorOf = (skill: string): number => (sandboxRows('specialReactFloor').find((r) => r.id === skill)?.stagger as number | undefined) ?? 0;

//   specialPick (the SPECIAL 1/2 picker): rows { id (skill id), role, label?, slot2Default?, slot2Alt? }: which melee skills the picker offers and what SPECIAL 2 starts as. No rows = no picker.
export type SpecialPickRow = { id: string; role: string; label?: string; slot2Default?: number; slot2Alt?: number };
export const specialPickRows = (): readonly SpecialPickRow[] => sandboxRows('specialPick') as unknown as SpecialPickRow[];

//   specialLook (the beta specials must read as different moves on a phone): one row { id (skill id), flash, sparks, spread, lift, size } per skill, percent of the shared skill-impact kit (100 = as it is). Presentation only, no sim. No row = the kit as it is.
export type SpecialLookRow = { id: string; flash: number; sparks: number; spread: number; lift: number; size: number };
export const specialLookOf = (skill: string): SpecialLookRow | undefined => sandboxRows('specialLook').find((r) => r.id === skill) as SpecialLookRow | undefined;
//   specialTrail ("weapon trails"): one row { id (skill id), samples, opacity, color, lead, tail } per melee special: a longer, firmer trail from `lead` ticks before the release until `tail` ticks after. No row = the game's own trail.
export type SpecialTrailRow = { id: string; samples: number; opacity: number; color: string; lead: number; tail: number };
export const specialTrailOf = (skill: string): SpecialTrailRow | undefined => sandboxRows('specialTrail').find((r) => r.id === skill) as SpecialTrailRow | undefined;
//   specialShards (solid impact fragments): rows { id (row id), skill, kind stone|metal, count (<= 8 a burst on a phone), tint, per-mille power, forward, lift, size, life, gravity, bounce, slide, shrink }. No rows = nothing is built or drawn.
export type ShardRow = { id: string; skill: string; kind: string; count: number; tint: string; power: number; forward: number; lift: number; size: number; life: number; gravity: number; bounce: number; slide: number; shrink: number };
export const specialShardsOf = (skill: string): ShardRow[] => (sandboxRows('specialShards') as unknown as ShardRow[]).filter((r) => r.skill === skill);
export const shardRows = (): number => sandboxRows('specialShards').length;
//   specialSound (the hit must sound like bone and weight): rows { id (row id), skill, cue (a CueName), gain, room, delay, on? } played in order when that melee special lands; `on`: 'start' plays at the commit, 'land' (default) on the foe. No rows = no sound added.
export type SpecialSoundRow = { id: string; skill: string; cue: string; gain: number; room: number; delay: number; on?: 'start' | 'land' };
export const specialSoundOf = (skill: string): SpecialSoundRow[] => (sandboxRows('specialSound') as unknown as SpecialSoundRow[]).filter((r) => r.skill === skill);

// RV79, the bow (Donor: the combat sandbox @93b1138c7; Lead's split: bow only, the bands TABLE is read here for the missile gap and nothing else; band damage / glance / AI hold are RV80, staff bolts and spell flight ride mana, RV81).
//   perMille / ticksPerSecond: the unit rows (1000 and 60) the per-mille rows and the speed rows convert by, so no unit literal sits in the sim.
const SANDBOX_PER_MILLE = sandboxRule('perMille'), TICKS_PER_SECOND = sandboxRule('ticksPerSecond');
//   bands (Dom 2026-10-14): rows { id, upTo (cm) }, the reach bands from the nearest out; the last has no real limit. Here only the missile gap reads them.
type BandRow = { id: string; upTo: number };
const SANDBOX_BANDS = sandboxRows('bands') as unknown as readonly BandRow[];
/** The nearest a missile can be thrown from: the inner edge of the outer band (Strategy: the bow is helpless up close). 0 with no band rows. */
export const missileMinGap = (): number => (SANDBOX_BANDS.length > 1 ? SANDBOX_BANDS[SANDBOX_BANDS.length - 2]!.upTo / CENTIMETRES_PER_METRE : 0);
//   missile rows { weapon, kind (bow), speed (cm/s), share (per-mille of the move's damage), windup / recovery (percent added to every move's timing: a bow draws), ammo (the quiver, 0 = infinite), pierce (per-mille of a guarded arrow that goes through), chipKills (1: chip through a guard can finish a man) }
//   name a weapon whose moves throw an arrow instead of striking; `missileLanes` rows { move, lane (-1 left, 0 forward, 1 right), mult } say which move throws which lane. No rows = nothing flies.
type MissileRow = { kind?: string; weapon: string; speed: number; share: number; windup?: number; recovery?: number; ammo?: number; pierce?: number; chipKills?: number };
type LaneRow = { move: string; lane: number; mult: number };
export const missileRows = (): number => sandboxRows('missile').length;
export const missileOf = (weapon: string): MissileRow | undefined => sandboxRows('missile').find((r) => r.weapon === weapon) as MissileRow | undefined;
export const laneOf = (move: string | null): LaneRow | undefined => (move ? sandboxRows('missileLanes').find((r) => r.move === move) as LaneRow | undefined : undefined);
export const MISSILE_HOMING = sandboxRule('missileHoming');   // 1 = auto-aim (Dom 2026-10-15): the shot flies at the foe and only a roll or a guard answers it
export const MISSILE_GUARD_POSTURE = sandboxRule('missileGuardPosture');   // posture a GUARDED arrow takes off the blocker (a wall of guard breaks inside the fight clock, Strategy 2026-10-18); a bow special's own `posture` replaces it. 0 = off
export const MISSILE_RADIUS = sandboxRule('missileRadius'), MISSILE_STUN = sandboxRule('missileStun'), MISSILE_FAN = sandboxRule('missileFan');   // cm near the line a body is hit; ticks a hit staggers; degrees of the side lanes
/** Travel time in whole ticks over `range` metres at the row's cm/s speed. */
export const missileTicks = (row: { speed: number }, range: number): number => Math.max(1, Math.ceil((range * CENTIMETRES_PER_METRE * TICKS_PER_SECOND) / row.speed));
//   quiver (Strategy: a bow carries a finite quiver; a row flag for the A/B): 1 = a missile weapon's `ammo` is the arrows it carries, 0 = infinite.
export const QUIVER = sandboxRule('quiver');
export const ammoOf = (weapon: string): number => { const r = missileOf(weapon); return QUIVER && r?.ammo ? r.ammo : 0; };
export const missileTiming = (weapon: string): { windup: number; recovery: number } | undefined => { const r = missileOf(weapon); return r && (r.windup || r.recovery) ? { windup: r.windup ?? 0, recovery: r.recovery ?? 0 } : undefined; };
//   Geometry helpers for the arrow's flight, all from rows: the side lane's angle (missileFan degrees per lane, over halfTurnDegrees), the point past which a fixed-aim arrow can still find the body (half its range), the hit radius in metres, and the stamina a guard
//   spends on the arrow (half its damage). halfTurnDegrees (180) and halves (2) are unit rows.
const HALF_TURN_DEGREES = sandboxRule('halfTurnDegrees'), HALVES = sandboxRule('halves');
export const missileLaneAngle = (lane: number): number => (lane * sandboxRule('missileFan') * Math.PI) / HALF_TURN_DEGREES;
export const missileHalfway = (range: number): number => range / HALVES;
export const missileRadiusM = (): number => MISSILE_RADIUS / CENTIMETRES_PER_METRE;
export const missileChip = (damage: number): number => Math.round(damage / HALVES);
//   missileAnswer (Strategy 2026-10-18, after the bow battery: the warden AI had no answer to an arrow and lost 16/16 to a plain archer): one row { id, dodge, guard, run } for the AI. When the foe has an arrow in flight at it, it decides ONCE per arrow (seeded):
//   roll in the arrival window with `dodge` percent, else raise its guard with `guard` percent, else take it; `run` = 1 sends it running at an archer who stands beyond the missile gap. No row = no answer, as before.
//   dodgeEarly: ticks before the roll's safe window closes that the AI starts it; guardLead: ticks before arrival it raises its guard.
export type MissileAnswerRow = { id: string; dodge: number; guard: number; run?: number; dodgeEarly: number; guardLead: number };
export const percentOfUnit = (unit: number): number => unit * PERCENT;
export const MISSILE_ANSWER: MissileAnswerRow | undefined = sandboxRows('missileAnswer')[0] as unknown as MissileAnswerRow | undefined;
//   bowSpecial (Dom 2026-10-18: four bow specials; Strategy approved the design and the unlock order): a caster whose weapon has a `bow` missile row and who stands beyond the missile gap resolves the picker special `skill` as arrows through the one missile model
//   instead of the melee special (inside the gap, or out of arrows, the melee special stays). One row per picker skill { skill, label, unlockAfterBossKills (DATA ONLY), arrows (the quiver cost), lanes (one arrow each: -1 left, 0 forward, 1 right), mult (per-mille of the special's damage per arrow),
//   windup (ticks, replaces specialMeleeWindup), speed (cm/s), react (1 = a landed arrow shoves and staggers like a melee special), pin (ticks of a `pinShot` crowd-control stun through the cc ladder), posture, clip (the special-clips.json role the archer plays) }. No rows = a bow has no specials.
export type BowSpecialRow = { skill: string; label: string; unlockAfterBossKills: number; arrows: number; lanes: number[]; mult: number; windup: number; speed: number; react?: number; pin?: number; clip?: string; posture?: number };
const BOW_SPECIALS = sandboxRows('bowSpecial') as unknown as readonly BowSpecialRow[];
export const bowSpecialRows = (): readonly BowSpecialRow[] => BOW_SPECIALS;
/** The bow special a caster of `weapon` casts for picker skill `skill` from `gap` metres with `ammo` arrows left, or undefined (the melee special instead). `gap` of Infinity asks for the row alone. */
export const bowSpecialOf = (weapon: string, skill: string | null | undefined, gap: number, ammo: number | undefined): BowSpecialRow | undefined => {
  if (!skill || !BOW_SPECIALS.length || missileOf(weapon)?.kind !== 'bow') return undefined;
  const r = BOW_SPECIALS.find((x) => x.skill === skill);
  return r && gap >= missileMinGap() && (ammo === undefined || ammo >= r.arrows) ? r : undefined;
};
export const perMille = (value: number, mille: number): number => (value * mille) / SANDBOX_PER_MILLE;
