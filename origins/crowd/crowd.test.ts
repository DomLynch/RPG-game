// Tag-team crowd fights (origins/crowd/crowd.ts, combat study §2 option 2A + 2E roles + 2F sweep push): one token, the rest circle.
// The rule tests feed the director synthetic observations; the last tests run it on the arena's own, unchanged simulation.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialAi } from '../../src/ai.ts';
import { project, stepPractice } from '../../src/combat.ts';
import { idleIntent, initialDuel, opponentFighter } from '../../src/duel.ts';
import { OPPONENTS, PROFILES } from '../../src/moves.ts';
import {
  carryPlayer, CROWD, encounterRecord, enemySeed, fromRing, handOver, LEADER_HOLD, limits, newCrowd, nextUp, observe, ringSpot, ROLE_RING,
  SKIRMISHER_HANDOVER, stepCrowd, SWEEP, type CrowdEvent, type CrowdState, type Observation, type PackMember,
} from './crowd.ts';

const ORIGIN = { x: 0, z: 0 };
const calm = (o: Partial<Observation> = {}): Observation => ({ holderStarted: false, quiet: true, holderDown: false, playerDown: false, sweep: false, player: ORIGIN, holder: { x: 0, z: 1.8 }, ...o });
const BANDITS: PackMember[] = [{ id: 'bandit-a' }, { id: 'bandit-b' }, { id: 'bandit-c' }];
// Run `n` ticks with the same observation; collect every event with its tick.
function run(s: CrowdState, n: number, o: (s: CrowdState) => Observation = () => calm()) {
  const log: { tick: number; e: CrowdEvent }[] = [];
  for (let i = 0; i < n; i++) { const r = stepCrowd(s, o(s)); s = r.state; for (const e of r.events) log.push({ tick: s.tick, e }); }
  return { s, log };
}
const holderOf = (s: CrowdState) => { assert.notEqual(s.holder, null); return s.holder!; };

test('a new encounter: one holder at tick 0, everyone else queued and circling at 4–6 m; deterministic per seed', () => {
  const s = newCrowd(42, BANDITS);
  assert.equal(s.queue.length, 2);
  assert.ok(!s.queue.includes(holderOf(s)));
  assert.equal(s.enemies[holderOf(s)]!.turns, 1);
  for (const e of s.enemies) assert.ok(e.ring.radius >= CROWD.ring.min && e.ring.radius <= CROWD.ring.max);
  assert.deepEqual(newCrowd(42, BANDITS), s, 'same seed, same encounter');
  const orders = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => { const t = newCrowd(seed, BANDITS); return [t.holder, ...t.queue].join(); }));
  assert.ok(orders.size > 1, 'the seed moves the order');
  assert.notEqual(enemySeed(42, 0), enemySeed(42, 1));
  assert.ok(s.enemies.every((e) => e.seed > 0));
});

test('a pack is 1..maxEnemies with unique ids', () => {
  assert.throws(() => newCrowd(1, []));
  assert.throws(() => newCrowd(1, Array.from({ length: CROWD.maxEnemies + 1 }, (_, i) => ({ id: `e${i}` }))));
  assert.throws(() => newCrowd(1, [{ id: 'x' }, { id: 'x' }]));
  const solo = newCrowd(1, [{ id: 'x' }]);
  assert.equal(solo.holder, 0);
  assert.deepEqual(solo.queue, []);
});

test('the holder hands over after 3 attack starts, at a quiet moment, to the first in the queue, and goes to the back', () => {
  let s = newCrowd(7, BANDITS);
  const first = holderOf(s), next = s.queue[0]!;
  s = run(s, CROWD.minPassGap).s;   // past the pass gap, no attacks yet: nobody moves
  assert.equal(s.holder, first);
  for (let i = 0; i < CROWD.starts - 1; i++) s = stepCrowd(s, calm({ holderStarted: true })).state;
  assert.equal(s.holder, first, 'two starts: he keeps it');
  let r = stepCrowd(s, calm({ holderStarted: true, quiet: false }));
  assert.equal(r.state.holder, first, 'third start, but not a quiet moment');
  r = stepCrowd(r.state, calm());
  assert.deepEqual(r.events, [{ kind: 'pass', from: first, to: next }]);
  assert.equal(r.state.holder, next);
  assert.equal(r.state.queue.at(-1), first, 'back of the queue');
  assert.equal(r.state.starts, 0);
});

