// The L16 rung-4 geared hero vs the level-3 troll, the scripted hero of tests/troll-level-fixed.test.ts (guard on a windup/active, a light every 25 ticks), with the era and the cap as knobs, to see what the standing bar measures.
//   ERA=on|off node scripts/zone1-fairness-l16.ts   env: CAP (120 s), SEEDS (16), EVERY (25 ticks)
import { forceSandbox, setRows79, setRows80, setSandbox } from '../src/fight/sandbox-era.ts';
import { creature, newWorld, player, stepCombat, type Input } from '../src/fight/world.ts';
import { rungSheet } from './lib/rung-sheet.ts';

const on = (process.env.ERA ?? 'off') === 'on', CAP = +(process.env.CAP ?? 120), SEEDS = +(process.env.SEEDS ?? 16), EVERY = +(process.env.EVERY ?? 25);
if (on) { forceSandbox(undefined); setSandbox(true); setRows79(true); setRows80(true); } else { forceSandbox(false); setSandbox(false); setRows79(false); setRows80(false); }
const guard = (w: ReturnType<typeof newWorld>, k: number): Input => {
  const f = w.fighters.find((x) => x.side === 'creature' && x.phase !== 'dead');
  return f && (f.phase === 'windup' || f.phase === 'active') ? { x: 0, z: 0, guard: true } : { x: 0, z: 0, attack: k % EVERY === 0 ? 'light' : null };
};
let won = 0, died = 0, timeout = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
  const sheet = rungSheet(4, 16), a = seed * 0.37 + 0.3;
  let w = newWorld([player('hero', 0, 0, 0, 16, null, { weapon: 'longsword', ...(sheet ? { sheet } : {}) }), creature('c0', 'cave-troll', Math.sin(a) * 6, Math.cos(a) * 6, a + Math.PI, 3)]), result = 'timeout';
  for (let k = 0; k < CAP * 60; k++) {
    w = stepCombat(w, { hero: guard(w, k) }, 1 / 60).world;
    if (w.fighters[0]!.phase === 'dead') { result = 'died'; break; }
    if (w.fighters.every((f) => f.side !== 'creature' || f.phase === 'dead')) { result = 'won'; break; }
  }
  if (result === 'won') won++; else if (result === 'died') died++; else timeout++;
}
console.log(`ERA ${on ? 'on' : 'off'} cap ${CAP}s every ${EVERY}: won ${won}/${SEEDS}, died ${died}, timeout ${timeout}`);
