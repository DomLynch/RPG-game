// Zone 1's OWN combat loop (Dom via Strategy, 2026-10-08: Zone 1 is detached from the Pit): continuous and open, no ring, no wall, no fight start or end, no FightRecord, no seed, no replay.
// Pure and DOM-free: ONE step function over a world of free fighters in the world's own metres. It borrows DATA from src/ (the move rows, the creature rows, the rules numbers: ticks at 60 Hz
// become seconds here) and the one speed table (../preview/speeds.ts); it never imports Match, duel.ts, record.ts or the sim. Its one randomness is the creature variety blow, an injected `rand` (default Math.random). Conventions as the rest of the game: heading h means forward = (sin h, cos h), aim = atan2(dx, dz). World owns mounting, rendering,
// animation and input; this file owns hits, reach, stamina, guard, roll, posture, stagger, death and what a creature does with its weapon.
// S0: movement, the light cut, a telegraphed creature bite, death, leash/give-up/heal-home. S1: guard (frontal block, perfect block, chip, guard break), roll with i-frames, posture break,
// stamina (sprint drain, exhaustion), and `minKillSeconds`, the server-side plausibility bound for a kill report (there is no record to replay in Zone 1).
import { MOVES, OPPONENTS, RULES, WEAPONS, type MoveDef, type MoveId, type WeaponId } from '../../src/moves.ts';
import { CAPS, NAKED, type Loadout } from '../../src/gear-stats.ts';
import { asStance, stanced, type PickedStance, type StanceId } from '../../src/stance.ts';
import { GIVE_UP_UNSEEN_S, SPEEDS, chaseSpeed, leashOf } from '../preview/speeds.ts';

const TICK = 1 / 60;
const secs = (ticks: number): number => ticks * TICK;
export const STAMINA_MAX = 100;                       // duel.ts createFighter: the bar every fighter starts with
export const HIT_ARC = (2 * Math.PI) / 3;             // total width of a sword cut's cone, and of the frontal guard (a block has to face the blow)
export const PLAYER_RADIUS = 0.425;                    // half the sim's 0.85 m fighter spacing (sim.ts)
export const AGGRO_M = 9;                              // a creature that is hunting a player notices him inside this ring (World's mob layer decides who is in the world at all)
export const SIGHT_M = 14;                              // a hunting creature keeps the player in sight inside this ring (hysteresis over AGGRO_M); past it the unseen clock runs
export const MAX_ATTACKERS = 2;                         // at most this many creatures wind up or swing at once (Dom: "it can be 2 vs 1, that is fine"); the rest hold off at the ring until a slot frees
export const CLOSE_EPS = 1e-6;                          // the clamped last step of a chase lands within float error of the blow's start distance: that counts as arrived (it once left a creature standing 1 ulp short, never swinging)
export const RECOVER_PAUSE_S = 0.6;                    // a creature's beat between its blows
export const TELEGRAPH_S = 0.4;                        // a creature's windup, long enough to read in the open world (Strategy, 2026-10-08); the bite row's own 14 ticks (.23 s) is a Pit number
// Damage by kind: the bite row's damage (10) times the creature's weight. Health, poise and body scale are the roster's own rows (moves.ts OPPONENTS).
export const BLOW_WEIGHT: Readonly<Record<string, number>> = { wolf: 1, boar: 1.4, bear: 2.2 };

/** The creature variety rows (S2): each kind's second blow, thrown with probability `p` (an injected `rand` decides, one roll per blow). `dash` is the metres it covers when the blow goes active (a lunge, a charge): it starts
 *  that much farther out, and the windup is the tell the player rolls or backs out of. `mul` scales the kind's weight damage; `breaksGuard` makes a raised guard useless against it (answer: roll, or parry the basic blow). */
export const VARIETY: Readonly<Record<string, { id: 'lunge' | 'charge' | 'heavy'; p: number; windup: number; mul: number; dash: number; breaksGuard: boolean }>> = {
  wolf: { id: 'lunge', p: 0.25, windup: 0.5, mul: 1.3, dash: 1.2, breaksGuard: false },
  boar: { id: 'charge', p: 0.25, windup: 0.7, mul: 1.6, dash: 4, breaksGuard: false },
  bear: { id: 'heavy', p: 0.25, windup: 0.9, mul: 2, dash: 0, breaksGuard: true },
};
export const PARRY_STAGGER_S = 0.7;                     // a perfect block of a creature's plain blow throws the creature off for this long (a heavy / charge cannot be parried: roll it)

