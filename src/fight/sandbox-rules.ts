import DEFS from './sandbox-rules-defs.json' with { type: 'json' };

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
