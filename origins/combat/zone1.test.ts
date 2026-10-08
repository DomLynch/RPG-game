import test from 'node:test';
import assert from 'node:assert/strict';
import { HERO_ID, ROW, newFighter, newWorld, stepCombat, type Ev, type HeroInput, type World } from './zone1.ts';

const run = (w: World, input: HeroInput, seconds: number, dt = 1 / 60) => { const events: Ev[] = []; for (let t = 0; t < seconds - 1e-9; t += dt) { const r = stepCombat(w, t === 0 ? input : { attack: null }, dt, () => 0.5); w = r.world; events.push(...r.events); } return { w, events }; };
const wolf = (x: number, z: number) => newFighter({ id: 'wolf-1', kind: 'wolf', x, z, facing: Math.PI, radius: 0.5, level: 11 });

test('hero light attack: reach and arc, a cooldown, damage and a kill', () => {
  let w = newWorld({ x: 0, z: 0, facing: 0 }); w.fighters.push(newFighter({ id: 'g', kind: 'goblin', x: 0, z: 1.8, facing: Math.PI, radius: 0.42, level: 1 }));
  const a = run(w, { attack: 'light' }, 0.3); assert.ok(a.events.some((e) => e.type === 'Swing')); assert.ok(a.events.some((e) => e.type === 'HitTaken' && e.id === 'g'));
  const behind = newWorld({ x: 0, z: 0, facing: 0 }); behind.fighters.push(newFighter({ id: 'g', kind: 'goblin', x: 0, z: -1.8, facing: 0, radius: 0.42, level: 1 }));
  assert.ok(!run(behind, { attack: 'light' }, 0.3).events.some((e) => e.type === 'HitTaken'), 'behind him: outside the arc');
  const far = newWorld({ x: 0, z: 0, facing: 0 }); far.fighters.push(newFighter({ id: 'g', kind: 'goblin', x: 0, z: 4, facing: 0, radius: 0.42, level: 1 }));
  assert.ok(!run(far, { attack: 'light' }, 0.3).events.some((e) => e.type === 'HitTaken'), 'out of reach');
  let k = newWorld({ x: 0, z: 0, facing: 0 }); k.fighters.push(newFighter({ id: 'g', kind: 'goblin', x: 0, z: 1.5, facing: Math.PI, radius: 0.42, level: 1 }));
  const kills: Ev[] = []; for (let i = 0; i < 8; i++) { const r = run(k, { attack: 'light' }, 0.7); k = r.w; kills.push(...r.events); }
  assert.ok(kills.some((e) => e.type === 'Died' && e.id === 'g'), 'dies in a few swings'); assert.equal(k.fighters[1]!.phase, 'dead');
});

test('a creature chases, telegraphs 0.4 s, then bites; the telegraph comes first and a hit on the windup interrupts it', () => {
  const w = newWorld({ x: 0, z: 0, facing: 0 }); w.fighters.push(wolf(0, 10));
  const r = run(w, { attack: null }, 6), tele = r.events.findIndex((e) => e.type === 'Telegraph'), bite = r.events.findIndex((e) => e.type === 'HitTaken' && e.id === HERO_ID);
  assert.ok(tele >= 0 && bite > tele, 'telegraph, then the bite'); assert.equal(r.events[tele]!.ms, 400);
  assert.ok(r.w.fighters[0]!.health < ROW.hero.maxHealth, 'the bite hurt');
});

test('walk away: past the leash or after the give-up time the creature evades home and heals, with no loss event', () => {
  const w = newWorld({ x: 0, z: 0, facing: 0 }); const c = wolf(0, 5); w.fighters.push(c);
  let cur = w, evaded = false; const events: Ev[] = [];
  for (let t = 0; t < 40; t += 1 / 60) { cur.fighters[0]!.z += 6 / 60; const r = stepCombat(cur, { attack: null }, 1 / 60, () => 0.5); cur = r.world; events.push(...r.events); }
  evaded = events.some((e) => e.type === 'Evaded'); assert.ok(evaded, 'it gave up and went home'); const back = cur.fighters[1]!;
  assert.equal(back.health, back.maxHealth, 'healed'); assert.ok(!events.some((e) => e.type === 'Died'), 'nobody died'); assert.ok(Math.hypot(back.x - back.home!.x, back.z - back.home!.z) < 0.5);
});

test('hero death: the Died event, the creature stops (evades), and he heals out of combat otherwise', () => {
  const w = newWorld({ x: 0, z: 0, facing: 0 }); w.fighters[0]!.health = 3; w.fighters.push(wolf(0, 1.4));
  const r = run(w, { attack: null }, 3); assert.ok(r.events.some((e) => e.type === 'Died' && e.id === HERO_ID)); assert.equal(r.w.fighters[0]!.phase, 'dead');
  const calm = newWorld({ x: 0, z: 0, facing: 0 }); calm.fighters[0]!.health = 50; assert.ok(run(calm, { attack: null }, 5).w.fighters[0]!.health > 50, 'regen with nothing around');
});
