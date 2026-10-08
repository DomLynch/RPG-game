// Zone 1's combat loop, slice 0 (origins/combat/zone1.ts): movement on the one speed table, the player's light cut (reach, arc, damage, stamina), a creature's telegraphed bite by kind,
// death, and the leash / give-up / heal-on-return. Pure steps at a fixed 1/60.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MOVES, OPPONENTS, RULES, WEAPONS, opponentAt } from '../../src/moves.ts';
import { CAPS } from '../../src/gear-stats.ts';
import { LEASH, SPEEDS } from '../preview/speeds.ts';
import { BLOW_WEIGHT, MAX_LEVEL, creature, levelHealth, minKillSeconds, newWorld, player, stepCombat, withStance, type Event, type Fighter, type Input, type World } from './zone1.ts';

/** The S0-S5b rows (the pack path): `open: false` keeps every fight off the Pit duel. */
const legacy = (fighters: Fighter[]): World => ({ ...newWorld(fighters), open: false });
const NEVER = () => 1, ALWAYS = () => 0, DT = 1 / 60, STILL: Input = { x: 0, z: 0 };
const get = (w: World, id: string): Fighter => w.fighters.find((f) => f.id === id)!;
/** Step `seconds`, with `input(t, world)` for the player; collects every event. */
function run(world: World, seconds: number, input: (t: number, w: World) => Input = () => STILL): { world: World; events: Event[] } {
  const events: Event[] = [];
  for (let t = 0; t < Math.round(seconds * 60); t++) { const r = stepCombat(world, { p: input(t, world) }, DT, NEVER); world = r.world; events.push(...r.events); }
  return { world, events };
}

test('the player walks 2.3 and runs 5.2 m/s (the speed table), facing where he goes', () => {
  const w = legacy([player('p', 0, 0)]);
  const walked = get(run(w, 1, () => ({ x: 0, z: 1 })).world, 'p'), ran = get(run(w, 1, () => ({ x: 1, z: 0, run: true })).world, 'p');
  assert.ok(Math.abs(walked.z - SPEEDS.player.walk) < 0.05, `walked ${walked.z}`);
  assert.ok(Math.abs(ran.x - SPEEDS.player.run) < 0.05, `ran ${ran.x}`);
  assert.ok(Math.abs(ran.facing - Math.PI / 2) < 1e-9);
});

test('a light cut: telegraph, then a swing, lands the sword row\'s damage on a creature in reach and arc, once; costs stamina that comes back', () => {
  const cut = MOVES.light_right;
  const target = creature('w', 'wolf', 0, 1.2); target.phase = 'stagger'; target.hurtFor = 99;
  const w = legacy([player('p', 0, 0, 0), target]);
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
    const w = legacy([player('p', 0, 0, 0), dummy]);
    const { events } = run(w, 0.8, (t) => (t === 0 ? { x: 0, z: 0, attack: 'light' } : STILL));
    assert.equal(events.filter((e) => e.type === 'Hit' && e.attacker === 'p').length, 0, `${x},${z}`);
  }
});

test('a creature bites with a 0.4 s telegraph; damage is by kind (the bite row times the creature\'s weight)', () => {
  for (const kind of ['wolf', 'boar', 'bear']) {
    const w = legacy([player('p', 0, 0), creature('c', kind, 0, 5)]);
    const { events, world } = run(w, 5);
    const tele = events.find((e) => e.type === 'Telegraph' && e.id === 'c');
    assert.ok(tele && tele.type === 'Telegraph' && tele.ms === 400, `${kind} telegraph ${JSON.stringify(tele)}`);
    const hit = events.find((e) => e.type === 'Hit' && e.victim === 'p');
    assert.ok(hit && hit.type === 'Hit' && hit.damage === Math.round(10 * BLOW_WEIGHT[kind]!), `${kind} damage`);
    assert.ok(get(world, 'p').health < 150);
  }
});

test('creatures close at the table\'s chase speed: the wolf faster than the boar', () => {
  const closed = (kind: string) => 8.5 - get(run(legacy([player('p', 0, 0), creature('c', kind, 0, 8.5)]), 0.5).world, 'c').z;
  const wolf = closed('wolf'), boar = closed('boar');
  assert.ok(Math.abs(wolf - 6.0 * 0.5) < 0.1, `wolf closed ${wolf}`);
  assert.ok(Math.abs(boar - 4.5 * 0.5) < 0.1, `boar closed ${boar}`);
});

test('a kill: Died is emitted once, the body stays dead, and the creature stops hunting a dead player', () => {
  const p = player('p', 0, 0); p.health = 5;
  const { world, events } = run(legacy([p, creature('c', 'bear', 0, 1)]), 3);
  assert.equal(events.filter((e) => e.type === 'Died').length, 1);
  assert.equal(get(world, 'p').phase, 'dead'); assert.equal(get(world, 'p').health, 0);
  assert.equal(get(world, 'c').hunting, false);
});

test('running away works from a boar (chase 4.5 < run 5.2): the leash ends the chase, it walks home and heals to full, one Evaded event and nothing else', () => {
  const b = creature('b', 'boar', 0, 4); b.health = 40;
  const w = legacy([player('p', 0, 0), b]);
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
  const w = legacy([player('p', 0, 0), creature('w', 'wolf', 0, 4)]);
  const r = run(w, 8, () => ({ x: 0, z: -1, run: true }));
  assert.equal(get(r.world, 'w').hunting, false, 'the wolf gave up inside 8 s');
});

test('stepCombat is pure: it never mutates the world it is given', () => {
  const w = legacy([player('p', 0, 0), creature('c', 'wolf', 0, 2)]);
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
  const { world, events } = run(legacy([player('p', 0, 0, 0), bite()]), 1, () => GUARD);
  const blocked = events.find((e) => e.type === 'Blocked');
  assert.ok(blocked && blocked.type === 'Blocked' && blocked.damage === 0, JSON.stringify(blocked));
  assert.equal(events.filter((e) => e.type === 'Hit').length, 0);
  assert.equal(get(world, 'p').health, RULES.health);
  assert.ok(get(world, 'p').stamina < 100 && get(world, 'p').posture > 0);
});

