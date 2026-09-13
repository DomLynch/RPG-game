import { advance, initialState, TARGET, wrapAngle, type Input, type State } from './sim.ts';

// Experimental timings in fixed 60 Hz ticks. Animation observes these; it never deals damage.
export const SWORD = { draw: 42, contact: 18, recovery: 66, damage: 25, reach: 1.65, arc: Math.PI / 3, reaction: 24, death: 144 } as const;
export const DEFENCE = { roll: 36, safeStart: 4, safeEnd: 20, rollCost: 30, blockCost: 25, parry: 10, parryCooldown: 30, stun: 90, regenDelay: 60, attackCost: 20, enemyWait: 90, enemyContact: 36, enemyRecovery: 100, enemyDamage: 20 } as const;
export type DefenceInput = { dodge?: boolean; guard?: boolean; parry?: boolean };
export type Practice = {
  fighter: State; phase: 'sheathed' | 'draw' | 'ready' | 'attack' | 'roll' | 'guard' | 'hurt' | 'dead'; age: number;
  health: number; playerHealth: number; stamina: number; rest: number; parryCooldown: number;
  enemyAge: number; enemyAttacking: boolean; enemyHeading: number; reaction: number; reactionDuration: number; hits: number;
  result: 'none' | 'hit' | 'miss' | 'hurt' | 'blocked' | 'parried' | 'dodged' | 'broken';
};
export const initialPractice = (): Practice => ({ fighter: initialState(), phase: 'sheathed', age: 0, health: 100, playerHealth: 100, stamina: 100, rest: 0, parryCooldown: 0, enemyAge: 0, enemyAttacking: false, enemyHeading: 0, reaction: 0, reactionDuration: SWORD.reaction, hits: 0, result: 'none' });
export const canStrike = (s: Practice): boolean => s.health > 0 && s.playerHealth > 0 && (s.phase === 'sheathed' || (s.phase === 'ready' && s.stamina >= DEFENCE.attackCost));
export const canDefend = (s: Practice): boolean => s.health > 0 && s.playerHealth > 0 && (s.phase === 'ready' || s.phase === 'guard');
const aim = (s: State) => Math.atan2(TARGET.x - s.x, TARGET.z - s.z);
const inReach = (s: State, heading: number, toward: number) => Math.hypot(TARGET.x - s.x, TARGET.z - s.z) <= SWORD.reach && Math.abs(wrapAngle(toward - heading)) <= SWORD.arc;

