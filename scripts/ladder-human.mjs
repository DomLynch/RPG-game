// Human-like defenders (Strategy 2026-10-06): guard/parry only once the swing is R ticks old, wrong side `miss` of the time. The tick-0 `blocker` in
// ladder-sweep.mjs is superhuman (right side on tick 0 of every swing), so a flat rung hides behind it; this is the yardstick the ladder gate uses.
//   node scripts/ladder-human.mjs   env: IDS (default: every beta opponent), N (60), LEVELS (6,18,46), R (12), MISS (.2)
import { OPPONENTS, MOVES, canStrike, initialPractice, stepPractice } from '../src/combat.ts';
import { RULES, opponentAt, profileAt } from '../src/moves.ts';
import { mirror, movesOf, timing } from '../src/duel.ts';
import { isHeld } from '../src/roster.ts';

const mk = (z = 0, action = null, guard = false) => ({ move: { x: 0, z, yaw: 0, run: false }, action, guard, lock: true });
const dist = (s) => Math.hypot(s.fighter.x - s.enemy.x, s.fighter.z - s.enemy.z);
const REACH = MOVES.light_right.reach;
const me = (s) => s.duel.fighters[0];
const foe = (s) => s.duel.fighters[1];
const foeMove = (s) => (foe(s).move ? movesOf(foe(s))[foe(s).move] : null);
const untilContact = (s) => timing(foe(s)).windup - foe(s).age;   // ticks until the opponent's blow lands (negative once it is active)
const incoming = (s) => s.threat && dist(s) < 3 && foeMove(s) !== null;

const start = (s) => (s.phase === 'sheathed' ? mk(0, 'light') : null);
const approach = (s) => (dist(s) > REACH - 0.15 ? mk(-1) : null);
const cut = (s, reserve) => approach(s) ?? (canStrike(s) && s.stamina >= reserve ? mk(0, 'light') : mk());
const free = (s) => { const f = foe(s); return dist(s) < REACH && (f.phase === 'hurt' || f.exhausted || (f.phase === 'attack' && f.landed) || (f.phase === 'attack' && f.age > timing(f).windup + timing(f).active + 4)); };
const punish = (s) => (me(s).punish > 0 || me(s).counterWindow > 0) && canStrike(s);
const offense = (s, reserve) => (punish(s) ? mk(0, s.stamina >= 35 ? 'heavy' : 'light') : free(s) && canStrike(s) ? mk(0, 'light') : cut(s, reserve));
const covered = (s) => ({ ...mk(0, null, true), guardDirection: mirror(foeMove(s).direction) });   // the directional guard covers ONE side: the mirror of the blow's
const parry = (s, lead) => {
  const m = foeMove(s);
  if (!m || !incoming(s) || !m.parryable || me(s).parryCooldown !== 0 || !['ready', 'guard'].includes(me(s).phase)) return null;
  const t = untilContact(s);
  return t <= lead && t >= 1 ? { ...mk(0, 'parry', true), guardDirection: mirror(m.direction) } : null;
};
const roll = (s, lead) => (!foeMove(s) || !incoming(s) || s.stamina < RULES.rollCost ? null : untilContact(s) <= lead && untilContact(s) >= RULES.safeStart ? mk(0, 'dodge') : null);

// Human-like defenders: the guard (or parry) goes up only once the foe's swing is `R` ticks old, and the side is wrong `miss` of the time (rolled once per swing).
export const human = (kind, R, miss, seed) => {
  let x = seed >>> 0, swing = -1, wrong = false;
  const rnd = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
  return (s) => {
    const f = foe(s);
    if (f.phase === 'attack' && f.age === 0) { /* noop */ }
    const id = f.phase === 'attack' ? `${f.move}` : null;
    if (id && f.age <= 1 && swing !== s.duel?.tick) { swing = s.duel?.tick ?? 0; wrong = rnd() < miss; }
    const seen = incoming(s) && f.age >= R;
    const side = (d) => wrong ? ({ left: 'right', right: 'left', overhead: 'low', low: 'overhead', thrust: 'left' })[d] ?? d : d;
    if (kind === 'blocker') return start(s) ?? (seen && foeMove(s).parryable !== false ? { ...mk(0, null, true), guardDirection: side(mirror(foeMove(s).direction)) } : null) ?? offense(s, 50);
    const p = seen ? parry(s, 5) : null;
    return start(s) ?? (p ? { ...p, guardDirection: side(p.guardDirection) } : null) ?? (seen && foeMove(s) && !foeMove(s).parryable ? roll(s, 14) : null) ?? (seen ? { ...mk(0, null, true), guardDirection: side(mirror(foeMove(s).direction)) } : null) ?? offense(s, 40);
  };
};
import { fight } from './ladder-sweep.mjs';
export const BETA_IDS = Object.keys(OPPONENTS).filter((id) => !isHeld(id));
/** Win % of the human-like bots (`blocker`, `skilled`) per opponent and level: { id: { blocker: [..per level], skilled: [..] } }. Seeds are fixed. */
export function ladderHuman({ ids = BETA_IDS, levels = [6, 18, 46], n = 60, R = 12, miss = .2 } = {}) {
  const out = {};
  for (const id of ids) {
    out[id] = {};
    for (const b of ['blocker', 'skilled']) out[id][b] = levels.map((l) => { let w = 0; for (let k = 1; k <= n; k++) w += fight(human(b, R, miss, k * 7919), id, l, k * 104729).won; return Math.round(100 * w / n); });
  }
  return out;
}
if (import.meta.main) {
  const env = process.env, levels = (env.LEVELS ?? '6,18,46').split(',').map(Number);
  const table = ladderHuman({ ids: env.IDS ? env.IDS.split(',') : BETA_IDS, levels, n: Number(env.N ?? 60), R: Number(env.R ?? 12), miss: Number(env.MISS ?? .2) });
  console.log('opponent'.padEnd(14) + 'bot'.padEnd(9) + levels.map((l) => `L${l}`.padStart(6)).join(''));
  for (const [id, bots] of Object.entries(table)) for (const [b, row] of Object.entries(bots)) console.log(id.padEnd(14) + b.padEnd(9) + row.map((v) => `${v}`.padStart(6)).join(''));
}
