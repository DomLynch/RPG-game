// Coach mode battery (Combat, slice 1): the player's side driven by src/coach.ts (decide() with the stance brain, human reaction bounds) against every LIVE foe at each level, one stance per row,
// the foe in its seeded mood (src/stance.ts moodOf), `seeds` fights per cell, side 0 = the coach. A cell is the coach's win rate (draws count half), so Strategy can see what each of the four live
// stance names wins by itself before any UI.   Usage: [FOES=goblin,pitborn] node scripts/coach-battery.mjs [fights=120] [level=6]
import { decide, initialAi } from '../src/ai.ts';
import { createCoach } from '../src/coach.ts';
import { opponentFighter, stepDuel, withStances } from '../src/duel.ts';
import { OPPONENTS, profileAt } from '../src/moves.ts';
import { ROSTER } from '../src/roster.ts';
import { PICKS, asStance, moodOf } from '../src/stance.ts';
import { arena } from '../tests/strategies.ts';

const FIGHTS = Number(process.argv[2] ?? 120), LEVEL = Number(process.argv[3] ?? 6), base = arena();
const FOES = process.env.FOES ? process.env.FOES.split(',') : Object.keys(OPPONENTS).filter((id) => !ROSTER[id]?.hold);
const fight = (stance, foeId, seed) => {
  const foe = OPPONENTS[foeId], profile = profileAt(foe, LEVEL), coach = createCoach(stance, seed);
  let d = { ...base, fighters: [opponentFighter(OPPONENTS.veteran, base.fighters[0].body), opponentFighter(foe, base.fighters[1].body)] };
  d = withStances(d, asStance(stance), asStance(moodOf(seed, foeId)));
  let ai = initialAi((seed * 40503 + 7) >>> 0);
  for (let i = 0; i < 7200 && !d.finish; i++) { const y = decide(d, 1, ai, profile); ai = y.ai; d = stepDuel(d, [coach.step(d), y.intent]); }
  return !d.finish || d.finish.draw ? 0.5 : d.finish.victim === 1 ? 1 : 0;
};
console.log(`coach vs each live foe at level ${LEVEL}, ${FIGHTS} fights per cell (the coach's win rate)`);
console.log(['foe', ...PICKS].map((x) => x.padEnd(13)).join(''));
const mean = Object.fromEntries(PICKS.map((p) => [p, 0]));
for (const foe of FOES) {
  const row = PICKS.map((p) => { let w = 0; for (let s = 1; s <= FIGHTS; s++) w += fight(p, foe, s); return w / FIGHTS; });
  row.forEach((r, i) => { mean[PICKS[i]] += r / FOES.length; });
  console.log([foe.padEnd(13), ...row.map((r) => `${(r * 100).toFixed(0)}%`.padEnd(13))].join(''));
}
console.log('mean over the foes:', PICKS.map((p) => `${p} ${(mean[p] * 100).toFixed(0)}%`).join('  '));
