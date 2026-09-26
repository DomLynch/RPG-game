// The Pommel Strike fairness table (#766): the day-one skill equipped, both scripted uses (tests/strategies.ts POMMEL) against every
// opponent, with every weapon a player can carry at normal and the longsword at hard, judged by scripts/player-weapon-battery.mjs's
// caps. npm test pins a subset (tests/skill-pommel.test.ts); this is the full sweep, whose output goes in the PR that changes the move.
//   node scripts/pommel-battery.mjs [--seeds 24] [--weapons longsword,knife] [--levels normal]
/* global process, console */
import { OPPONENTS, PLAYER_WEAPONS } from '../src/moves.ts';
import { POMMEL, battery } from '../tests/strategies.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const seeds = Number(arg('seeds', 24)), weapons = arg('weapons', PLAYER_WEAPONS.join(',')).split(','), levels = arg('levels', '');
const CAP = { normal: .5, hard: .35 };
const runs = levels ? weapons.flatMap(w => levels.split(',').map(l => [w, l])) : [...weapons.map(w => [w, 'normal']), ['longsword', 'hard']];
let over = 0;
for (const [weapon, level] of runs) for (const o of Object.values(OPPONENTS)) {
  const rows = battery(level, seeds, 7200, o, POMMEL, weapon, 'pommel');
  const flags = Object.entries(rows).filter(([, r]) => r.wins / seeds > CAP[level]).map(([name, r]) => `${name} wins ${r.wins}/${seeds}`);
  over += flags.length;
  const line = Object.entries(rows).map(([name, r]) => `${name} ${r.wins}W/${r.losses}L/${r.stalls}S`).join(' · ');
  console.log(`${flags.length ? 'OVER' : 'ok  '} ${weapon.padEnd(10)} ${o.id.padEnd(12)} ${level.padEnd(6)} ${line}${flags.length ? `\n     ↳ ${flags.join('; ')}` : ''}`);
}
console.log(over ? `${over} pairing(s) over a cap` : 'every pairing within the caps');