/** Creature level scaling (S3): the roster row is level 1; each level adds this much health and damage (linear, like the ladder's own knobs; tune from play). Level 18 = x1.51 health, x1.26 damage; 46 = x2.35, x1.68. */
export const LEVEL_HEALTH = 0.03, LEVEL_DAMAGE = 0.015, MAX_LEVEL = 50;
export const levelHealth = (level: number): number => 1 + LEVEL_HEALTH * (clampLevel(level) - 1);
export const levelDamage = (level: number): number => 1 + LEVEL_DAMAGE * (clampLevel(level) - 1);
function clampLevel(level: number): number { return Math.min(MAX_LEVEL, Math.max(1, Math.round(level))); }

/** PvP (S4, Dom via Strategy): no toggle. The SERVER sets `Fighter.pvp` each step to "attackable here, now" (wild zone = true, safe-town volume = false); the rules below decide between two such players.
 *  Under PROTECT_LEVEL a player is shielded until his own first attack; nobody may hit a player more than MAX_LEVEL_GAP levels below them. A player's blows always land on creatures, whatever the flags. */
export const PROTECT_LEVEL = 3, MAX_LEVEL_GAP = 10;
export const AGGRO_WINDOW_S = 60;                       // a player who hit you in the last minute is not "first" when you hit back

export type Phase = 'ready' | 'guard' | 'roll' | 'windup' | 'active' | 'recover' | 'stagger' | 'dead';
export type Fighter = {
  id: string; side: 'player' | 'creature'; kind: string;   // kind: 'player' or a ROSTER id ('wolf', 'boar', 'bear', ...)
  x: number; z: number; facing: number; radius: number;
  health: number; maxHealth: number; stamina: number; maxStamina: number; poise: number;
  weapon: WeaponId; move: MoveDef | null;               // the blow in progress
  phase: Phase; t: number;                              // seconds spent in the phase
  struck: string[];                                     // ids this blow already landed on (one hit per blow per target)
  regenIn: number;                                      // seconds before stamina comes back
  pause: number;                                        // creature only: seconds before it may start another blow
  hurtFor: number;                                      // how long the current stagger lasts
  posture: number; postureIdle: number;                 // posture (0..RULES.posture.max): blocks and clean hits fill it, it drains after `hold`; seconds since it last rose
  exhausted: boolean;                                   // stamina hit zero: no new action, slower, until it is back past RULES.exhaustRecover
  rollX: number; rollZ: number;                         // the roll's direction (unit)
  homeX: number; homeZ: number;                         // creature only: where it spawned (it walks back here)
  hunting: boolean; chaseX: number; chaseZ: number;     // creature only: it is on a chase that STARTED at (chaseX, chaseZ); the leash is measured from there
  unseen: number;                                       // creature only: seconds the prey has been out of sight
  attack: number; res: number;                          // damage multipliers (src/gear-stats.ts Loadout): `attack` scales what it deals, `res` what it takes, chip included; a creature's `attack` is its level's damage
  stance?: StanceId;                                    // src/stance.ts: the Pit's table, read through `stanced` (absent = Balanced, the unscaled value untouched)
  pvp: boolean; level: number; shielded: boolean;       // player only: attackable by players here and now (server-set); his level; the low-level shield (dropped on his first attack)
  plan: string | null;                                  // creature only: the variety blow rolled for its next attack ('basic' = none), null until rolled
  returning: boolean;                                   // creature only: it gave up and is walking home (it heals to full on arrival, no event)
};
export type World = { time: number; fighters: Fighter[]; aggro: Record<string, Record<string, number>> };   // aggro[attacker][victim] = when the attacker's last blow met that player
export type Input = { x: number; z: number; run?: boolean; attack?: 'light' | 'heavy' | 'kick' | null; guard?: boolean; roll?: { x: number; z: number } | null };   // world-axis move, a held run, a light cut / a roll pressed this step, a held guard
export type Event =
  | { type: 'Telegraph'; id: string; move: string; ms: number }   // a windup began: the tell World animates and sounds
  | { type: 'Swing'; id: string; move: string }                    // the blow's active part began
  | { type: 'Hit'; attacker: string; victim: string; damage: number; move: string }
  | { type: 'Blocked'; attacker: string; victim: string; perfect: boolean; damage: number }   // `damage` is the chip that passed through (0 for a cut)
  | { type: 'Dodged'; attacker: string; victim: string }          // the blow met a roll's invulnerable ticks
  | { type: 'Staggered'; id: string; ms: number; cause: 'hit' | 'posture' | 'guardBreak' | 'kick' | 'parry' }
  | { type: 'Aggressed'; attacker: string; victim: string; first: boolean }   // a player's blow met another player (hit, block or dodge): `first` = the victim had not hit him in the last AGGRO_WINDOW_S. The server's murder rule reads Aggressed(first) then Died(by)
  | { type: 'Died'; id: string; by: string }
  | { type: 'Evaded'; id: string };                               // a creature gave up and is back home, healed: World may drop it from the world (no XP, no loot, no combat log: the game does not hear of it)

