// The Zone 1 goblin camp's data (Characters, 2026-10-09): the creature wears the engine goblin's level-1 armour on the generated world body (no new art), its camp size is a data field, and
// the armour it drops is the six pieces the file wears. The world body is public/world/goblin.glb, generated from src/assets/goblin.glb by scripts/character/world_body.py.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOB_LOOKS } from '../origins/preview/mob-looks.ts';
import { loadZone } from '../origins/zones/loader.ts';
import { ROSTER } from '../src/roster.ts';
import { LOOT } from '../src/loot.ts';

const root = (p: string) => new URL(`../${p}`, import.meta.url);
function nodeNames(path: string): string[] {
  const b = readFileSync(root(path)), g = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  return (g.nodes as { name?: string; mesh?: number }[]).filter((n) => n.mesh !== undefined).map((n) => n.name ?? '');
}
const ID = 'character:pit-goblin';

test('the camp goblin\'s look is the engine goblin undyed at native height, on the generated world body', () => {
  const look = MOB_LOOKS[ID]!;
  assert.equal(look.opponent, 'goblin'); assert.ok(ROSTER.goblin.body === 'goblin', 'the roster body the engine fights');
  assert.deepEqual([look.tint, look.scale, look.dressing], [0xffffff, 1, { soot: 0, burnt: 0 }]);
});

test('the world body is phone-safe: the engine goblin\'s 65-joint rig at ~8k tris, one texture, under 2.2 MB (scripts/character/world_body.py, receipt: artifacts/character/pit-goblin/)', () => {
  const stats = (path: string) => {
    const b = readFileSync(root(path)), g = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
    const tris = (g.meshes as { primitives: { indices?: number }[] }[]).flatMap((m) => m.primitives).reduce((n, p) => n + (p.indices === undefined ? 0 : g.accessors[p.indices].count / 3), 0);
    return { bytes: b.length, tris, images: (g.images ?? []).length, joints: g.skins[0].joints.length, clips: (g.animations as { name: string }[]).map((a) => a.name).sort() };
  };
  const engine = stats('src/assets/goblin.glb'), world = stats('public/world/goblin.glb');
  assert.ok(world.tris <= 8200 && engine.tris > 50000, `world ${world.tris} tris from engine ${engine.tris}`);
  assert.equal(world.images, 1); assert.ok(world.bytes < 2.2 * 1024 * 1024, `${world.bytes} bytes`);
  assert.equal(world.joints, engine.joints); assert.deepEqual(world.clips, engine.clips, 'the same rig and clip names');
});

test('the engine goblin file already wears the level-1 armour, and the six loot pieces are in the carriers file', () => {
  const worn = nodeNames('src/assets/goblin.glb');
  for (const part of ['Steel.Helmet', 'Steel.Body', 'Steel.Greaves', 'Wrap.Boots', 'Gambeson', 'Leather.Body']) assert.ok(worn.includes(part), `${part} is drawn on the Pit goblin`);
  const pieces = LOOT.goblin!.filter((id) => !id.endsWith('Knife'));
  assert.deepEqual(pieces, ['goblin.Helmet', 'goblin.Body', 'goblin.Arms', 'goblin.Greaves', 'goblin.Boots', 'goblin.Gloves']);
  const carriers = nodeNames('src/assets/loot/carriers-goblin.glb');
  for (const id of pieces.filter((p) => !p.endsWith('Gloves'))) assert.ok(carriers.some((n) => n.startsWith(`${id}.`)), `${id} has a part in carriers-goblin.glb`);
  assert.ok(carriers.some((n) => n.includes('Gloves')), 'the shared gloves are in the carriers file');
});

test('Zone 1 has his row: level 1-2, camp size a data field of 2, bronze-only table for now', () => {
  const row = loadZone('1').spawns.rows.find((r) => r.id === ID)!;
  assert.deepEqual(row.level, [1, 2]); assert.deepEqual(row.behaviour.campSize, [2, 2]); assert.equal(row.loot, 'loottable:pit-goblin');
});
