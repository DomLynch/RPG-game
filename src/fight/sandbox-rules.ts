import DEFS from './sandbox-rules-defs.json' with { type: 'json' };
import SWARM_DEFS from './swarm-defs.json' with { type: 'json' };
import type { Sheet } from './sheet-rows.ts';
import PHASE_DEFS from './boss-phase-defs.json' with { type: 'json' };
import GEAR_DEFS from './gear-defs.json' with { type: 'json' };   // the owners and sets rows only (the loader chain behind gear-weight.ts would pull loot and legends into the sim)

// sandbox-mech: the sandbox's own rule rows (sandbox-rules-defs.json), one number each, read once at load. Every rule is 0 / absent as shipped on trunk,
// so a trunk fight is byte-identical; the Sandbox panel (sandbox/rows.json) turns them on. A sim file: no clock, no Math.random.
//   dodgeCounter: ticks after a successful roll-dodge in which Heavy becomes the guard counter (the same window a block opens). 0 = off.
const ROWS = DEFS.rules as readonly { id: string; window?: number; value?: number }[];
const num = (id: string, field: 'window' | 'value'): number => {
  const v = ROWS.find((r) => r.id === id)?.[field] ?? 0;
  if (!Number.isInteger(v) || v < 0) throw Error(`sandbox-rules-defs "${id}": ${field} is a whole number, 0 or more`);
  return v;
};
export const DODGE_COUNTER = num('dodgeCounter', 'window');
//   interruptEarly: extra lockout, in per-mille of the base interruptCooldown, when a cast is cut at its very start; it falls to 0 as the cast nears release (ModernUO: the earlier the cut, the longer the lockout). 0 = off.
export const INTERRUPT_EARLY = num('interruptEarly', 'value');
export const interruptLockout = (base: number, left: number, windup: number): number => (INTERRUPT_EARLY > 0 ? Math.round((base * (1000 + (INTERRUPT_EARLY * Math.min(left, windup)) / windup)) / 1000) : base);

//   castPushback: ticks a hit that does not interrupt pushes the caster's windup back (WoW: 0.5 s, twice a cast); castPushbackMax: how many times per cast. 0 = off.
export const CAST_PUSHBACK = num('castPushback', 'value');
export const CAST_PUSHBACK_MAX = num('castPushbackMax', 'value');

// manyOnOne (Dom 2026-10-13: 1st attacker 100%, 2nd 50%, 3rd 30%, 4th+ 30%): swarm-defs.json `attackers` rows, { index, 'world-mob': per-mille damage }. A world-mob fight stream that
// names its attacker index (duel.roll.attacker, set by the world layer) scales that foe's damage to the player by the row at or below its index. No rows (trunk) = 1000 = untouched.
type AttackerRow = { index: number; 'world-mob'?: number };
const ATTACKERS = ((SWARM_DEFS as unknown as { attackers?: AttackerRow[] }).attackers ?? []).slice().sort((a, b) => a.index - b.index);
export const attackerPerMille = (index: number | undefined): number => {
  if (!index || !ATTACKERS.length) return 1000;
  let m = 1000; for (const r of ATTACKERS) if (r.index <= index && r['world-mob'] !== undefined) m = r['world-mob'];
  return m;
};

// bossPhases (Dom 2026-10-13: bosses change their ATTACK at health steps, never their colour): boss-phase-defs.json `phases` rows, { id, special ('*' = any), below (percent of max health), share (per-mille multiplier on the
// special's damage share), cooldown (percent of the special's normal cooldown left when the phase starts), label, note }. The first tick the boss is under `below` percent, once per fight, its special hits harder and is ready
// sooner (no window, tell or recovery moves). No rows (trunk) = never. The label and note are the on-screen message (wound-notice.ts).
export type PhaseRow = { id: string; special: string; below: number; share: number; cooldown: number; label?: string; note?: string };
export const PHASES: readonly PhaseRow[] = ((PHASE_DEFS as unknown as { phases: PhaseRow[] }).phases ?? []).map((r) => {
  if (!r.id || typeof r.special !== 'string' || !(r.below > 0 && r.below < 100) || !(r.share >= 1) || !(r.cooldown >= 0 && r.cooldown <= 100)) throw Error(`boss-phase-defs "${String(r.id)}": special, below (1-99), share (>= 1 per-mille) and cooldown (0-100) are required`);
  return r;
});
export const phaseText = (id: string): { label: string; note: string } | undefined => { const r = PHASES.find((p) => p.id === id); return r?.label ? { label: r.label, note: r.note ?? '' } : undefined; };

