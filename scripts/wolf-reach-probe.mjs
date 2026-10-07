// How far from the wolf a bite lands: for each of the three strikes, the largest starting gap at which the wolf's bite connects with a standing, idle man, and the
// height it connects at (head / torso / legs). The AI's `reach` for a move is an estimate; this is the measured number it should be near (the Goblin's knife: slash 1.2 / stab 1.45 / hack 1.55).
//   node scripts/wolf-reach-probe.mjs [opponent=wolf]
import { createFighter, idleIntent, opponentFighter, stepDuel } from '../src/duel.ts';
import { OPPONENTS } from '../src/moves.ts';
import { TARGET } from '../src/sim.ts';

const id = process.argv[2] ?? 'wolf', o = OPPONENTS[id];
const mk = (gap) => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + gap, heading: Math.PI, distance: 0 }, 'ready'), opponentFighter(o, { x: TARGET.x, z: TARGET.z, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] });
for (const action of ['light', 'thrust', 'heavy']) {
  let far = null, where = null;
  for (let gap = 0.3; gap <= 2.4; gap += 0.02) {
    let d = mk(gap);
    for (let t = 0; t < 90; t++) { d = stepDuel(d, [idleIntent(), { ...idleIntent(), action: t === 0 ? action : null }]); const hit = d.events.find((e) => e.type === 'Hit' && e.actor === 1); if (hit) { far = gap; where = hit.location; break; } }
  }
  console.log(`${id} ${action}: lands from ${far === null ? 'never' : far.toFixed(2) + ' m'} (${where ?? '-'}); the move's reach estimate ${o ? '' : ''}`);
}
console.log(JSON.stringify({ scale: o.scale, health: o.health }));
