// Mob signature moves (Combat, top-10 #5, docs/research/origins-best-in-class.md C2; mob fights proposal docs/specs/origins/mob-fights-proposal.md): a world LAYER on the shared engine, not a second AI.
// The warden's own decide() still chooses WHEN to attack; this layer only chooses WHICH of the moves that already exist, the way sparring.ts takes attacks out of an intent after decide().
// Outside SIM_FILES on purpose: it reads a Duel and returns an Intent, writes nothing back, and never runs in the ladder, so every Pit fight and every record is unchanged by construction.
// Deterministic: a trigger is a condition on the duel (no dice, no chance), a cooldown is ticks. Nothing here resolves a blow; the swapped move goes through the same legal() and the same stepDuel.
import { legal, type Action, type Duel, type Intent, type Side } from './duel.ts';

export type KitTrigger = 'opener' | 'afterHit' | 'heroGuarding' | 'heroExhausted' | 'selfBelow';
export type KitMove = 'light' | 'heavy' | 'thrust' | 'skill';
// move: the attack thrown in place of the one decide() chose. trigger: the condition. cooldown: ticks before this row may fire again (60 = one second). below: for 'selfBelow', the share of own max health.
export type KitRow = { move: KitMove; trigger: KitTrigger; cooldown: number; below?: number };
export type KitState = { fired: number[]; attacks: number; lastHit: number };
export const initialKit = (rows: readonly KitRow[]): KitState => ({ fired: rows.map(() => -1e9), attacks: 0, lastHit: -1e9 });
export const AFTER_HIT_TICKS = 90;   // 'afterHit' holds for a second and a half after the mob's own blow lands
export const EXHAUSTED_BELOW = 25;   // 'heroExhausted': the hero's stamina at or under this (or the exhausted flag)
const isAttack = (a: Action | null): a is Action => a === 'light' || a === 'light_left' || a === 'light_right' || a === 'heavy' || a === 'thrust';

const holds = (row: KitRow, duel: Duel, me: Side, state: KitState, index: number): boolean => {
  const self = duel.fighters[me], foe = duel.fighters[1 - me];
  switch (row.trigger) {
    case 'opener': return state.attacks === 0;
    case 'afterHit': return duel.tick - state.lastHit <= AFTER_HIT_TICKS && state.fired[index] < state.lastHit;
    case 'heroGuarding': return foe.phase === 'guard';
    case 'heroExhausted': return foe.exhausted || foe.stamina <= EXHAUSTED_BELOW;
    case 'selfBelow': return self.health > 0 && self.health < self.maxHealth * (row.below ?? 0.5);
  }
};

// One tick: `duel` is the state the intent will be stepped on (events: the last step's). Returns the same `intent` object when nothing changes.
export function kitIntent(duel: Duel, me: Side, intent: Intent, kit: readonly KitRow[], state: KitState): { intent: Intent; state: KitState } {
  const hit = duel.events.some(e => (e.type === 'Hit' || e.type === 'GuardBroken') && e.actor === me);
  const base = hit ? { ...state, lastHit: duel.tick } : state;
  if (!isAttack(intent.action) || !kit.length) return { intent, state: base };
  const next = { ...base, attacks: base.attacks + 1 }, self = duel.fighters[me];
  for (let i = 0; i < kit.length; i++) {
    const row = kit[i];
    if (duel.tick - base.fired[i] < row.cooldown || !holds(row, duel, me, base, i)) continue;
    if (row.move === intent.action || !legal(self, row.move)) continue;
    const fired = base.fired.slice(); fired[i] = duel.tick;
    return { intent: { ...intent, action: row.move }, state: { ...next, fired } };
  }
  return { intent, state: next };
}