// castPenalty (Dom 2026-10-13: armour weight slows casting; numbers as Lead's #2577 armour-weights.json, heavy 20 / medium 10 / light 0): sandbox-rules-defs.json `castPenalty` rows, { id, dial, atLeast, percent }. The sim
// sees gear only as the sheet's ten dials, so the weight class is read off them: the heaviest row whose dial the wearer's sheet reaches adds `percent` of the windup to a special's cast time (plate = armour dial, leathers = stamina
// dial, robes match none). When promoted, a weightClass lookup replaces the dial test; the percentages stay. No rows (trunk) = the plain windup.
export type CastPenaltyRow = { id: string; dial: string; atLeast: number; percent: number };
export const CAST_PENALTY: readonly CastPenaltyRow[] = ((DEFS as unknown as { castPenalty?: CastPenaltyRow[] }).castPenalty ?? []).map((r) => {
  if (!r.id || !r.dial || !Number.isFinite(r.atLeast) || !(r.percent >= 0)) throw Error(`sandbox-rules-defs castPenalty "${String(r.id)}": id, dial, atLeast and percent (0 or more) are required`);
  return r;
});
export const castWindup = (sheet: Sheet | undefined, base: number): number => {
  let pct = 0; for (const r of CAST_PENALTY) if ((sheet?.[r.dial] ?? 0) >= r.atLeast && r.percent > pct) pct = r.percent;
  return base + Math.round((base * pct) / 100);
};

// execution (Dom 2026-10-13, Veloren poise-to-health, Sekiro deathblow): a critical blow (the `critical` move: the heavy thrown in the window a posture break opens) hits `executeMult` per-mille of its
// normal damage, and finishes outright a foe at or under `executeBelow` percent of max health. Both 0 = off (trunk): the blow is the plain number.
export const EXECUTE_MULT = num('executeMult', 'value');
export const EXECUTE_BELOW = num('executeBelow', 'value');
export const executed = (damage: number, critical: boolean, targetHealth: number, targetMax: number): number => {
  if (!critical || (!EXECUTE_MULT && !EXECUTE_BELOW)) return damage;
  const hit = EXECUTE_MULT ? Math.round((damage * EXECUTE_MULT) / 1000) : damage;
  return EXECUTE_BELOW && (targetHealth * 100) / targetMax <= EXECUTE_BELOW ? Math.max(hit, targetHealth) : hit;
};

// oneButton (Dom 2026-10-13, touch layout A): the STRIKE button decides its swing by the thumb. A release before `heavyHold` ms is the plain light, a slide up of `stabSlide` px is the thrust, a slide to a side is that cut (the
// existing slashSlide), a hold past `heavyHold` ms is the heavy (and keeps charging while held). Input intent only: the fight already takes every one of those actions. 0 = off (trunk): the button is today's Light.
export const ONE_BUTTON = num('oneButton', 'value');
export const HEAVY_HOLD_MS = num('heavyHold', 'value') || 180;
export const STAB_SLIDE_PX = num('stabSlide', 'value') || 18;

// stabHalfAngle (degrees): a slide within this of straight up is the stab (the wedge drawn on STRIKE); anything else is the cut to its side. The test itself is input.ts stabSector (trigonometry stays out of this sim-listed file).
export const STAB_HALF_ANGLE = num('stabHalfAngle', 'value') || 50;

