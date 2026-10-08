// Zone 1's combat loop, slice 0 (origins/combat/zone1.ts): movement on the one speed table, the player's light cut (reach, arc, damage, stamina), a creature's telegraphed bite by kind,
// death, and the leash / give-up / heal-on-return. Pure steps at a fixed 1/60.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MOVES, OPPONENTS, RULES } from '../../src/moves.ts';
import { LEASH, SPEEDS } from '../preview/speeds.ts';
import { BLOW_WEIGHT, creature, minKillSeconds, newWorld, player, stepCombat, type Event, type Fighter, type Input, type World } from './zone1.ts';

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

// ── S1: guard, roll, posture, stamina, the kill bound ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const bite = (kind = 'wolf') => { const c = creature('c', kind, 0, 0.9, Math.PI); c.hunting = true; return c; };   // a creature already in reach of a player at the origin facing +z
const GUARD: Input = { x: 0, z: 0, guard: true };

test('a held guard blocks a frontal bite: no damage, a Blocked event, the row\'s stamina and posture cost', () => {
  const { world, events } = run(newWorld([player('p', 0, 0, 0), bite()]), 1, () => GUARD);
  const blocked = events.find((e) => e.type === 'Blocked');
  assert.ok(blocked && blocked.type === 'Blocked' && blocked.damage === 0, JSON.stringify(blocked));
  assert.equal(events.filter((e) => e.type === 'Hit').length, 0);
  assert.equal(get(world, 'p').health, RULES.health);
  assert.ok(get(world, 'p').stamina < 100 && get(world, 'p').posture > 0);
});

test('a guard raised just before the blow is a PERFECT block and costs half; a guard from behind does not cover', () => {
  const blocked = (guardFrom: number) => run(newWorld([player('p', 0, 0, 0), bite()]), 0.5, (t) => (t >= guardFrom ? GUARD : STILL));   // the bite's swing is tick 25
  const early = blocked(0), justInTime = blocked(24);
  const flag = (r: ReturnType<typeof blocked>) => r.events.find((e) => e.type === 'Blocked');
  assert.ok(flag(early) && flag(early)!.type === 'Blocked' && !flag(early)!.perfect, 'a guard held a while is an ordinary block');
  assert.ok(flag(justInTime) && flag(justInTime)!.type === 'Blocked' && flag(justInTime)!.perfect, 'a guard raised just before the blow is perfect');
  const spent = (r: ReturnType<typeof blocked>) => 100 - get(r.world, 'p').stamina;
  assert.ok(spent(justInTime) < spent(early) * 0.75, `perfect ${spent(justInTime)} vs ordinary ${spent(early)}`);
  const behind = run(newWorld([player('p', 0, 0, Math.PI), bite()]), 1, () => GUARD);   // the player faces away: the bite lands
  assert.equal(behind.events.filter((e) => e.type === 'Hit' && e.victim === 'p').length, 1);
});

test('a roll is invulnerable between safeStart and safeEnd: a bite that lands inside it is Dodged; one that lands as the roll begins hits', () => {
  const rollAt = (tick: number) => run(newWorld([player('p', 0, 0, 0), bite()]), 0.6, (t) => (t === tick ? { x: 0, z: 0, roll: { x: 1, z: 0 } } : STILL));   // the bite's swing is tick 25
  const inside = rollAt(20);   // 5 ticks into the roll when the blow lands: inside the 4..20 window, and still in the bite's reach so the dodge is what saves him
  assert.ok(inside.events.some((e) => e.type === 'Dodged'));
  assert.equal(inside.events.filter((e) => e.type === 'Hit' && e.victim === 'p').length, 0);
  assert.equal(get(inside.world, 'p').health, RULES.health);
  const tooLate = rollAt(25);   // the roll begins the same tick: not yet invulnerable
  assert.equal(tooLate.events.filter((e) => e.type === 'Hit' && e.victim === 'p').length, 1);
});

