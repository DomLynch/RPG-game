import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as legion from '../src/special-fx-legion.ts';
import * as executioner from '../src/special-fx-executioner.ts';
import * as nightborn from '../src/special-fx-nightborn.ts';
import { disposeSpecialGroup } from '../src/special-presentation.ts';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import type { OpponentId } from '../src/roster.ts';
import type { SpecialFx } from '../src/special-modes.ts';

type Factory = (scene: THREE.Scene, opponent: OpponentId, exposure: number) => SpecialFx;
const cases = [
  ['set foot', 'veteran', 'shove', legion, 'createSetFoot'],
  ['heel reap', 'executioner', 'reaping', executioner, 'createHeelReap'],
  ['pale lunge', 'nightborn', 'lunge', nightborn, 'createPaleLunge'],
] as const;
for (const [name, opponent, skill, module, exportName] of cases) for (const exposure of [1, 2]) test(`${name} ${exposure}: accepted cast, frozen ticks, fizzle, null feet, yield and disposal`, () => {
  const factory = (module as unknown as Record<string, Factory>)[exportName]; assert.equal(typeof factory, 'function', 'real effect export');
  const scene = new THREE.Scene(), fx = factory(scene, opponent, exposure);
  const fighters = [{ special: 0 }, { special: 0, skill }] as unknown as readonly [Fighter, Fighter];
  const feet = [new THREE.Vector3(3, 0, 5), new THREE.Vector3(1, 0, 2)] as const;
  const event = (type: string, tick: number, move = `skill_${skill}`) => ({ type, tick, actor: 1, move, target: 0 }) as CombatEvent;
  const root = scene.getObjectByName(name)!; assert.ok(root);
  const state = () => { const rows: unknown[] = []; root.traverse(o => { const m = o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; rows.push([o.visible, o.position.toArray(), o.scale.toArray(), o.rotation.toArray(), m.material?.opacity]); }); return rows; };
  fx.render(0, [event('SpecialStarted', 1, 'skill_wrong')], fighters, 1, feet, false); assert.equal(root.visible, false);
  fx.render(0, [event('SpecialStarted', 1)], fighters, 70, feet, false); assert.ok(root.visible);
  const frozen = state(); fx.render(9, [], fighters, 70, feet, false); assert.deepEqual(state(), frozen);
  fx.render(0, [], fighters, 70, [null, feet[1]], false); assert.equal(root.visible, false);
  fx.render(0, [], fighters, 70, feet, false); assert.ok(root.visible);
  fx.render(0, [event('SpecialFizzled', 70)], fighters, 70, feet, false);
  const fizzled = state(); fx.render(0, [], fighters, 80, feet, false);
  const shapes = (s: unknown[]) => s.map(row => (row as unknown[]).slice(1, 4)); assert.deepEqual(shapes(state()), shapes(fizzled), 'fizzle freezes geometry');
  fx.render(0, [], fighters, 115, feet, false); assert.equal(root.visible, false);
  fx.render(0, [event('SpecialStarted', 200)], fighters, 300, feet, false);
  fx.render(0, [event('SpecialLanded', 319)], fighters, 327, feet, false); assert.ok(root.visible);
  fx.render(0, [], fighters, 364, feet, false); assert.equal(root.visible, false);
  fx.render(0, [event('SpecialStarted', 400)], fighters, 450, feet, false);
  fx.render(0, [], fighters, 450, feet, true); assert.equal(root.visible, false);
  const owned = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>(); scene.traverse(o => { if (o instanceof THREE.Mesh) { owned.add(o.geometry); const mat = o.material as THREE.MeshBasicMaterial; owned.add(mat); if (mat.map) owned.add(mat.map); } });
  let disposed = 0; for (const resource of owned) resource.addEventListener('dispose', () => disposed++);
  fx.clear(); disposeSpecialGroup(scene); assert.equal(disposed, owned.size); assert.equal(scene.children.length, 0);
});