// hurtStyle (Dom 2026-10-13: the bent-over hurt stagger "looks shit and we can do better"): `?hurt=1|2|3` picks a row of sandbox-rules-defs.json `hurtStyles` { id, weight, s1, s2, twist }: `weight` is how much of the recorded Hit clip stays (per-mille of the
// normal blend, the rest is the standing pose), `s1` / `s2` (radians, per-mille) lean the lower and upper spine (negative = back), `twist` turns the lower spine. Presentation only (characters.ts, after the mixer); no row picked = today's hurt.
export type HurtStyle = { id: number; weight: number; s1: number; s2: number; twist: number };
export const HURT_STYLES: readonly HurtStyle[] = ((DEFS as unknown as { hurtStyles?: HurtStyle[] }).hurtStyles ?? []);

// readyStyle (Dom 2026-10-14: "this dumb pose", the armed ready stance, bent forward over the sword): `?ready=1|2|3` picks a row of sandbox-rules-defs.json `readyStyles` { id, s1, s2, s3, neck } (radians, per-mille, added to the
// lower, middle and upper spine and the neck while the fighter stands armed and calm; negative = back/up). Presentation only, characters.ts after the mixer; no row picked = today's stance.
export type ReadyStyle = { id: number; s1: number; s2: number; s3: number; neck: number };
export const READY_STYLES: readonly ReadyStyle[] = ((DEFS as unknown as { readyStyles?: ReadyStyle[] }).readyStyles ?? []);

// plainPosture (Dom 2026-10-14: "remove all of the posture effects ... just use the vanilla base model"): 1 = the character driver adds no procedural posture on top of the recorded clips: no tired-body hunch and sagging sword arm, no
// open-stagger lift and lean, no charge lean, no stance silhouette. Guard-side tilt (the sides a guard covers) and every finisher stay as they are. 0 = off (trunk).
export const PLAIN_POSTURE = num('plainPosture', 'value') > 0;

// reachBands (Dom 2026-10-14, positioning gates; Strategy: soft x0.6, never soften a hard miss; NO on-screen marker, Dom: cheap): the distance between the fighters when the blow was THROWN (duel.ts attackFrom.gap, the same read as the pole's minReach; the lunge closes the gap before it lands) falls in a band (`bands` rows,
// { id, upTo } in centimetres, ascending); each weapon has a best band (`bandBest` rows, { weapon, band }). A landed blow outside its weapon's band deals `bandOff` per-mille of its damage; inside it, all of it. A pole thrust inside
// minReach and an out-of-reach swing still miss (duel.ts): a band only scales blows that already land. No rows / bandOff 0 (trunk) = untouched. Donors: For Honor and Mordhau range play, Chivalry 2 reach as a rule.
type BandRow = { id: string; upTo: number }; type BandBestRow = { weapon: string; band: string };
const BANDS = ((DEFS as unknown as { bands?: BandRow[] }).bands ?? []).slice().sort((a, b) => a.upTo - b.upTo);
const BAND_BEST = ((DEFS as unknown as { bandBest?: BandBestRow[] }).bandBest ?? []);
export const BAND_OFF = num('bandOff', 'value');
//   castTellOff: 1 hides the ground ring + fill drawn under the target while a spell winds up (boss-telegraph.ts caster tell; Dom 2026-10-16: "large white rings look shit"). 0 = trunk, the ring is drawn.
export const CAST_TELL_OFF = num('castTellOff', 'value');
export const bandOf = (distance: number): string | undefined => BANDS.find((b) => distance * 100 < b.upTo)?.id ?? BANDS[BANDS.length - 1]?.id;
export const bandPerMille = (weapon: string, distance: number): number => {
  if (!BAND_OFF || !BANDS.length) return 1000;
  const best = BAND_BEST.find((r) => r.weapon === weapon);
  return !best || bandOf(distance) === best.band ? 1000 : BAND_OFF;
};
// The AI holds its weapon's band (Strategy: without it the AI stands in the wrong band and the player wins for free): the approach stops where the weapon is IN its best band and can still start the planned move
// (stop <= reach - .1, the same margin ai.ts inReach keeps). If the band cannot be reached with that move (a trident's light against the outer band), the stop is the weapon's own `fight.close`, as on trunk. Off = `close`.
export const bandStop = (weapon: string, close: number, reach: number): number => {
  if (!BAND_OFF || !BANDS.length) return close;
  const i = BANDS.findIndex((b) => b.id === BAND_BEST.find((r) => r.weapon === weapon)?.band);
  if (i < 0) return close;
  const lo = i ? BANDS[i - 1]!.upTo / 100 : 0, top = Math.min(BANDS[i]!.upTo / 100 - .1, reach - .1);
  return top < lo + .05 ? close : Math.round(Math.min(Math.max(close, lo + .05), top) * 100) / 100;   // whole centimetres, so the stop is the same on every engine
};

