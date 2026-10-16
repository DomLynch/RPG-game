// Other players in Zone 1 draw the hero's own rig: buildWarriors' `spawn` makes one more actor from the SAME asset (view-only; the duel's player/opponent are built exactly as before).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Mesh, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildWarriors } from '../src/fight/characters.ts';
import { tagText } from '../origins/preview/remote-heroes.ts';

async function parse(file: string) {   // as tests/loot-wear.test.ts: the shipped GLB's geometry, rig and material names; images are the browser's
  const bytes = readFileSync(new URL(`../src/assets/${file}`, import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}
const meshes = (root: { traverse(cb: (o: unknown) => void): void }): Mesh[] => { const out: Mesh[] = []; root.traverse((o) => { if (o instanceof Mesh) out.push(o); }); return out; };

test('spawn: another actor of the hero\'s rig from the same asset, sharing its geometry and materials (so no new program), with its own skeleton', async () => {
  const warriors = buildWarriors(await parse('warrior.glb')), a = warriors.spawn(), b = warriors.spawn();
  assert.notEqual(a.anchor, warriors.player.anchor); assert.notEqual(a.anchor, b.anchor);
  const asset = (list: Mesh[]) => list.filter((m) => m.name !== 'WeaponTrail');   // the weapon's trail ribbon is each actor's own (its geometry is rewritten every frame); everything from the GLB is shared
  const own = asset(meshes(warriors.player.anchor)), mine = asset(meshes(a.anchor));
  assert.equal(mine.length, own.length, 'the same draws'); assert.ok(own.length > 3, 'the rig has its draws');
  for (let i = 0; i < own.length; i++) { assert.equal(mine[i]!.geometry, own[i]!.geometry, `${own[i]!.name}: shared geometry`); assert.equal(mine[i]!.material, own[i]!.material, `${own[i]!.name}: shared material`); }
  assert.notEqual(meshes(a.anchor).find((m) => m.name === 'WeaponTrail')?.geometry, meshes(warriors.player.anchor).find((m) => m.name === 'WeaponTrail')?.geometry, 'its own trail ribbon');
  const skin = (m: Mesh[]) => m.find((x): x is SkinnedMesh => x instanceof SkinnedMesh)!.skeleton;
  assert.notEqual(skin(mine), skin(own), 'its own skeleton: it moves on its own');
  a.update(1.5, 1 / 30, 'ready', 0, 'light', 0.35, 0);   // the engine's gait runs on it without touching the player's actor
});

test('the duel still builds its two actors as before: player and a separate opponent, `spawn` is only added', async () => {
  const asset = await parse('warrior.glb'), duel = buildWarriors(asset, await parse('warrior.glb'), ['longsword', 'longsword']);
  assert.deepEqual(Object.keys(duel).sort(), ['opponent', 'player', 'spawn']);
  assert.notEqual(duel.opponent.anchor, duel.player.anchor);
  const solo = buildWarriors(asset, undefined, ['longsword', 'longsword'], true);
  assert.equal(solo.opponent, solo.player, 'a zone creature (solo) is still one actor');
});

test('the tag: the name, "Guest" for a guest, and nothing until a name has arrived', () => {
  assert.equal(tagText({ name: 'Crixus', guest: false }), 'Crixus'); assert.equal(tagText({ name: '  Spartacus ', guest: false }), 'Spartacus');
  assert.equal(tagText({ name: 'Crixus', guest: true }), 'Guest'); assert.equal(tagText({ name: '  ', guest: false }), null); assert.equal(tagText(undefined), null);
});
