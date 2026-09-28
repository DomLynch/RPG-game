import { initialPractice, stepPractice } from '/Users/domininclynch/Desktop/Business/frankendom/.claude/worktrees/lucid-ellis-9746bf/src/combat.ts';
import { createRecorder } from '/Users/domininclynch/Desktop/Business/frankendom/.claude/worktrees/lucid-ellis-9746bf/src/record.ts';
import { decide, initialAi } from '/Users/domininclynch/Desktop/Business/frankendom/.claude/worktrees/lucid-ellis-9746bf/src/ai.ts';
import { LEVEL_ANCHORS, OPPONENTS, PROFILES, opponentAt, profileAt } from '/Users/domininclynch/Desktop/Business/frankendom/.claude/worktrees/lucid-ellis-9746bf/src/moves.ts';
const OPP = process.argv[2]; if (!OPPONENTS[OPP]) { console.log('no OPPONENTS key', OPP, Object.keys(OPPONENTS).join(',')); process.exit(2); }
let wins = 0;
for (let s = 0; s < 40; s++) {
  const seed = 731 + s * 97, level = LEVEL_ANCHORS.normal, recorder = createRecorder({ build: 'rank-look', opponent: OPP, weapon: 'longsword', level, seed });
  let practice = initialPractice(seed, opponentAt(OPPONENTS[OPP], level)), hero = initialAi(seed ^ 0x5bd1e995);
  while (!practice.finish && practice.duel.tick < 60 * 120) { const w = decide(practice.duel, 0, hero, PROFILES.normal); hero = w.ai; practice = stepPractice(practice, recorder.push(practice.duel.tick === 0 ? { ...w.intent, action: 'light' } : w.intent), profileAt(OPPONENTS[OPP], level)); }
  const f = practice.finish, won = f && !f.draw && f.victim === 1;
  if (won) { wins++; if (wins === 1) console.log('first win seed', seed, 's', s, 'ticks', practice.duel.tick); }
}
console.log(OPP, 'wins', wins, '/ 40');
