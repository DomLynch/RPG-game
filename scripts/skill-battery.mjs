// The skill fairness table (#766 for Pommel Strike, SCOPE 8's opponent moves after it): each equipped skill's scripted uses
// (tests/strategies.ts SKILL_STRATEGIES) against every opponent, with every weapon a player can carry at normal and the longsword at hard,
// judged by scripts/player-weapon-battery.mjs's caps. npm test pins a subset per skill (tests/skill-<id>.test.ts); this is the full sweep,
// whose output goes in the PR that changes a move.
//   node scripts/skill-battery.mjs [--skill <id> | --skills a,b] [--seeds 24] [--weapons longsword,knife] [--levels normal]
// Default: every skill in SKILL_MOVE. One --skill per process shards the sweep across cores.
/* global process, console */
import { OPPONENTS, PLAYER_WEAPONS } from '../src/moves.ts';
import { SKILL_STRATEGIES, battery } from '../tests/strategies.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const seeds = Number(arg('seeds', 24)), weapons = arg('weapons', PLAYER_WEAPONS.join(',')).split(','), levels = arg('levels', '');
const skills = arg('skill', arg('skills', Object.keys(SKILL_STRATEGIES).join(','))).split(',');
for (const s of skills) if (!SKILL_STRATEGIES[s]) throw new Error(`no scripted uses for skill '${s}' in tests/strategies.ts SKILL_STRATEGIES`);
const CAP = { normal: .5, hard: .35 };
const runs = levels ? weapons.flatMap(w => levels.split(',').map(l => [w, l])) : [...weapons.map(w => [w, 'normal']), ['longsword', 'hard']];
let over = 0;
for (const skill of skills) for (const [weapon, level] of runs) for (const o of Object.values(OPPONENTS)) {
  const rows = battery(level, seeds, 7200, o, SKILL_STRATEGIES[skill], weapon, skill);
  const flags = Object.entries(rows).filter(([, r]) => r.wins / seeds > CAP[level]).map(([name, r]) => `${name} wins ${r.wins}/${seeds}`);
  over += flags.length;
  const line = Object.entries(rows).map(([name, r]) => `${name} ${r.wins}W/${r.losses}L/${r.stalls}S`).join(' · ');
  console.log(`${flags.length ? 'OVER' : 'ok  '} ${skill.padEnd(8)} ${weapon.padEnd(10)} ${o.id.padEnd(12)} ${level.padEnd(6)} ${line}${flags.length ? `\n     ↳ ${flags.join('; ')}` : ''}`);
}
console.log(over ? `${over} pairing(s) over a cap` : 'every pairing within the caps');
process.exit(over ? 1 : 0);
