// RV30 backstep evidence: does a backstep / roll / guard answer the Executioner's heavy, by start gap and reaction delay?
//   node scripts/backstep-probe.mjs   env: FOE (executioner), MOVE (heavy), BS_TICKS (override RULES.backstep.ticks), BS_SPEED
import { OPPONENTS } from '../src/combat.ts';
import { RULES } from '../src/moves.ts';
import { stepDuel, movesOf } from '../src/duel.ts';
import { arena, act, idle, gap, W, P, blows } from '../tests/strategies.ts';

const foe = OPPONENTS[process.env.FOE ?? 'executioner'], move = process.env.MOVE ?? 'heavy';
const R = { ...RULES, backstep: { ...RULES.backstep, ticks: +(process.env.BS_TICKS ?? RULES.backstep.ticks), speed: +(process.env.BS_SPEED ?? RULES.backstep.speed) } };
const run = (g, reply, delay) => {
  let d = arena(foe); d.fighters[0].body.z = d.fighters[1].body.z + g; d.fighters[0].phase = 'ready'; d.fighters[1].phase = 'ready';
  let swung = -1, taken = 0;
  for (let i = 0; i < 260; i++) {
    const w = W(d), start = swung < 0 && w.phase === 'attack';
    if (start) swung = d.tick;
    const age = swung < 0 ? -1 : d.tick - swung;
    let mine = idle();
    if (swung >= 0 && age === delay) mine = reply === 'backstep' ? act('backstep') : reply === 'roll' ? act('dodge', { move: { x: 0, z: 1, yaw: 0, run: false } }) : idle();
    if (reply === 'guard' && swung >= 0 && age >= delay && age < 70) mine = { ...idle(), guard: true };
    d = stepDuel(d, [mine, swung < 0 ? act(move) : idle()], R);
    taken += blows(d.events).taken; d.events = [];
    if (taken) return 1;
  }
  return 0;
};
const mv = movesOf(W(arena(foe)))[move === 'heavy' ? 'heavy_overhead' : move];
console.log(`${process.env.FOE ?? 'executioner'} ${move}: reach ${mv.reach} stepIn ${mv.stepIn ?? 0}; backstep ticks ${R.backstep.ticks} speed ${R.backstep.speed}`);
console.log('hit? (1 = player hit) rows: reply @delay; cols: start gap m');
const gaps = [.85, 1.2, 1.6, 2.0, 2.6];
console.log('reply@delay'.padEnd(14) + gaps.map(g => String(g).padStart(6)).join(''));
for (const reply of ['none', 'backstep', 'roll', 'guard']) for (const delay of [0, 6, 12, 18]) {
  if (reply === 'none' && delay) continue;
  console.log(`${reply}@${delay}`.padEnd(14) + gaps.map(g => String(run(g, reply, delay)).padStart(6)).join(''));
}
