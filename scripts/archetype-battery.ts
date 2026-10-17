// The practice-sim win share of one opponent row at chosen levels: the scripted-strategy battery (tests/strategies.ts, stepDuel + the creature brain), every strategy, SEEDS fights each.
// The hero is the default 150 hp body unless HERO_LEVEL is set: then he carries that level's build points plus a worn plate set at each RUNGS rung (scripts/lib/rung-sheet.ts, rung 0 = no gear),
// the same sheet pack-battery.ts gives him. Strategy's bars are read on this (L3 35-55% for a Recruit hero). Every receipt names the row it measured and the hero body.
//   node scripts/archetype-battery.ts   env: OPPONENT (cave-troll), LEVELS (3,16), SEEDS (40), HERO_LEVEL (unset = bare body), RUNGS (0,2,4,9, only with HERO_LEVEL)
import { createHash } from 'node:crypto';
import { OPPONENTS } from '../src/fight/moves.ts';
import ARCHETYPES from '../src/fight/archetype-defs.json' with { type: 'json' };
import { battery } from '../tests/strategies.ts';
import { rungSheet } from './lib/rung-sheet.ts';

const env = (k: string, d: string) => (process.env[k] ?? d).split(','), id = env('OPPONENT', 'cave-troll')[0]!, seeds = +env('SEEDS', '40')[0]!, heroLevel = process.env.HERO_LEVEL ? +process.env.HERO_LEVEL : undefined;
const row = (ARCHETYPES as { archetypes: { id: string }[] }).archetypes.find((a) => a.id === env('ARCHETYPE', 'troll')[0]);   // the archetype row the opponent is built from, hashed into the receipt
console.log(`row ${id}${row ? ` archetype ${row.id} sha256 ${createHash('sha256').update(JSON.stringify(row)).digest('hex').slice(0, 16)}` : ''}  hero ${heroLevel === undefined ? 'bare 150 hp body, no sheet' : `level ${heroLevel} build points + plate set`}`);
for (const rung of heroLevel === undefined ? [undefined] : env('RUNGS', '0,2,4,9').map(Number)) for (const level of env('LEVELS', '3,16').map(Number)) {
  const rows = battery(level, seeds, 7200, OPPONENTS[id]!, undefined, 'longsword', null, rung === undefined ? undefined : rungSheet(rung, heroLevel));
  const all = Object.values(rows), pct = all.reduce((a, r) => a + r.wins, 0) / (all.length * seeds) * 100;
  console.log(`${id} L${level}${rung === undefined ? '' : ` rung ${rung}`}  all strategies ${pct.toFixed(0)}%  ${Object.entries(rows).map(([name, r]) => `${name} ${r.wins}/${seeds}`).join(' | ')}`);
}