const OPPONENT = (kind: string) => (OPPONENTS as Record<string, (typeof OPPONENTS)[keyof typeof OPPONENTS]>)[kind];

function fighter(id: string, side: Fighter['side'], kind: string, x: number, z: number, facing: number, radius: number, health: number, poise: number, weapon: WeaponId): Fighter {
  return { id, side, kind, x, z, facing, radius, health, maxHealth: health, stamina: STAMINA_MAX, maxStamina: STAMINA_MAX, poise, weapon, move: null, phase: 'ready', t: 0, struck: [], regenIn: 0, pause: 0, hurtFor: 0,
    posture: 0, postureIdle: 0, exhausted: false, rollX: 0, rollZ: 0, homeX: x, homeZ: z, hunting: false, chaseX: x, chaseZ: z, unseen: 0, attack: 1, res: 1, pvp: false, level: 1, shielded: false, plan: null, returning: false };
}
/** The player, with his gear's Loadout (NAKED = the identity: no gear changes nothing). */
export const player = (id: string, x: number, z: number, facing = 0, gear: Loadout = NAKED, level = 1): Fighter => ({ ...fighter(id, 'player', 'player', x, z, facing, PLAYER_RADIUS, RULES.health, 0, 'longsword'), attack: gear.attack, res: gear.res, level, shielded: level < PROTECT_LEVEL });
/** A creature of `kind` (a moves.ts ROSTER id): its health, poise, body scale and weapon are the roster's own rows. */
export function creature(id: string, kind: string, x: number, z: number, facing = 0, level = 1): Fighter {
  const o = OPPONENT(kind);
  if (!o) throw new RangeError(`zone1: unknown creature kind ${kind}`);
  return { ...fighter(id, 'creature', kind, x, z, facing, PLAYER_RADIUS * o.scale, Math.round(o.health * levelHealth(level)), o.poise, o.weapon), attack: levelDamage(level) };
}
/** A fighter with a picked stance ('neutral' = Balanced = none). The same four picks and the same signed per-mille table as the Pit (src/stance.ts), one kit everywhere. */
export const withStance = (f: Fighter, pick: PickedStance): Fighter => ({ ...f, stance: asStance(pick) });
export const newWorld = (fighters: Fighter[]): World => ({ time: 0, fighters, aggro: {} });

