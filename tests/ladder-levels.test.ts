// The 46-level ladder's profiles (moves.ts profileAt; Dom via Strategy 2026-09-27, anchors 1 / 6 / 18 / 46). The fairness of each level is
// the battery's (tests/ladder-battery.test.ts); this file pins the blend itself: the anchors are the tables, the novice lowers only skill,
// identity holds, the tick counts round, and the ladder's ceiling agrees with the career's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { READ } from '../src/ai.ts';
import { MAX_LEVEL } from '../src/career.ts';
import { LADDER } from '../src/ladder.ts';
import { LEVELS, LEVEL_ANCHORS, LOADOUT_FROM, LONGSWORD, NOVICE_BODY, OPPONENTS, POISE_FULL_AT, opponentAt, profileAt, type AiProfile, type Opponent } from '../src/moves.ts';
// A re-kitted opponent (moves.ts LOADOUT_FROM: the Centurion's gladius + scutum from level 6, RV18) is his roster body with the kit's weapon and guard on.
const kitted = (o: Opponent, l: number): Opponent => { const k = LOADOUT_FROM[o.id]; return k && l >= k.from ? { ...o, weapon: k.weapon, guard: { ...o.guard, ...k.guard } } : o; };
// Identity where nothing is re-kitted (an accidental clone of an unkitted opponent is still caught); structural equality only for a re-kit (Auditer, #942).
const same = (got: Opponent, o: Opponent, l: number, msg: string) => { const want = kitted(o, l); if (want === o) assert.equal(got, o, msg); else assert.deepEqual(got, want, msg); };

const SKILL: (keyof AiProfile)[] = ['reaction', 'accuracy', 'parry', 'dodge', 'aggression', 'lapse', 'read'];
const IDENTITY: (keyof AiProfile)[] = ['pressure', 'feint', 'guard', 'disengage', 'circle', 'step', 'interrupt', 'kick', 'dash'];
const ladder = LADDER.map(o => OPPONENTS[o.id]);

test('levels 6 / 18 / 46 ARE the easy / normal / hard tables (same object: the same fight, the same RNG draws)', () => {
  assert.equal(LEVELS, MAX_LEVEL, 'moves.ts and career.ts agree on the top level');
  for (const o of ladder) {
    assert.equal(profileAt(o, LEVEL_ANCHORS.easy), o.profiles.easy, o.id);
    assert.equal(profileAt(o, LEVEL_ANCHORS.normal), o.profiles.normal, o.id);
    assert.equal(profileAt(o, LEVEL_ANCHORS.hard), o.profiles.hard, o.id);
  }
});

test('level 1 is a novice below easy: slower, less accurate, never parries, more lapses; identity knobs as easy\'s', () => {
  for (const o of ladder) {
    const n = profileAt(o, 1), e = o.profiles.easy;
    assert.equal(n.reaction, e.reaction + 30, o.id); assert.equal(n.accuracy, .1, o.id); assert.equal(n.parry, 0, o.id); assert.equal(n.dodge, 0, o.id);
    assert.equal(n.lapse, .95, o.id); assert.equal(n.read, .1, o.id);
    assert.ok(n.aggression < e.aggression && n.dodge <= e.dodge, o.id);
    for (const key of IDENTITY) for (const l of [1, 2, 3, 4, 5]) assert.equal(profileAt(o, l)[key], e[key], `${o.id} ${key} held at easy's on level ${l}`);
    assert.equal(profileAt(o, 3).discipline, e.discipline, `${o.id}: the novice rests like easy`);
  }
});

test('between anchors every level is a blend: skill knobs move monotonically, counts are whole ticks, nothing leaves 0..1', () => {
  for (const o of ladder) {
    let prev = profileAt(o, 1);
    for (let l = 2; l <= LEVELS; l++) {
      const p = profileAt(o, l);
      assert.ok(Number.isInteger(p.reaction) && Number.isInteger(p.discipline) && (p.anticipate === undefined || Number.isInteger(p.anticipate)), `${o.id} ${l}: whole counts`);
      for (const key of ['accuracy', 'parry', 'dodge', 'aggression', 'pressure', 'lapse', 'read'] as const) assert.ok(p[key]! >= 0 && p[key]! <= 1, `${o.id} ${l} ${key}`);
      // Between two anchors a knob moves one way only (the tables themselves may turn: the Executioner's anticipate is normal's alone).
      const seg = (x: number) => (x < LEVEL_ANCHORS.easy ? 0 : x < LEVEL_ANCHORS.normal ? 1 : 2);
      if (seg(l) === seg(l - 1) || l === LEVEL_ANCHORS.easy || l === LEVEL_ANCHORS.normal) {
        const [a, b] = seg(l - 1) === 0 ? [profileAt(o, 1), o.profiles.easy] : seg(l - 1) === 1 ? [o.profiles.easy, o.profiles.normal] : [o.profiles.normal, o.profiles.hard];
        for (const key of SKILL) {
          const dir = Math.sign((b[key] ?? 0) - (a[key] ?? 0)), step = (p[key] ?? 0) - (prev[key] ?? 0);
          assert.ok(dir === 0 ? Math.abs(step) < 1e-9 : Math.sign(step) !== -dir, `${o.id} ${key} ${l - 1} -> ${l}: ${prev[key]} -> ${p[key]}`);
        }
      }
      prev = p;
    }
    assert.equal(profileAt(o, 0), profileAt(o, 1), 'below 1 is 1'); assert.equal(profileAt(o, 99), o.profiles.hard, 'above 46 is 46');
  }
});

