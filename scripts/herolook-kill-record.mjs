// Hero Look kill-screen still (docs/state/herolook.md): a REAL winning fight for the hero, recorded the way main.ts records one (the AI brain
// drives the player, exactly as scripts/kill-link-check.mjs does), encoded as a ?replay= record, so the real game replays it to a genuine
// kill and the still is taken in the real finisher window. Prints the first winning seed's link. No sim change, nothing overridden.
//   node scripts/herolook-kill-record.mjs [--opponent veteran] [--seeds 40]
import { initialPractice, stepPractice } from '../src/combat.ts';
import { createRecorder, encodeRecord } from '../src/record.ts';
import { decide, initialAi } from '../src/ai.ts';
import { OPPONENTS, PROFILES } from '../src/moves.ts';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const opponent = arg('--opponent', 'veteran'), SEEDS = Number(arg('--seeds', 40)), PROFILE = 'normal', MAX = 60 * 120;
for (let s = 0; s < SEEDS; s++) {
  const seed = 731 + s * 97, recorder = createRecorder({ build: 'herolook', opponent, weapon: 'longsword', profile: PROFILE, seed });
  let practice = initialPractice(seed, OPPONENTS[opponent]), hero = initialAi(seed ^ 0x5bd1e995);
  while (!practice.finish && practice.duel.tick < MAX) {
    const w = decide(practice.duel, 0, hero, PROFILES[PROFILE]); hero = w.ai;
    const intent = practice.duel.tick === 0 ? { ...w.intent, action: 'light' } : w.intent;
    practice = stepPractice(practice, recorder.push(intent), OPPONENTS[opponent].profiles[PROFILE]);
  }
  if (practice.finish && !practice.finish.draw && practice.finish.victim === 1) {
    const link = await encodeRecord(recorder.finish('killed'));
    console.log(JSON.stringify({ seed, opponent, ticks: practice.duel.tick, seconds: +(practice.duel.tick / 60).toFixed(1), query: `?replay=${link}` }));
    process.exit(0);
  }
}
console.error(`no winning fight in ${SEEDS} seeds`); process.exit(1);
