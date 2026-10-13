// A scripted Defensive-vs-Defensive fight, stepped tick by tick, reduced to one sha256 (every tick's duel hash and every event). Used to pin that a record below v52 replays the OLD Defensive stance (parry and
// guard-counter windows a quarter longer) byte for byte: the digest was taken on the build before the stance rows moved (#2447's tip), and the test below replays it under the v51 era.
import { createHash } from 'node:crypto';
import { decide, initialAi } from '../src/fight/ai.ts';
import { stepDuel, withStances } from '../src/fight/duel.ts';
import { OPPONENTS, profileAt, opponentAt } from '../src/fight/moves.ts';
import { hashDuel } from '../src/net/rollback.ts';
import { STRATEGIES, arena } from './strategies.ts';

export function scenarioDigest(): string {
  const h = createHash('sha256');
  for (const name of ['perfect parry', 'turtle and punish', 'light spam']) for (const seed of [3, 11]) {
    let d = withStances(arena(opponentAt(OPPONENTS.veteran, 20)), 'defensive', 'defensive'), ai = initialAi((seed * 2654435761) >>> 0);
    const profile = profileAt(OPPONENTS.veteran, 20), strategy = STRATEGIES[name]!;
    for (let i = 0; i < 1500 && !d.finish; i++) {
      const w = decide(d, 1, ai, profile); ai = w.ai; d = stepDuel(d, [strategy(d), w.intent]);
      h.update(String(hashDuel(d))); if (d.events.length) h.update(JSON.stringify(d.events));
    }
    h.update(`|${name}|${seed}|${d.tick}|`);
  }
  return h.digest('hex');
}
