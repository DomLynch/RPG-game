import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { initialDuel, withSpecials, type CombatEvent, type Fighter } from '../src/duel.ts';
import { OPPONENTS } from '../src/moves.ts';
import { createNightfallFx } from '../src/nightfall-fx.ts';
import { createBossSpecial } from '../src/special-fx-boss.ts';
import { createSpecialFx } from '../src/special-fx.ts';
import { casterPair, casterEvent, createSpecialPresentation } from '../src/special-presentation.ts';
import type { SpecialFx } from '../src/special-modes.ts';

const fighters = (): [Fighter, Fighter] => {
  const pair = withSpecials(initialDuel(OPPONENTS.nightborn, 'longsword', 'lunge'), 41, 'lunge').fighters;
  for (const f of pair) { f.specialName = 'hadesshadow'; f.special = 120; }
  return pair;
};
const start = (actor: 0 | 1, tick = 100): CombatEvent => ({ type: 'SpecialStarted', actor, tick, name: 'hadesshadow', move: 'skill_lunge' });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const bones = [new THREE.Vector3(-4, 2, 0), new THREE.Vector3(4, 2, 0)] as const;

test('actor adapters preserve source inputs and reorder caster, target and extras consistently', () => {
  const pair = fighters(), event = { ...start(0), target: 1 as const }, snapshot = structuredClone({ pair, event });
  assert.deepEqual(casterPair(pair, 0), [pair[1], pair[0]]);
  assert.deepEqual(casterEvent(event, 0), { ...event, actor: 1, target: 0 });
  assert.equal(casterPair(pair, 1), pair); assert.equal(casterEvent(event, 1), event);
  assert.deepEqual({ pair, event }, snapshot);
});

test('both actors at the same cast tick draw the real Hades effect at their own target', async () => {
  const scene = new THREE.Scene(), pair = fighters();
  const presentation = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera(), async (_id, group) => createSpecialFx(group, 'nightborn'));
  presentation.prepare(1, [start(0), start(1)], pair, 100, false); await flush();
  presentation.render(0, pair, 100, bones, bones, undefined, false);
  assert.equal(scene.children.length, 2);
  for (const side of [0, 1] as const) {
    const group = scene.getObjectByName(`special actor ${side}`)!;
    assert.equal(group.getObjectByName('special fx')!.visible, true);
    const cloud = group.getObjectByName('cloud 0')!;
    assert.ok(Math.abs(cloud.position.x - bones[1 - side].x) < 1, 'cloud surrounds this caster’s target');
  }
  presentation.clear(); assert.equal(scene.children.length, 0); assert.equal(presentation.exposure, 1);
});

test('accepted casts deduplicate by actor and cast tick; one fizzle leaves the other actor alive', async () => {
  const scene = new THREE.Scene(), pair = fighters(), batches: CombatEvent[][][] = [], clears: number[] = [];
  const presentation = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera(), async () => {
    const index = batches.length; batches.push([]); clears[index] = 0;
    return { render(_dt, events) { batches[index].push([...events]); }, clear() { clears[index]++; }, exposure: index === 0 ? 0.4 : 0.7 };
  });
  presentation.prepare(1, [start(0), start(1)], pair, 100, false); await flush();
  presentation.render(0, pair, 100, bones, bones, undefined, false);
  presentation.prepare(1, [start(0), start(1)], pair, 100, false);
  presentation.render(0, pair, 100, bones, bones, undefined, false);
  assert.deepEqual(batches.map(rows => rows.flat().filter(e => e.type === 'SpecialStarted').length), [1, 1]);
  presentation.prepare(1, [{ type: 'SpecialFizzled', actor: 0, tick: 101 }], pair, 101, false);
  presentation.render(0, pair, 101, bones, bones, undefined, false);
  assert.deepEqual(batches.map(rows => rows.flat().filter(e => e.type === 'SpecialFizzled').length), [1, 0]);
  assert.equal(presentation.exposure, 0.4);
  presentation.clear(); assert.deepEqual(clears, [1, 1]); assert.equal(presentation.exposure, 1);
});

for (const reason of ['fizzle', 'epoch', 'rewind', 'clear'] as const) test(`a pending load cannot revive after ${reason}`, async () => {
  const scene = new THREE.Scene(), pair = fighters(), resolve: Array<(fx: SpecialFx) => void> = []; let cleared = 0, rendered = 0;
  pair[0].specialShare = undefined;
  const presentation = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera(), () => new Promise(r => resolve.push(r)));
  presentation.prepare(1, [start(1)], pair, 100, false);
  if (reason === 'fizzle') presentation.prepare(1, [{ type: 'SpecialFizzled', actor: 1, tick: 101 }], pair, 101, false);
  if (reason === 'epoch') presentation.prepare(2, [], pair, 100, false);
  if (reason === 'rewind') presentation.prepare(1, [], pair, 20, false);
  if (reason === 'clear') presentation.clear();
  resolve[0]({ render() { rendered++; }, clear() { cleared++; }, exposure: 0.1 }); await flush();
  presentation.render(0, pair, 101, bones, bones, undefined, false);
  assert.equal(rendered, 0); assert.equal(cleared, 1); assert.equal(presentation.exposure, 1);
  presentation.clear();
});

for (const actor of [0, 1] as const) test(`real Knight anchor motion and target gait follow actor ${actor} and clear`, async () => {
  const scene = new THREE.Scene(), pair = fighters();
  pair[1 - actor].specialShare = undefined; pair[actor].specialName = 'wrath'; pair[actor].skill = 'ironrush';
  const presentation = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera(), async (_id, group) => createBossSpecial(group, 'knight', 'haze', 1));
  const anchors = [new THREE.Object3D(), new THREE.Object3D()];
  const warriors = { player: { anchor: anchors[0], boneWorld: () => bones[0].clone() }, opponent: { anchor: anchors[1], boneWorld: () => bones[1].clone() } };
  presentation.prepare(1, [{ ...start(actor), name: 'wrath', move: 'skill_ironrush' }], pair, 100, false); await flush();
  presentation.render(0, pair, 200, bones, bones, warriors, false);
  assert.notEqual(anchors[actor].position.x, 0); assert.equal(anchors[1 - actor].position.x, 0);
  presentation.clear(); assert.equal(anchors[actor].position.x, 0);
  pair[actor].specialName = 'foretoldstep'; pair[actor].special = 20;
  presentation.prepare(2, [], pair, 100, false);
  assert.deepEqual(presentation.gait((1 - actor) as 0 | 1, pair, -0.3, 'attack'), { travel: 1.6, pose: 'ready' });
  assert.deepEqual(presentation.gait(actor, pair, -0.3, 'attack'), { travel: -0.3, pose: 'attack' });
  presentation.clear();
});

test('real Nyx dims the outer scene background and restores it on epoch change', async () => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#777777'); const original = scene.background.clone(), camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 3, 8);
  const pair = fighters(); pair[0].specialShare = undefined; pair[1].specialName = 'nyxnightfall';
  const presentation = createSpecialPresentation(scene, 1, camera, async (_id, group) => createNightfallFx(group, camera, 'nightborn'));
  presentation.prepare(1, [{ ...start(1), name: 'nyxnightfall' }], pair, 100, false); await flush();
  presentation.render(0, pair, 210, bones, bones, undefined, false);
  assert.ok(presentation.exposure < 1); assert.ok(scene.background.r < original.r);
  presentation.prepare(2, [], pair, 0, false);
  assert.equal(presentation.exposure, 1); assert.ok(scene.background.equals(original)); presentation.clear();
});
