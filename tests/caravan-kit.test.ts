// The outlaw camp caravan kit (scripts/character/caravan_kit.py, Dom's PvP design: one caravan camp per zone, a bank, one trader, no guards): thirteen props on the town kit's own
// swatch atlas, a layout and four anchors in the manifest. Read in Node from the GLB's JSON chunk, no GL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLOTH_PIECES, OUTLAW_TRADER_OUTFIT } from '../origins/preview/town-dress.ts';

type Gltf = { nodes: { name?: string; mesh?: number }[]; meshes: { primitives: { indices: number; attributes: { POSITION: number } }[] }[]; accessors: { count: number }[]; images?: unknown[] };
type Manifest = { pieces: Record<string, { kind: string; tris: number; size: number[] }>; layout: [string, number, number, number][]; anchors: Record<string, number[]>; camp_radius_m: number };
const dir = new URL('../public/world/camp/', import.meta.url);
const bytes = readFileSync(new URL('caravan-kit.glb', dir)), json: Gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
const manifest: Manifest = JSON.parse(readFileSync(new URL('caravan-kit.json', dir), 'utf8'));
const BUDGET: Record<string, number> = { wagon: 1000, cart: 450, tent: 150, strongbox: 180, crate: 60, barrel: 140, sack: 60, sign: 90, awning: 100 };
const trisOf = (node: { mesh?: number }) => json.meshes[node.mesh!]!.primitives.reduce((n, p) => n + json.accessors[p.indices]!.count / 3, 0);

test('the file holds exactly the manifest\'s pieces, each within its triangle budget and matching the manifest count', () => {
  const nodes = json.nodes.filter((n) => n.mesh !== undefined);
  assert.deepEqual(nodes.map((n) => n.name).sort(), Object.keys(manifest.pieces).sort());
  for (const n of nodes) {
    const piece = manifest.pieces[n.name!]!;
    assert.equal(trisOf(n), piece.tris, `${n.name}: manifest tris`);
    assert.ok(piece.tris <= BUDGET[piece.kind]!, `${n.name}: ${piece.tris} over the ${piece.kind} budget ${BUDGET[piece.kind]}`);
  }
  assert.ok(nodes.reduce((s, n) => s + trisOf(n), 0) <= 2400, 'the whole kit stays under 2,400 triangles');
});

test('the camp needs a bank chest, a trader wagon with its awning, shelter and the camp sign; the layout names only real pieces', () => {
  for (const must of ['strongbox_a', 'wagon_trader_a', 'awning_a', 'tent_small_a', 'tent_large_a', 'sign_outlaw_a']) assert.ok(manifest.pieces[must], must);
  assert.ok(manifest.layout.length >= 12);
  for (const [name, x, z, heading] of manifest.layout) {
    assert.ok(manifest.pieces[name], `layout names ${name}`);
    assert.ok(Math.hypot(x, z) <= manifest.camp_radius_m, `${name} is inside the ${manifest.camp_radius_m} m camp`);
    assert.ok(Number.isFinite(heading));
  }
  assert.equal(manifest.layout.filter(([n]) => n === 'strongbox_a').length, 1, 'one bank');
  assert.equal(manifest.layout.filter(([n]) => n === 'wagon_trader_a').length, 1, 'one trader');
});

test('the four anchors sit inside the camp, the red respawn near the fire, and the bank and the trader face each other across it', () => {
  assert.deepEqual(Object.keys(manifest.anchors).sort(), ['bank', 'fire', 'red_respawn', 'trader']);
  for (const [k, p] of Object.entries(manifest.anchors)) { assert.equal(p.length, 3, k); assert.equal(p[1], 0, `${k} stands on the ground`); assert.ok(Math.hypot(p[0]!, p[2]!) <= manifest.camp_radius_m, k); }
  assert.ok(Math.hypot(...manifest.anchors.red_respawn!.filter((_, i) => i !== 1) as [number, number]) <= 4, 'reds respawn within 4 m of the fire');
  assert.ok(manifest.anchors.bank![0]! > manifest.anchors.trader![0]!, 'the bank is nearer the fire than the trader');
});

test('one embedded atlas: the kit reuses the town kit\'s 256 swatch image and ships no other', () => {
  assert.equal(json.images?.length, 1);
});

test('the outlaw trader\'s outfit is real garments, one body layer and one headgear (the outfitFor rule), so the clothes file already dresses him', () => {
  const p = OUTLAW_TRADER_OUTFIT.pieces;
  assert.ok(p.every((x) => CLOTH_PIECES.includes(x)));
  assert.equal(p.filter((x) => x === 'robe' || x === 'tunic').length, 1);
  assert.equal(p.filter((x) => x === 'cap' || x === 'hat' || x === 'hood').length, 1);
});