test('the holder hands over after 6 s even without attacking; never twice inside 120 ticks', () => {
  const { s: after, log } = run(newCrowd(9, BANDITS), CROWD.hold + CROWD.minPassGap * 3);
  const passes = log.filter((l) => l.e.kind === 'pass');
  assert.equal(passes[0]!.tick, CROWD.hold, 'first pass at 6 s');
  for (let i = 1; i < passes.length; i++) assert.ok(passes[i]!.tick - passes[i - 1]!.tick >= CROWD.minPassGap);
  // Attack spam every tick: the token still moves at most once per gap.
  const spam = run(after, CROWD.minPassGap * 4, () => calm({ holderStarted: true })).log.filter((l) => l.e.kind === 'pass');
  assert.ok(spam.length >= 2);
  for (let i = 1; i < spam.length; i++) assert.equal(spam[i]!.tick - spam[i - 1]!.tick, CROWD.minPassGap);
});

test('the holder falls: 45-tick breath, then the next steps in; the last one falling wins the encounter', () => {
  let s = newCrowd(3, BANDITS);
  const first = holderOf(s), next = s.queue[0]!;
  let r = stepCrowd(s, calm({ holderDown: true }));
  assert.deepEqual(r.events, [{ kind: 'fell', who: first }]);
  assert.equal(r.state.holder, null);
  assert.equal(r.state.breath, CROWD.breath);
  s = r.state;
  for (let i = 0; i < CROWD.breath - 1; i++) { r = stepCrowd(s, calm()); s = r.state; assert.deepEqual(r.events, []); }
  r = stepCrowd(s, calm());
  assert.deepEqual(r.events, [{ kind: 'step-in', to: next }]);
  s = r.state;
  assert.equal(s.holder, next);
  // Kill the other two.
  s = stepCrowd(s, calm({ holderDown: true })).state;
  s = run(s, CROWD.breath).s;
  r = stepCrowd(s, calm({ holderDown: true }));
  assert.deepEqual(r.events.map((e) => e.kind), ['fell', 'won']);
  assert.equal(r.state.outcome, 'won');
  assert.equal(stepCrowd(r.state, calm()).events.length, 0, 'over is over');
});

test('the player falling loses the encounter', () => {
  const r = stepCrowd(newCrowd(1, BANDITS), calm({ playerDown: true }));
  assert.equal(r.state.outcome, 'lost');
  assert.deepEqual(r.events, [{ kind: 'lost' }]);
});

test('waiting enemies circle at their role radius and the holder stays out of the ring', () => {
  const s0 = newCrowd(11, [{ id: 'a' }, { id: 'b', role: 'skirmisher' }, { id: 'c', role: 'brute' }]);
  const s = run(s0, 60).s;
  for (const i of s.queue) {
    const e = s.enemies[i]!, before = s0.enemies[i]!;
    assert.notEqual(e.ring.angle, before.ring.angle, 'he moved round');
    assert.equal(e.ring.radius, ROLE_RING[e.role].radius);
    const spot = ringSpot(e, ORIGIN);
    assert.ok(Math.abs(Math.hypot(spot.x, spot.z) - e.ring.radius) < 1e-9);
  }
  const h = holderOf(s);
  assert.equal(s.enemies[h]!.ring.angle, s0.enemies[h]!.ring.angle);
});

test('2E Skirmisher: the holder before him hands over after 2 starts or 4 s', () => {
  // Find a seed whose first in the queue is the skirmisher.
  const pack: PackMember[] = [{ id: 'a' }, { id: 'b' }, { id: 's', role: 'skirmisher' }];
  const seed = [...Array(64).keys()].find((k) => { const t = newCrowd(k, pack); return t.queue[0] === 2; })!;
  let s = newCrowd(seed, pack);
  assert.deepEqual(limits(s, nextUp(s)), SKIRMISHER_HANDOVER);
  s = run(s, CROWD.minPassGap).s;
  s = stepCrowd(s, calm({ holderStarted: true })).state;
  const r = stepCrowd(s, calm({ holderStarted: true }));
  assert.equal(r.events[0]?.kind, 'pass');
  assert.equal(r.state.holder, 2);
  const timed = run(newCrowd(seed, pack), SKIRMISHER_HANDOVER.hold).log.find((l) => l.e.kind === 'pass');
  assert.equal(timed?.tick, SKIRMISHER_HANDOVER.hold);
});

