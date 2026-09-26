// Scratch (not committed): find a fight vs the Witch where a Witch-fire LANDS, and write it as a replay link ending ~2.5 s after the hit.
import { writeFileSync } from 'node:fs';
import { initialPractice, stepPractice } from '/private/tmp/claude-501/-Users-domininclynch-Desktop-Business-frankendom--claude-worktrees-pensive-goodall-2f90b0/2ce786f4-5737-4711-9189-e55502312f76/scratchpad/scorch/src/combat.ts';
import { OPPONENTS } from '/private/tmp/claude-501/-Users-domininclynch-Desktop-Business-frankendom--claude-worktrees-pensive-goodall-2f90b0/2ce786f4-5737-4711-9189-e55502312f76/scratchpad/scorch/src/moves.ts';
import { idleIntent, legal } from '/private/tmp/claude-501/-Users-domininclynch-Desktop-Business-frankendom--claude-worktrees-pensive-goodall-2f90b0/2ce786f4-5737-4711-9189-e55502312f76/scratchpad/scorch/src/duel.ts';
import { createRecorder, encodeRecord } from '/private/tmp/claude-501/-Users-domininclynch-Desktop-Business-frankendom--claude-worktrees-pensive-goodall-2f90b0/2ce786f4-5737-4711-9189-e55502312f76/scratchpad/scorch/src/record.ts';
for (const foe of ['witch', 'veteran', 'executioner', 'goblin', 'pitborn', 'knight']) for (let seed = 731; seed < 771; seed++) for (const castAt of [0.9, 1.1]) {
  const meta = { build: 'scorch-still', opponent: foe, weapon: 'longsword', profile: 'normal', seed, skill: 'witchfire' }, rec = createRecorder(meta);
  let p = initialPractice(seed, OPPONENTS[foe], 'longsword', 'witchfire'), hitTick = null;
  for (let t = 0; t < 4000 && !p.finish; t++) {
    const me = p.duel.fighters[0], d = Math.hypot(p.duel.fighters[1].body.x - me.body.x, p.duel.fighters[1].body.z - me.body.z);
    const foeF = p.duel.fighters[1], opening = (foeF.phase === 'hurt' && foeF.stun - foeF.age >= 46) || (foeF.phase === 'attack' && foeF.age > 30 && foeF.move !== null);
    const action = me.phase === 'sheathed' ? 'light' : d <= castAt + 0.1 && opening && legal(me, 'skill') ? 'skill' : d <= castAt && t % 20 === 0 && legal(me, 'kick') ? 'kick' : d <= castAt && t % 20 === 10 ? 'light' : null;
    const intent = { ...idleIntent(), move: { x: 0, z: d > castAt ? 0.8 : 0, yaw: 0, run: false }, action };
    rec.push(intent); p = stepPractice(p, intent, OPPONENTS[foe].profiles.normal);
    if (hitTick === null && p.events.some(e => e.type === 'Hit' && e.move === 'skill_witchfire' && e.target === 1)) hitTick = p.duel.tick;
    if (hitTick !== null && p.duel.tick >= hitTick + 150) break;
  }
  if (hitTick !== null) {
    const record = rec.finish('abandoned'), link = await encodeRecord(record);
    writeFileSync('scorch-replay-rv13.txt', link); console.log(JSON.stringify({ foe, seed, castAt, hitTick, ticks: record.ticks, chars: link.length })); process.exit(0);
  }
}
console.log('none');
