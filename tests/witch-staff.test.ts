// The Witch's mage staff (Dom's pick B, 2026-09-26): a look-only trident part on her WeaponDrawn node. Nothing the fight reads moves.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type Doc = { nodes: { name?: string; mesh?: number; children?: number[]; extras?: Record<string, unknown> }[]; meshes: { primitives: { material: number }[] }[]; materials: { name: string }[]; accessors: unknown[] };
const split = (bytes: Buffer) => { const n = bytes.readUInt32LE(12); return { json: JSON.parse(bytes.subarray(20, 20 + n).toString()) as Doc, bin: bytes.subarray(28 + n) }; };

test('the Witch carries staff B on the trident\'s contract: same WeaponDrawn contact, the staff\'s own materials, none of the trident\'s', async () => {
  const j = split(await fs.readFile('src/assets/witch.glb')).json, wd = j.nodes.find(n => n.name === 'WeaponDrawn')!;
  assert.deepEqual(wd.extras?.contact, { from: .76, to: 1.22 }, 'the contact the bake and the sim read is the trident\'s');
  assert.equal(wd.extras?.weapon, 'trident'); assert.equal(wd.extras?.variant, 'staffB');
  const mats = new Set(wd.children!.flatMap(c => j.nodes[c].mesh === undefined ? [] : j.meshes[j.nodes[c].mesh!].primitives.map(p => j.materials[p.material].name)));
  assert.deepEqual([...mats].sort(), ['Leather', 'StaffWood', 'WitchStone']);
  assert.ok(!j.materials.some(m => /^WeaponTrident/.test(m.name)), 'the donor trident is gone, maps and all');
});

// Not raw bytes: three's sRGB→linear colour conversion (Math.pow(x, 2.4)) differs in the last ulp between V8 versions — Node 25 on the
// Mac writes StaffWood's green factor as 0.038204371589236, Node 22 on the CI runner as 0.03820437158923601 (measured 2026-09-26; the
// geometry and every other byte agree, float32 rounding hides it). So the binary chunk must match exactly and the JSON must match
// with every number normalised to 12 significant digits: still every node, accessor, material and animation, just not the 17th digit.
test('the committed witch.glb is what the swap produces: re-running it on the file changes no binary byte and no JSON value past 12 significant digits', async () => {
  const { swapWeaponPart } = await import('../scripts/character/swap-weapon-part.mjs');
  const copy = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'witch-')), 'witch.glb');
  await fs.copyFile('src/assets/witch.glb', copy);
  await swapWeaponPart(copy, 'trident', 'staffB');
  const [ours, committed] = [split(await fs.readFile(copy)), split(await fs.readFile('src/assets/witch.glb'))];
  assert.ok(ours.bin.equals(committed.bin), 'every geometry, skin, animation and image byte matches: rebuild with scripts/character/swap-weapon-part.mjs');
  const norm = (d: Doc) => JSON.stringify(d, (_k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Number(v.toPrecision(12)) : v));
  assert.equal(norm(ours.json), norm(committed.json), 'the same nodes, accessors, materials and animations: rebuild with scripts/character/swap-weapon-part.mjs');
  assert.equal(ours.json.accessors.length, committed.json.accessors.length);
});
