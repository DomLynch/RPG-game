// Zone 1's OWN combat loop (Dom via Strategy, 2026-10-08: Zone 1 is detached from the Pit): continuous and open, no ring, no wall, no fight start or end, no FightRecord, no seed, no replay.
// Pure and DOM-free: ONE step function over a world of free fighters in the world's own metres. It borrows DATA from src/ (the move rows, the creature rows, the rules numbers: ticks at 60 Hz
// become seconds here) and the one speed table (../preview/speeds.ts); it never imports Match, duel.ts, record.ts or the sim. Randomness is injected (`rand`), so a test is a plain call.
// Conventions as the rest of the game: heading h means forward = (sin h, cos h), aim = atan2(dx, dz). World owns mounting, rendering, animation and input; this file owns hits, reach, stamina,
// stagger, death and what a creature does with its weapon.
import { MOVES, OPPONENTS, RULES, WEAPONS, type MoveDef, type WeaponId } from '../../src/moves.ts';
import { GIVE_UP_UNSEEN_S, SPEEDS, chaseSpeed, leashOf } from '../preview/speeds.ts';

const TICK = 1 / 60;
const secs = (ticks: number): number => ticks * TICK;
export const STAMINA_MAX = 100;                       // duel.ts createFighter: the bar every fighter starts with
export const HIT_ARC = (2 * Math.PI) / 3;             // total width of a sword cut's cone (the cut has to be aimed; the thrust/kick rows come in a later slice)
export const PLAYER_RADIUS = 0.425;                    // half the sim's 0.85 m fighter spacing (sim.ts)
export const AGGRO_M = 9;                              // a creature that is hunting a player notices him inside this ring (World's mob layer decides who starts hunting)
export const SIGHT_M = 14;                              // a hunting creature keeps the player in sight inside this ring (hysteresis over AGGRO_M); past it the unseen clock runs
export const RECOVER_PAUSE_S = 0.6;                    // a creature's beat between its blows
export const TELEGRAPH_S = 0.4;                        // a creature's windup, long enough to read in the open world (Strategy, 2026-10-08); the bite row's own 14 ticks (.23 s) is a Pit number
// Damage by kind: the bite row's damage (10) times the creature's weight. Health, poise and body scale are the roster's own rows (moves.ts OPPONENTS).
export const BLOW_WEIGHT: Readonly<Record<string, number>> = { wolf: 1, boar: 1.4, bear: 2.2 };

export type Phase = 'ready' | 'windup' | 'active' | 'recover' | 'stagger' | 'dead';
export type Fighter = {
  id: string; side: 'player' | 'creature'; kind: string;   // kind: 'player' or a ROSTER id ('wolf', 'boar', 'bear', ...)
  x: number; z: number; facing: number; radius: number;
  health: number; maxHealth: number; stamina: number; maxStamina: number; poise: number;
  weapon: WeaponId; move: MoveDef | null;               // the blow in progress
  phase: Phase; t: number;                              // seconds spent in the phase
  struck: string[];                                     // ids this blow already landed on (one hit per blow per target)
  regenIn: number;                                      // seconds before stamina comes back
  pause: number;                                        // creature only: seconds before it may start another blow
  hurtFor: number;                                      // how long the current stagger lasts (the hitter's move row)
  homeX: number; homeZ: number;                         // creature only: where it spawned (it walks back here)
  hunting: boolean; chaseX: number; chaseZ: number;     // creature only: it is on a chase that STARTED at (chaseX, chaseZ); the leash is measured from there
  unseen: number;                                       // creature only: seconds the prey has been out of sight
  returning: boolean;                                   // creature only: it gave up and is walking home (it heals to full on arrival, no event)
};
export type World = { time: number; fighters: Fighter[] };
export type Input = { x: number; z: number; run?: boolean; attack?: 'light' | null };   // world-axis move, a held run, a light cut pressed this step
export type Event =
  | { type: 'Telegraph'; id: string; move: string; ms: number }   // a windup began: the tell World animates and sounds
  | { type: 'Swing'; id: string; move: string }                    // the blow's active part began
  | { type: 'Hit'; attacker: string; victim: string; damage: number; move: string }
  | { type: 'Staggered'; id: string; ms: number }
  | { type: 'Died'; id: string; by: string };

const OPPONENT = (kind: string) => (OPPONENTS as Record<string, (typeof OPPONENTS)[keyof typeof OPPONENTS]>)[kind];

export function player(id: string, x: number, z: number, facing = 0): Fighter {
  return { id, side: 'player', kind: 'player', x, z, facing, radius: PLAYER_RADIUS, health: RULES.health, maxHealth: RULES.health, stamina: STAMINA_MAX, maxStamina: STAMINA_MAX, poise: 0, weapon: 'longsword', move: null, phase: 'ready', t: 0, struck: [], regenIn: 0, pause: 0, hurtFor: 0, homeX: x, homeZ: z, hunting: false, chaseX: x, chaseZ: z, unseen: 0, returning: false };
}
/** A creature of `kind` (a moves.ts ROSTER id): its health, poise, body scale and weapon are the roster's own rows. */
export function creature(id: string, kind: string, x: number, z: number, facing = 0): Fighter {
  const o = OPPONENT(kind);
  if (!o) throw new RangeError(`zone1: unknown creature kind ${kind}`);
  return { id, side: 'creature', kind, x, z, facing, radius: PLAYER_RADIUS * o.scale, health: o.health, maxHealth: o.health, stamina: STAMINA_MAX, maxStamina: STAMINA_MAX, poise: o.poise, weapon: o.weapon, move: null, phase: 'ready', t: 0, struck: [], regenIn: 0, pause: 0, hurtFor: 0, homeX: x, homeZ: z, hunting: false, chaseX: x, chaseZ: z, unseen: 0, returning: false };
}
export const newWorld = (fighters: Fighter[]): World => ({ time: 0, fighters });

