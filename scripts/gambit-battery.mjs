// RV33 battery (docs/specs/origins/combat-study.md C1): does the Gambit beat a plain heavy? The "heavy only" bot of tests/strategies.ts, with and without arming every heavy
// at its chamber tick, against each opponent at the given ladder levels (24 seeds, the battery's own seeding). Usage: node scripts/gambit-battery.mjs [seeds] [stagger ticks] [levels,..] [foes,..]
import { decide, initialAi } from '../src/ai.ts';
import { stepDuel, withGambit } from '../src/duel.ts';
import { OPPONENTS, RULES, opponentAt, profileAt } from '../src/moves.ts';
import { act, arena, gap, idle, k, P, ready, W } from '../tests/strategies.ts';

const SEEDS = Number(process.argv[2] ?? 24), LEVELS = (process.argv[4] ?? '1,6,18,30,46').split(',').map(Number), FOES = (process.argv[5] ?? 'veteran,pitborn,goblin,executioner').split(',');
if (process.argv[3]) RULES.gambit.stagger = Number(process.argv[3]);   // a sweep of the self-stagger (ticks); default is the rule's own
const heavy = d => (ready(d) && gap(d) <= 1.8 * k(d) ? act('heavy') : idle());
const gambit = d => (P(d).phase === 'attack' && P(d).move === 'heavy_overhead' && P(d).age === 10 && !P(d).gambit ? act('heavy') : heavy(d));
const run = (foe, level, strategy, on, seed) => {
  const opponent = OPPONENTS[foe], profile = profileAt(opponent, level);
  let d = arena(opponentAt(opponent, level)); if (on) d = withGambit(d, seed * 7919);
  let ai = initialAi((seed * 2654435761) >>> 0), armed = 0, landed = 0, failed = 0;
  for (let i = 0; i < 7200 && !d.finish; i++) {
    const w = decide(d, 1, ai, profile); ai = w.ai; d = stepDuel(d, [strategy(d), w.intent]);
    for (const e of d.events) { if (e.type === 'GambitArmed') armed++; if (e.type === 'Hit' && e.gambit) landed++; if (e.type === 'GambitFailed') failed++; }
  }
  return { win: !!d.finish && !d.finish.draw && d.finish.victim === 1, armed, landed, failed, ticks: d.tick };
};
console.log('foe          level | plain heavy wins | gambit heavy wins | armed  landed  failed | mean ticks plain -> gambit');
for (const foe of FOES) for (const level of LEVELS) {
  const a = [], b = [];
  for (let s = 1; s <= SEEDS; s++) { a.push(run(foe, level, heavy, false, s)); b.push(run(foe, level, gambit, true, s)); }
  const sum = (xs, f) => xs.reduce((n, x) => n + f(x), 0);
  console.log(`${foe.padEnd(12)} ${String(level).padStart(5)} | ${String(sum(a, x => x.win)).padStart(8)}/${SEEDS}       | ${String(sum(b, x => x.win)).padStart(9)}/${SEEDS}        | ${String(sum(b, x => x.armed)).padStart(5)}  ${String(sum(b, x => x.landed)).padStart(6)}  ${String(sum(b, x => x.failed)).padStart(6)} | ${(sum(a, x => x.ticks) / SEEDS).toFixed(0)} -> ${(sum(b, x => x.ticks) / SEEDS).toFixed(0)}`);
}
