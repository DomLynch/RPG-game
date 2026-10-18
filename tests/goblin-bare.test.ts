// The bare goblin world body (public/world/kit/goblin-bare.glb): the body a rank-look goblin is drawn on (the look file is the armour SET, not a body; Test Zone port C07). It sits under public/world/kit/ because the
// mob view fetches it by a creature look's `body` path, so it is not a roster body of its own: tests/world-bodies.test.ts reads public/world/*.glb only. It must hold the same phone line as the bodies it stands in for.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { glbStats } from '../scripts/lib/glb-stats.mjs';
import { ROW } from '../scripts/character/add-weapon-packs.mjs';

const BARE = 'public/world/kit/goblin-bare.glb', WORLD = 'public/world/goblin.glb', root = (p: string) => new URL(`../${p}`, import.meta.url);
const WORLD_FILE = 1_300_000;   // scripts/check-budget.mjs WORLD_FILE: the gzip cap of one world body

test('the bare goblin is a skinned world body on the phone line: at most ~8k triangles, one texture, under the world file cap (gzip)', () => {
  const s = glbStats(BARE);
  assert.ok(s.tris > 0 && s.tris <= 8200, `${s.tris} tris`);
  assert.equal(s.images, 1, 'one texture');
  assert.ok(s.joints > 0, 'skinned');
  const gzip = gzipSync(readFileSync(root(BARE))).length;
  assert.ok(gzip < WORLD_FILE, `${gzip} B gzip`);
});

test('the bare goblin carries the goblin world body\'s rig: the same joints and every clip the goblin plays, plus the clip packs of the two-handed weapons its row lists (scripts/character/weapon-packs.json)', () => {
  const bare = glbStats(BARE), world = glbStats(WORLD), packs = (ROW.bodies as { file: string; weapons: string[] }[]).find((b) => b.file === BARE)?.weapons ?? [];
  assert.equal(bare.joints, world.joints);
  assert.deepEqual(world.clips.filter((c: string) => !bare.clips.includes(c)), [], 'a clip the goblin plays is missing');
  const extra = bare.clips.filter((c: string) => !world.clips.includes(c));
  assert.ok(extra.every((c: string) => packs.some((w) => c.startsWith(w[0].toUpperCase() + w.slice(1) + '_'))), `clips beyond the goblin's: ${extra.join(', ')}`);
});

test('the bare goblin is meshopt-packed like every world body (scripts/pack-world-body.mjs), so the mob view\'s loader reads it unchanged', () => {
  const bytes = readFileSync(root(BARE)), size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString()) as { extensionsUsed?: string[] };
  assert.ok(json.extensionsUsed?.includes('EXT_meshopt_compression'), 'packed with meshopt');
});