test('2E Brute: never takes the token before a Duellist has had it', () => {
  for (let seed = 0; seed < 32; seed++) {
    const s = newCrowd(seed, [{ id: 'brute', role: 'brute' }, { id: 'duel' }]);
    assert.equal(s.enemies[holderOf(s)]!.role, 'duellist', `seed ${seed}`);
    const { log } = run(s, CROWD.hold + 1);
    assert.deepEqual(log.find((l) => l.e.kind === 'pass')?.e, { kind: 'pass', from: 1, to: 0 }, 'after the Duellist, the Brute');
  }
  // With no Duellist in the pack, a Brute fights at once.
  assert.equal(newCrowd(1, [{ id: 'b1', role: 'brute' }, { id: 'b2', role: 'brute' }]).holder !== null, true);
});

test('2E Pack leader: last to take the token; others hand over every 4 s while he lives; kill him and they fight one each to the end', () => {
  const pack: PackMember[] = [{ id: 'boss', role: 'leader' }, { id: 'a' }, { id: 'b' }];
  for (let seed = 0; seed < 16; seed++) {
    const s = newCrowd(seed, pack);
    assert.notEqual(s.holder, 0);
    assert.equal(s.queue.at(-1), 0, 'leader queued last');
    const { s: later, log } = run(s, LEADER_HOLD * 4);
    const passes = log.filter((l) => l.e.kind === 'pass');
    assert.equal(passes[0]!.tick, LEADER_HOLD);
    assert.ok(passes.every((p) => p.e.kind === 'pass' && p.e.to !== 0), 'never passed to the leader while others live');
    assert.notEqual(later.holder, 0);
  }
  // Leader is the last alive: he steps in after the breath.
  let s = newCrowd(5, pack);
  s = stepCrowd(s, calm({ holderDown: true })).state; s = run(s, CROWD.breath).s;
  assert.notEqual(s.holder, 0);
  s = stepCrowd(s, calm({ holderDown: true })).state; s = run(s, CROWD.breath).s;
  assert.equal(s.holder, 0);
  // Leader killed first (forced in as the only one, then two others join): no voluntary hand-overs afterwards.
  let t = newCrowd(5, [{ id: 'boss', role: 'leader' }, { id: 'a' }, { id: 'b' }]);
  t = { ...t, holder: 0, queue: [1, 2] };
  t = stepCrowd(t, calm({ holderDown: true })).state;
  assert.equal(t.leaderFell, true);
  t = run(t, CROWD.breath).s;
  assert.equal(run(t, CROWD.hold * 3, () => calm({ holderStarted: true })).log.filter((l) => l.e.kind === 'pass').length, 0);
});

test('2F sweep: waiting enemies within 2.5 m of the holder are pushed to the outer ring and wait 60 ticks before their next token', () => {
  let s = newCrowd(21, BANDITS);
  const near = s.queue[0]!, far = s.queue[1]!;
  // Put `near` right beside the holder's spot and `far` behind the player.
  const holder = { x: 0, z: 1.8 };
  s = { ...s, enemies: s.enemies.map((e, i) => (i === near ? { ...e, ring: { ...e.ring, angle: 0.3, radius: 4, turn: 1 as const } } : i === far ? { ...e, ring: { ...e.ring, angle: Math.PI } } : e)) };
  const nearSpot = ringSpot(s.enemies[near]!, ORIGIN);
  assert.ok(Math.hypot(nearSpot.x - holder.x, nearSpot.z - holder.z) <= SWEEP.reach + 0.1);
  const r = stepCrowd(s, calm({ sweep: true, holder }));
  assert.deepEqual(r.events, [{ kind: 'pushed', who: near }]);
  assert.equal(r.state.enemies[near]!.ring.radius, CROWD.ring.max);
  assert.equal(r.state.enemies[near]!.ring.delay, SWEEP.delay);
  // While `near` is delayed, `far` is next in line even though `near` queues ahead of him.
  assert.equal(nextUp(r.state), far);
  // He drifts back to his own circle.
  const back = run(r.state, 200).s.enemies[near]!;
  assert.equal(back.ring.radius, ROLE_RING.duellist.radius);
});

test('stepCrowd is pure: the input state is never mutated', () => {
  const s = newCrowd(13, BANDITS), copy = structuredClone(s);
  stepCrowd(s, calm({ holderStarted: true, sweep: true }));
  stepCrowd(s, calm({ holderDown: true }));
  assert.deepEqual(s, copy);
});

// ---- On the arena's own simulation (src/ read-only) ----

