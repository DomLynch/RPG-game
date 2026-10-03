import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Match } from '../src/match.ts';
import { OPPONENTS, RULES, SKILL_MOVE } from '../src/moves.ts';
import { skillOf } from '../src/loot.ts';
import { idleIntent } from '../src/duel.ts';
import { loadProfile } from '../src/profile.ts';
import { loadTrial } from '../src/trial.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { classSpecialFor } from '../src/class-special-identity.ts';
import { SPECIAL_MODES } from '../src/special-modes.ts';
import { SPECIAL_TESTS, type SpecialTest } from '../src/special-look.ts';
import { resolveSparringPreview, sparringSpecialOptions, SPECIAL_LABELS } from '../src/sparring-specials.ts';
import { createSpecialPresentation } from '../src/special-presentation.ts';
import type { OpponentId } from '../src/roster.ts';

const approved = { veteran: 'setfoot', executioner: 'heelreap', nightborn: 'lunge', goblin: 'knuckledirt', pitborn: 'cleaverset', dwarf: 'groundset', shieldmaiden: 'cutmark' } as const;
function make(opponent: OpponentId, level = 6) {
  const writes: string[] = [], storage = { getItem: () => null, setItem: (key: string) => { writes.push(key); } };
  const m = new Match(OPPONENTS[opponent], 'test', { storage, profile: loadProfile(storage, () => 'test').profile, trial: loadTrial(storage), scorecard: loadScorecard(storage) }, 731, 'estoc', null, level);
  return { m, writes };
}
test('seven approved A slots complete fifty real modes without changing normal A activation', () => {
  assert.equal(Object.keys(SPECIAL_TESTS).length, 50);
  for (const [opponent, raw] of Object.entries(approved)) {
    const id = raw as SpecialTest;
    assert.deepEqual(SPECIAL_TESTS[id], { opponent, level: 6, first: 180 }); assert.ok(SPECIAL_LABELS[id]);
    assert.deepEqual(sparringSpecialOptions(opponent)[0].ids, [id]);
    for (const level of [1, 6, 15]) {
      assert.equal(classSpecialFor(opponent as OpponentId, level), id);
      const { m } = make(opponent as OpponentId, level); assert.equal(m.specials, false); assert.equal(m.practice.duel.fighters[1].specialShare, undefined);
    }
    const mode = SPECIAL_MODES[id]!; assert.ok(mode); assert.equal(mode.at, 'feet'); assert.equal(mode.held, undefined); assert.equal(mode.travel, undefined); assert.equal(mode.extra, undefined);
    const r = resolveSparringPreview(`?spar=1&opponent=${opponent}&weapon=estoc&difficulty=6&skill=none&special=${id}&yourSpecial=${id}`);
    assert.equal(r.invalid, false); assert.deepEqual(r.selection, { player: id, opponent: id });
  }
});
for (const [opponent, raw] of Object.entries(approved)) for (const actor of [0, 1] as const) test(`${raw}: actual ${actor === 0 ? 'SKILL' : 'AI'} common A and normalized current caster`, async () => {
  const id = raw as SpecialTest, { m, writes } = make(opponent as OpponentId), before = writes.length;
  m.startSparring({ weapon: 'estoc', skill: null, difficulty: actor === 0 ? 'dummy' : 1 }, null, { player: actor === 0 ? id : null, opponent: actor === 1 ? id : null });
  m.step(() => ({ ...idleIntent(), action: 'light' }));
  for (let i = 0; i < 200; i++) m.step(() => {
    const [a, b] = m.practice.duel.fighters, gap = Math.hypot(a.body.x - b.body.x, a.body.z - b.body.z);
    return { ...idleIntent(), guard: true, move: { x: 0, z: gap > 2 ? -1 : 0, yaw: 0, run: false } };
  });
  assert.ok(!m.fightLog.some(e => e.type === 'SpecialStarted' && e.actor === 0), 'no automatic player cast');
  if (actor === 0) m.step(() => ({ ...idleIntent(), action: 'skill' }));
  for (let i = 0; i < 170 && !m.practice.finish; i++) m.step(() => ({ ...idleIntent(), guard: true }));
  const start = m.fightLog.find(e => e.type === 'SpecialStarted' && e.actor === actor), land = m.fightLog.find(e => e.type === 'SpecialLanded' && e.actor === actor);
  assert.ok(start && land, 'genuine accepted common A lands'); assert.equal(start.move, SKILL_MOVE[skillOf(opponent as OpponentId)!]);
  assert.equal(land.tick - start.tick, RULES.special.windup - 1); assert.equal(land.damage, Math.round(RULES.special.damage * m.practice.duel.fighters[1 - actor].maxHealth));
  assert.equal(writes.length, before); assert.equal(m.recorder, null); assert.equal(m.practice.duel.fighters[0].weapon, 'estoc');
  for (const exposure of [1, 2]) {
    const scene = new THREE.Scene(), presentation = createSpecialPresentation(scene, exposure, new THREE.PerspectiveCamera()), feet = [new THREE.Vector3(2, 0, 3), new THREE.Vector3(-2, 0, 1)] as const;
    const snapshot = structuredClone(m.practice.duel.fighters);
    presentation.prepare(1, [start], snapshot, start.tick + 70, false, m.specialIdentity);
    for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve));
    presentation.render(0, snapshot, start.tick + 70, feet, feet, undefined, false);
    const group = scene.getObjectByName(`special actor ${actor}`)!; assert.ok(group && group.children.length, 'real mode lazy factory loaded');
    assert.deepEqual(group.children[0].position.toArray(), feet[actor].toArray(), 'actual caster after actor normalization');
    assert.deepEqual(snapshot, m.practice.duel.fighters, 'render cannot mutate simulation');
    presentation.prepare(2, [], snapshot, 0, false, m.specialIdentity); presentation.clear(); assert.equal(scene.children.length, 0);
  }
});
