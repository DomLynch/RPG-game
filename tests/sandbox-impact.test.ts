// sandbox-mech: impact. A contact row with `flash` / `ring` columns throws a flash and a ground ring; trunk's rows have no such columns, so nothing is drawn.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import ROWS from '../src/fight/hit-stop-defs.json' with { type: 'json' };
import type { CombatEvent } from '../src/fight/duel.ts';

const { createImpactFx, contactOf } = await import('../src/fight/impact-fx.ts');
const fighters = [{ body: { x: 0, z: 0 } }, { body: { x: 0, z: 2 } }] as never;
const parried = { type: 'Parried', actor: 0, target: 1 } as CombatEvent;
const shown = (scene: THREE.Scene) => scene.children.filter((o) => o.visible).length;

test('contacts map onto the hit-stop rows', () => {
  assert.equal(contactOf(parried), 'parry');
  assert.equal(contactOf({ type: 'GuardBroken', actor: 1, target: 0 } as CombatEvent), 'guardBreak');
  assert.equal(contactOf({ type: 'Blocked', actor: 0, target: 1 } as CombatEvent), 'blockLight');
});

test('no columns, nothing drawn; a parry row with flash + ring draws both, and they fade out', () => {
  const scene = new THREE.Scene(), fx = createImpactFx(scene);
  fx.fire([parried], fighters); assert.equal(shown(scene), 0);
  Object.assign((ROWS.contacts as Record<string, object>).parry, { flash: 1.5, ring: 2 });
  fx.fire([parried], fighters); assert.equal(shown(scene), 2);
  fx.update(1); assert.equal(shown(scene), 0);
});
