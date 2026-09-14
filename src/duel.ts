import { bladeImpact, type HitLocation } from './blade.ts';
import { MOVES, RULES, total, type Direction, type MoveId, type Timing } from './moves.ts';
import { advance, initialState, TARGET, wrapAngle, type Input, type State } from './sim.ts';

// Symmetric 1v1 melee simulation. Both fighters obey the same rules through the same Intent; the AI is just another
// intent source. Pure and fixed at 60 Hz: no renderer, clock, randomness or browser state. Presentation observes results.
export type Phase = 'sheathed' | 'draw' | 'ready' | 'attack' | 'roll' | 'guard' | 'hurt' | 'dead';
export type Action = 'light' | 'light_left' | 'light_right' | 'heavy' | 'kick' | 'dodge' | 'parry';
export type Intent = {
  move: Input;                  // camera-relative stick/keys
  action: Action | null;        // edge-triggered request for this tick; one is buffered late in a committed action
  guard: boolean;               // level: guard button held
  guardDirection?: Direction;   // used only when RULES.directionalGuard is on
  lock: boolean;                // face the opponent while ready and during attack wind-up
  cancel?: boolean;             // input cancellation: drop any buffered action
};
export const idleIntent = (): Intent => ({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
export type Fighter = {
  body: State; health: number; stamina: number; rest: number; exhausted: boolean; wound: number; woundSite: HitLocation;
  phase: Phase; age: number; move: MoveId | null; chained: boolean; landed: boolean;
  chain: number; lastMove: MoveId | null; parryCooldown: number; punish: number; stun: number;
  guardDirection: Direction | null; parrying: boolean; exposed: number; buffer: { action: Action; ttl: number } | null;
};
export type Side = 0 | 1;
export type Finish = { victim: Side; location: HitLocation; move: MoveId; heading: number };
export type EventType = 'ActionStarted' | 'AttackStarted' | 'AttackActive' | 'AttackMissed' | 'Hit' | 'Blocked' | 'Parried' | 'GuardBroken' | 'Dodged' | 'Staggered' | 'StaminaExhausted' | 'Killed';
export type CombatEvent = { tick: number; type: EventType; actor: Side; target?: Side; move?: MoveId; action?: 'draw' | 'roll' | 'guard' | 'parry'; damage?: number; location?: HitLocation; heading?: number; ticks?: number };
export type Duel = { tick: number; fighters: [Fighter, Fighter]; finish: Finish | null; events: CombatEvent[] };

export const createFighter = (body: State, phase: Phase): Fighter => ({ body, health: 100, stamina: 100, rest: 0, exhausted: false, wound: 0, woundSite: 'torso', phase, age: 0, move: null, chained: false, landed: false, chain: 0, lastMove: null, parryCooldown: 0, punish: 0, stun: 0, guardDirection: null, parrying: false, exposed: 0, buffer: null });
export const initialDuel = (): Duel => ({ tick: 0, fighters: [createFighter(initialState(), 'sheathed'), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] });

export const aim = (from: State, to: State): number => Math.atan2(to.x - from.x, to.z - from.z);
export const distance = (a: State, b: State): number => Math.hypot(a.x - b.x, a.z - b.z);
export const timing = (f: Fighter): Timing => f.chained && f.move ? MOVES[f.move].chained! : MOVES[f.move!];
export const isLight = (action: Action | null): boolean => action === 'light' || action === 'light_left' || action === 'light_right';
// Ticks a committed phase lasts; null for phases that end on input.
export function phaseLength(f: Fighter): number | null {
  if (f.phase === 'draw') return RULES.draw;
  if (f.phase === 'attack') return total(timing(f));
  if (f.phase === 'roll') return RULES.roll;
  if (f.phase === 'hurt' || f.phase === 'dead') return f.stun;
  return null;
}
export function inBufferWindow(f: Fighter): boolean {
  const length = (f.phase === 'attack' || f.phase === 'draw') ? phaseLength(f)! : 0;
  return length > 0 && f.age >= length - RULES.bufferWindow;
}
export function chooseMove(f: Fighter, action: Action): MoveId {
  if (action === 'heavy') return 'heavy_overhead';
  if (action === 'kick') return 'kick';
  if (f.punish > 0) return 'riposte';
  if (action === 'light_left' || action === 'light_right') return action;
  return f.lastMove === 'light_right' ? 'light_left' : 'light_right';
}
// Whether a fighter may start `action` right now; the same test the HUD uses to show enabled controls.
export function legal(f: Fighter, action: Action): boolean {
  if (!f.health || f.exhausted) return false;
  if (isLight(action)) return f.phase === 'sheathed' || (f.phase === 'ready' && f.stamina >= MOVES[chooseMove(f, action)].stamina);
  if (action === 'heavy') return f.phase === 'ready' && f.stamina >= MOVES.heavy_overhead.stamina;
  if (action === 'kick') return (f.phase === 'ready' || f.phase === 'guard') && f.stamina >= MOVES.kick.stamina;
  if (action === 'dodge') return (f.phase === 'ready' || f.phase === 'guard') && f.stamina >= RULES.rollCost;
  return f.phase === 'ready' && !f.exposed;
}

export function stepDuel(duel: Duel, intents: [Intent, Intent], R: typeof RULES = RULES): Duel {
  const tick = duel.tick + 1, events: CombatEvent[] = [], before = duel.fighters;
  const fighters = before.map(f => ({ ...f, age: f.age + 1, wound: Math.max(0, f.wound - 1), chain: Math.max(0, f.chain - 1), parryCooldown: Math.max(0, f.parryCooldown - 1), punish: Math.max(0, f.punish - 1), rest: Math.max(0, f.rest - 1), exposed: Math.max(0, f.exposed - 1), buffer: f.buffer && f.buffer.ttl > 1 ? { ...f.buffer, ttl: f.buffer.ttl - 1 } : null })) as [Fighter, Fighter];
  if (!before[0].health || !before[1].health) return { tick, fighters, finish: duel.finish, events };
  const spend = (i: Side, cost: number) => {
    const f = fighters[i]; f.stamina = Math.max(0, f.stamina - cost); f.rest = R.regenDelay;
    if (!f.stamina && !f.exhausted) { f.exhausted = true; events.push({ tick, type: 'StaminaExhausted', actor: i }); }
  };
  // 1. Actions decide from the pre-tick state so neither fighter sees the other's move for this tick.
  for (const i of [0, 1] as const) {
    const me = before[i], foe = before[1 - i], intent = intents[i], next = fighters[i];
    if (intent.cancel) next.buffer = null;
    let action = intent.action;
    if (action && !legal(me, action)) { if (inBufferWindow(me)) next.buffer = { action, ttl: R.bufferTtl }; action = null; }
    if (!action && next.buffer && legal(me, next.buffer.action)) action = next.buffer.action;
    if (action) next.buffer = null;
    const face = (limit: number) => { if (intent.lock) next.body = { ...next.body, heading: next.body.heading + Math.max(-limit, Math.min(limit, wrapAngle(aim(next.body, foe.body) - next.body.heading))) }; };
    if (action === 'dodge') {
      // Direction locks at the press; without movement, roll away from the opponent.
      const moving = Math.hypot(intent.move.x, intent.move.z) > .1;
      next.body = { ...me.body, heading: moving ? advance(me.body, intent.move, foe.body).heading : aim(me.body, foe.body) + Math.PI };
      next.phase = 'roll'; next.age = 0; spend(i, R.rollCost); events.push({ tick, type: 'ActionStarted', actor: i, action: 'roll' });
    } else if (action === 'kick') {
      next.phase = 'attack'; next.age = 0; next.move = 'kick'; next.chained = false; next.landed = false; next.chain = 0; next.lastMove = 'kick'; spend(i, MOVES.kick.stamina);
      if (intent.lock) next.body = { ...me.body, heading: aim(me.body, foe.body) };
      events.push({ tick, type: 'AttackStarted', actor: i, move: 'kick' });
    } else if ((action === 'parry' || intent.guard) && me.phase === 'ready' && !me.exhausted && !me.exposed) {
      const fresh = action === 'parry' && !me.parryCooldown;
      next.phase = 'guard'; next.age = fresh ? 0 : R.parry; next.guardDirection = intent.guardDirection ?? null; next.parrying = fresh;
      if (fresh) next.parryCooldown = R.parryCooldown;
      events.push({ tick, type: 'ActionStarted', actor: i, action: fresh ? 'parry' : 'guard' });
    } else if (isLight(action) || action === 'heavy') {
      if (me.phase === 'sheathed') { next.phase = 'draw'; next.age = 0; events.push({ tick, type: 'ActionStarted', actor: i, action: 'draw' }); }
      else {
        const id = chooseMove(me, action!), def = MOVES[id];
        next.chained = !!def.chained && me.chain > 0 && me.lastMove !== null && !!MOVES[me.lastMove].chain?.follow.includes(id);
        next.phase = 'attack'; next.age = 0; next.move = id; next.landed = false; next.chain = 0; next.lastMove = id; next.punish = 0; spend(i, def.stamina);
        events.push({ tick, type: 'AttackStarted', actor: i, move: id });
      }
      face(R.turnStart);
    }
  }
  // 2. Committed phases expire, then movement resolves in index order against the other body.
  for (const i of [0, 1] as const) {
    const next = fighters[i], intent = intents[i], foe = fighters[1 - i].body, length = phaseLength(next);
    // A parry attempt that met nothing may leave the fighter exposed (R.parryRecovery ticks, 0 = off); a punish window proves it connected.
    if (next.phase === 'guard' && next.age >= R.parry && next.parrying) { next.parrying = false; if (R.parryRecovery > 0 && !next.punish) { next.phase = 'ready'; next.age = 0; next.exposed = R.parryRecovery; } }
    if ((length !== null && next.age >= length && next.phase !== 'dead') || (next.phase === 'guard' && !intent.guard && next.age >= R.parry)) {
      if (next.phase === 'attack' && !next.chained && next.move && MOVES[next.move].chain) next.chain = MOVES[next.move].chain!.window;
      next.phase = 'ready'; next.age = 0; next.guardDirection = null; next.parrying = false;
    }
    if (next.phase === 'attack' && next.move && next.age < timing(next).windup) {
      // Wind-up: controlled turning toward the opponent and the move's lunge; a kick lunges too, so a backstep cannot walk out of a point-blank kick.
      if (intent.lock && next.move !== 'kick') next.body = { ...next.body, heading: next.body.heading + Math.max(-R.turnWindup, Math.min(R.turnWindup, wrapAngle(aim(next.body, foe) - next.body.heading))) };
      const lunge = MOVES[next.move].stepIn;
      if (lunge && next.age > R.stepInFrom) next.body = advance(next.body, { x: Math.sin(next.body.heading) * lunge, z: Math.cos(next.body.heading) * lunge, yaw: 0, run: false }, foe);
    } else if (next.phase === 'roll') {
      next.body = advance(next.body, { x: Math.sin(next.body.heading), z: Math.cos(next.body.heading), yaw: 0, run: true }, foe);
    } else if (next.phase === 'ready' || next.phase === 'sheathed' || next.phase === 'guard') {
      const guarding = next.phase === 'guard', scale = (guarding ? R.guardSpeed : 1) * (next.exhausted ? R.exhaustedSpeed : 1), run = !guarding && !next.exhausted && intent.move.run && next.stamina > 0;
      const moved = advance(next.body, { x: intent.move.x * scale, z: intent.move.z * scale, yaw: intent.move.yaw, run }, foe);
      if (run && moved.distance > next.body.distance) spend(i, R.sprintCost);
      next.body = moved;
      if (intent.lock && next.phase !== 'sheathed' && !intent.move.run) next.body = { ...next.body, heading: aim(next.body, foe) };
    }
    if (!next.rest && (next.phase === 'ready' || next.phase === 'sheathed')) next.stamina = Math.min(100, next.stamina + R.regen * (next.wound ? R.woundRegen : 1));
    if (next.exhausted && next.stamina >= R.exhaustRecover) next.exhausted = false;
  }
  // 3. Contacts resolve simultaneously against a snapshot, so a trade lands both blows and neither side is favoured by order.
  const snapshot = [{ ...fighters[0] }, { ...fighters[1] }] as const;
  let finish = duel.finish;
  for (const i of [0, 1] as const) {
    const j = (1 - i) as Side, a = snapshot[i], d = snapshot[j], A = fighters[i], D = fighters[j];
    if (a.phase !== 'attack' || a.landed || !a.move) continue;
    const def = MOVES[a.move], t = timing(a), pathId = a.chained ? def.chainPath : def.path;
    if (a.age === t.windup) events.push({ tick, type: 'AttackActive', actor: i, move: a.move });
    let location: HitLocation | null = null;
    if (pathId) {
      if (a.age < t.windup || a.age >= t.windup + t.active) continue;
      location = bladeImpact(pathId, a.age - 1, a.age, before[i].body, a.body, before[j].body, d.body);
      if (!location && a.age === t.windup + t.active - 1) events.push({ tick, type: 'AttackMissed', actor: i, move: a.move });
    } else {
      if (a.age !== t.windup) continue;
      if (distance(a.body, d.body) <= def.reach && Math.abs(wrapAngle(aim(a.body, d.body) - a.body.heading)) < R.kickArc) location = 'torso';
      else events.push({ tick, type: 'AttackMissed', actor: i, move: a.move });
    }
    if (!location) continue;
    A.landed = true;
    const facing = Math.abs(wrapAngle(aim(d.body, a.body) - d.body.heading)) <= R.guardArc;
    const guarding = d.phase === 'guard' && facing && (!R.directionalGuard || !d.guardDirection || d.guardDirection === def.direction);
    const stagger = (ticks: number) => {
      D.phase = D.health ? 'hurt' : 'dead'; D.age = 0; D.stun = D.health ? ticks : R.death; D.buffer = null;
      events.push({ tick, type: 'Staggered', actor: j, ticks: D.stun });
    };
    const wound = (damage: number, knockback: number) => {
      D.health = Math.max(0, D.health - damage);
      if (def.path) { D.wound = R.wound; D.woundSite = location!; }
      const away = aim(d.body, a.body) + Math.PI;
      for (let k = 0; k < knockback; k++) D.body = { ...advance(D.body, { x: Math.sin(away), z: Math.cos(away), yaw: 0, run: false }, A.body), heading: D.body.heading };
      if (!D.health) { finish = { victim: j, location: location!, move: a.move!, heading: a.body.heading }; events.push({ tick, type: 'Killed', actor: i, target: j, move: a.move!, location: location!, heading: a.body.heading }); }
    };
    if (d.phase === 'roll' && d.age >= R.safeStart && d.age <= R.safeEnd) events.push({ tick, type: 'Dodged', actor: j, target: i, move: a.move });
    else if (guarding && d.age < R.parry && def.parryable) {
      A.phase = 'hurt'; A.age = 0; A.stun = R.parryStun; A.buffer = null; D.punish = R.parryStun;
      events.push({ tick, type: 'Parried', actor: j, target: i, move: a.move }, { tick, type: 'Staggered', actor: i, ticks: R.parryStun });
    } else if (guarding && def.vsGuard) {
      spend(j, def.vsGuard.staminaDamage); wound(def.damage, def.knockback); events.push({ tick, type: 'Hit', actor: i, target: j, move: a.move, damage: def.damage, location, heading: a.body.heading }); stagger(def.vsGuard.stagger);
    } else if (guarding && !def.breaksGuard && d.stamina >= def.staminaDamage) {
      spend(j, def.staminaDamage); events.push({ tick, type: 'Blocked', actor: j, target: i, move: a.move });
    } else {
      const damage = Math.round(def.damage * R.location[location]);
      if (guarding) { spend(j, d.stamina); wound(damage, def.knockback); events.push({ tick, type: 'GuardBroken', actor: j, target: i, move: a.move, damage, location, heading: a.body.heading }); stagger(def.stagger); }
      else {
        const poised = d.phase === 'attack' && d.move !== null && MOVES[d.move].poise >= def.stagger && d.age >= MOVES[d.move].poiseFrom && d.age < timing(d).windup + timing(d).active;
        if (!def.path) spend(j, def.staminaDamage);
        wound(damage, poised ? 0 : def.knockback); events.push({ tick, type: 'Hit', actor: i, target: j, move: a.move, damage, location, heading: a.body.heading });
        if (!poised || !D.health) stagger(def.stagger);
      }
    }
  }
  return { tick, fighters, finish, events };
}

export const pathFor = (f: Fighter) => f.move && f.move !== 'kick' ? (f.chained ? MOVES[f.move].chainPath : MOVES[f.move].path) : null;