test('an absent knob blends from what its absence means in ai.ts, and stays absent when both anchors leave it out', () => {
  const x = OPPONENTS.executioner;   // anticipate is normal's alone: easy's absence is READ.anticipate
  assert.equal(x.profiles.easy.anticipate, undefined);
  assert.equal(profileAt(x, 12)!.anticipate, Math.round(READ.anticipate + (x.profiles.normal.anticipate! - READ.anticipate) / 2));
  assert.equal(profileAt(OPPONENTS.veteran, 12).feint, undefined, 'the Centurion has no feint key on any table');
});

test('the Witch keeps her sweep and hop at every level (RV17: identity held, only her skill fields move; Lead 2026-09-27)', () => {
  const w = OPPONENTS.witch;
  for (let l = 1; l <= LEVELS; l++) {
    const p = profileAt(w, l);
    assert.deepEqual({ pressure: p.pressure, disengage: p.disengage, circle: p.circle, step: p.step, guard: p.guard }, { pressure: .75, disengage: .5, circle: .6, step: .7, guard: .4 }, `level ${l}`);
  }
});

test('the goblin never guards and never parries, at any level', () => {
  for (let l = 1; l <= LEVELS; l++) { const p = profileAt(OPPONENTS.goblin, l); assert.equal(p.guard, 0, `level ${l}`); assert.equal(p.parry, 0, `level ${l}`); }
});

test('the novice body (Strategy 2026-09-27): poise 0 and 70 % health at level 1, back to his own body at level 6; the player is untouched', () => {
  for (const o of ladder) {
    const one = opponentAt(o, 1);
    assert.equal(one.poise, NOVICE_BODY.poise, o.id); assert.equal(one.health, Math.round(o.health * NOVICE_BODY.health), o.id);
    const full = Math.max(LEVEL_ANCHORS.easy, POISE_FULL_AT[o.id] ?? LEVEL_ANCHORS.easy);
    for (let l = 2; l <= LEVELS; l++) {
      const a = opponentAt(o, l - 1), b = opponentAt(o, l);
      assert.ok(b.poise >= a.poise && b.health >= a.health, `${o.id} ${l}: the body only grows with the level`);
      assert.deepEqual({ ...b, poise: 0, health: 0 }, { ...kitted(o, l), poise: 0, health: 0 }, `${o.id} ${l}: only poise and health change (and a re-kit's weapon and guard)`);
      if (l >= LEVEL_ANCHORS.easy) assert.equal(b.health, o.health, `${o.id} ${l}: full health from level 6`);
    }
    for (const l of [full, 30, LEVEL_ANCHORS.hard]) same(opponentAt(o, l), o, l, `${o.id} ${l}: he is the man he was`);
  }
});

test('the Pitborn and the Shieldmaiden: poise full only at 18 (Strategy 10:1x), so the light still staggers them at level 6', () => {
  const lightest = Math.min(LONGSWORD.moves.light_left.damage, LONGSWORD.moves.light_right.damage);
  for (const id of ['pitborn', 'shieldmaiden'] as const) {
    const o = OPPONENTS[id];
    assert.equal(POISE_FULL_AT[id], LEVEL_ANCHORS.normal);
    assert.ok(o.poise >= lightest, `${id}: today's poise stops the light (why the ramp exists)`);
    assert.ok(opponentAt(o, LEVEL_ANCHORS.easy).poise < lightest, `${id}: level 6 poise ${opponentAt(o, LEVEL_ANCHORS.easy).poise} < the light's ${lightest}`);
    assert.equal(opponentAt(o, LEVEL_ANCHORS.normal), o, `${id}: level 18 is today's body exactly`);
  }
  for (const o of ladder) if (!POISE_FULL_AT[o.id]) same(opponentAt(o, LEVEL_ANCHORS.easy), o, LEVEL_ANCHORS.easy, `${o.id}: level 6 is today's body`);
});
