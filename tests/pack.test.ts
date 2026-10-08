import test from 'node:test';
import assert from 'node:assert/strict';
import { aim, distance, idleIntent, initialDuel, stepDuel, type Duel } from '../src/duel.ts';
import { OPPONENTS } from '../src/moves.ts';
import { RADIUS } from '../src/sim.ts';
import { THREAT_MAX, addThreat, dropThreat, emptyThreat, joinThreat, nextBout, packFoe, packLeft, setThreatState, startPack, walkInBody } from '../src/pack.ts';

test('threat: the first joiner is the victim; a repeat join and an 8th joiner change nothing', () => {
  let t = joinThreat(emptyThreat(), 'a'); assert.equal(t.victim, 'a');
  assert.deepEqual(joinThreat(t, 'a'), t);
  for (let i = 1; i < THREAT_MAX; i++) t = joinThreat(t, `p${i}`);
  assert.equal(t.refs.length, THREAT_MAX); assert.deepEqual(joinThreat(t, 'late'), t);
});

test('threat: another attacker takes the creature only past 110 % (melee) or 130 % (caster) of the victim\'s threat', () => {
  const base = (caster: boolean) => addThreat(addThreat(joinThreat(joinThreat(emptyThreat(), 'a', caster), 'b', caster), 'a', 100, caster), 'b', 100, caster);
  for (const [caster, below, above] of [[false, 109, 111], [true, 129, 131]] as const) {
    const t = base(caster);   // a joined first and has 100 = b's 100: a stays (tie goes to the earlier joiner)
    assert.equal(t.victim, 'a');
    assert.equal(addThreat(t, 'b', below - 100, caster).victim, 'a', `${below} % does not switch`);
    assert.equal(addThreat(t, 'b', above - 100, caster).victim, 'b', `${above} % switches`);
  }
});

test('threat: a suppressed or dropped victim hands over; suppressed is used only when no online entry is left; a tie goes to the earlier joiner', () => {
  let t = ['a', 'b', 'c'].reduce((l, id) => addThreat(l, id, 50), emptyThreat());
  assert.equal(t.victim, 'a', 'equal threat: the earliest joiner');
  t = addThreat(t, 'b', 10);   // b 60 vs a 50 = 120 % -> b
  assert.equal(t.victim, 'b');
  t = setThreatState(t, 'b', 'suppressed'); assert.equal(t.victim, 'a', 'an online entry beats a suppressed one even with less threat');
  t = setThreatState(setThreatState(t, 'a', 'suppressed'), 'c', 'suppressed'); assert.equal(t.victim, 'b', 'all suppressed: the most threat');
  t = setThreatState(t, 'b', 'offline'); assert.equal(t.victim, 'a', 'offline is never chosen');
  t = dropThreat(dropThreat(t, 'a'), 'c'); assert.equal(t.victim, 'b' === t.victim ? 'b' : null);
  assert.equal(dropThreat(dropThreat(dropThreat(t, 'b'), 'a'), 'c').victim, null);
});

test('threat: a hit from a player who never tapped joins them, and a drop frees a slot without reusing its join number', () => {
  let t = addThreat(emptyThreat(), 'x', 30); assert.equal(t.refs[0]!.join, 0); assert.equal(t.victim, 'x');
  t = dropThreat(t, 'x'); t = joinThreat(t, 'y'); assert.equal(t.refs[0]!.join, 1);
  assert.deepEqual(addThreat(t, 'y', -5), t, 'no negative or zero threat');
});

test('pack: members keep camp order (the leader last), an empty camp is refused', () => {
  assert.throws(() => startPack([]), /at least one/);
  const p = startPack([OPPONENTS.goblin, OPPONENTS.pitborn, OPPONENTS.veteran]);
  assert.equal(packFoe(p), OPPONENTS.goblin); assert.equal(packLeft(p), 2);
});

const killed = (d: Duel, victim: 0 | 1, draw = false): Duel => ({ ...d, finish: { victim, location: 'torso', move: 'cut-high' as never, heading: 0, ...(draw ? { draw: true } : {}) } });

test('pack: the next member walks in only when the engaged one is dead or fled; the player\'s fighter carries over untouched', () => {
  const pack = startPack([OPPONENTS.goblin, OPPONENTS.pitborn, OPPONENTS.veteran]);
  let duel = initialDuel(OPPONENTS.goblin);
  assert.equal(nextBout(pack, duel), null, 'still standing');
  assert.equal(nextBout(pack, killed(duel, 0)), null, 'the player fell: the camp wins');
  assert.equal(nextBout(pack, killed(duel, 1, true)), null, 'a draw ends it');
  const hurt: Duel = { ...duel, fighters: [{ ...duel.fighters[0], health: 37, stamina: 12 }, duel.fighters[1]] };
  const a = nextBout(pack, killed(hurt, 1))!;
  assert.equal(a.duel.fighters[0].health, 37); assert.equal(a.duel.fighters[0].stamina, 12);
  assert.equal(a.duel.fighters[0], hurt.fighters[0], 'the very same fighter object: no free heal, no reset');
  assert.equal(a.duel.finish, null); assert.equal(a.pack.index, 1);
  assert.equal(a.duel.fighters[1].maxHealth, OPPONENTS.pitborn.health);
  const b = nextBout(a.pack, killed(a.duel, 1))!; assert.equal(b.pack.index, 2);
  assert.equal(nextBout(b.pack, killed(b.duel, 1)), null, 'the leader was the last');
  const fled = nextBout(pack, hurt, true)!; assert.equal(fled.pack.index, 1, 'a flight also brings the next member');
});

test('pack: the walk-in starts on the play circle\'s far edge from the player, facing the player, and the new bout steps', () => {
  const d0 = initialDuel(OPPONENTS.goblin), pos = (x: number, z: number): Duel => ({ ...d0, fighters: [{ ...d0.fighters[0], body: { ...d0.fighters[0].body, x, z } }, d0.fighters[1]] });
  for (const [x, z] of [[0, 4], [-3, 0], [2, -2], [0, 0]]) {
    const d = pos(x, z), body = walkInBody(d);
    assert.ok(Math.abs(Math.hypot(body.x, body.z) - (RADIUS - 0.6)) < 1e-9, `at the edge (${x},${z})`);
    if (Math.hypot(x, z) > 0) assert.ok(body.x * x + body.z * z < 0, 'on the opposite side');
    assert.ok(Math.abs(body.heading - aim(body, d.fighters[0].body)) < 1e-9, 'facing the player');
    assert.ok(distance(body, d.fighters[0].body) > 0.85);
  }
  const next = nextBout(startPack([OPPONENTS.goblin, OPPONENTS.pitborn]), killed(d0, 1))!.duel;
  let d = next; for (let t = 0; t < 300; t++) d = stepDuel(d, [idleIntent(), idleIntent()]);
  assert.ok(d.tick >= 300 && d.fighters[0].health > 0);
});