test('observe reads the duel: attack starts, quiet moments, sweeps and who is down', () => {
  const duel = initialDuel(OPPONENTS.pitborn);
  const o = observe(duel, [{ tick: 1, type: 'AttackStarted', actor: 1, move: 'light_right' }, { tick: 1, type: 'Hit', actor: 0, target: 1, move: 'light_left', damage: 5 }]);
  assert.equal(o.holderStarted, true);
  assert.equal(o.sweep, true);
  assert.equal(o.quiet, true);
  assert.equal(o.holderDown, false);
  assert.equal(observe(duel, [{ tick: 1, type: 'Hit', actor: 0, target: 1, move: 'heavy_overhead', damage: 5 }]).sweep, false);
  const busy = { ...duel, fighters: [{ ...duel.fighters[0], phase: 'attack' as const }, duel.fighters[1]] as typeof duel.fighters };
  assert.equal(observe(busy, []).quiet, false);
  const chain = { ...duel, fighters: [{ ...duel.fighters[0], chain: 5 }, duel.fighters[1]] as typeof duel.fighters };
  assert.equal(observe(chain, []).quiet, false, 'inside the player\'s chain window');
  const down = { ...duel, fighters: [duel.fighters[0], { ...duel.fighters[1], health: 0 }] as typeof duel.fighters };
  assert.equal(observe(down, []).holderDown, true);
});

test('carryPlayer keeps health, stamina, posture and wounds; fromRing brings an enemy in with his own bars', () => {
  const duel = initialDuel(OPPONENTS.pitborn);
  const live = { ...duel.fighters[0], health: 37, stamina: 22, posture: 40, wound: 12, woundSite: 'legs' as const, legWound: true, maxStamina: 80, phase: 'guard' as const };
  const fresh = initialDuel(OPPONENTS.pitborn).fighters[0];
  const c = carryPlayer(live, fresh);
  assert.deepEqual([c.health, c.stamina, c.posture, c.wound, c.woundSite, c.legWound, c.maxStamina], [37, 22, 40, 12, 'legs', true, 80]);
  assert.equal(c.phase, 'ready');
  assert.deepEqual(c.body, live.body);
  const saved = { ...opponentFighter(OPPONENTS.pitborn, { x: 0, z: 0, heading: 0, distance: 0 }), health: 51, stamina: 33, phase: 'attack' as const, move: 'heavy_overhead' as const };
  const inn = fromRing(saved, { x: 4, z: 0 }, ORIGIN);
  assert.deepEqual([inn.health, inn.stamina, inn.phase, inn.move, inn.body.x, inn.body.z], [51, 33, 'ready', null, 4, 0]);
  assert.ok(Math.abs(inn.body.heading - -Math.PI / 2) < 1e-9, 'facing the player');
});

test('a whole encounter on the unchanged sim: one attacker at a time, the player carried, side 1 swapped on each pass', () => {
  const profile = PROFILES.normal, seed = 2026;
  let crowd = newCrowd(seed, BANDITS);
  const bench = crowd.enemies.map(() => ({ fighter: null as ReturnType<typeof opponentFighter> | null, ai: null as ReturnType<typeof initialAi> | null }));
  let practice = project(initialDuel(OPPONENTS.pitborn), initialAi(crowd.enemies[crowd.holder!]!.seed));
  const fresh = practice.duel.fighters[1];
  let passes = 0, ticks = 0;
  const seenHolders = new Set<number>([crowd.holder!]);
  // A guarding player who never attacks: the warden's starts drive the hand-overs; the encounter ends when the player falls or time is up.
  const guard = { ...idleIntent(), guard: true };
  while (!crowd.outcome && ticks < 6000) {
    const before = practice.duel.fighters[0];
    practice = stepPractice(practice, guard, profile);
    ticks++;
    const r = stepCrowd(crowd, observe(practice.duel, practice.events));
    crowd = r.state;
    for (const e of r.events) {
      if (e.kind !== 'pass') continue;
      passes++;
      bench[e.from] = { fighter: practice.duel.fighters[1], ai: practice.ai };
      const saved = bench[e.to]!.fighter ?? fresh, at = ringSpot(crowd.enemies[e.to]!, practice.duel.fighters[0].body);
      const player = practice.duel.fighters[0];
      practice = project(handOver(practice.duel, fromRing(saved, at, player.body)), bench[e.to]!.ai ?? initialAi(crowd.enemies[e.to]!.seed));
      assert.equal(practice.duel.fighters[0], player, 'the player is carried as is');
      assert.ok(practice.duel.fighters[0].health <= before.health);
      seenHolders.add(e.to);
    }
  }
  assert.ok(passes >= 2, `hand-overs happened (${passes})`);
  assert.equal(seenHolders.size, 3, 'every bandit had a turn');
  const rec = encounterRecord('test:bandits', seed, crowd);
  assert.equal(rec.enemySeeds.length, 3);
  assert.equal(rec.ticks, ticks);
});
