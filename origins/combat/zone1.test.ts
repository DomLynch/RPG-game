// Zone 1's combat loop, slice 0 (origins/combat/zone1.ts): movement on the one speed table, the player's light cut (reach, arc, damage, stamina), a creature's telegraphed bite by kind,
// death, and the leash / give-up / heal-on-return. Pure steps at a fixed 1/60.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MOVES, OPPONENTS, RULES } from '../../src/moves.ts';
import { LEASH, SPEEDS } from '../preview/speeds.ts';
import { BLOW_WEIGHT, creature, newWorld, player, stepCombat, type Event, type Fighter, type Input, type World } from './zone1.ts';

const DT = 1 / 60, STILL: Input = { x: 0, z: 0 };
const get = (w: World, id: string): Fighter => w.fighters.find((f) => f.id === id)!;
/** Step `seconds`, with `input(t, world)` for the player; collects every event. */
function run(world: World, seconds: number, input: (t: number, w: World) => Input = () => STILL): { world: World; events: Event[] } {
  const events: Event[] = [];
  for (let t = 0; t < Math.round(seconds * 60); t++) { const r = stepCombat(world, { p: input(t, world) }, DT); world = r.world; events.push(...r.events); }
  return { world, events };
}

test('the player walks 2.3 and runs 5.2 m/s (the speed table), facing where he goes', () => {
  const w = newWorld([player('p', 0, 0)]);
  const walked = get(run(w, 1, () => ({ x: 0, z: 1 })).world, 'p'), ran = get(run(w, 1, () => ({ x: 1, z: 0, run: true })).world, 'p');
  assert.ok(Math.abs(walked.z - SPEEDS.player.walk) < 0.05, `walked ${walked.z}`);
  assert.ok(Math.abs(ran.x - SPEEDS.player.run) < 0.05, `ran ${ran.x}`);
  assert.ok(Math.abs(ran.facing - Math.PI / 2) < 1e-9);
});

test('a light cut: telegraph, then a swing, lands the sword row\'s damage on a creature in reach and arc, once; costs stamina that comes back', () => {
  const cut = MOVES.light_right;
  const target = creature('w', 'wolf', 0, 1.2); target.phase = 'stagger'; target.hurtFor = 99;
  const w = newWorld([player('p', 0, 0, 0), target]);
  const { world, events } = run(w, 1.2, (t) => (t === 0 ? { x: 0, z: 0, attack: 'light' } : STILL));
  assert.deepEqual(events.filter((e) => e.type === 'Telegraph' && e.id === 'p'), [{ type: 'Telegraph', id: 'p', move: cut.id, ms: Math.round((cut.windup / 60) * 1000) }]);
  const hits = events.filter((e) => e.type === 'Hit' && e.attacker === 'p');
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.type === 'Hit' && hits[0]!.damage, cut.damage);
  assert.equal(get(world, 'w').health, OPPONENTS.wolf.health - cut.damage);
  assert.ok(get(world, 'p').stamina < 100 && get(world, 'p').stamina >= 100 - cut.stamina - 1e-9, 'the cut cost stamina');
  assert.equal(get(run(world, 3).world, 'p').stamina, 100, 'and it regenerates');
});

test('a light cut misses behind the player and beyond reach', () => {
  for (const [x, z] of [[0, -1.2], [0, 3.5], [3, 0]] as const) {
    const dummy = creature('w', 'wolf', x, z); dummy.phase = 'stagger'; dummy.hurtFor = 99;   // held still, so only the geometry decides
    const w = newWorld([player('p', 0, 0, 0), dummy]);
    const { events } = run(w, 0.8, (t) => (t === 0 ? { x: 0, z: 0, attack: 'light' } : STILL));
    assert.equal(events.filter((e) => e.type === 'Hit' && e.attacker === 'p').length, 0, `${x},${z}`);
  }
});

test('a creature bites with a 0.4 s telegraph; damage is by kind (the bite row times the creature\'s weight)', () => {
  for (const kind of ['wolf', 'boar', 'bear']) {
    const w = newWorld([player('p', 0, 0), creature('c', kind, 0, 5)]);
    const { events, world } = run(w, 5);
    const tele = events.find((e) => e.type === 'Telegraph' && e.id === 'c');
    assert.ok(tele && tele.type === 'Telegraph' && tele.ms === 400, `${kind} telegraph ${JSON.stringify(tele)}`);
    const hit = events.find((e) => e.type === 'Hit' && e.victim === 'p');
    assert.ok(hit && hit.type === 'Hit' && hit.damage === Math.round(10 * BLOW_WEIGHT[kind]!), `${kind} damage`);
    assert.ok(get(world, 'p').health < 150);
  }
});