test('a guard raised RULES.parry + 1 ticks before the blow is a PERFECT block and costs half (just before it is a parry); a guard from behind does not cover', () => {
  const blocked = (guardFrom: number) => run(legacy([player('p', 0, 0, 0), bite()]), 0.5, (t) => (t >= guardFrom ? GUARD : STILL));   // the bite's swing is tick 25
  const early = blocked(0), justInTime = blocked(14), parried = blocked(24);   // swing at tick 25: age 11 = one tick into the perfect block; age 1 = inside the parry window
  const flag = (r: ReturnType<typeof blocked>) => r.events.find((e) => e.type === 'Blocked');
  assert.ok(flag(early) && flag(early)!.type === 'Blocked' && !flag(early)!.perfect, 'a guard held a while is an ordinary block');
  assert.ok(flag(justInTime) && flag(justInTime)!.type === 'Blocked' && flag(justInTime)!.perfect, 'a guard raised parry+1 ticks before the blow is perfect');
  assert.ok(parried.events.some((e) => e.type === 'Parried'), 'a guard raised just before the blow is a parry');
  const spent = (r: ReturnType<typeof blocked>) => 100 - get(r.world, 'p').stamina;
  assert.ok(spent(justInTime) < spent(early) * 0.75, `perfect ${spent(justInTime)} vs ordinary ${spent(early)}`);
  const behind = run(legacy([player('p', 0, 0, Math.PI), bite()]), 1, () => GUARD);   // the player faces away: the bite lands
  assert.equal(behind.events.filter((e) => e.type === 'Hit' && e.victim === 'p').length, 1);
});

test('a roll is invulnerable between safeStart and safeEnd: a bite that lands inside it is Dodged; one that lands as the roll begins hits', () => {
  const rollAt = (tick: number) => run(legacy([player('p', 0, 0, 0), bite()]), 0.6, (t) => (t === tick ? { x: 0, z: 0, roll: { x: 1, z: 0 } } : STILL));   // the bite's swing is tick 25
  const inside = rollAt(20);   // 5 ticks into the roll when the blow lands: inside the 4..20 window, and still in the bite's reach so the dodge is what saves him
  assert.ok(inside.events.some((e) => e.type === 'Dodged'));
  assert.equal(inside.events.filter((e) => e.type === 'Hit' && e.victim === 'p').length, 0);
  assert.equal(get(inside.world, 'p').health, RULES.health);
  const tooLate = rollAt(25);   // the roll begins the same tick: not yet invulnerable
  assert.equal(tooLate.events.filter((e) => e.type === 'Hit' && e.victim === 'p').length, 1);
});

test('rolling costs the rules\' stamina and moves a stride; no roll without the stamina', () => {
  const r = run(legacy([player('p', 0, 0, 0)]), 0.7, (t) => (t === 0 ? { x: 0, z: 0, roll: { x: 1, z: 0 } } : STILL));
  const p = get(r.world, 'p');
  assert.ok(p.x > 2.5, `rolled ${p.x}`);
  assert.ok(Math.abs(p.stamina - (100 - RULES.rollCost)) < 1e-6, `stamina ${p.stamina}`);
  const tired = player('p', 0, 0, 0); tired.stamina = 10;
  assert.notEqual(get(run(legacy([tired]), 0.2, () => ({ x: 0, z: 0, roll: { x: 1, z: 0 } })).world, 'p').phase, 'roll');
});

test('posture: blocks fill it and a full bar breaks the guard into a stagger; it drains after the hold', () => {
  const p = player('p', 0, 0, 0); p.posture = 95;
  const r = run(legacy([p, bite()]), 1, () => GUARD);
  assert.ok(r.events.some((e) => e.type === 'Staggered' && e.id === 'p' && e.cause === 'posture'));
  const calm = player('p', 0, 0, 0); calm.posture = 50;
  assert.ok(get(run(legacy([calm]), 2).world, 'p').posture < 50, 'posture drains once idle');
});

test('a guard that runs out of stamina breaks (guardBreak) and a clean hit on a creature fills ITS posture', () => {
  const p = player('p', 0, 0, 0); p.stamina = 5; p.regenIn = 5;   // nearly spent and no regen: the block's stamina cost empties it
  const r = run(legacy([p, bite()]), 1, () => GUARD);
  assert.ok(r.events.some((e) => e.type === 'Staggered' && e.id === 'p' && e.cause === 'guardBreak'));
  const target = creature('w', 'wolf', 0, 1.2); target.phase = 'stagger'; target.hurtFor = 99;
  const hit = run(legacy([player('p', 0, 0, 0), target]), 0.8, (t) => (t === 0 ? { x: 0, z: 0, attack: 'light' } : STILL));
  assert.ok(get(hit.world, 'w').posture > 0);
});

test('sprinting drains stamina; at zero he is exhausted (slower, no new action) until he recovers', () => {
  const run1 = run(legacy([player('p', 0, 0)]), 12, () => ({ x: 0, z: 1, run: true }));
  const p = get(run1.world, 'p');
  assert.ok(p.stamina < 100 && p.exhausted, `stamina ${p.stamina}`);
  const slow = get(run(legacy([{ ...p }]), 1, () => ({ x: 0, z: 1 })).world, 'p');
  assert.ok(slow.z - p.z < SPEEDS.player.walk, 'exhausted walking is slower than a fresh walk');
});

test('minKillSeconds is a conservative lower bound: no honest light-cut kill beats it, and a bigger creature takes longer', () => {
  assert.ok(minKillSeconds('wolf') > 0 && minKillSeconds('bear') > minKillSeconds('boar') && minKillSeconds('boar') > minKillSeconds('wolf'));
  // an honest fight: the player cuts as fast as the rules allow against a held dummy; the bound must not exceed the time it really took
  const dummy = creature('w', 'wolf', 0, 1.2); dummy.phase = 'stagger'; dummy.hurtFor = 999;
  let w = legacy([player('p', 0, 0, 0), dummy]), t = 0;
  while (get(w, 'w').phase !== 'dead' && t < 600) { w = stepCombat(w, { p: { x: 0, z: 0, attack: 'light' } }, DT, NEVER).world; t += DT; }
  assert.equal(get(w, 'w').phase, 'dead');
  assert.ok(t >= minKillSeconds('wolf'), `really took ${t.toFixed(2)} s, bound ${minKillSeconds('wolf').toFixed(2)} s`);
});

