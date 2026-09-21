// The loot pieces shelled from a skull must be shelled from the PLAYER's (parts.py --loot): the Executioner's mask + hood and the
// Nightborn's crown were first cut on their own fighters' heads and sat wrong on the hero — the crown floated 3 cm above his skull,
// his nose came through the mask. Measured in the rig's rest space (raw positions, both files), against the hero's scanned head.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

type Gltf = { nodes: { name: string; mesh?: number }[]; meshes: { primitives: { attributes: Record<string, number> }[] }[]; accessors: { bufferView: number; byteOffset?: number; count: number; componentType: number }[]; bufferViews: { byteOffset?: number; byteStride?: number }[]; scenes: { nodes: number[] }[] };
function glb(path: string) {
  const bytes = readFileSync(new URL(path, import.meta.url)), length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.toString('utf8', 20, 20 + length)) as Gltf, bin = bytes.subarray(28 + length);
  const positions = (name: string) => {
    const node = json.nodes.find(n => n.name === name); assert.ok(node?.mesh !== undefined, `${path}: no draw named ${name}`);
    const a = json.accessors[json.meshes[node!.mesh!].primitives[0].attributes.POSITION], bv = json.bufferViews[a.bufferView];
    const stride = (bv.byteStride ?? 12) / 4, base = ((bv.byteOffset ?? 0) + (a.byteOffset ?? 0)) / 4, f = new Float32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4);
    const out: number[][] = []; for (let k = 0; k < a.count; k++) out.push([f[base + k * stride], f[base + k * stride + 1], f[base + k * stride + 2]]);
    return out;
  };
  return { json, positions };
}
const hero = glb('../src/assets/warrior.glb'), loot = glb('../src/assets/loot.glb');
const head = hero.positions('Photo');
const apex = Math.max(...head.map(p => p[1]));
const skull = head.filter(p => p[1] > apex - 0.07), axisZ = (Math.min(...skull.map(p => p[2])) + Math.max(...skull.map(p => p[2]))) / 2;   // the head turns about this vertical axis
// A worn piece's stand-off from the head, per vertex: its radius from the head's axis minus the head's own radius at the same height
// and azimuth (nearest head vertex within 6 mm of height and 4° of azimuth). Negative = inside the face.
function standoff(piece: number[][]) {
  const out: number[] = [];
  for (const [x, y, z] of piece) {
    const az = Math.atan2(x, z - axisZ), r = Math.hypot(x, z - axisZ); let best = Infinity, dAz = 4 * Math.PI / 180;
    for (const [hx, hy, hz] of head) { if (Math.abs(hy - y) > 0.006) continue; const d = Math.abs(Math.atan2(hx, hz - axisZ) - az); if (d < dAz) { dAz = d; best = Math.hypot(hx, hz - axisZ); } }
    if (best < Infinity) out.push((r - best) * 1000);
  }
  assert.ok(out.length > piece.length / 2, `only ${out.length} of ${piece.length} vertices face the head`);
  return out.sort((a, b) => a - b);
}
const q = (d: number[], f: number) => d[Math.floor(f * (d.length - 1))];

test('the loot file shares the hero\'s scene-root transform (build-warrior.mjs: scale .9/.97/.97, y +.025)', () => {
  const root = (g: { json: Gltf }) => g.json.nodes[g.json.scenes[0].nodes[0]] as { matrix?: number[]; scale?: number[]; translation?: number[] };
  const h = root(hero), l = root(loot), m = l.matrix ?? [l.scale?.[0], 0, 0, 0, 0, l.scale?.[1], 0, 0, 0, 0, l.scale?.[2], 0, 0, l.translation?.[1], 0, 1];
  const hm = h.matrix ?? [h.scale![0], 0, 0, 0, 0, h.scale![1], 0, 0, 0, 0, h.scale![2], 0, 0, h.translation![1], 0, 1];
  for (const i of [0, 5, 10, 13]) assert.ok(Math.abs(m[i]! - hm[i]!) < 1e-6, `root transform differs at [${i}]: loot ${m[i]} hero ${hm[i]}`);
});

test('the Executioner\'s mask, shelled from the hero\'s skull, sits just off his lower face', () => {
  const d = standoff(loot.positions('executioner.Helmet.Steel'));
  assert.ok(q(d, .1) > 2, `mask p10 stand-off ${q(d, .1).toFixed(1)} mm: the plate cuts into the hero's face`);
  assert.ok(q(d, .9) < 40, `mask p90 stand-off ${q(d, .9).toFixed(1)} mm: the plate floats off the hero's face (shelled from another skull?)`);
});

test('the Nightborn\'s crown, shelled from the hero\'s skull, rides on it — not above it', () => {
  const crown = loot.positions('nightborn.Helmet.Ruby'), bottom = Math.min(...crown.map(p => p[1]));
  const band = crown.filter(p => p[1] < bottom + 0.025);   // the 22 mm ribbon; the prongs rise from its top past the apex by design
  assert.ok(band.length > 100, `${band.length} band vertices`);
  const top = Math.max(...band.map(p => p[1]));
  assert.ok(apex - top > 0.02 && apex - top < 0.07, `band top ${(apex - top).toFixed(3)} m below the apex: it should ride the upper skull, 2–7 cm down`);
  const d = standoff(band);
  assert.ok(q(d, .1) > -3, `band p10 stand-off ${q(d, .1).toFixed(1)} mm: inside the skull`);   // an ellipse on a skull: the lower edge may just touch
  assert.ok(q(d, .5) < 20 && q(d, .9) < 35, `band stand-off p50 ${q(d, .5).toFixed(1)} / p90 ${q(d, .9).toFixed(1)} mm: the circlet hovers off the skull (the Nightborn's wider head: 24 / 43)`);
});
