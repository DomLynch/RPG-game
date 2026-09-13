import { advance, initialState, TARGET, wrapAngle, type Input, type State } from './sim.ts';

// Experimental timings in fixed 60 Hz ticks. Animation observes these; it never deals damage.
export const SWORD = { draw: 42, contact: 14, recovery: 40, damage: 25, reach: 1.65, arc: Math.PI / 3, reaction: 24, death: 144 } as const;
export const DEFENCE = { roll: 36, safeStart: 4, safeEnd: 20, rollCost: 30, blockCost: 25, parry: 10, parryCooldown: 30, stun: 90, regenDelay: 60, attackCost: 20, enemyWait: 90, enemyContact: 36, enemyRecovery: 100, enemyDamage: 20 } as const;
export const ATTACKS = {
  light: { ...SWORD, cost: 20 },
  return: { ...SWORD, contact: 12, recovery: 34, cost: 20 },
  heavy: { ...SWORD, contact: 32, recovery: 68, damage: 38, reach: 1.9, cost: 35 },
  riposte: { ...SWORD, contact: 12, recovery: 36, damage: 40, cost: 20 },
} as const;
export type Attack = keyof typeof ATTACKS;
export type DefenceInput = { heavy?: boolean; dodge?: boolean; guard?: boolean; parry?: boolean };
export type Practice = {
  enemy: State; enemyMode: 'approach' | 'circle' | 'retreat' | 'guard'; decision: number; seed: number; enemyWait: number; enemyStamina: number; enemyGuardAge: number;
  fighter: State; phase: 'sheathed' | 'draw' | 'ready' | 'attack' | 'roll' | 'guard' | 'hurt' | 'dead'; age: number;
  attack: Attack; chain: number; resultAge: number;
  health: number; playerHealth: number; stamina: number; rest: number; parryCooldown: number;
  enemyAge: number; enemyAttacking: boolean; enemyHeading: number; reaction: number; reactionDuration: number; hits: number;
  result: 'none' | 'hit' | 'miss' | 'hurt' | 'blocked' | 'parried' | 'dodged' | 'broken' | 'enemyBlocked' | 'enemyBroken';
};
export const initialPractice = (): Practice => ({ enemy: { ...TARGET, heading: 0, distance: 0 }, enemyMode: 'approach', decision: 90, seed: 731, enemyWait: DEFENCE.enemyWait, enemyStamina: 100, enemyGuardAge: 0, fighter: initialState(), phase: 'sheathed', age: 0, attack: 'light', chain: 0, health: 100, playerHealth: 100, stamina: 100, rest: 0, parryCooldown: 0, enemyAge: 0, enemyAttacking: false, enemyHeading: 0, reaction: 0, reactionDuration: SWORD.reaction, hits: 0, resultAge: 0, result: 'none' });
export const canStrike = (s: Practice): boolean => s.health > 0 && s.playerHealth > 0 && (s.phase === 'sheathed' || (s.phase === 'ready' && s.stamina >= DEFENCE.attackCost));
export const canDefend = (s: Practice): boolean => s.health > 0 && s.playerHealth > 0 && (s.phase === 'ready' || s.phase === 'guard');
const aim = (s: State, target: State) => Math.atan2(target.x - s.x, target.z - s.z);
const inReach = (s: State, target: State, heading: number, toward: number, reach: number = SWORD.reach) => Math.hypot(target.x - s.x, target.z - s.z) <= reach && Math.abs(wrapAngle(toward - heading)) <= SWORD.arc;

