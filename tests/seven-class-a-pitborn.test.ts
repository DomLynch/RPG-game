import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCleaverSet } from '../src/special-fx-pitborn.ts';
import { LAND_AT, SPECIAL_RECOVER, CAST_MARGIN } from '../src/special-timing.ts';
import type { CombatEvent, Fighter } from '../src/duel.ts';

const fighters = [{ special: 0 }, { special: 0, skill: 'cleave' }] as unknown as readonly [Fighter, Fighter];
const feet = [new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, 0)] as const;
const event = (type: 'SpecialStarted' | 'SpecialLanded' | 'SpecialFizzled', tick: number, actor = 1, move = 'skill_cleave') => ({ type, tick, actor, move, target: 0, damage: 30 }) as unknown as CombatEvent;
function setup(exposure = 1.1, opponent: 'pitborn' | 'goblin' = 'pitborn') {
  const scene = new THREE.Scene(), fx = createCleaverSet(scene, opponent, exposure);
  const root = scene.children[0];
  const clods = root.children as THREE.Sprite[];
  const render = (tick: number, events: CombatEvent[] = [], yielding = false, pair: readonly [THREE.Vector3 | null, THREE.Vector3 | null] = feet, state = fighters, dt = 1 / 60) => fx.render(dt, events, state, tick, pair, yielding);
  const snapshot = () => clods.map(s => [s.visible, s.material.opacity, ...s.position.toArray(), ...s.scale.toArray()]);
  const windup = () => { render(1, [event('SpecialStarted', 1)]); render(100); };
  return { scene, fx, root, clods, render, snapshot, windup };
}

test('only the normalized Pitborn caster own Cleave starts this factory', () => {
  for (const [opponent, actor, move] of [['pitborn', 0, 'skill_cleave'], ['pitborn', 1, 'heavy'], ['goblin', 1, 'skill_cleave']] as const) {
    const p = setup(1.1, opponent); p.render(1, [event('SpecialStarted', 1, actor, move)]); p.render(100);
    assert.equal(p.root.visible, false);
  }
  const p = setup(); p.windup(); assert.ok(p.clods.some(s => s.visible));
});

test('patch follows current caster feet and faces target without mutating fighters or feet', () => {
  const p = setup(); p.windup(); const before = JSON.stringify(fighters);
  const pair = [new THREE.Vector3(5, 0.3, 3), new THREE.Vector3(2, 0.3, 3)] as const;
  p.render(101, [], false, pair);
  assert.deepEqual(p.root.position.toArray(), [2, 0.3, 3]); assert.equal(p.root.rotation.y, Math.PI / 2);
  assert.deepEqual(pair.map(v => v.toArray()), [[5, 0.3, 3], [2, 0.3, 3]]); assert.equal(JSON.stringify(fighters), before);
  p.render(102, [], false, [null, pair[1]]); assert.equal(p.root.visible, false);
  p.render(103, [], false, pair); assert.equal(p.root.visible, true);
});

test('one low compact patch gathers, frozen ticks are stable, only accepted landing settles it', () => {
  const p = setup(); p.windup(); assert.ok(p.clods.length <= 12);
  const held = p.snapshot(); p.render(100, [], false, feet, fighters, 10); assert.deepEqual(p.snapshot(), held);
  for (let t = 101; t <= 160; t++) p.render(t);
  const unlanded = p.clods.map(s => s.position.y); assert.ok(unlanded.every(y => y > 0.1));
  p.render(160, [event('SpecialLanded', 160)]); p.render(168);
  assert.ok(p.clods.every((s, i) => s.position.y < unlanded[i]));
  for (const s of p.clods) { assert.ok(Math.hypot(s.position.x, s.position.z) < 1); assert.ok(s.position.y < 0.25); }
  p.render(160 + SPECIAL_RECOVER); assert.equal(p.root.visible, false);
});

test('fizzle freezes gathered positions, fades without payoff and ignores later landing', () => {
  const p = setup(); p.windup(); p.render(100, [event('SpecialFizzled', 100)]);
  const positions = p.clods.map(s => s.position.toArray()), opacity = p.clods[0].material.opacity;
  p.render(108, [event('SpecialLanded', 108)]);
  assert.deepEqual(p.clods.map(s => s.position.toArray()), positions); assert.ok(p.clods[0].material.opacity < opacity);
  p.render(100 + SPECIAL_RECOVER); assert.equal(p.root.visible, false);
});

test('finisher yield and repeated clear hide all marks, rearm and restore active common clock', () => {
  const p = setup(); p.windup(); p.render(101, [], true); assert.equal(p.root.visible, false);
  p.fx.clear(); p.fx.clear(); assert.ok(p.clods.every(s => !s.visible && s.material.opacity === 0));
  p.render(1, [event('SpecialStarted', 1)]); p.render(100); assert.ok(p.clods.some(s => s.visible));
  const initial = p.snapshot(); p.fx.clear();
  const active = [{ special: 0 }, { special: 21, skill: 'cleave' }] as unknown as readonly [Fighter, Fighter];
  p.render(100, [], false, feet, active); assert.deepEqual(p.snapshot(), initial);
});

test('missing end times out and clear permits an earlier replay epoch', () => {
  const p = setup(); p.windup(); p.render(1 + LAND_AT + SPECIAL_RECOVER + CAST_MARGIN); assert.equal(p.root.visible, false);
  p.fx.clear(); p.windup(); const first = p.snapshot(); p.fx.clear(); p.windup(); assert.deepEqual(p.snapshot(), first);
});

test('day/night textures are dark warm torn clods, pooled and retained across clear/rearm', () => {
  for (const exposure of [1.1, 1.85]) {
    const p = setup(exposure), maps = new Set(p.clods.map(s => s.material.map!)); assert.equal(maps.size, 3);
    for (const map of maps) {
      const data = (map as THREE.DataTexture).image.data as Uint8Array;
      assert.ok(data.some((v, i) => i % 4 === 3 && v > 0));
      assert.equal(data[3], 0); assert.equal(data[data.length - 1], 0);
      for (let i = 0; i < data.length; i += 4) { assert.ok(data[i] <= 64); assert.ok(data[i] >= data[i + 1] && data[i + 1] >= data[i + 2]); }
    }
    const materials = p.clods.map(s => s.material); p.windup(); p.fx.clear(); p.windup();
    assert.deepEqual(p.clods.map(s => s.material), materials); assert.deepEqual(new Set(p.clods.map(s => s.material.map!)), maps);
    assert.ok(p.clods.every(s => !s.material.depthWrite && s.material.depthTest && s.material.fog));
  }
});