const dist = (a: Fighter, b: Fighter): number => Math.hypot(b.x - a.x, b.z - a.z);
const aim = (from: Fighter, to: Fighter): number => Math.atan2(to.x - from.x, to.z - from.z);
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const alive = (f: Fighter): boolean => f.phase !== 'dead';
/** Can `a`'s blow hurt `v`? Creatures and players always can (and are hurt by each other); two players only where both are attackable here, the victim is unshielded and not more than MAX_LEVEL_GAP below the attacker. */
const hostile = (a: Fighter, v: Fighter): boolean => a.side !== v.side || (a.pvp && v.pvp && !v.shielded && a.level - v.level <= MAX_LEVEL_GAP);
/** The blow a fighter throws: the player's light cut, or the creature's own weapon row (its light cut) with the open world's telegraph and its kind's weight. */
const PLAYER_BLOWS = { light: 'light_right', heavy: 'heavy_overhead', kick: 'kick' } as const;   // the longsword's rows (moves.ts MOVES): the heavy chips through a guard, the kick ignores it
const blowOf = (f: Fighter, press: 'light' | 'heavy' | 'kick' = 'light'): MoveDef => {
  if (f.side === 'player') return WEAPONS[f.weapon].moves[PLAYER_BLOWS[press]] ?? MOVES[PLAYER_BLOWS[press]];
  const row = WEAPONS[f.weapon].moves.light_right ?? MOVES.light_right, w = BLOW_WEIGHT[f.kind] ?? 1, v = VARIETY[f.kind];
  if (v && f.plan === v.id) return { ...row, id: v.id as MoveId, windup: Math.round(v.windup * 60), damage: Math.round(row.damage * w * v.mul), breaksGuard: v.breaksGuard || row.breaksGuard };
  return { ...row, windup: Math.round(TELEGRAPH_S * 60), damage: Math.round(row.damage * w) };
};
/** A blow connects from the attacker's centre to the victim's edge, inside its cone. */
const inReach = (a: Fighter, b: Fighter, move: MoveDef): boolean => dist(a, b) <= move.reach + b.radius && Math.abs(wrap(aim(a, b) - a.facing)) <= HIT_ARC / 2;
const invulnerable = (f: Fighter): boolean => f.phase === 'roll' && f.t >= secs(RULES.safeStart) && f.t < secs(RULES.safeEnd);
const covered = (v: Fighter, a: Fighter): boolean => Math.abs(wrap(aim(v, a) - v.facing)) <= HIT_ARC / 2;   // the blow comes from the front of a guard

function spend(f: Fighter, cost: number): void {
  f.stamina = Math.max(0, f.stamina - cost); f.regenIn = secs(RULES.regenDelay);
  if (f.stamina <= 0) f.exhausted = true;
}
function begin(f: Fighter, move: MoveDef, events: Event[]): void {
  f.move = move; f.phase = 'windup'; f.t = 0; f.struck = [];
  spend(f, move.stamina);
  events.push({ type: 'Telegraph', id: f.id, move: move.id, ms: Math.round(secs(move.windup) * 1000) });
}
function stagger(v: Fighter, ticks: number, cause: 'hit' | 'posture' | 'guardBreak' | 'kick' | 'parry', events: Event[]): void {
  v.phase = 'stagger'; v.t = 0; v.move = null; v.hurtFor = secs(ticks);
  events.push({ type: 'Staggered', id: v.id, ms: Math.round(secs(ticks) * 1000), cause });
}
function addPosture(v: Fighter, amount: number, events: Event[]): void {
  v.posture += amount; v.postureIdle = 0;
  if (v.posture >= RULES.posture.max) { v.posture = 0; stagger(v, RULES.posture.stun, 'posture', events); }
}
function hurt(a: Fighter, v: Fighter, damage: number, events: Event[]): boolean {   // true when it killed
  v.health = Math.max(0, v.health - damage);
  if (v.health > 0) return false;
  v.phase = 'dead'; v.t = 0; v.move = null; events.push({ type: 'Died', id: v.id, by: a.id });
  return true;
}

