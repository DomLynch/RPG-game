// The positioning gate's AI-vs-AI batch (spec docs/specs/combat/positioning-gates.md, Strategy's gate): every banded weapon against every other, both sides driven by the warden brain at the
// chosen rung, the same seeds with bands OFF and ON (bands on = duel.bands plus the `bands` holdBand tactic on both brains). Prints each weapon's mean win share and rank both ways and flags
// a rank move over --rank-tol or a share move over --share-tol; those tolerances are Strategy's tier band (defaults are placeholders until it names the numbers). Exit 1 on a flag.
//   node scripts/bands-batch.mjs [--seeds 40] [--level normal] [--ticks 7200] [--rank-tol 1] [--share-tol 0.08] [--weapons knife,gladius,...]
/* global process, console */
import { decide, initialAi } from '../src/fight/ai.ts';
import { stepDuel } from '../src/fight/duel.ts';
import { OPPONENTS, PROFILES } from '../src/fight/moves.ts';
import { BEST_BAND } from '../src/fight/bands.ts';
import { arena } from '../tests/strategies.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const seeds = Number(arg('seeds', 40)), level = arg('level', 'normal'), ticks = Number(arg('ticks', 7200)), rankTol = Number(arg('rank-tol', 1)), shareTol = Number(arg('share-tol', 0.08));
const weapons = arg('weapons', Object.keys(BEST_BAND).join(',')).split(',');
const profile = (bands) => ({ ...PROFILES[level], ...(bands ? { tactic: 'bands' } : {}) });

function fight(a, b, seed, bands) {   // a on side 0, b on side 1; returns 1 if a wins, 0 if b wins, .5 for a draw or a stall
  let d = { ...arena({ ...OPPONENTS.veteran, weapon: b }, a), ...(bands ? { bands: true } : {}) }, ai0 = initialAi((seed * 2654435761) >>> 0), ai1 = initialAi((seed * 40503 + 7) >>> 0);
  const p = profile(bands);
  for (let i = 0; i < ticks && !d.finish; i++) { const x = decide(d, 0, ai0, p), y = decide(d, 1, ai1, p); ai0 = x.ai; ai1 = y.ai; d = stepDuel(d, [x.intent, y.intent]); }
  return !d.finish || d.finish.draw ? .5 : d.finish.victim === 1 ? 1 : 0;
}
const table = (bands) => {
  const share = Object.fromEntries(weapons.map((w) => [w, { sum: 0, n: 0 }]));
  for (const a of weapons) for (const b of weapons) if (a !== b) for (let s = 1; s <= seeds; s++) { const r = fight(a, b, s, bands); share[a].sum += r; share[a].n++; share[b].sum += 1 - r; share[b].n++; }
  return Object.fromEntries(weapons.map((w) => [w, share[w].sum / share[w].n]));
};
const off = table(false), on = table(true), rank = (t) => Object.fromEntries(Object.entries(t).sort((x, y) => y[1] - x[1]).map(([w], i) => [w, i + 1]));
const ro = rank(off), rn = rank(on);
let flagged = 0;
for (const w of weapons) {
  const dShare = on[w] - off[w], dRank = rn[w] - ro[w], flag = Math.abs(dRank) > rankTol || Math.abs(dShare) > shareTol;
  flagged += flag ? 1 : 0;
  console.log(`${flag ? 'FLAG' : 'ok  '} ${w.padEnd(10)} best ${BEST_BAND[w].padEnd(5)} share off ${off[w].toFixed(3)} on ${on[w].toFixed(3)} (${dShare >= 0 ? '+' : ''}${dShare.toFixed(3)})  rank ${ro[w]} -> ${rn[w]}`);
}
console.log(flagged ? `${flagged} weapon(s) outside the tolerance (rank ${rankTol}, share ${shareTol}); level ${level}, ${seeds} seeds per ordered pair` : `no weapon re-ranked beyond the tolerance (rank ${rankTol}, share ${shareTol}); level ${level}, ${seeds} seeds per ordered pair`);
process.exit(flagged ? 1 : 0);
