import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildWarriors } from '../src/fight/index.ts';

async function rig() {
  const bytes = readFileSync(new URL('../src/assets/warrior.glb', import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return new GLTFLoader().parseAsync(JSON.stringify(json), '');
}

test('buildWarriors solo builds ONE actor (a zone creature): .opponent is the same object as .player; the default builds two', async () => {
  const asset = await rig();
  const solo = buildWarriors(asset, undefined, ['longsword', 'longsword'], true);
  assert.equal(solo.opponent, solo.player, 'solo: no second actor is built');
  const duel = buildWarriors(asset);
  assert.notEqual(duel.opponent, duel.player, 'the Pit default is unchanged: two actors');
  assert.notEqual(duel.opponent.anchor, duel.player.anchor);
});
