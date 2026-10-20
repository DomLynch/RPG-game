// The zone page's own path in a node script: a hero built the way world-combat.ts body() builds it (player(ME, ..., special, { weapon })), a creature joined with joinFighter, stepped with
// world-record.ts stepHero / quantStep (SPECIAL 1 = step.cast, what #skill-button's wc.cast() queues). Live era vs a record at v83.
import '../tests/lib/era-on.ts';
import { newWorld, player } from '../src/fight/world.ts';
import { ME, STEP, joinFighter, quantStep, stepHero } from '../src/fight/world-record.ts';
import { underRecord } from '../src/fight/detmath.ts';

function run(gap, kind, skill = 'cleave') {
  let world = newWorld([player(ME, 0, 0, 0, 16, skill, { weapon: 'longsword' })]);
  world = { ...world, fighters: [...world.fighters, joinFighter({ id: 'scav', kind, x: 0, z: gap, level: 1 })] };
  const gear = { level: 16, shielded: false }, rows = [];
  const foeHp = () => world.fighters[1].health + '/' + world.fighters[1].maxHealth;
  for (let k = 0; k < 200; k++) {
    const step = quantStep(k === 0 ? { x: 0, z: 0, facing: 0 } : null, false, null, null, null, k === 5);   // a few idle frames (the creature's own aggro), then SPECIAL 1
    const r = stepHero(world, step, gear); world = r.world;
    for (const e of r.events) if (e.actor === ME || e.type === 'Hit' || e.type === 'Staggered') rows.push(`frame ${k} ${e.type}${e.pit?.type ? ' [' + e.pit.type + (e.pit.move ? ' ' + e.pit.move : '') + (e.pit.damage ? ' dmg ' + e.pit.damage : '') + (e.pit.cue ? ' cue ' + e.pit.cue : '') + ']' : ''}${e.damage ? ' dmg ' + e.damage : ''}`);
  }
  return { rows, foeHp: foeHp(), hero: world.fighters[0] };
}
for (const kind of ['goblin']) for (const [label, f] of [['LIVE RV84', (g) => run(g, kind)], ['record v83', (g) => underRecord({ v: 83 }, () => run(g, kind))]]) for (const gap of [1.2, 4]) {
  const r = f(gap); console.log(`\n${label}, ${kind} at ${gap} m, SPECIAL 1 pressed at frame 5 (foe ${r.foeHp}; hero.skill=${r.hero.skill}):\n  ` + (r.rows.length ? r.rows.slice(0, 14).join('\n  ') : '(no events)'));
}