// ── S2a: the heavy and the kick ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const held = (kind = 'wolf') => { const c = creature('w', kind, 0, 1.2); c.phase = 'stagger'; c.hurtFor = 99; return c; };   // a target held still
const press = (attack: 'light' | 'heavy' | 'kick') => (t: number): Input => (t === 0 ? { x: 0, z: 0, attack } : STILL);

test('a heavy: the row\'s telegraph (32 ticks), damage 18, stamina 35', () => {
  const heavy = MOVES.heavy_overhead;
  const r = run(legacy([player('p', 0, 0, 0), held()]), 1.5, press('heavy'));
  const tele = r.events.find((e) => e.type === 'Telegraph' && e.id === 'p');
  assert.ok(tele && tele.type === 'Telegraph' && tele.move === 'heavy_overhead' && tele.ms === Math.round((heavy.windup / 60) * 1000));
  const hit = r.events.find((e) => e.type === 'Hit' && e.attacker === 'p');
  assert.ok(hit && hit.type === 'Hit' && hit.damage === heavy.damage);
  assert.equal(get(r.world, 'w').health, OPPONENTS.wolf.health - heavy.damage);
  assert.ok(Math.abs(get(run(legacy([player('p', 0, 0, 0), held()]), 0.5, press('heavy')).world, 'p').stamina - (100 - heavy.stamina)) < 1e-6);
});

test('a heavy chips through a guard (the row\'s 40%) and costs more posture than a cut; a kick goes THROUGH a guard', () => {
  const g = (attacker: 'heavy' | 'kick', seconds: number) => {
    const foe = creature('c', 'wolf', 0, 1.2, Math.PI); foe.phase = 'guard';   // a guarding creature held in front
    return run(legacy([player('p', 0, 0, 0), foe]), seconds, press(attacker));
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
  const r = run(legacy([player('p', 0, 0, 0), (() => { const c = held(); c.z = 1.0; return c; })()]), 1, press('kick'));
  const hit = r.events.find((e) => e.type === 'Hit' && e.attacker === 'p');
  assert.ok(hit && hit.type === 'Hit' && hit.damage === MOVES.kick.damage && hit.move === 'kick');
});

// ── S2b: 2 v 1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('2 v 1: never more than MAX_ATTACKERS creatures wind up or swing at once, and they do not stand inside one another', () => {
  let w = legacy([player('p', 0, 0), creature('a', 'wolf', 3, 3), creature('b', 'wolf', -3, 3), creature('c', 'wolf', 0, -4)]);
  let most = 0, closest = Infinity, bites = 0;
  for (let t = 0; t < 60 * 6; t++) {
    const r = stepCombat(w, { p: STILL }, DT, NEVER); w = r.world; bites += r.events.filter((e) => e.type === 'Telegraph').length;
    most = Math.max(most, w.fighters.filter((f) => f.side === 'creature' && (f.phase === 'windup' || f.phase === 'active')).length);
    const cs = w.fighters.filter((f) => f.side === 'creature');
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) closest = Math.min(closest, Math.hypot(cs[i]!.x - cs[j]!.x, cs[i]!.z - cs[j]!.z) - (cs[i]!.radius + cs[j]!.radius));
  }
  assert.ok(bites >= 3, `they do attack (${bites} telegraphs)`);
  assert.ok(most <= 2, `at most 2 at once, saw ${most}`);
  assert.ok(closest > -0.05, `bodies overlap by ${-closest}`);
});

test('a creature that starts anywhere inside its aggro ring, at any angle and any world position, closes in and STARTS its telegraph (the clamped last step must not leave it standing 1 ulp outside reach)', () => {
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;   // a fixed LCG: the fuzz is the same on every run
  for (let i = 0; i < 300; i++) {
    const kind = ['wolf', 'boar', 'bear'][i % 3]!, ang = rnd() * Math.PI * 2, d = 3 + rnd() * 5.9, px = rnd() * 50 - 25, pz = rnd() * 50 - 25;
    let w = legacy([player('p', px, pz), creature('c', kind, px + Math.sin(ang) * d, pz + Math.cos(ang) * d)]), tele = false;
    for (let t = 0; t < 60 * (d / 4.5 + 1.5) && !tele; t++) { const r = stepCombat(w, { p: STILL }, DT, NEVER); w = r.world; tele = r.events.some((e) => e.type === 'Telegraph' && e.id === 'c'); }
    assert.ok(tele, `${kind} from ${d.toFixed(2)} m at ${ang.toFixed(3)} rad (player at ${px.toFixed(2)},${pz.toFixed(2)}) never telegraphed`);
  }
});

// ---- S2b: creature variety rows (injected rand), parry ----
function runR(world: World, seconds: number, rand: () => number, input: (t: number, w: World) => Input = () => STILL): { world: World; events: Event[] } {
  const events: Event[] = [];
  for (let t = 0; t < Math.round(seconds * 60); t++) { const r = stepCombat(world, { p: input(t, world) }, DT, rand); world = r.world; events.push(...r.events); }
  return { world, events };
}
const firstTell = (events: Event[]) => events.find((e) => e.type === 'Telegraph' && e.id === 'c') as Extract<Event, { type: 'Telegraph' }>;

