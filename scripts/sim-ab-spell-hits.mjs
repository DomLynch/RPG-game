// A/B proof for the spell-pulse PR (RV69): a fight resolved at record version 68 (below hitsFrom) hashes the same on the base tree and on the branch, for EVERY root including the ones with a pulse row.
// Seeded AI-vs-AI fights with Special Moves and a spell on side 0, the hero pressing the cast whenever it is legal; hashed every 100 ticks. The branch's new Spell/Fighter fields (hits, hitEvery, hitHolds, volley) are
// left out of the hash so the two trees compare on behaviour, not on a field the base does not have.
//   node scripts/sim-ab-spell-hits.mjs [--era 68] [--seeds 6] [--ticks 3000]   (run on the base tree and on the branch with --era 68: the printed hashes must be equal; --era 69 on the branch moves ONLY the row roots)
/* global process, console */
import { createHash } from 'node:crypto';
import { initialAi, decide } from '../src/fight/ai.ts';
import { legal, stepDuel, withSpecials, withSpell } from '../src/fight/duel.ts';
import { OPPONENTS, PROFILES } from '../src/fight/moves.ts';
import { resolveSpell } from '../src/fight/spell-cast.ts';
import { arena } from '../tests/strategies.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const seeds = Number(arg('seeds', 6)), ticks = Number(arg('ticks', 3000)), era = Number(arg('era', 68)), power = Number(arg('power', 0)), IDS = (arg('ids', 'hervor,barghest,brokkr,andvari')).split(',');   // --power: the sheet's spell power (credit), so a dear spell (Three Blows costs 65) is not always a fizzle
const SKIP = new Set(['hits', 'hitEvery', 'hitHolds', 'volley']), strip = (_k, v) => (SKIP.has(_k) ? undefined : v);
const roots = {};
for (const id of IDS) { const h = createHash('sha256'); let fights = 0;
  for (const skill of [0, 60, 100]) for (let s = 1; s <= seeds; s++) {
    let d = withSpell(withSpecials(arena(OPPONENTS.veteran), 6, 'shove'), 0, resolveSpell(id, skill, power, era), s * 7919);
    d.fighters[0].skillCooldown = 0; d.fighters[1].skillCooldown = 0;
    let ai0 = initialAi((s * 2654435761) >>> 0), ai1 = initialAi((s * 40503 + 7) >>> 0);
    for (let i = 0; i < ticks && !d.finish; i++) {
      const x = decide(d, 0, ai0, PROFILES.normal), y = decide(d, 1, ai1, PROFILES.normal); ai0 = x.ai; ai1 = y.ai;
      const intent = i % 40 === 0 && legal(d.fighters[0], 'skill') ? { ...x.intent, action: 'skill' } : x.intent;
      d = stepDuel(d, [intent, y.intent]);
      if (i % 100 === 0) h.update(JSON.stringify({ t: d.tick, f: d.fighters, x: d.finish, c: d.cast }, strip));
    }
    h.update(JSON.stringify({ end: d.tick, f: d.fighters, x: d.finish, c: d.cast }, strip)); fights++;
  }
  roots[id] = `${fights} fights ${h.digest('hex').slice(0, 16)}`;
}
console.log(JSON.stringify({ era, roots }, null, 1));
