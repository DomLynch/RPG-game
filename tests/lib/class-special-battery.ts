// A small class-special battery for the era proof (tests/sandbox-era.test.ts): the player carries NO skill (nothing picked), the opponent casts its own class special (specials on), a few strategies x seeds; the hash of every fight's
// outcome, ticks, special tallies and health. It imports nothing era-related, so the same file runs on any sha: the pin in the test was taken at trunk b40785691, before the sandbox landed.
import { createHash } from 'node:crypto';
import { decide, initialAi } from '../../src/fight/ai.ts';
import { stepDuel, withSpecials } from '../../src/fight/duel.ts';
import { OPPONENTS, opponentAt, profileAt } from '../../src/fight/moves.ts';
import { skillOf } from '../../src/core/loot.ts';
import { STRATEGIES, arena } from '../strategies.ts';

const OPPONENT_IDS = ['veteran', 'pitborn', 'goblin', 'nightborn', 'executioner', 'dwarf', 'shieldmaiden', 'knight'] as const;
const STRATEGY_IDS = ['light spam', 'turtle and punish'] as const;

export function classSpecialBatteryHash(seeds = 3, levels: readonly number[] = [6, 36]): string {
  const results: unknown[] = [];
  for (const id of OPPONENT_IDS) for (const level of levels) for (const sname of STRATEGY_IDS) for (let seed = 1; seed <= seeds; seed++) {
    const opponent = OPPONENTS[id], strategy = STRATEGIES[sname] ?? Object.values(STRATEGIES)[0]!, profile = profileAt(opponent, level);
    let d = withSpecials(arena(opponentAt(opponent, level), 'longsword', null), level, skillOf(opponent.id)), ai = initialAi((seed * 2654435761) >>> 0), cast = 0, landed = 0;
    for (let i = 0; i < 7200 && !d.finish; i++) {
      const w = decide(d, 1, ai, profile); ai = w.ai;
      d = stepDuel(d, [strategy(d), w.intent]);
      for (const e of d.events) { if (e.type === 'SpecialStarted') cast++; if (e.type === 'SpecialLanded') landed++; }
    }
    results.push([id, level, sname, seed, d.finish ? (d.finish.draw ? 'draw' : d.finish.victim === 1 ? 'win' : 'loss') : 'stall', d.tick, cast, landed, d.fighters[0].health, d.fighters[1].health]);
  }
  return createHash('sha256').update(JSON.stringify(results)).digest('hex').slice(0, 16);
}
