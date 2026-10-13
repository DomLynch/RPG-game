import DEFS from './sandbox-rules-defs.json' with { type: 'json' };
import SWARM_DEFS from './swarm-defs.json' with { type: 'json' };
import PHASE_DEFS from './boss-phase-defs.json' with { type: 'json' };

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
//   interruptEarly: extra lockout, in per-mille of the base interruptCooldown, when a cast is cut at its very start; it falls to 0 as the cast nears release (ModernUO: the earlier the cut, the longer the lockout). 0 = off.
export const INTERRUPT_EARLY = num('interruptEarly', 'value');
export const interruptLockout = (base: number, left: number, windup: number): number => (INTERRUPT_EARLY > 0 ? Math.round((base * (1000 + (INTERRUPT_EARLY * Math.min(left, windup)) / windup)) / 1000) : base);

// manyOnOne (Dom 2026-10-13: 1st attacker 100%, 2nd 50%, 3rd 30%, 4th+ 30%): swarm-defs.json `attackers` rows, { index, 'world-mob': per-mille damage }. A world-mob fight stream that
// names its attacker index (duel.roll.attacker, set by the world layer) scales that foe's damage to the player by the row at or below its index. No rows (trunk) = 1000 = untouched.
type AttackerRow = { index: number; 'world-mob'?: number };
const ATTACKERS = ((SWARM_DEFS as unknown as { attackers?: AttackerRow[] }).attackers ?? []).slice().sort((a, b) => a.index - b.index);
export const attackerPerMille = (index: number | undefined): number => {
  if (!index || !ATTACKERS.length) return 1000;
  let m = 1000; for (const r of ATTACKERS) if (r.index <= index && r['world-mob'] !== undefined) m = r['world-mob'];
  return m;
};

// bossPhases (Dom 2026-10-13: bosses change their ATTACK at health steps, never their colour): boss-phase-defs.json `phases` rows, { id, special ('*' = any), below (percent of max health), share (per-mille multiplier on the
// special's damage share), cooldown (percent of the special's normal cooldown left when the phase starts), label, note }. The first tick the boss is under `below` percent, once per fight, its special hits harder and is ready
// sooner (no window, tell or recovery moves). No rows (trunk) = never. The label and note are the on-screen message (wound-notice.ts).
export type PhaseRow = { id: string; special: string; below: number; share: number; cooldown: number; label?: string; note?: string };
export const PHASES: readonly PhaseRow[] = ((PHASE_DEFS as unknown as { phases: PhaseRow[] }).phases ?? []).map((r) => {
  if (!r.id || typeof r.special !== 'string' || !(r.below > 0 && r.below < 100) || !(r.share >= 1) || !(r.cooldown >= 0 && r.cooldown <= 100)) throw Error(`boss-phase-defs "${String(r.id)}": special, below (1-99), share (>= 1 per-mille) and cooldown (0-100) are required`);
  return r;
});
export const phaseText = (id: string): { label: string; note: string } | undefined => { const r = PHASES.find((p) => p.id === id); return r?.label ? { label: r.label, note: r.note ?? '' } : undefined; };
