// RV84 receipt: the combat events of a world hero's SPECIAL 1 (cleave, longsword) through the world's own stepBout (the stepper Zone 1 calls), live era vs a record at v83; in range (1.2 m) and out of range (4 m).
import '../tests/lib/era-on.ts';
import { player } from '../src/fight/world.ts';
import { openBout, stepBout } from '../src/fight/open-fight.ts';
import { ME } from '../src/fight/world-record.ts';
import { underRecord } from '../src/fight/detmath.ts';
import { RECORD_VERSION } from '../src/fight/record.ts';

const TICK = 1 / 60, IDLE = { x: 0, z: 0 };
function fight(gap, ticks = 260) {
  const hero = player(ME, 0, 0, 0, 1, 'cleave', { weapon: 'longsword' }), foe = player('p2', 0, gap, Math.PI, 1, null);
  let bout = openBout(hero, foe); const out = [];
  for (let k = 0; k <= ticks; k++) {
    const r = stepBout(bout, hero, foe, k === 0 ? { ...IDLE, special: true } : IDLE, IDLE, TICK, k); bout = r.bout;
    for (const e of r.events) { const p = e.pit ?? {}; if (p.type && p.actor === 0 || p.type === 'Hit' || p.type === 'Staggered') out.push(`t${p.tick ?? k} ${p.type}${p.move ? ' ' + p.move : ''}${p.damage ? ' dmg ' + p.damage : ''}${p.cue ? ' cue ' + p.cue : ''}`); }
  }
  return { out, foeHp: foe.health + '/' + foe.maxHealth };
}
console.log('RECORD_VERSION', RECORD_VERSION);
for (const [label, run] of [['LIVE (RV84)', (g) => fight(g)], ['record at v83', (g) => underRecord({ v: 83 }, () => fight(g))]]) {
  for (const gap of [1.2, 4]) { const r = run(gap); console.log(`\n${label}, special pressed at ${gap} m (foe ${r.foeHp}):\n  ` + (r.out.length ? r.out.join('\n  ') : '(no combat events: the press was refused)')); }
}
