// The practice-sim win share of one opponent row at chosen levels: the scripted-strategy battery (tests/strategies.ts, stepDuel + the creature brain, the default 150 hp hero), every strategy, SEEDS fights each.
// The receipt Strategy's bars are read on (L3 35-55% for a Recruit hero). No gear: the world-loop harness is scripts/pack-battery.ts.
//   node scripts/archetype-battery.ts   env: OPPONENT (cave-troll), LEVELS (3,16), SEEDS (40)
import { OPPONENTS } from '../src/fight/moves.ts';
import { battery } from '../tests/strategies.ts';

const env = (k: string, d: string) => (process.env[k] ?? d).split(','), id = env('OPPONENT', 'cave-troll')[0]!, seeds = +env('SEEDS', '40')[0]!;
for (const level of env('LEVELS', '3,16').map(Number)) {
  const rows = battery(level, seeds, 7200, OPPONENTS[id]!), all = Object.values(rows), pct = all.reduce((a, r) => a + r.wins, 0) / (all.length * seeds) * 100;
  console.log(`${id} L${level}  all strategies ${pct.toFixed(0)}%  ${Object.entries(rows).map(([name, r]) => `${name} ${r.wins}/${seeds}`).join(' | ')}`);
}
