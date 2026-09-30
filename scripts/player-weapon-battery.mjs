// The player weapon fairness table (Brief 5 flip): every weapon a player can carry (moves.ts PLAYER_WEAPONS) against every live rung of
// the ladder at normal and hard, run through the same scripted-strategy battery that pins each rung (tests/strategies.ts), judged by the
// same caps: no strategy wins more than half its fights at normal or more than a third at hard, and none goes untouched. Combat signs the
// table before a pairing ships; a pairing over a cap is tuned on the weapon side, never on the rung's profile.
//   node scripts/player-weapon-battery.mjs [--seeds 24] [--weapons knife,estoc] [--levels normal,hard]
/* global process, console */
import { LADDER } from '../src/ladder.ts';
import { OPPONENTS, PLAYER_WEAPONS } from '../src/moves.ts';
import { battery } from '../tests/strategies.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const seeds = Number(arg('seeds', 24)), weapons = arg('weapons', PLAYER_WEAPONS.join(',')).split(','), levels = arg('levels', 'normal,hard').split(',');
const CAP = { normal: .5, hard: .35 }, UNTOUCHED = { default: 2, 'perfect parry': 8 };
let over = 0;
for (const weapon of weapons) for (const rung of LADDER) for (const level of levels) {
  const rows = battery(level, seeds, 7200, OPPONENTS[rung.id], undefined, weapon), flags = [];
  const line = Object.entries(rows).map(([name, r]) => {
    const winShare = r.wins / seeds, untouchedCap = Math.ceil((UNTOUCHED[name] ?? UNTOUCHED.default) * seeds / 24);
    if (name !== 'perfect parry' && winShare > CAP[level]) flags.push(`${name} wins ${r.wins}/${seeds}`);
    if (r.untouched > untouchedCap) flags.push(`${name} untouched ${r.untouched}/${seeds}`);
    return `${name} ${r.wins}W/${r.losses}L/${r.stalls}S u${r.untouched}`;
  }).join(' · ');
  over += flags.length;
  console.log(`${flags.length ? 'OVER' : 'ok  '} ${weapon.padEnd(10)} ${rung.id.padEnd(12)} ${level.padEnd(6)} ${line}${flags.length ? `\n     ↳ ${flags.join('; ')}` : ''}`);
}
console.log(over ? `${over} pairing(s) over a cap` : 'every pairing within the caps');
process.exit(over ? 1 : 0);