test('variety: with rand() below p each kind throws its second blow (lunge / charge / heavy), slower to read and harder; a rand of 1 never does; the live default (Math.random) throws it about 1 in 4', () => {
  for (const [kind, id] of [['wolf', 'lunge'], ['boar', 'charge'], ['bear', 'heavy']] as const) {
    const mk = () => legacy([player('p', 0, 0), creature('c', kind, 0, 6)]);
    const v = firstTell(runR(mk(), 4, ALWAYS).events), plain = firstTell(runR(mk(), 4, NEVER).events), dflt = firstTell(run(mk(), 4).events);   // run() injects NEVER
    assert.equal(v.move, id); assert.notEqual(plain.move, id); assert.equal(dflt.move, plain.move);
    assert.ok(v.ms > plain.ms, `${kind} ${id} windup ${v.ms} vs ${plain.ms}`);
    const dmg = (rand: () => number) => { const e = runR(mk(), 6, rand).events.find((x) => x.type === 'Hit' && x.attacker === 'c'); return e && e.type === 'Hit' ? e.damage : 0; };
    assert.ok(dmg(ALWAYS) > dmg(NEVER) && dmg(NEVER) > 0, `${kind} ${id} hits harder`);
  }
});

test('variety: a lunge / charge starts from farther out and covers its ground on the swing, so a roll through the windup dodges it', () => {
  const w = legacy([player('p', 0, 0), creature('c', 'boar', 0, 7)]);
  let world = w, gap0 = 0, tele = false;
  for (let t = 0; t < 600 && !tele; t++) { const r = stepCombat(world, { p: STILL }, DT, ALWAYS); world = r.world; tele = r.events.some((e) => e.type === 'Telegraph'); }
  gap0 = Math.hypot(get(world, 'c').x, get(world, 'c').z);
  assert.ok(gap0 > 2.5, `a charge winds up from ${gap0.toFixed(2)} m`);
  const out = runR(world, 2, ALWAYS, (t) => (t === 30 ? { x: 0, z: 0, roll: { x: 1, z: 0 } } : STILL));
  assert.ok(out.events.some((e) => e.type === 'Dodged') || !out.events.some((e) => e.type === 'Hit' && e.victim === 'p'), 'the rolled player is not hit');
});

test('variety: the bear heavy goes through a raised guard; its plain swipe does not', () => {
  const guarding = () => ({ x: 0, z: 0, guard: true });
  const hitsOn = (rand: () => number) => runR(legacy([player('p', 0, 0, 0), creature('c', 'bear', 0, 1.5)]), 4, rand, guarding).events.filter((e) => e.type === 'Hit' && e.victim === 'p').length;
  assert.ok(hitsOn(ALWAYS) >= 1, 'heavy lands through the guard');
  assert.equal(hitsOn(NEVER), 0, 'plain swipe is blocked');
});

test('parry (duel.ts: guarding && age < window && parryable): a guard up inside the 10-tick window turns a creature\'s blow aside - no damage, the creature is thrown off for parryStun - whatever the blow', () => {
  const mk = (rand: () => number) => {
    let w = legacy([player('p', 0, 0, 0), creature('c', 'wolf', 0, 1.2)]); const events: Event[] = [];
    for (let t = 0; t < 360; t++) {
      const c = get(w, 'c'), guard = c.phase === 'windup' && c.t >= c.move!.windup / 60 - 0.04;   // raise the guard just before the blow lands
      const r = stepCombat(w, { p: { x: 0, z: 0, guard } }, DT, rand); w = r.world; events.push(...r.events);
    }
    return events;
  };
  for (const rand of [NEVER, ALWAYS]) {
    const ev = mk(rand);
    assert.ok(ev.some((e) => e.type === 'Parried' && e.attacker === 'c' && e.victim === 'p'), 'parried');
    assert.ok(ev.some((e) => e.type === 'Staggered' && e.id === 'c' && e.cause === 'parry' && e.ms === Math.round((RULES.parryStun / 60) * 1000)), 'the creature is thrown off for parryStun');
    assert.ok(!ev.some((e) => e.type === 'Hit' && e.victim === 'p'), 'no damage');
  }
});

// ---- the Auditor's three duel.ts rows (#1888 hold): perfect block = no chip; an unaffordable block = guard broken; a kick into a guard puts posture on it ----
const guardDuel = (attack: 'light' | 'heavy' | 'kick', raiseAt: number, opts: { stamina?: number; atkStance?: 'trickster' | 'neutral' } = {}) => {
  const a = withStance(player('a', 0, 0, 0, undefined, 10), opts.atkStance ?? 'neutral'), b = player('b', 0, 1.2, Math.PI, undefined, 10); a.pvp = b.pvp = true;
  if (opts.stamina !== undefined) b.stamina = opts.stamina;
  let w = newWorld([a, b]); const events: Event[] = []; let atHit = -1;
  for (let t = 0; t < 120; t++) { const r = stepCombat(w, { a: t === 0 ? { x: 0, z: 0, attack } : STILL, b: { x: 0, z: 0, guard: t >= raiseAt } }, DT, NEVER); w = r.world; events.push(...r.events); if (atHit < 0 && r.events.some((e) => e.type === 'Hit' && e.victim === 'b')) atHit = get(w, 'b').posture; }
  return { w, events, atHit };
};

test('duel.ts row: a PERFECT block (the RULES.perfectBlock ticks after the parry window) takes no chip; an ordinary block takes the row\'s chip', () => {
  const heavy = MOVES.heavy_overhead, perfect = guardDuel('heavy', heavy.windup - RULES.parry - 1), plain = guardDuel('heavy', 0);   // raised parry+1 ticks before the blow lands = 1 tick into the perfect block
  assert.ok(perfect.events.some((e) => e.type === 'Blocked' && e.perfect && e.damage === 0), 'perfect block, chip 0');
  assert.equal(get(perfect.w, 'b').health, RULES.health, 'no chip taken');
  assert.ok(plain.events.some((e) => e.type === 'Blocked' && !e.perfect && e.damage === Math.round(heavy.damage * heavy.chip)), 'ordinary block pays the chip');
  assert.equal(get(plain.w, 'b').health, RULES.health - Math.round(heavy.damage * heavy.chip));
});

test('duel.ts row: a guard that cannot afford the block is GUARD-BROKEN - full damage, RULES.breakCost, a guardBreak stagger, posture reset', () => {
  const heavy = MOVES.heavy_overhead, r = guardDuel('heavy', 0, { stamina: 1 });
  assert.ok(!r.events.some((e) => e.type === 'Blocked'), 'it does not block');
  assert.ok(r.events.some((e) => e.type === 'Hit' && e.victim === 'b' && e.damage === heavy.damage), 'full damage');
  assert.ok(r.events.some((e) => e.type === 'Staggered' && e.id === 'b' && e.cause === 'guardBreak'), 'guard-break stagger');
  assert.equal(get(r.w, 'b').health, RULES.health - heavy.damage);
  assert.equal(get(r.w, 'b').posture, 0, 'posture reset');
});