export function stepPractice(current: Practice, input: Input, strike: boolean, locked: boolean, defence: DefenceInput = {}): Practice {
  const next = { ...current, age: current.age + 1, reaction: Math.max(0, current.reaction - 1), rest: Math.max(0, current.rest - 1), parryCooldown: Math.max(0, current.parryCooldown - 1) };
  if (!current.health || !current.playerHealth) return next;
  const spend = (cost: number) => { next.stamina = Math.max(0, next.stamina - cost); next.rest = DEFENCE.regenDelay; };
  if (defence.dodge && canDefend(current) && current.stamina >= DEFENCE.rollCost) {
    // Lock direction at touch-down; without movement, roll away from the opponent.
    const moving = Math.hypot(input.x, input.z) > .1;
    const heading = moving ? advance(current.fighter, input).heading : aim(current.fighter) + Math.PI;
    next.fighter = { ...current.fighter, heading }; next.phase = 'roll'; next.age = 0; spend(DEFENCE.rollCost);
  } else if ((defence.guard || defence.parry) && current.phase === 'ready' && current.stamina > 0) {
    next.phase = 'guard'; next.age = defence.parry && !current.parryCooldown ? 0 : DEFENCE.parry;
    if (next.age === 0) next.parryCooldown = DEFENCE.parryCooldown;
  } else if (strike && canStrike(current)) {
    next.phase = current.phase === 'sheathed' ? 'draw' : 'attack'; next.age = 0; next.result = 'none';
    if (next.phase === 'attack') spend(DEFENCE.attackCost);
    if (locked) next.fighter = { ...current.fighter, heading: aim(current.fighter) };
  }
  if ((next.phase === 'draw' && next.age >= SWORD.draw) || (next.phase === 'attack' && next.age >= SWORD.recovery) || (next.phase === 'roll' && next.age >= DEFENCE.roll) || (next.phase === 'hurt' && next.age >= SWORD.reaction) || (next.phase === 'guard' && !defence.guard && next.age >= DEFENCE.parry)) { next.phase = 'ready'; next.age = 0; }
  if (next.phase === 'roll') {
    const heading = next.fighter.heading;
    next.fighter = advance(next.fighter, { x: Math.sin(heading), z: Math.cos(heading), yaw: 0, run: true });
  } else if (next.phase === 'ready' || next.phase === 'sheathed' || next.phase === 'guard') {
    const guarding = next.phase === 'guard';
    next.fighter = advance(next.fighter, { ...input, x: input.x * (guarding ? .35 : 1), z: input.z * (guarding ? .35 : 1), run: !guarding && input.run && next.stamina > 0 });
    if (locked && (guarding || Math.hypot(input.x, input.z) < .1)) next.fighter.heading = aim(next.fighter);
    if (!guarding && input.run && next.fighter.distance > current.fighter.distance) spend(.2);
  }
  if (!next.rest && (next.phase === 'ready' || next.phase === 'sheathed')) next.stamina = Math.min(100, next.stamina + .4);
  if (next.phase === 'attack' && next.age === SWORD.contact) {
    if (inReach(next.fighter, next.fighter.heading, aim(next.fighter))) {
      next.health = Math.max(0, current.health - SWORD.damage); next.hits++;
      next.reaction = next.health ? SWORD.reaction : SWORD.death; next.reactionDuration = next.reaction; next.result = 'hit';
      next.enemyAttacking = false; next.enemyAge = 0;
    } else next.result = 'miss';
  }
  // The warden holds position, commits its facing at wind-up, and only engages an armed fighter.
  if (!next.health || next.phase === 'sheathed' || next.phase === 'draw' || next.reaction) return next;
  next.enemyAge++;
  if (!next.enemyAttacking && next.enemyAge >= DEFENCE.enemyWait && Math.hypot(TARGET.x - next.fighter.x, TARGET.z - next.fighter.z) <= 2.1) {
    next.enemyAttacking = true; next.enemyAge = 0; next.enemyHeading = aim(next.fighter) + Math.PI;
  } else if (next.enemyAttacking && next.enemyAge >= DEFENCE.enemyRecovery) { next.enemyAttacking = false; next.enemyAge = 0; }
  if (next.enemyAttacking && next.enemyAge === DEFENCE.enemyContact) {
    if (!inReach(next.fighter, next.enemyHeading, aim(next.fighter) + Math.PI)) { next.result = 'dodged'; return next; }
    const facing = Math.abs(wrapAngle(aim(next.fighter) - next.fighter.heading)) <= SWORD.arc;
    if (next.phase === 'roll' && next.age >= DEFENCE.safeStart && next.age <= DEFENCE.safeEnd) next.result = 'dodged';
    else if (next.phase === 'guard' && facing && next.age < DEFENCE.parry) {
      next.result = 'parried'; next.reaction = DEFENCE.stun; next.reactionDuration = DEFENCE.stun; next.enemyAttacking = false; next.enemyAge = 0;
    } else if (next.phase === 'guard' && facing && next.stamina >= DEFENCE.blockCost) { spend(DEFENCE.blockCost); next.result = 'blocked'; }
    else {
      const broken = next.phase === 'guard' && facing;
      if (broken) spend(next.stamina);
      next.playerHealth = Math.max(0, next.playerHealth - DEFENCE.enemyDamage); next.phase = next.playerHealth ? 'hurt' : 'dead'; next.age = 0; next.result = broken ? 'broken' : 'hurt';
    }
  }
  return next;
}

export function practiceHint(s: Practice): string {
  if (!s.playerHealth) return 'You fell. Rematch and try another defence.';
  if (!s.health) return 'Warden defeated. Ready for a rematch?';
  if (s.phase === 'sheathed') return 'Draw your sword. The warden will counterattack.';
  if (s.phase === 'draw') return 'Drawing longsword…';
  if (s.enemyAttacking && s.enemyAge < DEFENCE.enemyContact) return 'Incoming strike — roll or time your guard!';
  if (s.result !== 'none') return { hit: 'Clean hit · −25', miss: 'Miss — close the distance and face the warden.', hurt: 'Hit taken · −20', blocked: 'Blocked · −25 stamina', parried: 'Parried! The warden is open.', dodged: 'Evaded!', broken: 'Guard broken · recover your stamina' }[s.result];
  return s.phase === 'guard' ? 'Guarding · release to recover stamina' : 'Hold guard to block · tap just before impact to parry';
}