// armourVsBlow (Dom 2026-10-14, Strategy #1 "plate ignores cuts, mail ignores stabs, cloth fears everything, a maul breaks plate"): a blow has a KIND (`blowKinds` rows, { weapon, move, kind }, the most specific match wins:
// weapon+move, weapon+'*', '*'+move, '*'+'*'); the defender has an armour CLASS (a creature by gear-defs owners: weightClassOf(opponent id); the player by the sheet's dials, armour >= 20 heavy, stamina >= 20 medium,
// magicResist >= 20 light); `armourVs` rows { kind, armour, value } scale the landed blow by `value` per-mille. A kind or class with no row, or a defender with no class, = 1000. No rows (trunk) = untouched.
type BlowKindRow = { weapon: string; move: string; kind: string }; type ArmourVsRow = { kind: string; armour: string; value: number };
const BLOW_KINDS = ((DEFS as unknown as { blowKinds?: BlowKindRow[] }).blowKinds ?? []);
const ARMOUR_VS = ((DEFS as unknown as { armourVs?: ArmourVsRow[] }).armourVs ?? []);
export const ARMOUR_ON = ARMOUR_VS.length > 0;
export const blowKind = (weapon: string, move: string): string | undefined => {
  const hit = (w: string, m: string) => BLOW_KINDS.find((r) => r.weapon === w && r.move === m)?.kind;
  return hit(weapon, move) ?? hit(weapon, '*') ?? hit('*', move) ?? hit('*', '*');
};
const weightClassOf = (id: string): string | null => {
  const g = GEAR_DEFS as unknown as { owners?: { id: string; set: string }[]; sets?: { id: string; weightClass?: string }[] };
  const set = g.owners?.find((o) => o.id === id.split('.')[0])?.set;
  return (set && g.sets?.find((x) => x.id === set)?.weightClass) || null;
};
export const armourClassOf = (sheet: Sheet | undefined, oid: string | undefined): string | null =>
  oid ? weightClassOf(oid) : !sheet ? null : (sheet.armour ?? 0) >= 20 ? 'heavy' : (sheet.stamina ?? 0) >= 20 ? 'medium' : (sheet.magicResist ?? 0) >= 20 ? 'light' : null;
// The loadout menu (sandbox panel, ?myArmour= / ?foeArmour=): `armourYou` / `armourFoe` rows force the defender's class for this table: 1 unarmoured, 2 light, 3 medium, 4 heavy; 0 = read it from the gear / the creature.
const FORCED: readonly (string | null)[] = [null, null, 'light', 'medium', 'heavy'];
const forced = (side: number | undefined): string | null | undefined => { const v = num(side === 0 ? 'armourYou' : 'armourFoe', 'value'); return v ? FORCED[v] : undefined; };
export const armourPerMille = (weapon: string, move: string, sheet: Sheet | undefined, oid: string | undefined, side?: number): number => {
  if (!ARMOUR_ON) return 1000;
  const f = forced(side), kind = blowKind(weapon, move), cls = f !== undefined ? f : armourClassOf(sheet, oid);
  return kind && cls ? (ARMOUR_VS.find((r) => r.kind === kind && r.armour === cls)?.value ?? 1000) : 1000;
};

