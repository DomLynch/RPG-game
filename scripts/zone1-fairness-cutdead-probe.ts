// Probe for the era-on "the hero cuts it dead" red (origins/preview/world-combat.test.ts): the same masher against a level-1 wolf at several hero-to-wolf distances, live rules (era on).
//   node scripts/zone1-fairness-cutdead-probe.ts   -> per distance: kill or no kill in 400 presses (0.5 s each), seconds to kill, hero health left
import { createWorldCombat } from '../src/fight/index.ts';

for (const gap of [0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.4]) {
  const fell: string[] = [], spec = { id: 'wolf-1', body: 'wolf', name: 'wolf', level: 1 }, at = { x: 0, z: gap };
  const mobs = { within: (x: number, z: number, r: number) => fell.length || Math.hypot(at.x - x, at.z - z) > r ? [] : [{ spec, x: at.x, z: at.z, dist: Math.hypot(at.x - x, at.z - z) }], drive: () => {} };
  const wc = createWorldCombat({ mobs: () => mobs, onKill: (s: { id: string }) => void fell.push(s.id), onHeroDied: () => {}, onHeroHit: () => {}, onSwing: () => {} } as never);
  let secs = 0;
  for (let i = 0; i < 400 && !fell.length; i++) { wc.press(); for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().find((q) => q.id === 'wolf-1'); wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 }); secs += 1 / 30; } }
  const h = wc.hero();
  console.log(`gap ${gap.toFixed(1)} m: ${fell.length ? `KILL at ${secs.toFixed(1)} s` : 'no kill in 200 s'}, hero hp ${Math.round(h.health)}/${Math.round(h.max)}${h.dead ? ' (dead)' : ''}`);
}
