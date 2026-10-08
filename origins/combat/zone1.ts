// Zone 1's OWN combat loop (Dom via Strategy, 2026-10-08: Zone 1 is detached from the Pit): continuous and open, no ring, no wall, no fight start or end, no FightRecord, no seed, no replay.
// Pure and DOM-free: ONE step function over a world of free fighters in the world's own metres. It borrows DATA from src/ (the move rows, the creature rows, the rules numbers: ticks at 60 Hz
// become seconds here) and the one speed table (../preview/speeds.ts); it never imports Match, duel.ts, record.ts or the sim. Zone 1 draws no randomness yet (the creature variety slices add
// an injected `rand`), so a test is a plain call. Conventions as the rest of the game: heading h means forward = (sin h, cos h), aim = atan2(dx, dz). World owns mounting, rendering,
// animation and input; this file owns hits, reach, stamina, guard, roll, posture, stagger, death and what a creature does with its weapon.
// S0: movement, the light cut, a telegraphed creature bite, death, leash/give-up/heal-home. S1: guard (frontal block, perfect block, chip, guard break), roll with i-frames, posture break,
// stamina (sprint drain, exhaustion), and `minKillSeconds`, the server-side plausibility bound for a kill report (there is no record to replay in Zone 1).
import { MOVES, OPPONENTS, RULES, WEAPONS, type MoveDef, type WeaponId } from '../../src/moves.ts';
import { GIVE_UP_UNSEEN_S, SPEEDS, chaseSpeed, leashOf } from '../preview/speeds.ts';

const TICK = 1 / 60;
const secs = (ticks: number): number => ticks * TICK;
export const STAMINA_MAX = 100;                       // duel.ts createFighter: the bar every fighter starts with
export const HIT_ARC = (2 * Math.PI) / 3;             // total width of a sword cut's cone, and of the frontal guard (a block has to face the blow)
export const PLAYER_RADIUS = 0.425;                    // half the sim's 0.85 m fighter spacing (sim.ts)
export const AGGRO_M = 9;                              // a creature that is hunting a player notices him inside this ring (World's mob layer decides who is in the world at all)
export const SIGHT_M = 14;                              // a hunting creature keeps the player in sight inside this ring (hysteresis over AGGRO_M); past it the unseen clock runs
export const RECOVER_PAUSE_S = 0.6;                    // a creature's beat between its blows
export const TELEGRAPH_S = 0.4;                        // a creature's windup, long enough to read in the open world (Strategy, 2026-10-08); the bite row's own 14 ticks (.23 s) is a Pit number
// Damage by kind: the bite row's damage (10) times the creature's weight. Health, poise and body scale are the roster's own rows (moves.ts OPPONENTS).
export const BLOW_WEIGHT: Readonly<Record<string, number>> = { wolf: 1, boar: 1.4, bear: 2.2 };

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
  returning: boolean;                                   // creature only: it gave up and is walking home (it heals to full on arrival, no event)
};
export type World = { time: number; fighters: Fighter[] };
export type Input = { x: number; z: number; run?: boolean; attack?: 'light' | null; guard?: boolean; roll?: { x: number; z: number } | null };   // world-axis move, a held run, a light cut / a roll pressed this step, a held guard
export type Event =
  | { type: 'Telegraph'; id: string; move: string; ms: number }   // a windup began: the tell World animates and sounds
  | { type: 'Swing'; id: string; move: string }                    // the blow's active part began
  | { type: 'Hit'; attacker: string; victim: string; damage: number; move: string }
  | { type: 'Blocked'; attacker: string; victim: string; perfect: boolean; damage: number }   // `damage` is the chip that passed through (0 for a cut)
  | { type: 'Dodged'; attacker: string; victim: string }          // the blow met a roll's invulnerable ticks
  | { type: 'Staggered'; id: string; ms: number; cause: 'hit' | 'posture' | 'guardBreak' }
  | { type: 'Died'; id: string; by: string }
  | { type: 'Evaded'; id: string };                               // a creature gave up and is back home, healed: World may drop it from the world (no XP, no loot, no combat log: the game does not hear of it)

const OPPONENT = (kind: string) => (OPPONENTS as Record<string, (typeof OPPONENTS)[keyof typeof OPPONENTS]>)[kind];

function fighter(id: string, side: Fighter['side'], kind: string, x: number, z: number, facing: number, radius: number, health: number, poise: number, weapon: WeaponId): Fighter {
  return { id, side, kind, x, z, facing, radius, health, maxHealth: health, stamina: STAMINA_MAX, maxStamina: STAMINA_MAX, poise, weapon, move: null, phase: 'ready', t: 0, struck: [], regenIn: 0, pause: 0, hurtFor: 0,
    posture: 0, postureIdle: 0, exhausted: false, rollX: 0, rollZ: 0, homeX: x, homeZ: z, hunting: false, chaseX: x, chaseZ: z, unseen: 0, returning: false };
}
export const player = (id: string, x: number, z: number, facing = 0): Fighter => fighter(id, 'player', 'player', x, z, facing, PLAYER_RADIUS, RULES.health, 0, 'longsword');
/** A creature of `kind` (a moves.ts ROSTER id): its health, poise, body scale and weapon are the roster's own rows. */
export function creature(id: string, kind: string, x: number, z: number, facing = 0): Fighter {
  const o = OPPONENT(kind);
  if (!o) throw new RangeError(`zone1: unknown creature kind ${kind}`);
  return fighter(id, 'creature', kind, x, z, facing, PLAYER_RADIUS * o.scale, o.health, o.poise, o.weapon);
}
export const newWorld = (fighters: Fighter[]): World => ({ time: 0, fighters });

