import { readFileSync } from 'node:fs';
import { decodeRecord } from '/private/tmp/claude-501/-Users-domininclynch-Desktop-Business-frankendom--claude-worktrees-pensive-goodall-2f90b0/b4d35bc8-416e-48b7-ac18-e4afc3911871/scratchpad/wt-witchfire/src/record.ts';
import { initialPractice, stepPractice } from '/private/tmp/claude-501/-Users-domininclynch-Desktop-Business-frankendom--claude-worktrees-pensive-goodall-2f90b0/b4d35bc8-416e-48b7-ac18-e4afc3911871/scratchpad/wt-witchfire/src/combat.ts';
import { OPPONENTS } from '/private/tmp/claude-501/-Users-domininclynch-Desktop-Business-frankendom--claude-worktrees-pensive-goodall-2f90b0/b4d35bc8-416e-48b7-ac18-e4afc3911871/scratchpad/wt-witchfire/src/moves.ts';
const r = await decodeRecord(readFileSync('scorch-replay.txt', 'utf8').trim());
let p = initialPractice(r.seed, OPPONENTS[r.opponent], r.weapon, r.skill ?? null);
for (const intent of r.intents) { p = stepPractice(p, intent, OPPONENTS[r.opponent].profiles[r.profile]); const f = p.duel.fighters[0];
  if (f.move === 'skill_witchfire' && [0, 20, 40, 44, 60].includes(f.age)) console.log('age', f.age, 'tick', p.duel.tick);
  for (const e of p.events) if (e.move === 'skill_witchfire' && e.type !== 'AttackStarted') console.log(e.type, 'tick', p.duel.tick); }
