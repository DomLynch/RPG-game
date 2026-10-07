import test from 'node:test';
import assert from 'node:assert/strict';
import { createFighter, feintable, mirror, stepDuel, withStances, type Duel } from '../src/duel.ts';
import { PICKS, STANCES, asStance, homePick, moodOf, stanced, type StanceId } from '../src/stance.ts';
import { OPPONENTS, RULES, opponentAt, profileAt } from '../src/moves.ts';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { hashDuel } from '../src/net/rollback.ts';
import { packRecord, unpackRecord } from '../src/record.ts';
import { verifyRecord } from '../src/replay.ts';
import { liveRecorder } from './lib/live-recorder.ts';
import { act, arena, idle, W } from './strategies.ts';

// Stances (RV34, docs/specs/origins/combat-study.md "stances and opponent mood"). Dom's table is pinned as data: a number that moves is a decision, not a drift.
test('the stance table is Dom\'s: every delta, per mille, and nothing else', () => {
  assert.deepEqual(STANCES, {
    aggressive: { damage: 50, posture: 100, block: 100 },
    defensive: { damage: -50, block: -150, recover: 1000 },
    trickster: { heavyDamage: -50, feint: -500, kickPosture: 1000 },
  });
  assert.deepEqual([...PICKS], ['neutral', 'aggressive', 'defensive', 'trickster']);
});

test('stanced() leaves a stance-less fighter\'s number untouched (no float drift) and scales a stanced one by its delta', () => {
  assert.equal(stanced({}, 'damage', 18), 18); assert.equal(stanced({ stance: 'trickster' }, 'damage', 18), 18, 'a key the stance does not name is untouched');
  assert.equal(stanced({ stance: 'aggressive' }, 'damage', 20), 21); assert.equal(stanced({ stance: 'defensive' }, 'block', 40), 34); assert.equal(stanced({ stance: 'trickster' }, 'feint', 10), 5);
});

// The player starts with the sword drawn and throws one heavy; the opponent stands (or guards the overhead). The first Hit / Blocked is the blow under test.
const swing = (player?: StanceId, mood?: StanceId, guard = false, move: 'heavy' | 'light' = 'heavy') => {
  let d: Duel = withStances(arena(), player, mood); d = { ...d, fighters: [{ ...d.fighters[0], phase: 'ready' }, d.fighters[1]] }; const ev: Duel['events'] = [];
  for (let i = 0; i < 90; i++) { d = stepDuel(d, [i === 0 ? act(move) : idle(), guard ? { ...idle(), guard: true, guardDirection: mirror(move === 'heavy' ? 'overhead' : 'right') } : idle()]); ev.push(...d.events); }
  return { d, ev, hit: ev.find(e => e.type === 'Hit'), blocked: ev.find(e => e.type === 'Blocked') };
};

test('stances move damage and block cost by their table and never the timing of the blow', () => {
  const none = swing(), agg = swing('aggressive'), def = swing('defensive'), tri = swing('trickster');
  assert.ok(none.hit && agg.hit && def.hit && tri.hit);
  assert.ok(agg.hit.damage! > none.hit.damage! && def.hit.damage! < none.hit.damage! && tri.hit.damage! < none.hit.damage!, 'aggressive hits harder; defensive and a trickster\'s heavy hit softer');
  for (const s of [agg, def, tri]) assert.equal(s.hit!.tick, none.hit.tick, 'the blow lands on the same tick: a stance never changes timing');
  const guarded = (mood?: StanceId) => swing(undefined, mood, true, 'light').blocked;   // a light cut a guard simply blocks (a heavy breaks it)
  const plain = guarded(), a = guarded('aggressive'), df = guarded('defensive');
  assert.ok(plain && a && df);
  assert.ok(a.stamina! > plain.stamina! && df.stamina! < plain.stamina!, 'an aggressive blocker pays more, a defensive one less');
});

test('a trickster feints for half: a swing he could not afford to abandon, he can', () => {
  const f = createFighter({ x: 0, z: 0, heading: 0, distance: 0 } as never, 'attack');
  const swinging = { ...f, move: 'light_right' as const, age: 1, stamina: RULES.feintCost * 0.6 };
  assert.equal(feintable(swinging), false); assert.equal(feintable({ ...swinging, stance: 'trickster' }), true);
});

test('the AI\'s mood is drawn from the seed: half its home stance, the other half spread over the other three picks', () => {
  assert.deepEqual([homePick('executioner'), homePick('shieldmaiden'), homePick('goblin'), homePick('veteran')], ['aggressive', 'defensive', 'trickster', 'neutral']);
  for (const foe of ['executioner', 'goblin', 'veteran']) {
    const count = new Map<string, number>(); const N = 4000;
    for (let s = 1; s <= N; s++) { const m = moodOf(s * 2654435761 >>> 0, foe); count.set(m, (count.get(m) ?? 0) + 1); assert.equal(m, moodOf(s * 2654435761 >>> 0, foe), 'a pure function of the seed'); }
    assert.ok(Math.abs(count.get(homePick(foe))! / N - 0.5) < 0.035, `${foe}: home stance about half (${count.get(homePick(foe))! / N})`);
    for (const p of PICKS) if (p !== homePick(foe)) assert.ok(Math.abs((count.get(p) ?? 0) / N - 1 / 6) < 0.035, `${foe}: ${p} about a sixth`);
  }
  assert.equal(asStance('neutral'), undefined); assert.equal(asStance('trickster'), 'trickster');
});

test('no stances: the fight grows no stance field and is the plain fight, hash for hash', () => {
  const plain = swing().d, off = (() => { let d = arena(); d = { ...d, fighters: [{ ...d.fighters[0], phase: 'ready' }, d.fighters[1]] }; for (let i = 0; i < 90; i++) d = stepDuel(d, [i === 0 ? act('heavy') : idle(), idle()]); return d; })();
  assert.equal(hashDuel(plain), hashDuel(off)); assert.ok(plain.fighters.every(f => !('stance' in f)));
});

// RV34: the record carries the flag and the player's pick; the AI's mood is re-drawn from the seed on replay.
test('a stances fight is recorded as v34, packed and replayed to the very same state; the AI drew its mood from the seed', () => {
  for (const pick of PICKS) {
    const seed = 21, opponent = OPPONENTS.executioner, profile = profileAt(opponent, 6);
    const rec = liveRecorder({ build: 'test', opponent: 'executioner', weapon: 'longsword', level: 6, seed, stances: pick });
    let p = initialPractice(seed, opponentAt(opponent, 6), 'longsword', null, undefined, undefined, pick);
    for (let i = 0; i < 200; i++) p = stepPractice(p, rec.push(i === 0 ? act('light') : i % 50 === 40 ? act('heavy') : idle()), profile);
    assert.equal(W(p.duel).stance, asStance(moodOf(seed, 'executioner')));
    assert.equal(p.duel.fighters[0].stance, asStance(pick));
    const record = unpackRecord(packRecord(rec.finish('abandoned')));
    assert.equal(record.v, 34); assert.equal(record.stances, pick);
    const replay = verifyRecord(record);
    assert.ok(replay.ok); assert.equal(hashDuel(replay.practice.duel), hashDuel(p.duel));
  }
});