// commitVsBait (Dom 2026-10-14, Strategy #4; donor Dark Souls hyper-armour): a `commit` row { weapon, move, windup } makes that weapon's move a commitment: its windup is `windup` percent longer (a long, readable tell),
// it cannot be feinted, and it shrugs every stagger from its first tick to the end of its active window (a hit does not interrupt it). The answer is the dodge-counter (dodgeCounter row) or a guard-break: a bait.
// No rows (trunk) = every move as it was.
type CommitRow = { weapon: string; move: string; windup: number };
const COMMIT = ((DEFS as unknown as { commit?: CommitRow[] }).commit ?? []);
export const commitOf = (weapon: string, move: string | null): CommitRow | undefined => (COMMIT.length && move ? COMMIT.find((r) => r.weapon === weapon && r.move === move) : undefined);

// glanceSound (Dom 2026-10-14: an off-band blow lands "dull": a softer thud): a Hit event carrying `glance` (reach bands) plays its flesh/heavy impact cue at `glanceGain` per-mille of its gain and at `glanceRate`
// per-mille playback speed (lower = duller). Presentation only (sound/cues.ts); 0 = off (trunk).
export const GLANCE_GAIN = num('glanceGain', 'value');
export const GLANCE_RATE = num('glanceRate', 'value') || 1000;

// ward (Dom 2026-10-14, Strategy #6; donors Magicka and Absolver ward stance): a `ward` row { opponent, down, reflect } makes that creature's raised guard a ward. The first blow that meets its guard is reflected: the
// defender takes nothing, the attacker takes `reflect` per-mille of the blow (never to death) and staggers, and the ward is DOWN for `down` ticks (the guard is an ordinary guard meanwhile). A cheap light into the
// ward pops it before the real blow. No rows (trunk) = every guard as it was.
type WardRow = { opponent: string; down: number; reflect: number };
const WARD = ((DEFS as unknown as { ward?: WardRow[] }).ward ?? []);
export const WARD_ON = WARD.length > 0;
export const wardOf = (oid: string | undefined): WardRow | undefined => (WARD_ON && oid ? WARD.find((r) => r.opponent === oid) : undefined);

// flank + shieldWall (Dom 2026-10-14, Strategy preview 2 and #9; donors For Honor guard direction, the Hoplite line in GAME_SPEC): a blow that lands on a RAISED guard from outside its arc but not from behind (a side
// blow: the guard is already ignored there on trunk) deals `flankDamage` and `flankPosture` per-mille of itself (0 = off). A `brace` row { opponent } roots that creature while its guard is up: it absorbs the front
// but cannot step, so the answer is the shove or the flank. No rows (trunk) = untouched.
export const FLANK_DAMAGE = num('flankDamage', 'value'), FLANK_POSTURE = num('flankPosture', 'value');
type BraceRow = { opponent: string };
const BRACE = ((DEFS as unknown as { brace?: BraceRow[] }).brace ?? []);
export const braced = (oid: string | undefined): boolean => BRACE.length > 0 && !!oid && BRACE.some((r) => r.opponent === oid);

// clockFighter (Dom 2026-10-14, Strategy #5, donors DotA and Street Fighter chip-and-stall characters): a `poison` row { opponent, damage, every, duration } makes that creature's landed special poison its target: `damage`
// health every `every` ticks for `duration` ticks (a new landing refreshes it). Poison never kills (it stops at 1 health): it is a clock, the foe must press and the poisoner can wait behind a guard. No marker: the health
// bar draining is the signal (Dom: no markers). No rows (trunk) = nothing.
type PoisonRow = { opponent: string; damage: number; every: number; duration: number };
const POISON = ((DEFS as unknown as { poison?: PoisonRow[] }).poison ?? []);
export const POISON_ON = POISON.length > 0;
export const poisonOf = (oid: string | undefined): PoisonRow | undefined => (POISON_ON && oid ? POISON.find((r) => r.opponent === oid) : undefined);
export const poisonTick = (row: PoisonRow, until: number, tick: number): number => (until >= tick && (until - tick) % row.every === 0 ? row.damage : 0);
export const OID_ON = ARMOUR_ON || WARD_ON || BRACE.length > 0 || POISON_ON;   // the opponent's id rides on its fighter only while a sandbox row reads it

