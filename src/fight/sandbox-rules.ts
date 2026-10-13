import DEFS from './sandbox-rules-defs.json' with { type: 'json' };
import SWARM_DEFS from './swarm-defs.json' with { type: 'json' };

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

// manyOnOne (Dom 2026-10-13: 1st attacker 100%, 2nd 50%, 3rd 30%, 4th+ 30%): swarm-defs.json `attackers` rows, { index, 'world-mob': per-mille damage }. A world-mob fight stream that
// names its attacker index (duel.roll.attacker, set by the world layer) scales that foe's damage to the player by the row at or below its index. No rows (trunk) = 1000 = untouched.
type AttackerRow = { index: number; 'world-mob'?: number };
const ATTACKERS = ((SWARM_DEFS as unknown as { attackers?: AttackerRow[] }).attackers ?? []).slice().sort((a, b) => a.index - b.index);
export const attackerPerMille = (index: number | undefined): number => {
  if (!index || !ATTACKERS.length) return 1000;
  let m = 1000; for (const r of ATTACKERS) if (r.index <= index && r['world-mob'] !== undefined) m = r['world-mob'];
  return m;
};
