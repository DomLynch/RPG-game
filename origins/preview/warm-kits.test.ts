// warm-kits.json: the rows load, the loader refuses a bad one, and every row's loot id is a real piece in loot.glb (a typo would warm nothing and the T4 check would be the only thing to notice).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { lootPiecesOf, lootWorn } from '../../src/fight/characters.ts';
import KITS from './warm-kits.json' with { type: 'json' };
import { loadWarmKits, warmKits } from './warm-kits.ts';
import { wornIds } from './dress-remote.ts';

async function loot() {
  const bytes = readFileSync(new URL('../../src/assets/loot.glb', import.meta.url)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString());
  json.images = []; json.textures = []; json.materials = json.materials.map((m: { name: string }) => ({ name: m.name }));
  json.buffers[0].uri = 'data:application/octet-stream;base64,' + bytes.subarray(28 + size).toString('base64');
  globalThis.ProgressEvent ??= class { constructor(_type: string, fields: object) { Object.assign(this, fields); } } as unknown as typeof ProgressEvent;
  return lootPiecesOf((await new GLTFLoader().parseAsync(JSON.stringify(json), '')).scene);
}

test('the warm-kit rows load and each names a worn set and the programs it brings', () => {
  const kits = warmKits();
  assert.equal(kits.length, KITS.warmKits.length);
  assert.ok(kits.length >= 6, 'the 2026-10-16 T4 count named six slots');
  for (const kit of kits) { assert.ok(Object.keys(kit.worn).length > 0, kit.id); assert.ok(kit.programs.length > 0, kit.id); }
});

test('the loader refuses a row with no worn set, an empty id or no programs, and a duplicate id', () => {
  const row = (fields: object, id = 'x') => ({ warmKits: [{ id, fields }] });
  assert.throws(() => loadWarmKits(row({ worn: {}, programs: ['a'] })), /worn/);
  assert.throws(() => loadWarmKits(row({ worn: { Body: '' }, programs: ['a'] })), /worn/);
  assert.throws(() => loadWarmKits(row({ worn: { Body: 'a.Body' }, programs: [] })), /programs/);
  assert.throws(() => loadWarmKits({ warmKits: [{ id: 'x', fields: { worn: { Body: 'a.Body' }, programs: ['a'] } }, { id: 'x', fields: { worn: { Body: 'a.Body' }, programs: ['a'] } }] }));
});

test('every warm-kit loot id is a real piece of loot.glb', async () => {
  const pieces = await loot();
  for (const kit of warmKits()) assert.ok(pieces.some((piece) => lootWorn(piece, wornIds(kit.worn))), `${kit.id}: ${JSON.stringify(kit.worn)} matches no loot piece`);
});
