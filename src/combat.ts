import { advance, initialState, TARGET, wrapAngle, type Input, type State } from './sim.ts';

// Experimental longsword timings in simulation ticks. Animation observes these; it never deals damage.
export const SWORD = { draw: 42, contact: 18, recovery: 66, damage: 25, reach: 1.65, arc: Math.PI / 3, reaction: 24, death: 144 } as const;
export type Practice = { fighter: State; phase: 'sheathed' | 'draw' | 'ready' | 'attack'; age: number; health: number; reaction: number; hits: number; result: 'none' | 'hit' | 'miss' };
export const initialPractice = (): Practice => ({ fighter: initialState(), phase: 'sheathed', age: 0, health: 100, reaction: 0, hits: 0, result: 'none' });

export function stepPractice(current: Practice, input: Input, strike: boolean, locked: boolean): Practice {
  const next = { ...current, age: current.age + 1, reaction: Math.max(0, current.reaction - 1) };
  if (strike && current.health > 0 && (current.phase === 'sheathed' || current.phase === 'ready')) {
    next.phase = current.phase === 'sheathed' ? 'draw' : 'attack'; next.age = 0; next.result = 'none';
    if (locked) next.fighter = { ...current.fighter, heading: Math.atan2(TARGET.x - current.fighter.x, TARGET.z - current.fighter.z) };
  }
  if ((next.phase === 'draw' && next.age >= SWORD.draw) || (next.phase === 'attack' && next.age >= SWORD.recovery)) { next.phase = 'ready'; next.age = 0; }
  if (next.phase !== 'draw' && next.phase !== 'attack') next.fighter = advance(next.fighter, input);
  if (next.phase === 'attack' && next.age === SWORD.contact) {
    const { x, z, heading } = next.fighter;
    const distance = Math.hypot(TARGET.x - x, TARGET.z - z);
    const angle = wrapAngle(Math.atan2(TARGET.x - x, TARGET.z - z) - heading);
    if (distance <= SWORD.reach && Math.abs(angle) <= SWORD.arc) {
      next.health = Math.max(0, current.health - SWORD.damage); next.hits++;
      next.reaction = next.health ? SWORD.reaction : SWORD.death; next.result = 'hit';
    } else next.result = 'miss';
  }
  return next;
}

export function practiceHint(state: Practice): string {
  if (!state.health) return 'Warden defeated. Reset to practise again.';
  if (state.phase === 'draw') return 'Drawing longsword…';
  if (state.phase === 'attack' && state.result === 'none') return 'Committed strike…';
  if (state.result === 'miss') return 'Miss — close the distance and face the warden.';
  if (state.result === 'hit') return 'Clean hit · −25';
  return state.phase === 'sheathed' ? 'Draw your sword to begin.' : 'Step within reach. Tap light attack.';
}