// bindAndDisarm (Dom 2026-10-14, Strategy #8; donors Bushido Blade, Mount & Blade chamber): a `bind` row { weapon, window, hold, react } makes a block with that weapon catch the blade: the attacker is BOUND for `window`
// ticks (no swing, no thrust, no skill; a kick or shove is legal) and must kick to break free. If the window runs out the attacker is DISARMED for `hold` ticks (kick and guard only). `react`: the ticks left
// when an AI attacker answers with the kick (a human attacker answers when he likes). The blocker must have the weapon and the block must land. No rows (trunk) = nothing.
type BindRow = { weapon: string; window: number; hold: number; react: number };
const BIND = ((DEFS as unknown as { bind?: BindRow[] }).bind ?? []);
export const bindOf = (weapon: string): BindRow | undefined => (BIND.length ? BIND.find((r) => r.weapon === weapon) : undefined);

// mana (Dom 2026-10-15: spells usable any time like melee, with a bar like stamina; Strategy ruling: a separate third pool, SPENT PER CAST, regenerating when idle, never a drain over time; stamina stays the melee
// cost; the armour casting penalty slows the regen, not the cost; donors Diablo 2 mana pool + regen, EverQuest mana as the caster's clock): `manaMax` (0 = off, the spell costs stamina as on trunk), `manaRegen` (tenths of a
// point per second), `manaDelay` (ticks after a cast before regen resumes), `manaCostMult` (per-mille of the spell's stamina cost, so the spell rows' own costs still order the spells). Sandbox-only fighter state
// (mana, maxMana, manaRest) that exists only while `manaMax` > 0, so a trunk fight carries nothing new.
export const MANA_MAX = num('manaMax', 'value'), MANA_REGEN = num('manaRegen', 'value'), MANA_DELAY = num('manaDelay', 'value'), MANA_COST_MULT = num('manaCostMult', 'value') || 1000;
export const manaCost = (staminaCost: number): number => Math.round((staminaCost * MANA_COST_MULT) / 1000);
export const manaRegenPerTick = (sheet: Sheet | undefined): number => {
  let pct = 0; for (const r of CAST_PENALTY) if ((sheet?.[r.dial] ?? 0) >= r.atLeast && r.percent > pct) pct = r.percent;
  return (MANA_REGEN / 10 / 60) * (100 / (100 + pct));   // a +20% casting penalty is a 17% slower regen
};