test('rolling costs the rules\' stamina and moves a stride; no roll without the stamina', () => {
  const r = run(newWorld([player('p', 0, 0, 0)]), 0.7, (t) => (t === 0 ? { x: 0, z: 0, roll: { x: 1, z: 0 } } : STILL));
  const p = get(r.world, 'p');
  assert.ok(p.x > 2.5, `rolled ${p.x}`);
  assert.ok(Math.abs(p.stamina - (100 - RULES.rollCost)) < 1e-6, `stamina ${p.stamina}`);
  const tired = player('p', 0, 0, 0); tired.stamina = 10;
  assert.notEqual(get(run(newWorld([tired]), 0.2, () => ({ x: 0, z: 0, roll: { x: 1, z: 0 } })).world, 'p').phase, 'roll');
});

test('posture: blocks fill it and a full bar breaks the guard into a stagger; it drains after the hold', () => {
  const p = player('p', 0, 0, 0); p.posture = 95;
  const r = run(newWorld([p, bite()]), 1, () => GUARD);
  assert.ok(r.events.some((e) => e.type === 'Staggered' && e.id === 'p' && e.cause === 'posture'));
  const calm = player('p', 0, 0, 0); calm.posture = 50;
  assert.ok(get(run(newWorld([calm]), 2).world, 'p').posture < 50, 'posture drains once idle');
});

test('a guard that runs out of stamina breaks (guardBreak) and a clean hit on a creature fills ITS posture', () => {
  const p = player('p', 0, 0, 0); p.stamina = 5; p.regenIn = 5;   // nearly spent and no regen: the block's stamina cost empties it
  const r = run(newWorld([p, bite()]), 1, () => GUARD);
  assert.ok(r.events.some((e) => e.type === 'Staggered' && e.id === 'p' && e.cause === 'guardBreak'));
  const target = creature('w', 'wolf', 0, 1.2); target.phase = 'stagger'; target.hurtFor = 99;
  const hit = run(newWorld([player('p', 0, 0, 0), target]), 0.8, (t) => (t === 0 ? { x: 0, z: 0, attack: 'light' } : STILL));
  assert.ok(get(hit.world, 'w').posture > 0);
});

test('sprinting drains stamina; at zero he is exhausted (slower, no new action) until he recovers', () => {
  const run1 = run(newWorld([player('p', 0, 0)]), 12, () => ({ x: 0, z: 1, run: true }));
  const p = get(run1.world, 'p');
  assert.ok(p.stamina < 100 && p.exhausted, `stamina ${p.stamina}`);
  const slow = get(run(newWorld([{ ...p }]), 1, () => ({ x: 0, z: 1 })).world, 'p');
  assert.ok(slow.z - p.z < SPEEDS.player.walk, 'exhausted walking is slower than a fresh walk');
});

test('minKillSeconds is a conservative lower bound: no honest light-cut kill beats it, and a bigger creature takes longer', () => {
  assert.ok(minKillSeconds('wolf') > 0 && minKillSeconds('bear') > minKillSeconds('boar') && minKillSeconds('boar') > minKillSeconds('wolf'));
  // an honest fight: the player cuts as fast as the rules allow against a held dummy; the bound must not exceed the time it really took
  const dummy = creature('w', 'wolf', 0, 1.2); dummy.phase = 'stagger'; dummy.hurtFor = 999;
  let w = newWorld([player('p', 0, 0, 0), dummy]), t = 0;
  while (get(w, 'w').phase !== 'dead' && t < 600) { w = stepCombat(w, { p: { x: 0, z: 0, attack: 'light' } }, DT).world; t += DT; }
  assert.equal(get(w, 'w').phase, 'dead');
  assert.ok(t >= minKillSeconds('wolf'), `really took ${t.toFixed(2)} s, bound ${minKillSeconds('wolf').toFixed(2)} s`);
});

// ── S2a: the heavy and the kick ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const held = (kind = 'wolf') => { const c = creature('w', kind, 0, 1.2); c.phase = 'stagger'; c.hurtFor = 99; return c; };   // a target held still
const press = (attack: 'light' | 'heavy' | 'kick') => (t: number): Input => (t === 0 ? { x: 0, z: 0, attack } : STILL);

