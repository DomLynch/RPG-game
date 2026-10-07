// RV30 own-row evidence: the scripted battery (tests/strategies.ts) against one opponent at normal and hard, wins / untouched per script.
//   node scripts/own-row-battery.mjs   env: IDS (shieldmaiden,knight,plaguedoctor), SEEDS (24), LEVELS (normal,hard)
import { OPPONENTS } from '../src/combat.ts';
import { battery, STRATEGIES, TAP_ATTACK } from '../tests/strategies.ts';

const seeds = +(process.env.SEEDS ?? 24);
for (const id of (process.env.IDS ?? 'shieldmaiden,knight,plaguedoctor').split(',')) for (const level of (process.env.LEVELS ?? 'normal,hard').split(',')) {
  const rows = battery(level, seeds, 7200, OPPONENTS[id], { ...STRATEGIES, ...TAP_ATTACK });
  const top = Object.entries(rows).sort((a, b) => b[1].wins - a[1].wins)[0];
  console.log(`${id} ${level}: top ${top[0]} ${top[1].wins}/${seeds}; ` + Object.entries(rows).map(([n, r]) => `${n} ${r.wins}w/${r.untouched}u/${r.stalls}s`).join(' | '));
}

// Readability: the foe's mean health left when the fight ends (a script that never wins still shows how far it gets): kick only v light spam.
import { arena } from '../tests/strategies.ts';
import { decide, initialAi } from '../src/ai.ts';
import { stepDuel } from '../src/duel.ts';
import { opponentAt, profileAt } from '../src/moves.ts';
for (const id of (process.env.IDS ?? 'shieldmaiden,knight,plaguedoctor').split(',')) for (const level of (process.env.LEVELS ?? 'normal,hard').split(',')) {
  const out = [];
  for (const name of ['kick only', 'light spam']) {
    let left = 0, n = 0;
    for (let s = 1; s <= seeds; s++) {
      const o = OPPONENTS[id], profile = o.profiles[level]; let d = arena(o), ai = initialAi((s * 2654435761) >>> 0);
      for (let i = 0; i < 7200 && !d.finish; i++) { const w = decide(d, 1, ai, profile); ai = w.ai; d = stepDuel(d, [STRATEGIES[name](d), w.intent]); }
      left += d.fighters[1].health; n++;
    }
    out.push(`${name} foe health left ${(left / n).toFixed(0)}`);
  }
  console.log(`${id} ${level}: ${out.join(' | ')}`);
}
