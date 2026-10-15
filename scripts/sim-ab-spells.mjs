// A/B proof for the spell-slots sim PR: a ONE-spell fight (slot a only, as every fight before the slots) hashes the same on the base tree and on the branch.
// Seeded AI-vs-AI fights with Special Moves and a spell on side 0, the hero pressing the cast whenever it is legal; hashed every 100 ticks.
//   node scripts/sim-ab-spells.mjs [--seeds 6] [--ticks 3000]   (run on the base tree and on the branch; the two printed hashes must be equal)
/* global process, console */
import { createHash } from 'node:crypto';
import { initialAi, decide } from '../src/fight/ai.ts';
import { legal, stepDuel, withSpecials, withSpell } from '../src/fight/duel.ts';
import { OPPONENTS, PROFILES } from '../src/fight/moves.ts';
import { SPELL_IDS, resolveSpell } from '../src/fight/spell-cast.ts';
import { arena } from '../tests/strategies.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const seeds = Number(arg('seeds', 6)), ticks = Number(arg('ticks', 3000)), h = createHash('sha256');
const ids = SPELL_IDS.filter((id) => resolveSpell(id, 0).cost > 0).slice(0, 4);
let fights = 0;
for (const id of ids) for (const skill of [0, 60, 100]) for (let s = 1; s <= seeds; s++) {
  let d = withSpell(withSpecials(arena(OPPONENTS.veteran), 6, 'shove'), 0, resolveSpell(id, skill), s * 7919);
  d.fighters[0].skillCooldown = 0; d.fighters[1].skillCooldown = 0;
  let ai0 = initialAi((s * 2654435761) >>> 0), ai1 = initialAi((s * 40503 + 7) >>> 0);
  for (let i = 0; i < ticks && !d.finish; i++) {
    const x = decide(d, 0, ai0, PROFILES.normal), y = decide(d, 1, ai1, PROFILES.normal); ai0 = x.ai; ai1 = y.ai;
    const intent = i % 40 === 0 && legal(d.fighters[0], 'skill') ? { ...x.intent, action: 'skill' } : x.intent;
    d = stepDuel(d, [intent, y.intent]);
    if (i % 100 === 0) h.update(JSON.stringify({ t: d.tick, f: d.fighters, x: d.finish, c: d.cast }));
  }
  h.update(JSON.stringify({ end: d.tick, f: d.fighters, x: d.finish, c: d.cast })); fights++;
}
console.log(`${fights} fights, hash ${h.digest('hex')}`);