test('a heavy: the row\'s telegraph (32 ticks), damage 18, stamina 35', () => {
  const heavy = MOVES.heavy_overhead;
  const r = run(newWorld([player('p', 0, 0, 0), held()]), 1.5, press('heavy'));
  const tele = r.events.find((e) => e.type === 'Telegraph' && e.id === 'p');
  assert.ok(tele && tele.type === 'Telegraph' && tele.move === 'heavy_overhead' && tele.ms === Math.round((heavy.windup / 60) * 1000));
  const hit = r.events.find((e) => e.type === 'Hit' && e.attacker === 'p');
  assert.ok(hit && hit.type === 'Hit' && hit.damage === heavy.damage);
  assert.equal(get(r.world, 'w').health, OPPONENTS.wolf.health - heavy.damage);
  assert.ok(Math.abs(get(run(newWorld([player('p', 0, 0, 0), held()]), 0.5, press('heavy')).world, 'p').stamina - (100 - heavy.stamina)) < 1e-6);
});

test('a heavy chips through a guard (the row\'s 40%) and costs more posture than a cut; a kick goes THROUGH a guard', () => {
  const g = (attacker: 'heavy' | 'kick', seconds: number) => {
    const foe = creature('c', 'wolf', 0, 1.2, Math.PI); foe.phase = 'guard';   // a guarding creature held in front
    return run(newWorld([player('p', 0, 0, 0), foe]), seconds, press(attacker));
  };
  const heavy = g('heavy', 0.7), kick = g('kick', 0.4);   // the kick lands at tick 18; 0.4 s is before any stamina comes back (regen delay .75 s)
  const blocked = heavy.events.find((e) => e.type === 'Blocked');
  assert.ok(blocked && blocked.type === 'Blocked' && blocked.damage === Math.round(MOVES.heavy_overhead.damage * MOVES.heavy_overhead.chip));
  assert.ok(get(heavy.world, 'c').posture >= MOVES.heavy_overhead.posture - 1e-6 && MOVES.heavy_overhead.posture > MOVES.light_right.posture, 'the heavy fills the row\'s posture');
  assert.equal(kick.events.filter((e) => e.type === 'Blocked').length, 0, 'a kick is never blocked');
  assert.ok(kick.events.some((e) => e.type === 'Staggered' && e.id === 'c' && e.cause === 'kick'));
  assert.equal(get(kick.world, 'c').stamina, 100 - MOVES.kick.vsGuard!.staminaDamage);
});

test('a kick on an unguarded fighter is a small clean hit (damage 4) with the row\'s stagger', () => {
  const r = run(newWorld([player('p', 0, 0, 0), (() => { const c = held(); c.z = 1.0; return c; })()]), 1, press('kick'));
  const hit = r.events.find((e) => e.type === 'Hit' && e.attacker === 'p');
  assert.ok(hit && hit.type === 'Hit' && hit.damage === MOVES.kick.damage && hit.move === 'kick');
});

// ── S2b: 2 v 1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('2 v 1: never more than MAX_ATTACKERS creatures wind up or swing at once, and they do not stand inside one another', () => {
  let w = newWorld([player('p', 0, 0), creature('a', 'wolf', 3, 3), creature('b', 'wolf', -3, 3), creature('c', 'wolf', 0, -4)]);
  let most = 0, closest = Infinity, bites = 0;
  for (let t = 0; t < 60 * 6; t++) {
    const r = stepCombat(w, { p: STILL }, DT); w = r.world; bites += r.events.filter((e) => e.type === 'Telegraph').length;
    most = Math.max(most, w.fighters.filter((f) => f.side === 'creature' && (f.phase === 'windup' || f.phase === 'active')).length);
    const cs = w.fighters.filter((f) => f.side === 'creature');
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) closest = Math.min(closest, Math.hypot(cs[i]!.x - cs[j]!.x, cs[i]!.z - cs[j]!.z) - (cs[i]!.radius + cs[j]!.radius));
  }
  assert.ok(bites >= 3, `they do attack (${bites} telegraphs)`);
  assert.ok(most <= 2, `at most 2 at once, saw ${most}`);
  assert.ok(closest > -0.05, `bodies overlap by ${-closest}`);
});