const dist = (a: Fighter, b: Fighter): number => Math.hypot(b.x - a.x, b.z - a.z);
const aim = (from: Fighter, to: Fighter): number => Math.atan2(to.x - from.x, to.z - from.z);
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const alive = (f: Fighter): boolean => f.phase !== 'dead';
/** The blow a fighter throws: the player's light cut, or the creature's own weapon row (its light cut). */
const blowOf = (f: Fighter): MoveDef => {
  const row = WEAPONS[f.weapon].moves.light_right ?? MOVES.light_right;
  return f.side === 'player' ? row : { ...row, windup: Math.round(TELEGRAPH_S * 60), damage: Math.round(row.damage * (BLOW_WEIGHT[f.kind] ?? 1)) };
};
/** Where a blow connects from: its reach is the move row's, measured from centre to the victim's edge. */
const inReach = (a: Fighter, b: Fighter, move: MoveDef): boolean => dist(a, b) <= move.reach + b.radius && Math.abs(wrap(aim(a, b) - a.facing)) <= HIT_ARC / 2;

function begin(f: Fighter, move: MoveDef, events: Event[]): void {
  f.move = move; f.phase = 'windup'; f.t = 0; f.struck = [];
  f.stamina = Math.max(0, f.stamina - move.stamina); f.regenIn = secs(RULES.regenDelay);
  events.push({ type: 'Telegraph', id: f.id, move: move.id, ms: Math.round(secs(move.windup) * 1000) });
}

function land(a: Fighter, v: Fighter, move: MoveDef, events: Event[]): void {
  v.health = Math.max(0, v.health - move.damage);
  events.push({ type: 'Hit', attacker: a.id, victim: v.id, damage: move.damage, move: move.id });
  if (v.health <= 0) { v.phase = 'dead'; v.t = 0; v.move = null; events.push({ type: 'Died', id: v.id, by: a.id }); return; }
  if (move.damage >= v.poise) { v.phase = 'stagger'; v.t = 0; v.move = null; v.hurtFor = secs(move.stagger); events.push({ type: 'Staggered', id: v.id, ms: Math.round(secs(move.stagger) * 1000) }); }   // a plain clean hit dealing less than poise never staggers (moves.ts Opponent.poise)
}

/** The next world: movement, blows, stamina, creature behaviour. Never mutates its input. S0 draws no randomness (the creature variety slices add an injected `rand`). */
export function stepCombat(world: World, inputs: Readonly<Record<string, Input>>, dt: number): { world: World; events: Event[] } {
  const events: Event[] = [];
  const fighters = world.fighters.map((f) => ({ ...f, struck: f.struck.slice() }));
  for (const f of fighters) {
    if (!alive(f)) continue;
    f.t += dt;
    if (f.pause > 0) f.pause = Math.max(0, f.pause - dt);
    if (f.regenIn > 0) f.regenIn = Math.max(0, f.regenIn - dt);
    else if (f.phase === 'ready') f.stamina = Math.min(f.maxStamina, f.stamina + RULES.regen * 60 * dt);
    const free = f.phase === 'ready';
    if (f.side === 'player') {
      const input = inputs[f.id];
      if (free && input) {
        const len = Math.hypot(input.x, input.z);
        if (len > 1e-6) {
          const speed = input.run ? SPEEDS.player.run : SPEEDS.player.walk, k = Math.min(1, len) / len;
          f.x += input.x * k * speed * dt; f.z += input.z * k * speed * dt; f.facing = Math.atan2(input.x, input.z);
        }
        if (input.attack === 'light' && f.stamina > 0) begin(f, blowOf(f), events);
      }
    } else if (free) {
      const prey = fighters.filter((p) => p.side === 'player' && alive(p)).sort((a, b) => dist(f, a) - dist(f, b))[0];
      if (f.returning) {   // gave up: walks home at its amble, heals to full on arrival (no event)
        const dx = f.homeX - f.x, dz = f.homeZ - f.z, d = Math.hypot(dx, dz), step = SPEEDS.creature.amble * dt;
        if (d <= Math.max(step, 0.1)) { f.x = f.homeX; f.z = f.homeZ; f.returning = false; f.health = f.maxHealth; }
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
    // The blow's phases, in the move row's own ticks.
    if (f.move && (f.phase === 'windup' || f.phase === 'active' || f.phase === 'recover')) {
      const m = f.move;
      if (f.phase === 'windup' && f.t >= secs(m.windup)) { f.phase = 'active'; f.t -= secs(m.windup); events.push({ type: 'Swing', id: f.id, move: m.id }); }
      if (f.phase === 'active') {
        for (const v of fighters) if (v !== f && v.side !== f.side && alive(v) && !f.struck.includes(v.id) && inReach(f, v, m)) { f.struck.push(v.id); land(f, v, m, events); }
        if (f.t >= secs(m.active)) { f.phase = 'recover'; f.t -= secs(m.active); }
      } else if (f.phase === 'recover' && f.t >= secs(m.recovery)) { f.phase = 'ready'; f.t = 0; f.move = null; if (f.side === 'creature') f.pause = RECOVER_PAUSE_S; }
    } else if (f.phase === 'stagger' && f.t >= f.hurtFor) { f.phase = 'ready'; f.t = 0; if (f.side === 'creature') f.pause = RECOVER_PAUSE_S; }
  }
  return { world: { time: world.time + dt, fighters }, events };
}