function land(a: Fighter, v: Fighter, row: MoveDef, events: Event[]): void {
  const sd = Math.round(stanced(a, 'damage', row.charges ? stanced(a, 'heavyDamage', row.damage) : row.damage));   // the attacker's stance (aggressive +5 %, defensive -5 %, trickster -5 % on heavies)
  const kickOnGuard = row.id === 'kick' && v.phase === 'guard', dealtPosture = kickOnGuard ? stanced(a, 'kickPosture', stanced(a, 'posture', row.posture)) : stanced(a, 'posture', row.posture);
  const move = a.attack === 1 && v.res === 1 && sd === row.damage && dealtPosture === row.posture ? row : { ...row, damage: Math.round(sd * a.attack * v.res), posture: dealtPosture };   // stance, gear and level scale damage (chip follows it) and posture dealt; timings are untouched
  if (invulnerable(v)) { events.push({ type: 'Dodged', attacker: a.id, victim: v.id }); return; }
  if (move.vsGuard && v.phase === 'guard') {   // a kick goes through a standing guard: a little damage, the guard's stamina, a long stagger
    events.push({ type: 'Hit', attacker: a.id, victim: v.id, damage: move.damage, move: move.id });
    if (hurt(a, v, move.damage, events)) return;
    spend(v, move.vsGuard.staminaDamage); stagger(v, move.vsGuard.stagger, 'kick', events);
    return;
  }
  if (v.phase === 'guard' && !move.breaksGuard && covered(v, a)) {   // a frontal block: no damage but the row's chip; the stamina and posture it costs are the row's own
    const perfect = v.t < secs(Math.round(stanced(v, 'window', RULES.perfectBlock))), chip = Math.round(move.damage * move.chip);
    events.push({ type: 'Blocked', attacker: a.id, victim: v.id, perfect, damage: chip });
    if (perfect && a.side === 'creature' && a.plan === 'basic' && alive(a)) stagger(a, PARRY_STAGGER_S * 60, 'parry', events);   // a parry: the creature's plain blow is turned aside and it staggers
    if (chip > 0 && hurt(a, v, chip, events)) return;
    spend(v, stanced(v, 'block', move.staminaDamage) * (perfect ? RULES.perfectBlockCost : 1));
    addPosture(v, move.posture * (perfect ? RULES.posture.perfect : 1), events);
    if (v.phase === 'guard' && v.stamina <= 0) { v.stamina = 0; stagger(v, RULES.posture.stun, 'guardBreak', events); }   // the guard gave out
    return;
  }
  events.push({ type: 'Hit', attacker: a.id, victim: v.id, damage: move.damage, move: move.id });
  if (hurt(a, v, move.damage, events)) return;
  addPosture(v, move.posture, events);
  if (v.phase !== 'stagger' && move.damage >= v.poise) stagger(v, move.stagger, 'hit', events);   // a plain clean hit dealing less than poise never staggers (moves.ts Opponent.poise)
}

/** Creatures do not stand inside one another: a creature pushed out of any other creature's body (half each, the way the hero's own spacing is kept). */
function separate(f: Fighter, all: Fighter[]): void {
  for (const o of all) {
    if (o === f || o.side !== 'creature' || !alive(o)) continue;
    const dx = f.x - o.x, dz = f.z - o.z, d = Math.hypot(dx, dz), min = f.radius + o.radius;
    if (d >= min) continue;
    const ux = d > 1e-6 ? dx / d : 1, uz = d > 1e-6 ? dz / d : 0, push = (min - d) / 2;
    f.x += ux * push; f.z += uz * push; o.x -= ux * push; o.z -= uz * push;
  }
}

