// RV30 evidence: the light-spam script's win rate at level 6 against every ladder opponent (the cap is 80 % at L6 and up), pooled and per opponent.
//   node scripts/light-spam-l6.mjs   env: SEEDS (24), LEVEL (6)
import { LADDER } from '../src/ladder.ts';
import { OPPONENTS } from '../src/combat.ts';
import { battery, STRATEGIES } from '../tests/strategies.ts';

const seeds = +(process.env.SEEDS ?? 24), level = +(process.env.LEVEL ?? 6);
let wins = 0, n = 0; const rows = [];
for (const o of LADDER) {
  const r = battery(level, seeds, 7200, OPPONENTS[o.id], { 'light spam': STRATEGIES['light spam'] })['light spam'];
  wins += r.wins; n += seeds; rows.push(`${o.id} ${r.wins}/${seeds}`);
}
console.log(`L${level} light spam: pooled ${wins}/${n} = ${(100 * wins / n).toFixed(0)} %; ${rows.join(', ')}`);
