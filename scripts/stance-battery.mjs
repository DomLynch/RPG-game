// RV34 battery (docs/specs/origins/combat-study.md, stances ruling: every pair wins 40-60%, none dominant): the SAME body and brain on both sides (the opponent's own profile at the given
// level), every stance against every stance, each pair fought from both sides so the first-side edge cancels. A cell is the ROW stance's win rate (draws count half) over `seeds` x 2 fights.
// Usage: [STANCE_TUNE='{"defensive":{"recover":1000}}'] node scripts/stance-battery.mjs [seeds] [opponent] [level]   (STANCE_TUNE overrides table entries for a what-if run)
import { decide, initialAi } from '../src/ai.ts';
import { opponentFighter, stepDuel, withStances } from '../src/duel.ts';
import { OPPONENTS, profileAt } from '../src/moves.ts';
import { PICKS, STANCES, asStance } from '../src/stance.ts';
import { arena } from '../tests/strategies.ts';

for (const [id, deltas] of Object.entries(JSON.parse(process.env.STANCE_TUNE ?? '{}'))) Object.assign(STANCES[id], deltas);
// Brains (Strategy, 2026-10-07: the honest bots barely block, feint or kick, so the defensive stances cannot show): `honest` is the opponent's own profile; `blocker` guards and parries (a human who plays the
// defence); `feinter` feints and kicks (a human who plays the mind games). Both sides use the same brain, so a cell isolates the stances. Usage: BRAIN=honest|blocker|feinter.
const BRAINS = { honest: {}, blocker: { parry: .7, dodge: .1, aggression: .35, guard: 1, lapse: .1, read: .9 }, feinter: { feint: .5, kick: .6, aggression: .7, parry: .2, read: .8 } };
const BRAIN = process.env.BRAIN ?? 'honest';
const SEEDS = Number(process.argv[2] ?? 30), FOE = process.argv[3] ?? 'pitborn', LEVEL = Number(process.argv[4] ?? 6);
const opponent = OPPONENTS[FOE], profile = { ...profileAt(opponent, LEVEL), ...BRAINS[BRAIN] }, base = arena();
const fight = (s0, s1, seed) => {
  let d = { ...base, fighters: [opponentFighter(opponent, base.fighters[0].body), opponentFighter(opponent, base.fighters[1].body)] };
  d = withStances(d, asStance(s0), asStance(s1));
  let a0 = initialAi((seed * 2654435761) >>> 0), a1 = initialAi((seed * 40503 + 7) >>> 0);
  for (let i = 0; i < 7200 && !d.finish; i++) { const x = decide(d, 0, a0, profile), y = decide(d, 1, a1, profile); a0 = x.ai; a1 = y.ai; d = stepDuel(d, [x.intent, y.intent]); }
  return !d.finish || d.finish.draw ? 0.5 : d.finish.victim === 1 ? 1 : 0;   // side 0's score
};
console.log(`${FOE} L${LEVEL}, ${BRAIN} brain, ${SEEDS * 2} fights per cell (row stance's win rate)`);
console.log(['row \\ col', ...PICKS].map(x => x.padEnd(11)).join(''));
const mean = [];
for (const row of PICKS) {
  const cells = [];
  for (const col of PICKS) { let w = 0; for (let s = 1; s <= SEEDS; s++) { w += fight(row, col, s); w += 1 - fight(col, row, s + 1000); } cells.push(w / (2 * SEEDS)); }
  mean.push(cells.reduce((a, b) => a + b, 0) / cells.length);
  console.log([row.padEnd(11), ...cells.map(c => `${(c * 100).toFixed(0)}%`.padEnd(11))].join(''));
}
console.log('mean vs the field:', PICKS.map((p, i) => `${p} ${(mean[i] * 100).toFixed(0)}%`).join('  '));