// missiles (Dom 2026-10-15: staffs fire a bolt instead of melee, stab = forward, left slash = left bolt, right slash = right bolt; bows and crossbows follow; Strategy: ONE shared missile model, the missile lives in the OUTER band and is a hard
// miss inside the inner band, resolved deterministically in the sim tick, answered by a dodge, a same-side guard or a sidestep; donors Magicka lane bolts, Mordhau and Chivalry 2 archery, Skyrim bow feel, ModernUO/2004Scape: damage is delivered
// after a projectile delay): `missile` rows { weapon, speed (cm/s), share (per-mille of the move's damage), mana } name a weapon whose moves throw a bolt instead of striking; `missileLanes` rows { move, lane (-1 left, 0 forward, 1 right), mult }
// say which move throws which lane; `missileRadius` (cm) is how near the line a body must be when the bolt arrives, `missileFan` (degrees) the angle of the side lanes, `missileStun` the ticks a hit staggers. No rows (trunk) = nothing.
type MissileRow = { kind?: string; weapon: string; speed: number; share: number; mana: number; windup?: number; recovery?: number; ammo?: number; pierce?: number; tint?: string };   // windup / recovery: percent added to every move's timing (a bow draws, a crossbow reloads); ammo: the quiver (0 = infinite); pierce: per-mille of a blocked bolt that goes through; tint: the bolt's colour
type LaneRow = { move: string; lane: number; mult?: number };
const MISSILES = ((DEFS as unknown as { missile?: MissileRow[] }).missile ?? []);
const LANES = ((DEFS as unknown as { missileLanes?: LaneRow[] }).missileLanes ?? []);
export const missileOf = (weapon: string): MissileRow | undefined => (MISSILES.length ? MISSILES.find((r) => r.weapon === weapon) : undefined);
export const laneOf = (move: string | null): LaneRow | undefined => (move ? LANES.find((r) => r.move === move) : undefined);
export const MISSILE_HOMING = num('missileHoming', 'value');   // 1 = auto-aim (Dom 2026-10-15; donors decide the hit when the shot is fired): the shot flies at the foe and only a roll or a guard answers it
// A staff shot is paid in mana alone (Dom 2026-10-15); the stand-in weapon's melee stamina is waived while mana is on. Bow and crossbow shots cost stamina like any attack.
export const missilePaysNoStamina = (weapon: string): boolean => MANA_MAX > 0 && missileOf(weapon)?.kind === 'staff';
export const MISSILE_RADIUS = num('missileRadius', 'value'), MISSILE_FAN = num('missileFan', 'value'), MISSILE_STUN = num('missileStun', 'value');
/** The nearest a missile can be thrown from: the inner edge of the outer band (Strategy: the bow is helpless up close). */
export const missileMinGap = (): number => (BANDS.length > 1 ? BANDS[BANDS.length - 2]!.upTo / 100 : 0);
// spellRange (Dom 2026-10-16, Strategy's table stands; Dom later: a band is the FARTHEST a spell reaches, never a minimum, so any spell may be cast as close as you like, at your own risk): one `spellRange` row per spell root { root, band (a `bands` id), speed (cm/s) and tint when the spell travels }. A cast is legal while the gap between the fighters
// is no farther than the root's band (the band edges are the live `bands` rows, no new distance); beyond it the press is refused and nothing is spent, with the `spellCue` row's short text ("far"). A row with a speed goes through the
// one missile model (travel time, answered by roll or guard); the rest land on the foe at the release. No rows (trunk) = a spell has no range, as before.
type SpellRangeRow = { root: string; band: string; kind?: 'melee' | 'magic'; windup?: number; speed?: number; tint?: string }; type CueRow = { id: string; text: string };
const SPELL_RANGES = ((DEFS as unknown as { spellRange?: SpellRangeRow[] }).spellRange ?? []);
const CUES = ((DEFS as unknown as { spellCue?: CueRow[] }).spellCue ?? []);
export const spellRangeOf = (root: string): SpellRangeRow | undefined => (BANDS.length ? SPELL_RANGES.find((r) => r.root === root) : undefined);
// kind (Dom 2026-10-16: melee or magic, nothing else): a `melee` root is cast up close and paid in STAMINA; a `magic` root (medium / long band) is paid in MANA. A root with no kind (trunk, no rows) pays as before: mana while mana is on.
// spellFx (Dom 2026-10-16: "we designed unique level 10 spell effects, black fog, a claw, earth movement; where are they?"): 1 = a catalogue spell cast plays its root's designed special effect (crack = Antaeus' earth, longShadow = Thanatos' fog, baying = Arawn ...) instead of the sandbox's plain flash. 0 = trunk: a spell cast in a real fight draws no special effect.
export const SPELL_FX = num('spellFx', 'value');
// spellEffect: one row per catalogue spell { id, fx } naming the designed special effect it plays (sandbox/spell-fx.json, authored by sandbox/spell-fx-gen.mjs from the ladder rule: rank 1-3 = class special A, 4-7 = B, 8 / 9 / 10 = the family's boss special). A spell with no row falls back to its root template's special (special-presentation.ts).
type SpellEffectRow = { id: string; fx: string };
const SPELL_EFFECTS = ((DEFS as unknown as { spellEffect?: SpellEffectRow[] }).spellEffect ?? []);
// A spellPick row may name its own `fx` (Dom 2026-10-16: the alpha's 20 spells must each look different and strong); it wins over the generated band rule above.
export const spellEffectOf = (spell: string): string | undefined => ((DEFS as unknown as { spellPick?: { id: string; fx?: string }[] }).spellPick ?? []).find((r) => r.id === spell)?.fx ?? SPELL_EFFECTS.find((r) => r.id === spell)?.fx;
// spellBuffer (Dom 2026-10-16: "sometimes a first tap does nothing"): milliseconds a SPELL press the game cannot take yet (a stagger, a swing's recovery) is held and fired the moment it can. 0 = off (trunk): a refused press is simply lost.
export const SPELL_BUFFER_MS = num('spellBuffer', 'value');
// spellPick (Dom 2026-10-16: the alpha / pre-beta ladder reaches level 3, so30 hand-picked spells for levels 1-3, 10 a level, each playing one of the 30 designed boss specials of ranks 8, 9, 10): one row { id, level } per offered spell. The spell pickers list only these; every other spell stays in the rows, hidden. No rows (trunk) = every spell.
type SpellPickRow = { id: string; level: number; fx?: string };
export const spellPick = (): readonly string[] => ((DEFS as unknown as { spellPick?: SpellPickRow[] }).spellPick ?? []).map((r) => r.id);
// windup (Dom 2026-10-16: a melee cast must be quicker than a magic one, or the caster is a sitting duck next to a plain slash): ticks of cast for this root, at 60 a second. No row field = the global special windup (120, two seconds).
/** Ticks this root's cast takes before it lands, or `base` (the global special windup) when its row names none. */
export const spellWindupOf = (root: string | undefined, base: number): number => (root && spellRangeOf(root)?.windup) || base;
/** True when the spell's cast is paid in mana (magic, or a root with no kind while mana is on); false for a melee spell, which pays stamina. */
export const paysMana = (root: string | undefined): boolean => MANA_MAX > 0 && (!root || spellRangeOf(root)?.kind !== 'melee');
/** 'far' when `distance` metres is beyond the root's band (its farthest reach), undefined when the cast may go (any distance inside it, however close; or the root has no row). */
export const spellRangeCue = (root: string, distance: number): 'far' | undefined => {
  const row = spellRangeOf(root); if (!row) return undefined;
  const have = BANDS.findIndex((b) => b.id === bandOf(distance)), want = BANDS.findIndex((b) => b.id === row.band);
  return want >= 0 && have > want ? 'far' : undefined;
};
// spellLook (Dom 2026-10-16: every spell its own look, in the data layer): one row per catalogue spell { id, tint, size (per-mille of the burst's base size), pulse (ticks the burst lasts) }. sandbox/spell-looks.json authors all 700 (sandbox/spell-looks-gen.mjs); a spell with no row, or no rows (trunk), looks as before.
type SpellLookRow = { id: string; tint?: string; size?: number; pulse?: number };
const SPELL_LOOKS = ((DEFS as unknown as { spellLook?: SpellLookRow[] }).spellLook ?? []);
export const spellLookOf = (spell: string): SpellLookRow | undefined => SPELL_LOOKS.find((r) => r.id === spell);
export const spellCueText =(id: string): string => CUES.find((c) => c.id === id)?.text ?? id;
/** Travel time in whole ticks over `range` metres at the row's cm/s speed. */
export const missileTicks = (row: { speed: number }, range: number): number => Math.max(1, Math.ceil((range * 100 * 60) / row.speed));

// quiver + weapon timing for missile weapons (Strategy: bows and crossbows carry a finite quiver, a row flag `quiver` on/off for the A/B; the staff is infinite, mana is its cost).
export const QUIVER = num('quiver', 'value');
export const ammoOf = (weapon: string): number => { const r = missileOf(weapon); return QUIVER && r?.ammo ? r.ammo : 0; };
export const missileTiming = (weapon: string): { windup: number; recovery: number } | undefined => { const r = missileOf(weapon); return r && (r.windup || r.recovery) ? { windup: r.windup ?? 0, recovery: r.recovery ?? 0 } : undefined; };
