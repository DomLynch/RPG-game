// Proof that a change touched no CLASS special, and a measurement of the player's PICKED special (RV78, the melee-special flip). Run at two shas and compare.
//   node scripts/special-class-digest.mjs [--seeds 6] [--win-seeds 200]     (node >= 22.6 with type stripping; the VPS or the HF CPU box)
// class digest: every ladder opponent at three levels, the player carries NO skill (nothing picked), the opponent casts its own class special (specials on), every strategy x seed; the hash of every
//   fight's outcome, ticks and special tallies. The same hash at base and head means no class special moved.
// picked win rate: the player carries the day-one Pommel as his picked SPECIAL and casts it whenever it is ready and in reach (tests/special-battery.ts fight); the light-spam strategy against the veteran,
//   win-seeds seeds at two levels: the share of fights the player wins, with the specials off and on.
/* global process, console */
import { createHash } from 'node:crypto';
import { decide, initialAi } from '../src/fight/ai.ts';
import { stepDuel, withSpecials } from '../src/fight/duel.ts';
import { OPPONENTS, opponentAt, profileAt } from '../src/fight/moves.ts';
import { skillOf } from '../src/core/loot.ts';
import { setStab } from '../src/fight/stab-rule.ts';
import { fight } from '../tests/special-battery.ts';
import { STRATEGIES, arena } from '../tests/strategies.ts';

setStab(true);
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? Number(process.argv[i + 1]) : d; };
const SEEDS = arg('seeds', 6), WIN_SEEDS = arg('win-seeds', 200);

const classFight = (opponent, level, seed, strategy) => {
  const profile = profileAt(opponent, level);
  let d = withSpecials(arena(opponentAt(opponent, level), 'longsword', null), level, skillOf(opponent.id)), ai = initialAi((seed * 2654435761) >>> 0), cast = 0, landed = 0;
  for (let i = 0; i < 7200 && !d.finish; i++) {
    const w = decide(d, 1, ai, profile); ai = w.ai;
    d = stepDuel(d, [strategy(d), w.intent]);
    for (const e of d.events) { if (e.type === 'SpecialStarted') cast++; if (e.type === 'SpecialLanded') landed++; }
  }
  return [d.finish ? (d.finish.draw ? 'draw' : d.finish.victim === 1 ? 'win' : 'loss') : 'stall', d.tick, cast, landed, d.fighters[0].health, d.fighters[1].health];
};

const results = [];
for (const [id, opponent] of Object.entries(OPPONENTS)) for (const level of [6, 18, 36]) for (const [name, strategy] of Object.entries(STRATEGIES)) for (let seed = 1; seed <= SEEDS; seed++) results.push([id, level, name, seed, ...classFight(opponent, level, seed, strategy)]);
const text = JSON.stringify(results);
console.log(`class special digest ${createHash('sha256').update(text).digest('hex').slice(0, 16)} (${results.length} fights, ${text.length} bytes)`);

for (const level of [6, 18]) {
  const wins = { off: 0, on: 0 };
  for (let seed = 1; seed <= WIN_SEEDS; seed++) for (const mode of ['off', 'on']) if (fight(level, seed, OPPONENTS.veteran, STRATEGIES['light spam'], mode === 'on').outcome === 'win') wins[mode]++;
  console.log(`light spam vs veteran L${level}: ${WIN_SEEDS} seeds, picked-special OFF ${wins.off} wins (${(100 * wins.off / WIN_SEEDS).toFixed(1)}%), ON ${wins.on} wins (${(100 * wins.on / WIN_SEEDS).toFixed(1)}%)`);
}
