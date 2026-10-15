// A/B proof for a behaviour-neutral sim change (sim batch C: literals to rows, same values): a fixed set of seeded AI-vs-AI fights across every banded weapon pair, plus the lorarii wall guard sectors and the
// perk scale, hashed every 100 ticks. Run it on the base tree and on the branch; the two printed hashes must be equal.
//   node scripts/sim-ab-hash.mjs [--seeds 6] [--ticks 3000]
/* global process, console */
import { createHash } from 'node:crypto';
import { initialAi, decide } from '../src/fight/ai.ts';
import { lorariusGuard, stepDuel, withPerks } from '../src/fight/duel.ts';
import { OPPONENTS, PROFILES, PLAYER_WEAPONS } from '../src/fight/moves.ts';
import { arena } from '../tests/strategies.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const seeds = Number(arg('seeds', 6)), ticks = Number(arg('ticks', 3000)), h = createHash('sha256');
const weapons = PLAYER_WEAPONS;
let fights = 0;
for (const a of weapons) for (const b of weapons) if (a !== b) for (let s = 1; s <= seeds; s++) {
  let d = arena({ ...OPPONENTS.veteran, weapon: b }, a), ai0 = initialAi((s * 2654435761) >>> 0), ai1 = initialAi((s * 40503 + 7) >>> 0);
  for (let i = 0; i < ticks && !d.finish; i++) {
    const x = decide(d, 0, ai0, PROFILES.normal), y = decide(d, 1, ai1, PROFILES.normal); ai0 = x.ai; ai1 = y.ai; d = stepDuel(d, [x.intent, y.intent]);
    if (i % 100 === 0) h.update(JSON.stringify({ t: d.tick, f: d.fighters, x: d.finish }));
  }
  h.update(JSON.stringify({ end: d.tick, f: d.fighters, x: d.finish })); fights++;
}
for (let k = 0; k < 720; k++) { const a = k * Math.PI / 360 - Math.PI; h.update(String(lorariusGuard({ x: Math.cos(a) * 9, z: Math.sin(a) * 9 }))); }
for (const v of [-30, -7, 0, 11, 30]) { const d = withPerks(arena(), [{ vitality: v, wind: v }, { stride: v }]); h.update(JSON.stringify(d.fighters.map((f) => [f.maxHealth, f.health, f.regen, f.speed]))); }
console.log(`${fights} fights, hash ${h.digest('hex')}`);