export function stepPractice(current: Practice, input: Input, strike: boolean, locked: boolean, defence: DefenceInput = {}): Practice {
  const next = { ...current, resultAge: Math.min(120, current.resultAge + 1), age: current.age + 1, reaction: Math.max(0, current.reaction - 1), rest: Math.max(0, current.rest - 1), parryCooldown: Math.max(0, current.parryCooldown - 1), chain: Math.max(0, current.chain - 1) };
  if (!current.health || !current.playerHealth) return next;
  const spend = (cost: number) => { next.stamina = Math.max(0, next.stamina - cost); next.rest = DEFENCE.regenDelay; };
  if (defence.dodge && canDefend(current) && current.stamina >= DEFENCE.rollCost) {
    // Lock direction at touch-down; without movement, roll away from the opponent.
    const moving = Math.hypot(input.x, input.z) > .1;
    const heading = moving ? advance(current.fighter, input, current.enemy).heading : aim(current.fighter, current.enemy) + Math.PI;
    next.fighter = { ...current.fighter, heading }; next.phase = 'roll'; next.age = 0; spend(DEFENCE.rollCost);
  } else if ((defence.guard || defence.parry) && current.phase === 'ready' && current.stamina > 0) {
    next.phase = 'guard'; next.age = defence.parry && !current.parryCooldown ? 0 : DEFENCE.parry;
    if (next.age === 0) next.parryCooldown = DEFENCE.parryCooldown;
  } else if ((strike || defence.heavy) && canStrike(current) && (!defence.heavy || current.stamina >= ATTACKS.heavy.cost)) {
    next.phase = current.phase === 'sheathed' ? 'draw' : 'attack'; next.age = 0; next.result = 'none';
    if (next.phase === 'attack') { next.attack = defence.heavy ? 'heavy' : current.result === 'parried' && current.reaction > 0 ? 'riposte' : current.chain > 0 ? 'return' : 'light'; next.chain = 0; spend(ATTACKS[next.attack].cost); }
    if (locked) next.fighter = { ...current.fighter, heading: current.fighter.heading + Math.max(-.3, Math.min(.3, wrapAngle(aim(current.fighter, current.enemy) - current.fighter.heading))) };
  }
  if ((next.phase === 'draw' && next.age >= SWORD.draw) || (next.phase === 'attack' && next.age >= ATTACKS[next.attack].recovery) || (next.phase === 'roll' && next.age >= DEFENCE.roll) || (next.phase === 'hurt' && next.age >= SWORD.reaction) || (next.phase === 'guard' && !defence.guard && next.age >= DEFENCE.parry)) { if (next.phase === 'attack' && next.attack === 'light') next.chain = 18; next.phase = 'ready'; next.age = 0; }
  if (next.phase === 'attack' && next.age < ATTACKS[next.attack].contact) {
    if (locked) next.fighter = { ...next.fighter, heading: next.fighter.heading + Math.max(-.25, Math.min(.25, wrapAngle(aim(next.fighter, next.enemy) - next.fighter.heading))) };
    if (next.age > 3) {
      const heading = next.fighter.heading;
      next.fighter = advance(next.fighter, { x: Math.sin(heading) * .55, z: Math.cos(heading) * .55, yaw: 0, run: false }, next.enemy);
    }
  }
  if (next.phase === 'roll') {
    const heading = next.fighter.heading;
    next.fighter = advance(next.fighter, { x: Math.sin(heading), z: Math.cos(heading), yaw: 0, run: true }, next.enemy);
  } else if (next.phase === 'ready' || next.phase === 'sheathed' || next.phase === 'guard') {
    const guarding = next.phase === 'guard';
    next.fighter = advance(next.fighter, { ...input, x: input.x * (guarding ? .35 : 1), z: input.z * (guarding ? .35 : 1), run: !guarding && input.run && next.stamina > 0 }, next.enemy);
    if (locked && (guarding || Math.hypot(input.x, input.z) < .1)) next.fighter.heading = aim(next.fighter, next.enemy);
    if (!guarding && input.run && next.fighter.distance > current.fighter.distance) spend(.2);
  }
  if (!next.rest && (next.phase === 'ready' || next.phase === 'sheathed')) next.stamina = Math.min(100, next.stamina + .4);
  if (next.phase === 'attack' && next.age === ATTACKS[next.attack].contact) {
    next.resultAge = 0;
    if (inReach(next.fighter, next.enemy, next.fighter.heading, aim(next.fighter, next.enemy), ATTACKS[next.attack].reach)) {
      const guarded = next.enemyMode === 'guard' && next.enemyGuardAge >= 12 && !next.reaction && !next.enemyAttacking && next.enemyStamina >= 20 && Math.abs(wrapAngle(aim(next.enemy, next.fighter) - next.enemy.heading)) < SWORD.arc;
      if (guarded && next.attack !== 'heavy' && next.attack !== 'riposte') {
        next.enemyStamina -= 20; next.result = 'enemyBlocked'; next.enemyWait = 30; next.enemyAge = 0;
      } else {
        if (guarded) next.enemyStamina = 0;
        next.health = Math.max(0, current.health - ATTACKS[next.attack].damage); next.hits++;
        next.reaction = next.health ? SWORD.reaction : SWORD.death; next.reactionDuration = next.reaction; next.result = guarded ? 'enemyBroken' : 'hit';
        next.decision = 48; next.enemyMode = 'retreat'; next.enemyGuardAge = 0;
        const away = aim(next.enemy, next.fighter) + Math.PI;
        for (let i = 0; i < 4; i++) next.enemy = advance(next.enemy, { x: Math.sin(away), z: Math.cos(away), yaw: 0, run: false }, next.fighter);
        next.enemyAttacking = false; next.enemyAge = 0;
      }
    } else next.result = 'miss';
  }
  // Readable local opponent. Decisions consume seeded state, never renderer time or hidden player input.
  if (!next.health || next.phase === 'sheathed' || next.phase === 'draw' || next.reaction) return next;
  next.enemyAge++;
  next.decision = Math.max(0, current.decision - 1);
  if (!next.enemyAttacking) {
    const distance = Math.hypot(next.enemy.x - next.fighter.x, next.enemy.z - next.fighter.z);
    if (!next.decision) {
      next.seed = (Math.imul(next.seed, 1664525) + 1013904223) >>> 0;
      next.decision = 36 + next.seed % 45; next.enemyWait = 45 + (next.seed >>> 8) % 61;
      next.enemyMode = distance > 1.7 ? 'approach' : next.enemyStamina < 25 || distance < 1.05 ? 'retreat' : next.seed % 3 === 0 ? 'guard' : 'circle';
      next.enemyGuardAge = 0;
    }
    if (distance > 2.5) next.enemyMode = 'approach';
    const facing = aim(next.enemy, next.fighter), side = (next.seed & 1) ? 1 : -1;
    const forward = next.enemyMode === 'approach' && distance > 1.5 ? .6 : next.enemyMode === 'retreat' && distance < 2.2 ? -.4 : 0;
    const lateral = next.enemyMode === 'circle' ? side * .25 : 0;
    next.enemy = advance(next.enemy, { x: Math.sin(facing) * forward + Math.cos(facing) * lateral, z: Math.cos(facing) * forward - Math.sin(facing) * lateral, yaw: 0, run: false }, next.fighter);
    next.enemy.heading = facing;
    next.enemyGuardAge = next.enemyMode === 'guard' ? next.enemyGuardAge + 1 : 0;
    if (next.enemyMode !== 'guard') next.enemyStamina = Math.min(100, next.enemyStamina + .3);
    // A whiff is observable only after contact. Never react to an uncommitted input.
    if (next.phase === 'attack' && next.result === 'miss' && next.age > ATTACKS[next.attack].contact + 12) next.enemyWait = Math.min(next.enemyWait, 24);
  } else if (next.enemyAge > 6 && next.enemyAge < DEFENCE.enemyContact) {
    next.enemy = advance(next.enemy, { x: Math.sin(next.enemyHeading) * .18, z: Math.cos(next.enemyHeading) * .18, yaw: 0, run: false }, next.fighter);
  }

  if (!next.enemyAttacking && next.enemyAge >= next.enemyWait && next.enemyMode !== 'guard' && Math.hypot(next.enemy.x - next.fighter.x, next.enemy.z - next.fighter.z) <= 1.8) {
    next.enemyAttacking = true; next.enemyAge = 0; next.enemyHeading = aim(next.fighter, next.enemy) + Math.PI;
  } else if (next.enemyAttacking && next.enemyAge >= DEFENCE.enemyRecovery) { next.enemyAttacking = false; next.enemyAge = 0; next.decision = 0; }
  if (next.enemyAttacking && next.enemyAge === DEFENCE.enemyContact) {
    next.resultAge = 0;
    if (!inReach(next.fighter, next.enemy, next.enemyHeading, aim(next.fighter, next.enemy) + Math.PI)) { next.result = 'dodged'; return next; }
    const facing = Math.abs(wrapAngle(aim(next.fighter, next.enemy) - next.fighter.heading)) <= SWORD.arc;
    if (next.phase === 'roll' && next.age >= DEFENCE.safeStart && next.age <= DEFENCE.safeEnd) next.result = 'dodged';
    else if (next.phase === 'guard' && facing && next.age < DEFENCE.parry) {
      next.enemyMode = 'retreat'; next.result = 'parried'; next.reaction = DEFENCE.stun; next.reactionDuration = DEFENCE.stun; next.enemyAttacking = false; next.enemyAge = 0;
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
  if (s.enemyMode === 'guard' && !s.reaction && !s.enemyAttacking) return 'Warden guarding · heavy attack breaks the guard';
  if (s.phase === 'ready' && s.chain > 0) return 'Light again to follow through · or reset your footing';
  if (s.result !== 'none' && s.resultAge < 120) return { hit: `Clean ${s.attack === 'return' ? 'follow-up' : s.attack} hit · −${ATTACKS[s.attack].damage}`, miss: 'Miss — close the distance and face the warden.', hurt: 'Hit taken · −20', blocked: 'Blocked · −25 stamina', parried: 'Parried! The warden is open.', dodged: 'Evaded!', broken: 'Guard broken · recover your stamina', enemyBlocked: 'Warden blocked · use a heavy attack or change angle', enemyBroken: 'Guard shattered · press the opening' }[s.result];
  return s.phase === 'guard' ? 'Guarding · release to recover stamina' : 'Hold guard to block · tap just before impact to parry';
}