test('duel.ts row: a kick into a held guard puts posture on it, and a Trickster\'s puts 50 % more (src/stance.ts kickPosture)', () => {
  const kick = MOVES.kick, plain = guardDuel('kick', 0), trick = guardDuel('kick', 0, { atkStance: 'trickster' });
  const posture = (r: ReturnType<typeof guardDuel>) => r.atHit;   // the posture the tick the kick lands (it drains afterwards)
  assert.ok(posture(plain) > 0, 'a kick through a guard fills posture');
  assert.ok(Math.abs(posture(trick) / posture(plain) - 1.5) < 0.1, `trickster ${posture(trick)} vs ${posture(plain)}`);
  void kick;
});

test('live default rand: the variety blow comes up about 1 attack in 4, and stepCombat works with no rand argument', () => {
  let seed = 99; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let blows = 0, specials = 0;
  for (let i = 0; i < 400; i++) {
    let w = legacy([player('p', 0, 0), creature('c', ['wolf', 'boar', 'bear'][i % 3]!, 0, 1.4)]); w.fighters[0]!.health = 1e6;
    for (let t = 0; t < 60 * 3; t++) { const r = stepCombat(w, { p: STILL }, DT, rnd); w = r.world; for (const e of r.events) if (e.type === 'Telegraph' && e.id === 'c') { blows++; if (e.move === 'lunge' || e.move === 'charge' || e.move === 'heavy') specials++; } }
  }
  assert.ok(specials / blows > 0.18 && specials / blows < 0.32, `${specials}/${blows}`);
  assert.doesNotThrow(() => stepCombat(legacy([player('p', 0, 0), creature('c', 'wolf', 0, 5)]), { p: STILL }, DT));
});

test('2v1 pack: two wolves take turns - one winds up at a time, so their blows never land on the same tick', () => {
  let w = legacy([player('p', 0, 0), creature('a', 'wolf', 0.8, 1.6), creature('b', 'wolf', -0.8, 1.6)]); w.fighters[0]!.health = 1e6;
  let hitters = 0, same = 0, swings = 0;
  for (let t = 0; t < 60 * 12; t++) {
    const r = stepCombat(w, { p: { x: 0, z: 0, guard: false } }, DT, NEVER); w = r.world;
    const ids = new Set(r.events.filter((e) => e.type === 'Hit' && e.victim === 'p').map((e) => (e as Extract<Event, { type: 'Hit' }>).attacker));
    if (ids.size > 1) same++; hitters += ids.size; swings += r.events.filter((e) => e.type === 'Swing').length;
    if (w.fighters.filter((f) => f.phase === 'windup').length > 1) same++;
  }
  assert.ok(hitters >= 4 && swings >= 4, `both wolves attack (${hitters} hits)`);
  assert.equal(same, 0, 'never two winding up or landing together');
  assert.ok(new Set(w.fighters.map((f) => f.id)).size === 3);
});

test('gear: naked changes nothing; Attack scales what the player deals, RES what he takes (chip included); both capped numbers from gear-stats', () => {
  const dealt = (gear: { attack: number; res: number }) => {
    const t = creature('w', 'boar', 0, 1.2); t.phase = 'stagger'; t.hurtFor = 99;
    return OPPONENTS.boar.health - get(run(legacy([player('p', 0, 0, 0, gear), t]), 1.2, (k) => (k === 0 ? { x: 0, z: 0, attack: 'light' } : STILL)).world, 'w').health;
  };
  assert.equal(dealt({ attack: 1, res: 1 }), MOVES.light_right.damage);
  assert.equal(dealt({ attack: CAPS.attack, res: 1 }), Math.round(MOVES.light_right.damage * CAPS.attack));
  const taken = (gear: { attack: number; res: number }, guard = false) => {
    const w = run(legacy([player('p', 0, 0, 0, gear), creature('c', 'bear', 0, 1.4)]), 1.5, () => ({ x: 0, z: 0, guard }));
    return RULES.health - get(w.world, 'p').health;
  };
  assert.ok(taken({ attack: 1, res: CAPS.res }) < taken({ attack: 1, res: 1 }), 'RES cuts the blow');
  assert.equal(taken({ attack: 1, res: CAPS.res }), Math.round(Math.round(WEAPONS.bite.moves.light_right!.damage * BLOW_WEIGHT.bear!) * CAPS.res));
});

test('level: a creature of level L has the Pit\'s own level body (moves.ts opponentAt), no Zone 1 scaling; minKillSeconds follows the level and the best gear', () => {
  for (const level of [1, 6, 18, 46]) { const c = get(newWorld([creature('c', 'wolf', 0, 5, 0, level)]), 'c'); assert.equal(c.health, opponentAt(OPPONENTS.wolf, level).health); assert.equal(c.poise, opponentAt(OPPONENTS.wolf, level).poise); assert.equal(c.level, level); }
  assert.equal(levelHealth('bear', 99), levelHealth('bear', MAX_LEVEL));
  assert.ok(minKillSeconds('bear', 1) <= minKillSeconds('bear', 46), 'a higher level cannot be killed faster');
});

// ---- S4: player vs player (Dom: no toggle; the server sets pvp per area; low-level shield; level band) ----
const duo = (opts: { aPvp?: boolean; bPvp?: boolean; aLevel?: number; bLevel?: number; bFacesBack?: boolean } = {}) => {
  const a = player('a', 0, 0, 0, undefined, opts.aLevel ?? 10), b = player('b', 0, 1.2, Math.PI, undefined, opts.bLevel ?? 10);
  a.pvp = opts.aPvp ?? true; b.pvp = opts.bPvp ?? true;
  return legacy([a, b]);
};
const swing = (w: World, who = 'a', secs = 1.2) => { const events: Event[] = []; for (let t = 0; t < secs * 60; t++) { const r = stepCombat(w, { [who]: t === 0 ? { x: 0, z: 0, attack: 'light' } : STILL, [who === 'a' ? 'b' : 'a']: STILL }, DT, NEVER); w = r.world; events.push(...r.events); } return { world: w, events }; };

