import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { initialDuel, withSpecials, stepDuel, idleIntent } from '../src/duel.ts';
import * as goblin from '../src/special-fx-goblin.ts';
import { LAND_AT, SPECIAL_RECOVER, CAST_MARGIN } from '../src/special-timing.ts';
import { disposeSpecialGroup } from '../src/special-presentation.ts';

const fighters = (special = 0, skill = 'jab') => [{ special: 0 }, { special, skill }] as unknown as readonly [Fighter, Fighter];
const start = (tick = 0, move = 'skill_jab', actor = 1): CombatEvent => ({ type: 'SpecialStarted', tick, move, actor }) as CombatEvent;
const end = (tick: number, type: 'SpecialLanded' | 'SpecialFizzled'): CombatEvent => ({ type, tick, actor: 1 }) as CombatEvent;
function make(exposure = 1) {
  assert.ok('createKnuckleDirt' in goblin, 'Knuckle Dirt has its own factory');
  const scene = new THREE.Scene(), fx = goblin.createKnuckleDirt(scene, 'goblin', exposure);
  const root = scene.children[0], feet = [new THREE.Vector3(2, 0, 0), new THREE.Vector3(0, 0, 0)] as const;
  const render = (tick: number, events: CombatEvent[] = [], yielding = false, pair: readonly [THREE.Vector3 | null, THREE.Vector3 | null] = feet, fs = fighters()) => fx.render(1 / 60, events, fs, tick, pair, yielding);
  const sprites = root.children as THREE.Sprite[];
  const snapshot = () => sprites.map(s => [s.visible, ...s.position.toArray(), ...s.scale.toArray(), s.material.opacity]);
  return { scene, fx, root, feet, render, sprites, snapshot };
}

test('Knuckle Dirt accepts only normalized Goblin jab, supports late loading, and suppresses yielding starts', () => {
  for (const [move, actor] of [['skill_pommel', 1], ['skill_jab', 0]] as const) {
    const m = make(); m.render(20, [start(0, move, actor)]); assert.equal(m.root.visible, false);
  }
  const m = make(); m.render(20, [start()], true); assert.equal(m.root.visible, false);
  m.render(20, [], false, m.feet, fighters(100)); assert.equal(m.root.visible, true);
  const other = new THREE.Scene(); goblin.createKnuckleDirt(other, 'veteran', 1).render(0, [start()], fighters(), 20, m.feet, false);
  assert.equal(other.children[0].visible, false);
});

test('foot-sized gather stays stationary, feet remain unchanged, frozen tick cannot drift or flick without landing', () => {
  const m = make(), original = m.feet.map(v => v.toArray()); m.render(0, [start()]); m.render(80);
  assert.equal(m.root.visible, true); assert.ok(m.sprites.filter(s => s.visible).length >= 10);
  assert.ok(m.sprites.every(s => Math.hypot(s.position.x - 0.46, s.position.z - 0.28) < 0.23 && s.position.y < 0.12));
  const pose = m.snapshot(), anchor = m.root.position.clone();
  for (let i = 0; i < 100; i++) m.render(80);
  assert.deepEqual(m.snapshot(), pose); assert.deepEqual(m.feet.map(v => v.toArray()), original);
  m.render(LAND_AT + 20, [], false, [new THREE.Vector3(0, 0, -5), new THREE.Vector3(4, 0, 4)]);
  assert.deepEqual(m.root.position, anchor); assert.ok(m.sprites.every(s => s.position.z < 0.4 && s.position.y < 0.12), 'no predicted payoff');
});

test('yield cancels active gather and landed tail, keeps pool, and rearms at fresh feet', () => {
  for (const landed of [false, true]) {
    const m = make(), pool = [...m.root.children]; m.render(0, [start()]); m.render(80);
    if (landed) { m.render(LAND_AT, [end(LAND_AT, 'SpecialLanded')]); m.render(LAND_AT + 9); }
    assert.equal(m.root.visible, true);
    const tick = landed ? LAND_AT + 10 : 81;
    m.render(tick, [], true);
    assert.equal(m.root.visible, false, landed ? 'landed tail yields' : 'active gather yields');
    assert.ok(m.sprites.every(s => !s.visible && s.material.opacity === 0));
    m.render(tick + 1, [end(tick + 1, 'SpecialLanded')]);
    assert.equal(m.root.visible, false, 'cancelled cast cannot resume or pay off');
    assert.deepEqual(m.root.children, pool, 'yield retains pool');
    m.render(300, [start(300)], false, [new THREE.Vector3(6, 0, 0), new THREE.Vector3(4, 0, 0)]);
    m.render(340); assert.equal(m.root.visible, true); assert.equal(m.root.position.x, 4, 'fresh cast resets anchor');
    assert.deepEqual(m.root.children, pool, 'rearm reuses pool');
  }
});

