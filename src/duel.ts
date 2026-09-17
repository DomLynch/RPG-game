import { bladeImpact, type HitLocation } from './blade.ts';
import { OPPONENTS, RULES, total, weaponOf, type Direction, type GuardProfile, type Material, type MoveId, type Opponent, type Timing, type WeaponId } from './moves.ts';
import { advance, initialState, RADIUS, TARGET, wrapAngle, type Input, type State } from './sim.ts';

// Symmetric 1v1 melee simulation. Both fighters obey the same rules through the same Intent; the AI is just another
// intent source. Pure and fixed at 60 Hz: no renderer, clock, randomness or browser state. Presentation observes results.
export type Phase = 'sheathed' | 'draw' | 'ready' | 'attack' | 'roll' | 'backstep' | 'guard' | 'hurt' | 'dead';
export type Action = 'light' | 'light_left' | 'light_right' | 'heavy' | 'thrust' | 'kick' | 'dodge' | 'backstep' | 'parry';
export type Intent = {
  move: Input;                  // camera-relative stick/keys
  action: Action | null;        // edge-triggered request for this tick; one is buffered late in a committed action
  guard: boolean;               // level: guard button held
  held?: boolean;               // level: the attack control is still held (a chambered swing waits; a charging one charges)
  guardDirection?: Direction;   // used only when RULES.directionalGuard is on
  lock: boolean;                // face the opponent while ready and during attack wind-up
  cancel?: boolean;             // input cancellation: drop any buffered action
};
export const idleIntent = (): Intent => ({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
export type Fighter = {
  body: State; health: number; stamina: number; rest: number; exhausted: boolean; wound: number; woundSite: HitLocation;
  phase: Phase; age: number; move: MoveId | null; chained: boolean; landed: boolean;
  chain: number; lastMove: MoveId | null; parryCooldown: number; punish: number; stun: number;
  posture: number; critical: number;   // posture 0..RULES.posture.max; critical = ticks left in which Heavy is the critical on a broken opponent
  guardDirection: Direction | null; parrying: boolean; exposed: number; evaded: number; counterWindow: number; charge: number; charged: boolean; buffer: { action: Action; ttl: number } | null;
  guardProfile?: Partial<GuardProfile>;   // shield/loadout overrides; absent = the longsword defaults in RULES
  postureRest: number;   // ticks left before posture drains again (a gain pauses the drain)
  maxStamina: number; legWound: boolean;   // attrition: the bar's ceiling for this duel, and a slowing leg wound
  attackFrom: { x: number; z: number; gap: number } | null;   // where the current attack started and the gap then: a target that walked in since is walking onto the point
  weapon: WeaponId;   // the tables this fighter fights with (moves, blade paths, guard kind, material): see moves.ts `WEAPONS`
  stall: number;   // ticks the current attack's clock stands still (a thrust that met nothing hangs at full extension)
  maxHealth: number;   // the bar's ceiling (moves.ts `Opponent.health`; RULES.health for a man)
  scale: number;   // body scale: the hit capsule and its head/torso/legs regions the opponent's blade sweeps (moves.ts `Opponent`)
  regen: number;   // stamina regeneration multiplier (moves.ts `Opponent.regen`; 1 = a man)
  speed: number;   // pace multiplier: walking, sprinting, the wind-up lunge and the backstep (moves.ts `Opponent.speed`; 1 = a man)
  poise: number;   // a plain clean hit dealing less than this never staggers this fighter (moves.ts `Opponent`); 0 = human
};
export type Side = 0 | 1;
export type Finish = { victim: Side; location: HitLocation; move: MoveId; heading: number; draw?: boolean };   // draw: both fell on the same tick (victim is then the first processed)
export type EventType = 'ActionStarted' | 'AttackStarted' | 'Charging' | 'Charged' | 'AttackActive' | 'AttackMissed' | 'Hit' | 'Blocked' | 'Parried' | 'GuardBroken' | 'PostureBroken' | 'Dodged' | 'Staggered' | 'StaminaExhausted' | 'Killed';
// Event sides: a blow that lands (Hit, GuardBroken, Killed) names the attacker as `actor` and the one struck as `target`; a defence that
// succeeds (Blocked, Parried, Dodged) names the defender as `actor` and the attacker as `target`.
export type CombatEvent = { tick: number; type: EventType; actor: Side; target?: Side; move?: MoveId; action?: 'draw' | 'roll' | 'backstep' | 'guard' | 'parry' | 'feint'; damage?: number; stamina?: number; perfect?: boolean; counter?: boolean; rear?: boolean; charged?: boolean; stop?: boolean; trip?: boolean; walled?: boolean; weapon?: WeaponId; material?: Material; location?: HitLocation; heading?: number; ticks?: number; posture?: number };
export type Duel = { tick: number; fighters: [Fighter, Fighter]; finish: Finish | null; events: CombatEvent[] };

// Every move / path lookup for a fighter goes through its weapon.
export const movesOf = (f: Pick<Fighter, 'weapon'>) => weaponOf(f.weapon).moves;
export const createFighter = (body: State, phase: Phase, weapon: WeaponId = 'longsword', scale = 1, poise = 0, health: number = RULES.health, guard?: Partial<GuardProfile>, regen = 1, speed = 1): Fighter => ({ weapon, ...(weaponOf(weapon).guardProfile || guard ? { guardProfile: { ...weaponOf(weapon).guardProfile, ...guard } } : {}), scale, poise, regen, speed, body, health, maxHealth: health, stamina: 100, rest: 0, exhausted: false, wound: 0, woundSite: 'torso', phase, age: 0, move: null, chained: false, landed: false, chain: 0, lastMove: null, parryCooldown: 0, punish: 0, stun: 0, posture: 0, critical: 0, guardDirection: null, parrying: false, exposed: 0, evaded: 0, counterWindow: 0, charge: 0, charged: false, buffer: null, postureRest: 0, maxStamina: 100, legWound: false, attackFrom: null, stall: 0 });
// An opponent's fighter from his data (moves.ts `Opponent`): the one place his weapon, scale, poise, health, guard, regen and pace are read.
export const opponentFighter = (o: Opponent, body: State, phase: Phase = 'ready'): Fighter => createFighter(body, phase, o.weapon, o.scale, o.poise, o.health, o.guard, o.regen ?? 1, o.speed ?? 1);
export const initialDuel = (opponent: Opponent = OPPONENTS.veteran): Duel => ({ tick: 0, fighters: [createFighter(initialState(), 'sheathed'), opponentFighter(opponent, { ...TARGET, heading: 0, distance: 0 })], finish: null, events: [] });

export const aim = (from: State, to: State): number => Math.atan2(to.x - from.x, to.z - from.z);
export const distance = (a: State, b: State): number => Math.hypot(a.x - b.x, a.z - b.z);
// At the ring wall with the given direction pointing out of the ring: the wall is behind a step that way.
export const walled = (body: State, dx: number, dz: number): boolean => Math.hypot(body.x, body.z) >= RADIUS - RULES.wall.edge && body.x * dx + body.z * dz > 0;
// Ticks since the current phase began. `age` is the animation clock (a chambered swing rewinds it); `charge` counts the parked ticks,
// so age + charge is monotonic elapsed time — what perception and reaction delays must read.
export const elapsed = (f: Fighter): number => f.age + f.charge;
export const timing = (f: Fighter): Timing => f.chained && f.move ? movesOf(f)[f.move].chained! : movesOf(f)[f.move!];
const isLight = (action: Action | null): boolean => action === 'light' || action === 'light_left' || action === 'light_right';
export const guardOf = (f: Fighter, R: typeof RULES = RULES): GuardProfile => ({ costScale: 1, arc: R.guardArc, window: R.parry, recovery: R.parryRecovery, commits: false, stopsHeavy: false, heavyBreaks: false, ...f.guardProfile });
// A swing may be feinted (cancelled into a fresh guard) only in its first ticks and only for a price.
export const feintable = (f: Fighter, R: typeof RULES = RULES): boolean => f.phase === 'attack' && f.move !== null && f.age < movesOf(f)[f.move].feintUntil && f.stamina >= R.feintCost;
// Ticks a committed phase lasts; null for phases that end on input.
function phaseLength(f: Fighter): number | null {
  if (f.phase === 'draw') return RULES.draw;
  if (f.phase === 'attack') return total(timing(f));
  if (f.phase === 'roll') return RULES.roll;
  if (f.phase === 'backstep') return RULES.backstep.ticks;
  if (f.phase === 'hurt' || f.phase === 'dead') return f.stun;
  return null;
}
// The tail of every committed phase accepts one queued action, so a press as you come out of a swing, a draw, a roll or a
// stagger is never lost. Death has no tail.
export function inBufferWindow(f: Fighter): boolean {
  const length = f.phase === 'dead' ? null : phaseLength(f);
  return length !== null && f.age >= length - RULES.bufferWindow;
}
function chooseMove(f: Fighter, action: Action): MoveId {
  if (action === 'heavy') return f.critical > 0 ? 'critical' : f.punish > 0 ? 'heavy_riposte' : f.counterWindow > 0 ? 'heavy_counter' : 'heavy_overhead';
  if (action === 'kick') return 'kick';
  if (f.punish > 0) return 'riposte';
  if (action === 'thrust') return 'thrust';
  if (action === 'light_left' || action === 'light_right') return action;
  return f.lastMove === 'light_right' ? 'light_left' : 'light_right';
}
// Whether a fighter may start `action` right now; the same test the HUD uses to show enabled controls.
export function legal(f: Fighter, action: Action): boolean {
  if (!f.health || f.exhausted) return false;
  // A committing parry (the Nightborn's, guard.commits) runs its window, and the exposure it ends in when it met nothing is a real recovery —
  // the blade is out of line — so no swing comes out of either. A man's parry yields to any action and his exposure only bares his guard.
  const g = guardOf(f), committed = g.commits && ((f.phase === 'guard' && f.parrying && !f.punish && f.age < g.window) || (f.phase === 'ready' && f.exposed > 0));
  const standing = (f.phase === 'ready' || f.phase === 'guard') && !committed;   // a guard yields to any action; it never eats an input
  const stepping = f.phase === 'backstep', stepTail = stepping && f.age >= RULES.backstep.cancelFrom;   // a backstep's tail cancels into a swing
  if (isLight(action)) return f.phase === 'sheathed' || ((standing || stepTail) && f.stamina >= movesOf(f)[chooseMove(f, action)].stamina);
  if (action === 'heavy' || action === 'thrust') return (standing || stepTail) && f.stamina >= movesOf(f)[chooseMove(f, action)].stamina;
  if (action === 'kick') return standing && f.stamina >= movesOf(f).kick.stamina;
  if (action === 'dodge') return (standing && f.stamina >= RULES.rollCost) || (stepping && f.stamina >= RULES.rollCost - RULES.backstep.cost);   // holding the control turns the step into a roll
  if (action === 'backstep') return standing && f.stamina >= RULES.backstep.cost;
  return (f.phase === 'ready' && !f.exposed) || feintable(f);
}

// Every attack starts through one door: the transient modifiers of the previous action (charge, punish/critical windows, guard
// counter, parry state) are reset here and nowhere else, so no swing inherits the last one's bonuses.
function beginAttack(f: Fighter, id: MoveId, chained: boolean, foe: State): void {
  f.phase = 'attack'; f.age = 0; f.move = id; f.chained = chained; f.landed = false; f.chain = 0; f.lastMove = id; f.attackFrom = { x: f.body.x, z: f.body.z, gap: distance(f.body, foe) }; f.stall = 0;
  f.punish = 0; f.critical = 0; f.counterWindow = 0; f.charge = 0; f.charged = false; f.parrying = false; f.guardDirection = null;
}
export function stepDuel(duel: Duel, intents: [Intent, Intent], R: typeof RULES = RULES): Duel {
  const tick = duel.tick + 1, events: CombatEvent[] = [], before = duel.fighters;
  const fighters = before.map(f => ({ ...f, age: f.stall > 0 ? f.age : f.age + 1, stall: Math.max(0, f.stall - 1), wound: Math.max(0, f.wound - 1), chain: Math.max(0, f.chain - 1), parryCooldown: Math.max(0, f.parryCooldown - 1), punish: Math.max(0, f.punish - 1), critical: Math.max(0, f.critical - 1), posture: f.phase === 'hurt' || f.phase === 'dead' || f.postureRest > 0 ? f.posture : Math.max(0, f.posture - R.posture.decay), postureRest: Math.max(0, f.postureRest - 1), rest: Math.max(0, f.rest - 1), exposed: Math.max(0, f.exposed - 1), evaded: Math.max(0, f.evaded - 1), counterWindow: Math.max(0, f.counterWindow - 1), buffer: f.buffer && f.buffer.ttl > 1 ? { ...f.buffer, ttl: f.buffer.ttl - 1 } : null })) as [Fighter, Fighter];
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
      // Direction locks at the press; without movement, roll away from the opponent. A roll grown out of a backstep pays the difference.
      const moving = Math.hypot(intent.move.x, intent.move.z) > .1;
      next.body = { ...me.body, heading: moving ? advance(me.body, intent.move, foe.body).heading : aim(me.body, foe.body) + Math.PI };
      next.phase = 'roll'; next.age = 0; spend(i, me.phase === 'backstep' ? R.rollCost - R.backstep.cost : R.rollCost); events.push({ tick, type: 'ActionStarted', actor: i, action: 'roll' });
    } else if (action === 'backstep' && walled(me.body, -Math.sin(me.body.heading), -Math.cos(me.body.heading))) {
      // Cornered: the wall is at the back, there is nowhere to step. The press is simply refused (a roll still works).
    } else if (action === 'backstep') {
      next.phase = 'backstep'; next.age = 0; next.parrying = false; next.guardDirection = null; spend(i, R.backstep.cost); events.push({ tick, type: 'ActionStarted', actor: i, action: 'backstep' });
    } else if (action === 'kick') {
      beginAttack(next, 'kick', false, foe.body); spend(i, movesOf(next).kick.stamina);
      if (intent.lock) next.body = { ...me.body, heading: aim(me.body, foe.body) };
      events.push({ tick, type: 'AttackStarted', actor: i, move: 'kick' });
    } else if (isLight(action) || action === 'heavy' || action === 'thrust') {
      if (me.phase === 'sheathed') { next.phase = 'draw'; next.age = 0; events.push({ tick, type: 'ActionStarted', actor: i, action: 'draw' }); }
      else {
        const id = chooseMove(me, action!), def = movesOf(me)[id];
        // Chained timing: a listed follow-up inside the chain window, or a light out of an evade (dodge-attack).
        const follows = me.chain > 0 && me.lastMove !== null && !!movesOf(me)[me.lastMove].chain?.follow.includes(id);
        beginAttack(next, id, !!def.chained && (follows || (isLight(action) && (me.evaded > 0 || me.phase === 'backstep'))), foe.body); spend(i, def.stamina);
        events.push({ tick, type: 'AttackStarted', actor: i, move: id });
      }
      face(R.turnStart);
    } else if (action === 'parry' && feintable(me, R)) {
      // Feint: the swing already paid for is abandoned into a guard; a fresh press still opens its parry window.
      const fresh = !me.parryCooldown;
      next.phase = 'guard'; next.age = fresh ? 0 : guardOf(me, R).window; next.move = null; next.guardDirection = intent.guardDirection ?? null; next.parrying = fresh; spend(i, R.feintCost);
      if (fresh) next.parryCooldown = R.parryCooldown;
      events.push({ tick, type: 'ActionStarted', actor: i, action: 'feint' });
    } else if ((action === 'parry' || intent.guard) && me.phase === 'ready' && !me.exhausted && !me.exposed) {
      const fresh = action === 'parry' && !me.parryCooldown;
      next.phase = 'guard'; next.age = fresh ? 0 : guardOf(me, R).window; next.guardDirection = intent.guardDirection ?? null; next.parrying = fresh;
      if (fresh) next.parryCooldown = R.parryCooldown;
      events.push({ tick, type: 'ActionStarted', actor: i, action: fresh ? 'parry' : 'guard' });
    }
  }
  // 2. Committed phases expire, then movement resolves — both against the other body as it stood at the start of the tick, so
  // neither index is privileged; any overlap that produces is split evenly afterwards.
  for (const i of [0, 1] as const) {
    const next = fighters[i], intent = intents[i], foe = before[1 - i].body, length = phaseLength(next), { window, recovery, commits } = guardOf(next, R);
    // A parry attempt that met nothing: a *released* tap leaves the fighter exposed for the guard's `recovery` ticks (R.parryRecovery unless the man's guard says otherwise; 0 = off); a guard still
    // *held* when the window closes simply becomes the standing guard (its first perfectBlock ticks are the perfect block). Holding Guard
    // therefore always guards — the only gamble in a parry is the tap. A punish window proves the parry connected. A committing parry
    // (guard.commits) has no such refuge: met nothing, it ends exposed whether or not the guard is held.
    if (next.phase === 'guard' && next.age >= window && next.parrying) { next.parrying = false; if (recovery > 0 && !next.punish && (!intent.guard || commits)) { next.phase = 'ready'; next.age = 0; next.exposed = recovery; } }
    if ((length !== null && next.age >= length && next.phase !== 'dead') || (next.phase === 'guard' && !intent.guard && next.age >= window)) {
      if (next.phase === 'attack' && !next.chained && next.move && movesOf(next)[next.move].chain) next.chain = movesOf(next)[next.move].chain!.window;
      if (next.phase === 'roll' || next.phase === 'backstep') next.evaded = R.dodgeAttackWindow;
      next.phase = 'ready'; next.age = 0; next.guardDirection = null; next.parrying = false;
    }
    // Chamber: a held swing pauses at its chamber tick (age is rewound each tick) until release or the maximum; a charging move held long enough becomes the charged swing.
    const chamber = next.phase === 'attack' && next.move !== null && !next.chained ? movesOf(next)[next.move].chamber : null;
    let parked = false;
    if (chamber !== null && next.age === chamber + 1 && intents[i].held && next.charge < R.charge.max) {
      next.age = chamber; next.charge++; parked = true;
      if (next.charge === 1) events.push({ tick, type: 'Charging', actor: i, move: next.move! });
      if (movesOf(next)[next.move!].charges && next.charge === R.charge.min) { next.charged = true; events.push({ tick, type: 'Charged', actor: i, move: next.move! }); }
    }
    if (next.phase === 'attack' && next.move && next.age < timing(next).windup) {
      // Wind-up: controlled turning toward the opponent and the move's lunge; a kick lunges too, so a backstep cannot walk out of a point-blank kick.
      if (intent.lock && next.move !== 'kick') next.body = { ...next.body, heading: next.body.heading + Math.max(-R.turnWindup, Math.min(R.turnWindup, wrapAngle(aim(next.body, foe) - next.body.heading))) };
      const lunge = movesOf(next)[next.move].stepIn;
      // A parked swing does not keep lunging: the lunge belongs to the wind-up, and the wind-up is paused.
      if (lunge && next.age > R.stepInFrom && !parked) next.body = advance(next.body, { x: Math.sin(next.body.heading) * lunge, z: Math.cos(next.body.heading) * lunge, yaw: 0, run: false }, foe, next.speed);
    } else if (next.phase === 'roll') {
      next.body = advance(next.body, { x: Math.sin(next.body.heading), z: Math.cos(next.body.heading), yaw: 0, run: true }, foe, next.speed);
    } else if (next.phase === 'backstep') {
      // Straight back along the facing, still facing the opponent: no turn, no invulnerability, just distance.
      next.body = { ...advance(next.body, { x: -Math.sin(next.body.heading) * R.backstep.speed, z: -Math.cos(next.body.heading) * R.backstep.speed, yaw: 0, run: false }, foe, next.speed), heading: next.body.heading };
    } else if (next.phase === 'ready' || next.phase === 'sheathed' || next.phase === 'guard') {
      const guarding = next.phase === 'guard', scale = (guarding ? R.guardSpeed : 1) * (next.exhausted ? R.exhaustedSpeed : 1) * (next.legWound ? R.attrition.legSpeed : 1), run = !guarding && !next.exhausted && intent.move.run && next.stamina > 0;
      const moved = advance(next.body, { x: intent.move.x * scale, z: intent.move.z * scale, yaw: intent.move.yaw, run }, foe, next.speed);
      // Sprinting drains without the action delay: no regeneration on a sprinting tick, and it resumes the tick the sprint stops (an action's
      // regenDelay is for actions; a sprint that reset it every tick starved the bar for a second after every dash).
      if (run && moved.distance > next.body.distance) { next.stamina = Math.max(0, next.stamina - R.sprintCost); next.rest = Math.max(next.rest, 1); if (!next.stamina && !next.exhausted) { next.exhausted = true; events.push({ tick, type: 'StaminaExhausted', actor: i }); } }
      next.body = moved;
      if (intent.lock && next.phase !== 'sheathed' && !intent.move.run) next.body = { ...next.body, heading: aim(next.body, foe) };
    }
    // Regeneration: full while standing ready; a raised guard regenerates at half rate (it used to stop it, which made blocking a stamina trap).
    if (!next.rest && (next.phase === 'ready' || next.phase === 'sheathed' || next.phase === 'guard')) next.stamina = Math.min(next.maxStamina, next.stamina + R.regen * next.regen * (next.wound ? R.woundRegen : 1) * (next.phase === 'guard' ? R.guardRegen : 1));
    if (next.exhausted && next.stamina >= R.exhaustRecover) next.exhausted = false;
  }
  // Symmetric separation: both may have stepped into the other's old position; push them apart by equal halves.
  {
    const [p, q] = [fighters[0].body, fighters[1].body], dx = q.x - p.x, dz = q.z - p.z, gap = Math.hypot(dx, dz);
    if (gap < .85 - 1e-8) {
      const push = (.85 - gap) / 2, ux = gap > 1e-8 ? dx / gap : Math.sin(p.heading), uz = gap > 1e-8 ? dz / gap : Math.cos(p.heading);
      const clamp = (x: number, z: number) => { const r = Math.hypot(x, z); return r > RADIUS ? { x: x * RADIUS / r, z: z * RADIUS / r } : { x, z }; };
      fighters[0].body = { ...p, ...clamp(p.x - ux * push, p.z - uz * push) }; fighters[1].body = { ...q, ...clamp(q.x + ux * push, q.z + uz * push) };
    }
  }
  // 3. Contacts resolve simultaneously against a snapshot, so a trade lands both blows and neither side is favoured by order.
  const snapshot = [{ ...fighters[0] }, { ...fighters[1] }] as const;
  let finish = duel.finish;
  for (const i of [0, 1] as const) {
    const j = (1 - i) as Side, a = snapshot[i], d = snapshot[j], A = fighters[i], D = fighters[j];
    if (a.phase !== 'attack' || a.landed || !a.move) continue;
    const def = movesOf(a)[a.move], t = timing(a), pathId = a.chained ? def.chainPath : def.path, charged = a.charged, weapon = weaponOf(a.weapon);
    if (a.age === t.windup) events.push({ tick, type: 'AttackActive', actor: i, move: a.move });
    let location: HitLocation | null = null;
    if (pathId) {
      if (a.age < t.windup || a.age >= t.windup + t.active) continue;
      // A thrust started inside a pole's minimum reach drives the point past the target: it meets nothing (the sweep and the kick have no such hole).
      // Judged from where it started: the lunge closes any gap to touching, so the gap at contact says nothing about where the point went.
      location = a.attackFrom !== null && a.attackFrom.gap < (def.minReach ?? 0) ? null : bladeImpact(a.weapon, pathId, a.age - 1, a.age, before[i].body, a.body, before[j].body, d.body, d.scale);
      // A miss is reported once, as the window closes. A thrust that meets nothing overextends: its clock hangs at full extension for `whiff` ticks
      // (the window-closing tick repeats while stalled, so the report is keyed on the stall not having started).
      if (!location && a.age === t.windup + t.active - 1 && before[i].stall === 0) { events.push({ tick, type: 'AttackMissed', actor: i, move: a.move }); if (a.move === 'thrust') A.stall = R.stopHit.whiff; }
    } else {
      if (a.age !== t.windup) continue;
      if (distance(a.body, d.body) <= def.reach && Math.abs(wrapAngle(aim(a.body, d.body) - a.body.heading)) < R.kickArc) location = 'torso';
      else events.push({ tick, type: 'AttackMissed', actor: i, move: a.move });
    }
    if (!location) continue;
    A.landed = true;
    const g = guardOf(d, R), facing = Math.abs(wrapAngle(aim(d.body, a.body) - d.body.heading)) <= g.arc;
    const guarding = d.phase === 'guard' && facing && (!R.directionalGuard || !d.guardDirection || d.guardDirection === def.direction);
    const breaks = (def.breaksGuard || charged || (g.heavyBreaks && def.direction === 'overhead')) && !g.stopsHeavy, blockCost = def.staminaDamage * g.costScale;
    const stagger = (ticks: number) => {
      const wall = walledHit ? R.wall.stagger : 0;
      D.phase = D.health ? 'hurt' : 'dead'; D.age = 0; D.stun = D.health ? ticks + wall : R.death; D.buffer = null; D.counterWindow = 0;
      events.push({ tick, type: 'Staggered', actor: j, ticks: D.stun, ...(walledHit ? { walled: true } : {}) });
      if (walledHit) shake(j, R.wall.posture);
    };
    // Posture: `amount` on the target; at the maximum the target's posture breaks — a long stagger and a critical window for the other side.
    const shake = (target: Side, amount: number) => {
      const T = fighters[target], O = fighters[1 - target];
      if (!T.health || amount <= 0) return;
      T.posture = Math.min(R.posture.max, T.posture + amount); T.postureRest = R.posture.hold;
      if (T.posture < R.posture.max) return;
      T.posture = 0; T.phase = 'hurt'; T.age = 0; T.stun = Math.max(T.stun, R.posture.stun); T.buffer = null; T.counterWindow = 0; T.charge = 0; T.charged = false;
      O.punish = R.posture.stun; O.critical = R.posture.stun;
      events.push({ tick, type: 'PostureBroken', actor: (1 - target) as Side, target, ticks: R.posture.stun });
    };
    let walledHit = false;
    const wound = (damage: number, knockback: number, mark = !!def.path) => {
      D.health = Math.max(0, D.health - damage);
      if (mark) {
        D.wound = R.wound; D.woundSite = location!;
        // Attrition: a blade wound costs part of the bar's ceiling for the rest of the duel; a leg wound slows the walk.
        D.maxStamina = Math.max(R.attrition.floor, D.maxStamina - R.attrition.stamina); D.stamina = Math.min(D.stamina, D.maxStamina);
        if (location === 'legs') D.legWound = true;
      }
      const away = aim(d.body, a.body) + Math.PI;
      for (let k = 0; k < knockback; k++) D.body = { ...advance(D.body, { x: Math.sin(away), z: Math.cos(away), yaw: 0, run: false }, A.body), heading: D.body.heading };
      // The ring wall: knockback that ends against the wall is a second impact — extra stagger and posture (kicks shove; see stagger()).
      walledHit = knockback > 0 && D.health > 0 && walled(D.body, Math.sin(away), Math.cos(away));
      if (!D.health) { finish = finish ? { ...finish, draw: true } : { victim: j, location: location!, move: a.move!, heading: a.body.heading }; events.push({ tick, type: 'Killed', actor: i, target: j, move: a.move!, location: location!, heading: a.body.heading }); }
    };
    // A low blade (the sweep) trips a roll in its first half: the roller is going down into it. The kick has no blade and is rolled as before.
    const trip = d.phase === 'roll' && def.direction === 'low' && def.path !== null && d.age < R.roll / 2;
    if (d.phase === 'roll' && d.age >= R.safeStart && d.age <= R.safeEnd && !trip) events.push({ tick, type: 'Dodged', actor: j, target: i, move: a.move });
    else if (guarding && d.age < g.window && def.parryable) {
      A.phase = 'hurt'; A.age = 0; A.stun = R.parryStun; A.buffer = null; D.punish = R.parryStun;
      events.push({ tick, type: 'Parried', actor: j, target: i, move: a.move, weapon: weapon.id, material: weapon.material }, { tick, type: 'Staggered', actor: i, ticks: R.parryStun });
      shake(i, R.posture.parry);
    } else if (guarding && def.vsGuard) {
      spend(j, def.vsGuard.staminaDamage); wound(def.damage, def.knockback); events.push({ tick, type: 'Hit', actor: i, target: j, move: a.move, damage: def.damage, location, heading: a.body.heading, weapon: weapon.id, material: weapon.material }); stagger(def.vsGuard.stagger); shake(j, def.posture);
    } else if (guarding && !breaks && d.stamina >= (d.age - g.window < R.perfectBlock ? blockCost * R.perfectBlockCost : blockCost)) {
      // A guard raised just in time (its first perfectBlock ticks as a block, never a parry window) pays half and stops the chip; the
      // discounted price is what has to be affordable.
      const perfect = d.age - g.window < R.perfectBlock, cost = perfect ? blockCost * R.perfectBlockCost : blockCost, chip = perfect ? 0 : Math.round(def.damage * def.chip * R.location[location]);
      spend(j, cost); D.counterWindow = R.guardCounter;   // a block opens the guard-counter window
      events.push({ tick, type: 'Blocked', actor: j, target: i, move: a.move, stamina: cost, perfect, weapon: weapon.id, material: weapon.material, ...(chip ? { damage: chip } : {}) });
      if (chip) { wound(chip, 0, false); if (!D.health) stagger(0); }   // chip never marks a wound, but it can still kill
      shake(j, def.posture * (perfect ? R.posture.perfect : 1));
    } else {
      const damage = Math.round(def.damage * R.location[location] * (charged ? R.charge.damage : 1)), baseStun = Math.round(def.stagger * (charged ? R.charge.stagger : 1));
      if (guarding) { spend(j, R.breakCost); wound(damage, def.knockback); events.push({ tick, type: 'GuardBroken', actor: i, target: j, move: a.move, damage, location, heading: a.body.heading, charged, weapon: weapon.id, material: weapon.material }); stagger(baseStun); D.posture = 0; }
      else {
        // Hyper-armour: a heavy parked at its chamber, a charged heavy, or any move past its poise point. A short hold that was released
        // uncharged is a plain heavy again (armour from its poise tick only).
        const poised = d.phase === 'attack' && d.move !== null && ((movesOf(d)[d.move].charges && (d.charged || (d.charge > 0 && d.age === movesOf(d)[d.move].chamber)) && d.age < timing(d).windup + timing(d).active) || (movesOf(d)[d.move].poise >= def.stagger && d.age >= movesOf(d)[d.move].poiseFrom && d.age < timing(d).windup + timing(d).active));
        // Counter-hit and rear-hit multiply the clean hit; they never apply through a guard or a parry.
        const counter = d.phase === 'attack' || (d.phase === 'roll' && d.age > R.safeEnd);
        // The thrust is the stop-hit: into a swing, or into an opponent walking onto the point, it lands harder than a cut's counter-hit.
        // Walking onto the point: since the thrust started, the target has come at least stopHit.walk closer to where it started from (its own steps; the lunge does not count).
        const advancing = (d.phase === 'ready' || d.phase === 'guard') && a.attackFrom !== null && distance(d.body, { ...d.body, x: a.attackFrom.x, z: a.attackFrom.z }) < a.attackFrom.gap - R.stopHit.walk;
        const stop = a.move === 'thrust' && (counter || advancing);
        const rear = Math.abs(wrapAngle(aim(d.body, a.body) - d.body.heading)) > Math.PI - R.rear.arc / 2;
        const dealt = Math.round(damage * (stop ? R.stopHit.damage : counter ? R.counter.damage : 1) * (rear ? R.rear.damage : 1)), stun = Math.round(baseStun * (stop ? R.stopHit.stagger : counter ? R.counter.stagger : 1) * (rear ? R.rear.stagger : 1));
        if (!def.path) spend(j, def.staminaDamage);
        // Poise: a brute shrugs a plain blow under his threshold — no stagger, no knockback; the wound and the posture still count.
        const shrugged = poised || (dealt < d.poise && !counter && !stop && !rear && !charged);
        wound(dealt, shrugged ? 0 : def.knockback); events.push({ tick, type: 'Hit', actor: i, target: j, move: a.move, damage: dealt, location, heading: a.body.heading, counter: counter || stop, rear, charged, weapon: weapon.id, material: weapon.material, ...(stop ? { stop: true } : {}), ...(trip ? { trip: true } : {}) });
        if (!shrugged || !D.health) stagger(stun);
        shake(j, def.posture * (counter ? R.counter.damage : 1));
      }
    }
  }
  return { tick, fighters, finish, events };
}