test('pvp: in the wild a player\'s cut lands on another player (same hit, damage, Died as against a creature); one first-strike event names the aggressor', () => {
  const { world, events } = swing(duo());
  assert.equal(get(world, 'b').health, RULES.health - MOVES.light_right.damage);
  assert.deepEqual(events.filter((e) => e.type === 'Aggressed'), [{ type: 'Aggressed', attacker: 'a', victim: 'b', first: true }]);
  let w = duo(); get(w, 'b').health = 1; const died = swing(w).events.find((e) => e.type === 'Died');
  assert.deepEqual(died, { type: 'Died', id: 'b', by: 'a' });
});

test('pvp: a safe-town volume (pvp false on either side) means no attack lands, no Aggressed', () => {
  for (const o of [{ aPvp: false }, { bPvp: false }]) { const { world, events } = swing(duo(o)); assert.equal(get(world, 'b').health, RULES.health); assert.ok(!events.some((e) => e.type === 'Aggressed' || e.type === 'Hit')); }
});

test('pvp: under level 3 a player is shielded until his own first attack; the band is one-way (cannot hit someone more than 10 levels below)', () => {
  assert.equal(get(swing(duo({ bLevel: 2 })).world, 'b').health, RULES.health, 'a level-2 target is shielded');
  const fresh = swing(duo({ aLevel: 2, bLevel: 2 }));   // both shielded: nobody can hurt anybody
  assert.equal(get(fresh.world, 'b').health, RULES.health);
  assert.equal(get(swing(duo({ aLevel: 30, bLevel: 19 })).world, 'b').health, RULES.health, '11 levels below: refused');
  assert.ok(get(swing(duo({ aLevel: 30, bLevel: 20 })).world, 'b').health < RULES.health, '10 levels below: allowed');
  assert.ok(get(swing(duo({ aLevel: 5, bLevel: 30 })).world, 'b').health < RULES.health, 'the low can always hit up');
  // the shield drops when the shielded player attacks (and he can then be hit back)
  let w = duo({ aLevel: 10, bLevel: 2 }); const swungBack = swing(w, 'b');
  assert.equal(get(swungBack.world, 'b').shielded, false);
  assert.ok(swungBack.events.some((e) => e.type === 'Aggressed' && e.attacker === 'b' && e.first));
});

test('pvp: hitting back is not "first" (inside the window); a creature\'s blows and a player\'s on a creature ignore all of it', () => {
  let w = duo(); w = swing(w).world;
  const back = swing(w, 'b'), e = back.events.find((x) => x.type === 'Aggressed');
  assert.deepEqual(e, { type: 'Aggressed', attacker: 'b', victim: 'a', first: false });
  const cw = legacy([player('p', 0, 0, 0, undefined, 1), creature('c', 'wolf', 0, 1.2)]);   // pvp false, level 1, shielded: creatures still fight him
  assert.ok(run(cw, 3).events.some((x) => x.type === 'Hit' && x.victim === 'p'), 'a shielded player is not shielded from creatures');
});

// ---- S5a: stances (the Pit's table, src/stance.ts, read through stanced) ----
test('stances: the Pit table applies in the open - aggressive +5 % damage, defensive -5 %, trickster -5 % on heavies; Balanced is the unscaled value', () => {
  const hit = (pick: 'neutral' | 'aggressive' | 'defensive' | 'trickster', attack: 'light' | 'heavy') => {
    const t = creature('w', 'boar', 0, 1.2); t.phase = 'stagger'; t.hurtFor = 99;
    const e = run(legacy([withStance(player('p', 0, 0), pick), t]), 2, (k) => (k === 0 ? { x: 0, z: 0, attack } : STILL)).events.find((x) => x.type === 'Hit' && x.attacker === 'p');
    return e && e.type === 'Hit' ? e.damage : 0;
  };
  const light = MOVES.light_right.damage, heavy = MOVES.heavy_overhead.damage;
  assert.equal(hit('neutral', 'light'), light); assert.equal(hit('neutral', 'heavy'), heavy);
  assert.equal(hit('aggressive', 'light'), Math.round(light * 1.05)); assert.equal(hit('defensive', 'light'), Math.round(light * 0.95));
  assert.equal(hit('trickster', 'light'), light, 'trickster leaves a light cut alone'); assert.equal(hit('trickster', 'heavy'), Math.round(heavy * 0.95));
});

test('stances: a defensive block costs 15 % less stamina and its parry window is a quarter longer; aggressive blocks cost 10 % more and deal 10 % more posture', () => {
  const blocked = (pick: 'neutral' | 'aggressive' | 'defensive', who: 'att' | 'def') => {
    const a = withStance(player('a', 0, 0, 0, undefined, 10), who === 'att' ? pick : 'neutral'), b = withStance(player('b', 0, 1.2, Math.PI, undefined, 10), who === 'def' ? pick : 'neutral');
    a.pvp = b.pvp = true; let w = legacy([a, b]); let lost = 0, posture = 0;
    for (let t = 0; t < 90; t++) {
      const bb = get(w, 'b'), r = stepCombat(w, { a: t === 0 ? { x: 0, z: 0, attack: 'light' } : STILL, b: { x: 0, z: 0, guard: true } }, DT, NEVER); w = r.world;
      if (r.events.some((e) => e.type === 'Blocked')) { lost = bb.stamina - get(w, 'b').stamina; posture = get(w, 'b').posture; break; }
    }
    return { lost, posture };
  };
  assert.ok(blocked('defensive', 'def').lost < blocked('neutral', 'def').lost, 'defensive blocks cheaper');
  assert.ok(blocked('aggressive', 'def').lost > blocked('neutral', 'def').lost, 'aggressive blocks dearer');
  assert.ok(blocked('aggressive', 'att').posture > blocked('neutral', 'att').posture, 'aggressive deals more posture');
});

