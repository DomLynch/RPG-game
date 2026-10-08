import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { OUTLAW_CAMP, campAnchors, campPlacements, missingPieces, toWorld, type KitManifest } from './outlaw-camp.ts';

const manifest = JSON.parse(fs.readFileSync(new URL('../../public/world/camp/caravan-kit.json', import.meta.url), 'utf8')) as KitManifest & { pieces: Record<string, unknown> };

test('the camp sits at the Ferry Landing spot, well away from every town', () => {
  const { at } = OUTLAW_CAMP; const towns = [{ x: 0, z: -70 }, { x: -90, z: 123 }, { x: -247, z: -182 }];
  for (const t of towns) assert.ok(Math.hypot(at.x - t.x, at.z - t.z) > 100, `far from a town at ${t.x},${t.z}`);
});

test('placements: every layout row lands inside the camp radius around the centre, rotated as the manifest says; heading 0 is a pure translation', () => {
  const ps = campPlacements(manifest, OUTLAW_CAMP.at, 0); assert.equal(ps.length, manifest.layout.length);
  for (const p of campPlacements(manifest)) assert.ok(Math.hypot(p.x - OUTLAW_CAMP.at.x, p.z - OUTLAW_CAMP.at.z) <= manifest.camp_radius_m, `${p.piece} inside the radius`);
  const first = ps[0]!, row = manifest.layout[0]!; assert.deepEqual([first.x, first.z], [OUTLAW_CAMP.at.x + row[1], OUTLAW_CAMP.at.z + row[2]]); assert.ok(Math.abs(first.rotY - (row[3] * Math.PI) / 180) < 1e-9);
  const turned = toWorld({ x: 0, z: 0 }, Math.PI / 2, 1, 0); assert.ok(Math.abs(turned.x) < 1e-9 && Math.abs(turned.z + 1) < 1e-9, 'a quarter turn sends +x to -z (three rotation.y)');
});

test('anchors: bank, trader, fire and the reds\' respawn are inside the camp, the fire is the centre', () => {
  const a = campAnchors(manifest); assert.deepEqual(a.fire, OUTLAW_CAMP.at);
  for (const k of ['bank', 'trader', 'redRespawn'] as const) assert.ok(Math.hypot(a[k].x - a.fire.x, a[k].z - a.fire.z) <= manifest.camp_radius_m, k);
});

test('every placed piece is a piece the manifest describes (and the node check reports a missing one)', () => {
  assert.deepEqual(missingPieces(manifest, new Set(Object.keys(manifest.pieces))), []); assert.deepEqual(missingPieces({ layout: [['ghost', 0, 0, 0]] }, new Set(['wagon_trader_a'])), ['ghost']);
});

test('turned to the road: the sign (local 0,+9.5) lands on the road side, between the fire and the road end', () => {
  const road = { x: -132, z: -50 }, sign = campPlacements(manifest).find((p) => p.piece === 'sign_outlaw_a')!;
  assert.ok(Math.hypot(sign.x - road.x, sign.z - road.z) < Math.hypot(OUTLAW_CAMP.at.x - road.x, OUTLAW_CAMP.at.z - road.z), 'closer to the road end than the fire is');
  assert.ok(Math.abs(OUTLAW_CAMP.heading - Math.atan2(14, 22)) < 1e-12);
});
