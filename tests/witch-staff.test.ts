// The Witch's mage staff (Dom's pick B, 2026-09-26): a look-only trident part on her WeaponDrawn node. Nothing the fight reads moves.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const doc = (bytes: Buffer) => JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) as { nodes: { name?: string; mesh?: number; children?: number[]; extras?: Record<string, unknown> }[]; meshes: { primitives: { material: number }[] }[]; materials: { name: string }[] };

test('the Witch carries staff B on the trident\'s contract: same WeaponDrawn contact, the staff\'s own materials, none of the trident\'s', async () => {
  const j = doc(await fs.readFile('src/assets/witch.glb')), wd = j.nodes.find(n => n.name === 'WeaponDrawn')!;
  assert.deepEqual(wd.extras?.contact, { from: .76, to: 1.22 }, 'the contact the bake and the sim read is the trident\'s');
  assert.equal(wd.extras?.weapon, 'trident'); assert.equal(wd.extras?.variant, 'staffB');
  const mats = new Set(wd.children!.flatMap(c => j.nodes[c].mesh === undefined ? [] : j.meshes[j.nodes[c].mesh!].primitives.map(p => j.materials[p.material].name)));
  assert.deepEqual([...mats].sort(), ['Leather', 'StaffWood', 'WitchStone']);
  assert.ok(!j.materials.some(m => /^WeaponTrident/.test(m.name)), 'the donor trident is gone, maps and all');
});

test('the committed witch.glb is exactly what the swap produces: re-running it on the file changes no byte', async () => {
  const { swapWeaponPart } = await import('../scripts/character/swap-weapon-part.mjs');
  const copy = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'witch-')), 'witch.glb');
  await fs.copyFile('src/assets/witch.glb', copy);
  await swapWeaponPart(copy, 'trident', 'staffB');
  assert.ok((await fs.readFile(copy)).equals(await fs.readFile('src/assets/witch.glb')), 'rebuild the staff with scripts/character/swap-weapon-part.mjs');
});