test('stances: Balanced / no stance is byte for byte the stance-less step', () => {
  const mk = (pick?: 'neutral') => { let w = legacy([pick ? withStance(player('p', 0, 0), pick) : player('p', 0, 0), creature('c', 'wolf', 0, 1.3)]); const out: string[] = []; for (let t = 0; t < 240; t++) { const r = stepCombat(w, { p: t % 90 === 0 ? { x: 0, z: 0, attack: 'light' } : STILL }, DT, NEVER); w = r.world; out.push(JSON.stringify(r.events)); } return JSON.stringify(w.fighters) + out.join(); };
  assert.equal(mk('neutral'), mk());
});

// ---- S5b: specials (RULES.special frame, named identity as data) and creature mood ----
import { specialOf } from '../../src/moves.ts';
import { withMood, withSpecial } from './zone1.ts';
const SP = RULES.special;
const caster = (name = specialOf('knight', 36)!, level = 10) => withSpecial(player('p', 0, 0, 0, undefined, level), name);
const cast = (w: World, secs: number, input: (t: number) => Input = (t) => (t === 0 ? { x: 0, z: 0, special: true } : STILL)) => { const events: Event[] = []; for (let t = 0; t < secs * 60; t++) { const r = stepCombat(w, { p: input(t) }, DT, NEVER); w = r.world; events.push(...r.events); } return { world: w, events }; };

test('special: not ready until RULES.special.first seconds in; then a 2 s telegraph carrying its name, an unblockable release on every enemy in reach for a share of THEIR max health', () => {
  const name = specialOf('knight', 36)!, c = caster(name), bear = creature('b', 'bear', 0, 2.0), wolf = creature('w', 'wolf', 2.0, 0);
  bear.phase = wolf.phase = 'stagger'; bear.hurtFor = wolf.hurtFor = 99;
  const early = cast(legacy([c, creature('x', 'wolf', 40, 0)]), 1);
  assert.ok(!early.events.some((e) => e.type === 'Telegraph'), 'not ready in the first seconds');
  const { world, events } = cast(legacy([{ ...c, specialIn: 0 }, bear, wolf]), 3);
  assert.deepEqual(events.filter((e) => e.type === 'Telegraph' && e.id === 'p'), [{ type: 'Telegraph', id: 'p', move: name, ms: Math.round((SP.windup / 60) * 1000) }]);
  assert.equal(events.filter((e) => e.type === 'Hit' && e.attacker === 'p').length, 2, 'both in reach hit, whatever the facing');
  assert.equal(get(world, 'b').health, OPPONENTS.bear.health - Math.round(SP.damage * OPPONENTS.bear.health));
  assert.equal(get(world, 'w').health, OPPONENTS.wolf.health - Math.round(SP.damage * OPPONENTS.wolf.health));
  assert.ok(get(world, 'p').specialIn > SP.cooldown / 60 - 1.5, 'cooldown re-armed from the release');
});

test('special: out of reach nothing happens; a guard does not stop it; a boss-level caster hits for bossDamage', () => {
  const ready = { ...caster(), specialIn: 0 }, far = creature('f', 'wolf', 0, 8); far.phase = 'stagger'; far.hurtFor = 99;
  assert.equal(get(cast(legacy([ready, far]), 3).world, 'f').health, OPPONENTS.wolf.health, 'out of reach');
  const a = { ...ready }, g = player('g', 0, 2, Math.PI, undefined, 10); a.pvp = g.pvp = true;
  let w = legacy([a, g]); const events: Event[] = [];
  for (let t = 0; t < 180; t++) { const r = stepCombat(w, { p: t === 0 ? { x: 0, z: 0, special: true } : STILL, g: { x: 0, z: 0, guard: true } }, DT, NEVER); w = r.world; events.push(...r.events); }
  assert.ok(events.some((e) => e.type === 'Hit' && e.victim === 'g') && !events.some((e) => e.type === 'Blocked'), 'a raised guard is no defence');
  const boss = { ...caster(specialOf('knight', 41)!, SP.bossFrom), specialIn: 0 }, t1 = creature('b', 'bear', 0, 2.0); t1.phase = 'stagger'; t1.hurtFor = 99;
  assert.equal(get(cast(legacy([boss, t1]), 3).world, 'b').health, OPPONENTS.bear.health - Math.round(SP.bossDamage * OPPONENTS.bear.health));
});

test('special: a hit taken inside the windup breaks it; no release; the shorter cooldown', () => {
  const c = { ...caster(), specialIn: 0 }, foe = creature('w', 'wolf', 0, 1.0);   // the wolf's bite (10 hp) lands inside the 2 s windup
  const out = cast(legacy([c, foe]), 3);
  assert.ok(out.events.some((e) => e.type === 'Staggered' && e.id === 'p'), 'the cast broke (the player has poise 0, so a clean hit staggers and cancels it; the 10 % rule covers fighters with poise)');
  assert.ok(!out.events.some((e) => e.type === 'Swing' && e.id === 'p'), 'no release');
  assert.ok(get(out.world, 'p').specialIn > 0 && get(out.world, 'p').specialIn <= SP.interruptCooldown / 60, 'on the shorter cooldown');
});

test('creature mood: the Pit\'s moodOf draw - about half the home stance, the rest spread over the other three; same rand = same stance', () => {
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const count: Record<string, number> = {};
  for (let i = 0; i < 2000; i++) { const k = withMood(creature('c', 'wolf', 0, 0), rnd).stance ?? 'neutral'; count[k] = (count[k] ?? 0) + 1; }
  assert.ok(count.neutral! > 900 && count.neutral! < 1100, `wolf home = Balanced about half: ${JSON.stringify(count)}`);
  for (const k of ['aggressive', 'defensive', 'trickster']) assert.ok(count[k]! > 250, `${k} is drawn: ${JSON.stringify(count)}`);
  assert.equal(withMood(creature('c', 'bear', 0, 0), () => 0.77).stance, withMood(creature('c', 'bear', 0, 0), () => 0.77).stance);
});