test('creatures close at the table\'s chase speed: the wolf faster than the boar', () => {
  const closed = (kind: string) => 8.5 - get(run(newWorld([player('p', 0, 0), creature('c', kind, 0, 8.5)]), 0.5).world, 'c').z;
  const wolf = closed('wolf'), boar = closed('boar');
  assert.ok(Math.abs(wolf - 6.0 * 0.5) < 0.1, `wolf closed ${wolf}`);
  assert.ok(Math.abs(boar - 4.5 * 0.5) < 0.1, `boar closed ${boar}`);
});

test('a kill: Died is emitted once, the body stays dead, and the creature stops hunting a dead player', () => {
  const p = player('p', 0, 0); p.health = 5;
  const { world, events } = run(newWorld([p, creature('c', 'bear', 0, 1)]), 3);
  assert.equal(events.filter((e) => e.type === 'Died').length, 1);
  assert.equal(get(world, 'p').phase, 'dead'); assert.equal(get(world, 'p').health, 0);
  assert.equal(get(world, 'c').hunting, false);
});

test('running away works from a boar (chase 4.5 < run 5.2): the leash ends the chase, it walks home and heals to full, one Evaded event and nothing else', () => {
  const b = creature('b', 'boar', 0, 4); b.health = 40;
  const w = newWorld([player('p', 0, 0), b]);
  const away = run(w, 12, () => ({ x: 0, z: -1, run: true }));
  const boar = get(away.world, 'b');
  assert.equal(boar.hunting, false, 'it gave up');
  assert.equal(away.events.filter((e) => e.type === 'Hit').length, 0, 'it never landed a bite');
  const home = run(away.world, 60);   // the player stands far away; it walks home at the amble
  assert.equal(get(home.world, 'b').health, OPPONENTS.boar.health);
  assert.equal(get(home.world, 'b').returning, false);
  assert.deepEqual(home.events, [{ type: 'Evaded', id: 'b' }], 'one Evaded for the mount, nothing else: no Hit, no Died, no XP-bearing event');
});

test('the wolf is faster than a runner but gives up at a 15 m leash, the boar at 30', () => {
  assert.ok(SPEEDS.creature.wolfChase > SPEEDS.player.run && LEASH.wolf === 15 && LEASH.default === 30);
  const w = newWorld([player('p', 0, 0), creature('w', 'wolf', 0, 4)]);
  const r = run(w, 8, () => ({ x: 0, z: -1, run: true }));
  assert.equal(get(r.world, 'w').hunting, false, 'the wolf gave up inside 8 s');
});

test('stepCombat is pure: it never mutates the world it is given', () => {
  const w = newWorld([player('p', 0, 0), creature('c', 'wolf', 0, 2)]);
  const before = JSON.stringify(w);
  run(w, 2, () => ({ x: 0, z: 1, attack: 'light' }));
  assert.equal(JSON.stringify(w), before);
});

test('the player\'s health is the rules\' number', () => {
  assert.equal(player('p', 0, 0).health, RULES.health);
});

test('a creature that starts anywhere inside its aggro ring, at any angle and any world position, closes in and STARTS its telegraph (the clamped last step must not leave it standing 1 ulp outside reach)', () => {
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;   // a fixed LCG: the fuzz is the same on every run
  for (let i = 0; i < 300; i++) {
    const kind = ['wolf', 'boar', 'bear'][i % 3]!, ang = rnd() * Math.PI * 2, d = 3 + rnd() * 5.9, px = rnd() * 50 - 25, pz = rnd() * 50 - 25;
    let w = newWorld([player('p', px, pz), creature('c', kind, px + Math.sin(ang) * d, pz + Math.cos(ang) * d)]), tele = false;
    for (let t = 0; t < 60 * (d / 4.5 + 1.5) && !tele; t++) { const r = stepCombat(w, { p: STILL }, DT); w = r.world; tele = r.events.some((e) => e.type === 'Telegraph' && e.id === 'c'); }
    assert.ok(tele, `${kind} from ${d.toFixed(2)} m at ${ang.toFixed(3)} rad (player at ${px.toFixed(2)},${pz.toFixed(2)}) never telegraphed`);
  }
});
