// CS31 impact flash/ring and crowd roars (Combat sandbox @93b1138c7): data-driven and silent by default. No contact row ships a flash or ring; no roar row ships.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONTACTS } from '../src/fight/hit-stop-rows.ts';
import { contactOf, createImpactFx } from '../src/fight/impact-fx.ts';
import { ROARS, momentsOf } from '../src/audio/crowd-rows.ts';
import type { CombatEvent } from '../src/fight/combat.ts';

const ev = (e: object) => e as CombatEvent;

test('no contact row ships a flash or ring, and no roar ships: the picture and the crowd are as they were', () => {
  for (const [id, row] of Object.entries(CONTACTS)) assert.ok(row.flash === undefined && row.ring === undefined && row.tint === undefined, `${id} has no impact columns`);
  assert.deepEqual(ROARS, []);
});

test('the impact fx draws nothing without columns, and a row with a flash and a ring draws both at the struck body', () => {
  const scene = new THREE.Scene(), fx = createImpactFx(scene), fighters = [{ body: { x: 0, z: 0 } }, { body: { x: 0, z: 2 } }] as never;
  const hit = ev({ type: 'Hit', actor: 0, target: 1, move: 'light', location: 'torso' });
  fx.fire([hit], fighters); fx.update(1 / 60);
  assert.equal(scene.children.filter((o) => o.visible).length, 0, 'no columns: nothing visible');
  const row = CONTACTS.hitLight as { flash?: number; ring?: number }; row.flash = 1; row.ring = 2;
  try {
    fx.fire([hit], fighters); fx.update(1 / 60);
    assert.equal(scene.children.filter((o) => o.visible).length, 2, 'a flash and a ring');
    for (let t = 0; t < 120; t++) fx.update(1 / 60);
    assert.equal(scene.children.filter((o) => o.visible).length, 0, 'both are gone within a second');
  } finally { delete row.flash; delete row.ring; }
  assert.equal(contactOf(ev({ type: 'GuardBroken', actor: 0, target: 1 })), 'guardBreak');
});

test('kill, parry, guard break and heavy hits are the roar moments; a light hit is none', () => {
  assert.deepEqual([...momentsOf([ev({ type: 'Killed', actor: 0 }), ev({ type: 'Parried', actor: 1, target: 0 })])], ['kill', 'parry']);
  assert.deepEqual([...momentsOf([ev({ type: 'GuardBroken', actor: 0, target: 1 }), ev({ type: 'Hit', actor: 0, target: 1, charged: true })])], ['guardBreak', 'heavy']);
  assert.deepEqual([...momentsOf([ev({ type: 'Hit', actor: 0, target: 1, move: 'light' })])], []);
});