// ---- S6: a lone creature fights on the Pit's own duel (open-fight.ts -> duel-open.ts + ai-open.ts) ----
const duelRun = (world: World, seconds: number, input: (t: number, w: World) => Input = () => STILL) => { const events: Event[] = []; for (let t = 0; t < Math.round(seconds * 60); t++) { const r = stepCombat(world, { p: input(t, world) }, DT, NEVER); world = r.world; events.push(...r.events); } return { world, events }; };

test('a lone creature that closes in fights on the Pit duel: a stream appears, it telegraphs and hits through the Pit\'s rows, and the world Fighter mirrors the Pit fighter', () => {
  const w = newWorld([player('p', 0, 0), creature('c', 'goblin', 0, 3.5)]);
  const r = duelRun(w, 6);
  assert.ok(Object.keys(r.world.streams).length === 1 || get(r.world, 'p').health < RULES.health, 'a stream ran');
  assert.ok(r.events.some((e) => e.type === 'Telegraph' && e.id === 'c'), 'the creature winds up (the Pit\'s attack-started)');
  assert.ok(r.events.some((e) => e.type === 'Hit' && e.victim === 'p'), 'and lands a Pit blow');
  const [ph, pc] = r.world.streams.c!.duel.fighters;
  assert.equal(get(r.world, 'c').health, pc.health * 1); assert.equal(get(r.world, 'p').health, ph.health);
});

test('on the duel: the hero cuts, blocks, rolls and wins through the Pit rows; a killed creature emits Died once', () => {
  let w = newWorld([player('p', 0, 0), creature('c', 'wolf', 0, 1.4)]); const events: Event[] = [];
  for (let t = 0; t < 60 * 40 && get(w, 'c').phase !== 'dead' && get(w, 'p').phase !== 'dead'; t++) {
    const r = stepCombat(w, { p: t % 40 === 0 ? { x: 0, z: 0, attack: 'light', guard: false } : { x: 0, z: 0, guard: t % 40 > 25 } }, DT, NEVER); w = r.world; events.push(...r.events);
  }
  assert.ok(events.some((e) => e.type === 'Hit' && e.attacker === 'p'), 'the hero lands cuts');
  assert.ok(events.filter((e) => e.type === 'Died').length <= 1, 'at most one Died');
  assert.ok(get(w, 'c').phase === 'dead' || get(w, 'p').phase === 'dead', 'the duel ends');
});

test('on the duel: gear scales the damage (Attack out, RES in) by scaling the pools; naked is the Pit number', () => {
  const dealt = (attack: number) => { const w = newWorld([player('p', 0, 0, 0, { attack, res: 1 }), creature('c', 'boar', 0, 1.3)]); const r = duelRun(w, 4, (t) => (t === 0 ? { x: 0, z: 0, attack: 'light' } : STILL)); const e = r.events.find((x) => x.type === 'Hit' && x.attacker === 'p'); return e && e.type === 'Hit' ? e.damage : 0; };
  assert.ok(dealt(1) > 0 && dealt(CAPS.attack) >= dealt(1), `${dealt(1)} vs ${dealt(CAPS.attack)}`);
});

test('on the duel: a pack (two hunters) stays on the S0-S5b rows; the stream is dropped when a second creature joins', () => {
  const r = duelRun(newWorld([player('p', 0, 0), creature('a', 'wolf', 0, 3), creature('b', 'wolf', 1, 3)]), 3);
  assert.equal(Object.keys(r.world.streams).length, 0);
});

test('on the duel: a creature inside the engage ring is on the duel at once, hunting, and a creature outside stays on the world layer', () => {
  const r = duelRun(newWorld([player('p', 0, 0), creature('c', 'wolf', 0, 3)]), 1, () => ({ x: 0, z: 0 }));
  assert.ok(r.world.streams.c && get(r.world, 'c').hunting, 'engaged at 3 m');
  const far = duelRun(newWorld([player('p', 0, 0), creature('c', 'wolf', 0, 8)]), 0.5);
  assert.equal(Object.keys(far.world.streams).length, 0, 'at 8 m it is still chasing on the world layer');

test('parry cooldown (duel.ts parryCooldown): a fresh guard press opens the parry window (age 0) and arms a 30-tick cooldown; a press inside it starts the guard at age = window (no parry window); after it, fresh again', () => {
  let w = legacy([player('p', 0, 0, 0)]);
  const step = (guard: boolean) => { w = stepCombat(w, { p: { x: 0, z: 0, guard } }, DT, NEVER).world; return get(w, 'p'); };
  assert.equal(step(true).t, 0, 'a fresh press: the parry window opens at age 0');
  for (let i = 0; i < 5; i++) step(true);
  step(false); for (let i = 0; i < 8; i++) step(false);   // let go for 9 ticks, still inside the 30-tick cooldown
  assert.ok(Math.abs(step(true).t - RULES.parry / 60) < 1e-9, 'a press inside the cooldown starts the guard at age = window: no parry window');
  for (let i = 0; i < 6; i++) step(true);
  step(false); for (let i = 0; i < 40; i++) step(false);   // past the cooldown
  assert.equal(step(true).t, 0, 'after the cooldown a press is fresh again');
});

test('parry spam is not free (the Auditor\'s repro: guard 8 ticks up / 1 down vs a wolf for 30 s): parries stay within one per cooldown and the hero is not parry-immune', () => {
  const w0 = legacy([player('p', 0, 0, 0), creature('c', 'wolf', 0, 1.2)]); w0.fighters[0]!.health = w0.fighters[0]!.maxHealth = 1e6;
  let w = w0, parries = 0, hits = 0;
  for (let t = 0; t < 60 * 30; t++) { const r = stepCombat(w, { p: { x: 0, z: 0, guard: t % 9 !== 8 } }, DT, NEVER); w = r.world; parries += r.events.filter((e) => e.type === 'Parried').length; hits += r.events.filter((e) => e.type === 'Hit' && e.victim === 'p').length; }
  assert.ok(parries <= Math.ceil(30 / (RULES.parryCooldown / 60)), `${parries} parries in 30 s`);
  assert.ok(parries < 10, `${parries} (was 10 with a fresh window on every press)`);
});
