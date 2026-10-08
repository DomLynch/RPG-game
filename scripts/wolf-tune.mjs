// Fairness probe for a beast profile: the hero's brain (easy / normal) against the wolf and the Goblin, N seeded AI-vs-AI fights each, the warden's wins. Used to tune the wolf's profile NUMBERS
// toward the Goblin's rates (about 7/24 easy, 4/24 normal) with no new mechanics.   node scripts/wolf-tune.mjs '{"easy":{"accuracy":.7},"normal":{...}}'
import { decide, initialAi } from '../src/ai.ts';
import { createFighter, opponentFighter, stepDuel } from '../src/duel.ts';
import { OPPONENTS, PROFILES } from '../src/moves.ts';
import { TARGET } from '../src/sim.ts';
const patch = JSON.parse(process.argv[2] ?? '{}'), seeds = Number(process.argv[3] ?? 24);
function wins(o, level) {
  let n = 0;
  for (let s = 1; s <= seeds; s++) {
    let d = { tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + 1.6, heading: Math.PI, distance: 0 }, 'ready'), opponentFighter(o, { ...TARGET, heading: 0, distance: 0 })], finish: null, events: [] };
    let a = initialAi(((s * 2654435761) >>> 0) ^ 0x9e3779b9), b = initialAi((s * 2654435761) >>> 0);
    for (let i = 0; i < 9000 && !d.finish; i++) { const x = decide(d, 0, a, PROFILES[level]), y = decide(d, 1, b, o.profiles[level]); a = x.ai; b = y.ai; d = stepDuel(d, [x.intent, y.intent]); }
    if (d.finish && d.finish.victim === 1 && !d.finish.draw) n++;
  }
  return n;
}
const FOE = process.env.FOE ?? 'wolf', w = OPPONENTS[FOE], tuned = { ...w, ...(patch.row ?? {}), profiles: { ...w.profiles, easy: { ...w.profiles.easy, ...(patch.easy ?? {}) }, normal: { ...w.profiles.normal, ...(patch.normal ?? {}) }, hard: { ...w.profiles.hard, ...(patch.hard ?? {}) } } };
console.log(JSON.stringify(patch), `${FOE} wins of ${seeds}: easy ${wins(tuned, 'easy')}, normal ${wins(tuned, 'normal')}   (goblin: easy ${wins(OPPONENTS.goblin, 'easy')}, normal ${wins(OPPONENTS.goblin, 'normal')})`);