const dist = (a: Fighter, b: Fighter): number => Math.hypot(b.x - a.x, b.z - a.z);
const aim = (from: Fighter, to: Fighter): number => Math.atan2(to.x - from.x, to.z - from.z);
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const alive = (f: Fighter): boolean => f.phase !== 'dead';
/** The blow a fighter throws: the player's light cut, or the creature's own weapon row (its light cut) with the open world's telegraph and its kind's weight. */
const blowOf = (f: Fighter): MoveDef => {
  const row = WEAPONS[f.weapon].moves.light_right ?? MOVES.light_right;
  return f.side === 'player' ? row : { ...row, windup: Math.round(TELEGRAPH_S * 60), damage: Math.round(row.damage * (BLOW_WEIGHT[f.kind] ?? 1)) };
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
function stagger(v: Fighter, ticks: number, cause: 'hit' | 'posture' | 'guardBreak', events: Event[]): void {
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

function land(a: Fighter, v: Fighter, move: MoveDef, events: Event[]): void {
  if (invulnerable(v)) { events.push({ type: 'Dodged', attacker: a.id, victim: v.id }); return; }
  if (v.phase === 'guard' && !move.breaksGuard && covered(v, a)) {   // a frontal block: no damage but the row's chip; the stamina and posture it costs are the row's own
    const perfect = v.t < secs(RULES.perfectBlock), chip = Math.round(move.damage * move.chip);
    events.push({ type: 'Blocked', attacker: a.id, victim: v.id, perfect, damage: chip });
    if (chip > 0 && hurt(a, v, chip, events)) return;
    spend(v, move.staminaDamage * (perfect ? RULES.perfectBlockCost : 1));
    addPosture(v, move.posture * (perfect ? RULES.posture.perfect : 1), events);
    if (v.phase === 'guard' && v.stamina <= 0) { v.stamina = 0; stagger(v, RULES.posture.stun, 'guardBreak', events); }   // the guard gave out
    return;
  }
  events.push({ type: 'Hit', attacker: a.id, victim: v.id, damage: move.damage, move: move.id });
  if (hurt(a, v, move.damage, events)) return;
  addPosture(v, move.posture, events);
  if (v.phase !== 'stagger' && move.damage >= v.poise) stagger(v, move.stagger, 'hit', events);   // a plain clean hit dealing less than poise never staggers (moves.ts Opponent.poise)
}

/** The next world: movement, blows, stamina, guard, roll, posture, creature behaviour. Never mutates its input. */
export function stepCombat(world: World, inputs: Readonly<Record<string, Input>>, dt: number): { world: World; events: Event[] } {
  const events: Event[] = [];
  const fighters = world.fighters.map((f) => ({ ...f, struck: f.struck.slice() }));
  for (const f of fighters) {
    if (!alive(f)) continue;
    f.t += dt;
    if (f.pause > 0) f.pause = Math.max(0, f.pause - dt);
    if (f.regenIn > 0) f.regenIn = Math.max(0, f.regenIn - dt);
    f.postureIdle += dt;
    if (f.postureIdle >= secs(RULES.posture.hold) && f.posture > 0) f.posture = Math.max(0, f.posture - RULES.posture.decay * 60 * dt);
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
          if (input.attack === 'light' && f.phase === 'ready' && !f.exhausted && f.stamina > 0) begin(f, blowOf(f), events);
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
          const move = blowOf(f), startAt = move.reach * 0.85 + prey.radius;
          if (dist(f, prey) > startAt) { const step = Math.min(chaseSpeed(f.kind) * dt, dist(f, prey) - startAt); f.x += Math.sin(f.facing) * step; f.z += Math.cos(f.facing) * step; }
          else if (f.pause <= 0) begin(f, move, events);
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
      if (f.phase === 'windup' && f.t >= secs(m.windup)) { f.phase = 'active'; f.t -= secs(m.windup); events.push({ type: 'Swing', id: f.id, move: m.id }); }
      if (f.phase === 'active') {
        for (const v of fighters) if (v !== f && v.side !== f.side && alive(v) && !f.struck.includes(v.id) && inReach(f, v, m)) { f.struck.push(v.id); land(f, v, m, events); }
        if (f.t >= secs(m.active) && f.phase === 'active') { f.phase = 'recover'; f.t -= secs(m.active); }
      } else if (f.phase === 'recover' && f.t >= secs(m.recovery)) { f.phase = 'ready'; f.t = 0; f.move = null; if (f.side === 'creature') f.pause = RECOVER_PAUSE_S; }
    } else if (f.phase === 'stagger' && f.t >= f.hurtFor) { f.phase = 'ready'; f.t = 0; if (f.side === 'creature') f.pause = RECOVER_PAUSE_S; }
  }
  return { world: { time: world.time + dt, fighters }, events };
}

/**
 * The SERVER's plausibility bound for a kill report (there is no record to replay in Zone 1, so anti-cheat is a bound, not a proof): the fewest seconds a player could possibly take to kill
 * `kind` with the longsword's light cut. Hits needed at the best damage multiplier the rules ever give (a rear or counter blow, RULES.rear.damage); the cadence is the fastest chained cut.
 * A claimed kill faster than this, or with hitsDealt x best damage below the creature's health, is refused. Conservative on purpose: it never refuses an honest fight.
 */
export function minKillSeconds(kind: string): number {
  const o = OPPONENT(kind);
  if (!o) throw new RangeError(`zone1: unknown creature kind ${kind}`);
  const cut = MOVES.light_right, best = cut.damage * RULES.rear.damage, hits = Math.ceil(o.health / best);
  const chained = cut.chained ?? cut, cycle = secs(chained.windup + chained.active + chained.recovery);
  return secs(cut.windup) + Math.max(0, hits - 1) * cycle;   // the first blow lands after its windup; every later one a full chained cycle apart
}