test('accepted landing makes one low directional flick; fizzle never does; tail, timeout and clear rearm', () => {
  const m = make(); m.render(0, [start()]); m.render(LAND_AT, [end(LAND_AT, 'SpecialLanded')]);
  const origin = m.sprites.slice(12).reduce((sum, s) => sum + s.position.z, 0) / 12; m.render(LAND_AT + 9);
  const flying = m.sprites.slice(12); assert.ok(flying.every(s => s.visible));
  assert.ok(flying.reduce((sum, s) => sum + s.position.z, 0) / flying.length > origin + 0.15, 'early flick advances toward foe');
  assert.ok(flying.every(s => s.position.y < 0.28 && Math.abs(s.position.x - 0.46) < 0.2));
  assert.ok(Math.abs(m.root.rotation.y - Math.PI / 2) < 1e-9, 'local forward points toward foe');
  m.render(LAND_AT + SPECIAL_RECOVER); assert.equal(m.root.visible, false);
  m.render(300, [start(300)]); m.render(340); m.render(340, [end(340, 'SpecialFizzled')]); m.render(350);
  assert.ok(m.sprites.every(s => !s.visible || s.position.z < 0.4)); m.fx.clear(); assert.equal(m.root.visible, false);
  m.render(0, [start()]); m.render(LAND_AT + SPECIAL_RECOVER + CAST_MARGIN); assert.equal(m.root.visible, false);
  m.render(0, [start()]); m.render(60); assert.equal(m.root.visible, true);
});

test('payoff at saved capture ages stays low, outside body centre and opaque through one flick', () => {
  for (const exposure of [1, 2]) {
    const m = make(exposure); m.render(0, [start()]); m.render(LAND_AT, [end(LAND_AT, 'SpecialLanded')]);
    for (const age of [14, 15]) {
      m.render(LAND_AT + age);
      const flying = m.sprites.slice(12);
      assert.ok(flying.every(s => s.visible && s.material.opacity > 0.5 && s.scale.x >= 0.055));
      assert.ok(flying.every(s => s.position.x > 0.25 && s.position.y < 0.28 && s.position.z > 0.4));
    }
    m.render(LAND_AT + 30); assert.ok(m.sprites.slice(12).every(s => !s.visible), 'one flick ends before common recovery');
    m.render(LAND_AT + SPECIAL_RECOVER); assert.equal(m.root.visible, false);
  }
});

test('missing feet cannot replay stale patch; pools and private maps dispose through manager in day and night', () => {
  for (const exposure of [1, 2]) {
    const m = make(exposure), children = [...m.root.children]; m.render(0, [start()]); m.render(80);
    m.render(81, [], false, [null, null]); assert.equal(m.root.visible, false);
  m.fx.clear(); m.render(0, [start()], false, [null, null]); assert.equal(m.root.visible, false);
  m.render(80, [], false, [new THREE.Vector3(6, 0, 0), new THREE.Vector3(4, 0, 0)]); assert.equal(m.root.position.x, 4, 'fresh loaded feet replace stale anchor');
    assert.deepEqual(m.root.children, children); let disposed = 0;
    const maps = new Set(m.sprites.map(s => s.material.map!)); for (const map of maps) map.addEventListener('dispose', () => disposed++);
    disposeSpecialGroup(m.scene); assert.equal(disposed, maps.size); assert.equal(m.scene.children.length, 0);
  }
});

test('real accepted jab casts from either side drive normalized effect without changing simulation', () => {
  for (const actor of [0, 1] as const) {
    let duel = withSpecials(initialDuel(), 1, 'jab');
    for (const f of duel.fighters) { f.phase = 'ready'; f.skill = 'jab'; f.skillCooldown = 0; }
    duel.fighters[0].body.x = 0; duel.fighters[0].body.z = 0;
    duel.fighters[1].body.x = 0; duel.fighters[1].body.z = 2;
    const m = make(); let starts = 0, lands = 0;
    for (let t = 0; t < 180; t++) {
      const intents = [idleIntent(), idleIntent()] as [ReturnType<typeof idleIntent>, ReturnType<typeof idleIntent>];
      if (t === 0) intents[actor].action = 'skill'; duel = stepDuel(duel, intents);
      starts += duel.events.filter(e => e.type === 'SpecialStarted').length;
      lands += duel.events.filter(e => e.type === 'SpecialLanded').length;
      const events = actor === 1 ? duel.events : duel.events.map(e => ({ ...e, actor: (1 - e.actor) as 0 | 1, ...(e.target === undefined ? {} : { target: (1 - e.target) as 0 | 1 }) }));
      const fs = actor === 1 ? duel.fighters : [duel.fighters[1], duel.fighters[0]] as const;
      const before = JSON.stringify(duel); m.render(duel.tick, events, false, m.feet, fs); assert.equal(JSON.stringify(duel), before);
      if (events.some(e => e.type === 'SpecialLanded')) { m.render(duel.tick + 9, [], false, m.feet, fs); assert.ok(m.sprites.some(s => s.visible && s.position.z > 0.4)); }
    }
    assert.equal(starts, 1); assert.equal(lands, 1); assert.equal(m.root.visible, false);
  }
});