/** The next world (`rand` decides each creature's variety blow, about 1 attack in 4; the live game passes nothing and gets Math.random, tests inject): movement, blows, stamina, guard, roll, posture, creature behaviour. Never mutates its input. */
export function stepCombat(world: World, inputs: Readonly<Record<string, Input>>, dt: number, rand: () => number = Math.random): { world: World; events: Event[] } {
  const events: Event[] = [];
  const fighters = world.fighters.map((f) => ({ ...f, struck: f.struck.slice() })), aggro: World['aggro'] = {};
  for (const [a, m] of Object.entries(world.aggro)) aggro[a] = { ...m };
  for (const f of fighters) {
    if (!alive(f)) continue;
    f.t += dt;
    if (f.pause > 0) f.pause = Math.max(0, f.pause - dt);
    if (f.regenIn > 0) f.regenIn = Math.max(0, f.regenIn - dt);
    f.postureIdle += dt;
    if (f.postureIdle >= secs(RULES.posture.hold) && f.posture > 0) f.posture = Math.max(0, f.posture - stanced(f, 'recover', RULES.posture.decay) * 60 * dt);
    const input = f.side === 'player' ? inputs[f.id] : undefined;
    const idle = f.phase === 'ready' || f.phase === 'guard';
    if (f.exhausted && f.stamina >= RULES.exhaustRecover) f.exhausted = false;
    if (f.side === 'player') {
      const running = !!input?.run && f.phase === 'ready' && !f.exhausted && (input.x !== 0 || input.z !== 0);
      if (idle && f.regenIn <= 0 && !running) f.stamina = Math.min(f.maxStamina, f.stamina + RULES.regen * 60 * dt * (f.phase === 'guard' ? RULES.guardRegen : 1));
      if (input && idle) {
        if (input.roll && !f.exhausted && f.stamina >= RULES.rollCost) {   // a roll: the direction pressed, else where he faces; invulnerable between safeStart and safeEnd
          const len = Math.hypot(input.roll.x, input.roll.z), dx = len > 1e-6 ? input.roll.x / len : Math.sin(f.facing), dz = len > 1e-6 ? input.roll.z / len : Math.cos(f.facing);
          f.phase = 'roll'; f.t = 0; f.rollX = dx; f.rollZ = dz; f.facing = Math.atan2(dx, dz); spend(f, RULES.rollCost);
        } else {
          const guarding = !!input.guard && !f.exhausted && f.stamina > 0;
          if (guarding && f.phase !== 'guard') { f.phase = 'guard'; f.t = 0; } else if (!guarding && f.phase === 'guard') { f.phase = 'ready'; f.t = 0; }
          const len = Math.hypot(input.x, input.z);
          if (len > 1e-6) {
            const gait = running ? SPEEDS.player.run : SPEEDS.player.walk, k = Math.min(1, len) / len;
            const speed = gait * (guarding ? RULES.guardSpeed : 1) * (f.exhausted ? RULES.exhaustedSpeed : 1);
            f.x += input.x * k * speed * dt; f.z += input.z * k * speed * dt; f.facing = Math.atan2(input.x, input.z);
            if (running) spend(f, RULES.sprintCost * 60 * dt);
          }
          if (input.attack && f.phase === 'ready' && !f.exhausted && f.stamina > 0) begin(f, blowOf(f, input.attack), events);
        }
      }
    } else if (f.phase === 'ready') {
      if (f.regenIn <= 0) f.stamina = Math.min(f.maxStamina, f.stamina + RULES.regen * 60 * dt);
      const prey = fighters.filter((p) => p.side === 'player' && alive(p)).sort((a, b) => dist(f, a) - dist(f, b))[0];
      if (f.returning) {   // gave up: walks home at its amble, heals to full on arrival (no event)
        const dx = f.homeX - f.x, dz = f.homeZ - f.z, d = Math.hypot(dx, dz), step = SPEEDS.creature.amble * dt;
        if (d <= Math.max(step, 0.1)) { f.x = f.homeX; f.z = f.homeZ; f.returning = false; f.health = f.maxHealth; f.posture = 0; events.push({ type: 'Evaded', id: f.id }); }
        else { f.facing = Math.atan2(dx, dz); f.x += (dx / d) * step; f.z += (dz / d) * step; }
      } else if (prey && (f.hunting ? dist(f, prey) <= SIGHT_M || f.unseen < GIVE_UP_UNSEEN_S : dist(f, prey) <= AGGRO_M)) {
        if (!f.hunting) { f.hunting = true; f.chaseX = f.x; f.chaseZ = f.z; f.unseen = 0; }
        f.unseen = dist(f, prey) > SIGHT_M ? f.unseen + dt : 0;
        if (f.unseen >= GIVE_UP_UNSEEN_S || Math.hypot(f.x - f.chaseX, f.z - f.chaseZ) > leashOf(f.kind)) { f.hunting = false; f.returning = true; f.unseen = 0; }
        else {
          f.facing = aim(f, prey);
          if (f.plan === null) { const v = VARIETY[f.kind]; f.plan = v && rand() < v.p ? v.id : 'basic'; }
          const move = blowOf(f), v = VARIETY[f.kind], dash = v && f.plan === v.id ? v.dash : 0, near = move.reach * 0.85 + prey.radius, startAt = near + dash * 0.9;
          if (dist(f, prey) > startAt + CLOSE_EPS) { const step = Math.min(chaseSpeed(f.kind) * dt, dist(f, prey) - startAt); f.x += Math.sin(f.facing) * step; f.z += Math.cos(f.facing) * step; }
          else if (f.pause <= 0 && fighters.filter((o) => o !== f && o.side === 'creature' && (o.phase === 'windup' || o.phase === 'active')).length < MAX_ATTACKERS && !fighters.some((o) => o !== f && o.side === 'creature' && o.phase === 'windup')) begin(f, move, events);
          separate(f, fighters);
        }
      } else if (f.hunting) { f.hunting = false; f.returning = true; f.unseen = 0; }   // nobody left to hunt (the prey is dead or gone)
    }
    // The roll: a stride along its direction for RULES.roll ticks at the run's speed.
    if (f.phase === 'roll') {
      f.x += f.rollX * SPEEDS.player.run * dt; f.z += f.rollZ * SPEEDS.player.run * dt;
      if (f.t >= secs(RULES.roll)) { f.phase = 'ready'; f.t = 0; }
    }
    // The blow's phases, in the move row's own ticks.
    if (f.move && (f.phase === 'windup' || f.phase === 'active' || f.phase === 'recover')) {
      const m = f.move;
      if (f.phase === 'windup' && f.t >= secs(m.windup)) { f.phase = 'active'; f.t -= secs(m.windup); events.push({ type: 'Swing', id: f.id, move: m.id });
        const v = VARIETY[f.kind], prey = f.side === 'creature' && v && f.plan === v.id && v.dash > 0 ? fighters.filter((p) => p.side === 'player' && alive(p)).sort((a, b) => dist(f, a) - dist(f, b))[0] : undefined;
        if (prey) { const gap = Math.max(0, dist(f, prey) - (m.reach * 0.85 + prey.radius)), step = Math.min(v!.dash, gap), h = aim(f, prey); f.x += Math.sin(h) * step; f.z += Math.cos(h) * step; f.facing = h; }   // the lunge / charge covers its ground as the blow goes active
      }
      if (f.phase === 'active') {
        for (const v of fighters) if (v !== f && hostile(f, v) && alive(v) && !f.struck.includes(v.id) && inReach(f, v, m)) {
          f.struck.push(v.id);
          if (f.side === 'player' && v.side === 'player') {   // player against player: log who struck first, drop the attacker's low-level shield
            const back = aggro[v.id]?.[f.id];
            events.push({ type: 'Aggressed', attacker: f.id, victim: v.id, first: back === undefined || world.time - back > AGGRO_WINDOW_S });
            (aggro[f.id] ??= {})[v.id] = world.time; f.shielded = false;
          }
          land(f, v, m, events);
        }
        if (f.t >= secs(m.active) && f.phase === 'active') { f.phase = 'recover'; f.t -= secs(m.active); }
      } else if (f.phase === 'recover' && f.t >= secs(m.recovery)) { f.phase = 'ready'; f.t = 0; f.move = null; if (f.side === 'creature') { f.pause = RECOVER_PAUSE_S; f.plan = null; } }
    } else if (f.phase === 'stagger' && f.t >= f.hurtFor) { f.phase = 'ready'; f.t = 0; if (f.side === 'creature') { f.pause = RECOVER_PAUSE_S; f.plan = null; } }
  }
  return { world: { time: world.time + dt, fighters, aggro }, events };
}

/**
 * The SERVER's plausibility bound for a kill report (there is no record to replay in Zone 1, so anti-cheat is a bound, not a proof): the fewest seconds a player could possibly take to kill
 * `kind` with the longsword's light cut. Hits needed at the best damage multiplier the rules ever give (a rear or counter blow, RULES.rear.damage); the cadence is the fastest chained cut.
 * A claimed kill faster than this, or with hitsDealt x best damage below the creature's health, is refused. Conservative on purpose: it never refuses an honest fight.
 */
export function minKillSeconds(kind: string, level = 1): number {
  const o = OPPONENT(kind);
  if (!o) throw new RangeError(`zone1: unknown creature kind ${kind}`);
  const cut = MOVES.light_right, best = Math.round(cut.damage * CAPS.attack) * RULES.rear.damage, hits = Math.ceil(Math.round(o.health * levelHealth(level)) / best);   // the best gear (CAPS.attack) and the creature's level health
  const chained = cut.chained ?? cut, cycle = secs(chained.windup + chained.active + chained.recovery);
  return secs(cut.windup) + Math.max(0, hits - 1) * cycle;   // the first blow lands after its windup; every later one a full chained cycle apart
}
