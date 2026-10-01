import assert from 'node:assert/strict';
import test from 'node:test';
import { ENVELOPE, fitCheck } from '../scripts/shield-fit-check.mjs';

// A synthetic board: an ellipse `w` × `h` (metres) extruded `depth` thick about z = 0, origin at its centre, both faces modelled.
function glb({ w, h, depth = .06, segs = 32, backFace = true, extraMaterial = false, shift = [0, 0] }: { w: number; h: number; depth?: number; segs?: number; backFace?: boolean; extraMaterial?: boolean; shift?: [number, number] }) {
  const pos: number[] = [], idx: number[] = [], ring = (z: number) => Array.from({ length: segs }, (_, i) => [shift[0] + (w / 2) * Math.cos(2 * Math.PI * i / segs), shift[1] + (h / 2) * Math.sin(2 * Math.PI * i / segs), z]);
  const zf = depth / 2, zb = -depth / 2;
  pos.push(shift[0], shift[1], zf, ...ring(zf).flat(), shift[0], shift[1], zb, ...ring(zb).flat());
  const cf = 0, rf = 1, cb = 1 + segs, rb = 2 + segs;
  for (let i = 0; i < segs; i++) {
    const n = (i + 1) % segs;
    idx.push(cf, rf + i, rf + n);                                    // front, normal +Z
    if (backFace) idx.push(cb, rb + n, rb + i);                      // back, normal −Z
    idx.push(rf + i, rb + i, rb + n, rf + i, rb + n, rf + n);        // the rim
  }
  const positions = new Float32Array(pos), indices = new Uint32Array(idx);
  const bin = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(indices.buffer)]);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], positions[i + c]); max[c] = Math.max(max[c], positions[i + c]); }
  const json = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'Shield', mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: extraMaterial ? [{ name: 'a' }, { name: 'b' }] : [{ name: 'Painted' }],
    accessors: [{ bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min, max }, { bufferView: 1, componentType: 5125, count: indices.length, type: 'SCALAR' }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }, { buffer: 0, byteOffset: positions.byteLength, byteLength: indices.byteLength }],
    buffers: [{ byteLength: bin.length }],
  };
  let body = Buffer.from(JSON.stringify(json)); body = Buffer.concat([body, Buffer.alloc((4 - body.length % 4) % 4, 0x20)]);
  const binPad = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4)]), head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + body.length + 8 + binPad.length, 8);
  jh.writeUInt32LE(body.length, 0); jh.writeUInt32LE(0x4e4f534a, 4); bh.writeUInt32LE(binPad.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, body, bh, binPad]);
}
const failed = (bytes: Buffer, carrier: string, band: string) => (fitCheck(bytes, { carrier, band }) as { rule: string; status: string }[]).filter(r => r.status === 'FAIL').map(r => r.rule);

test('the envelope: the Centurion\'s and the Shieldmaiden\'s rounds Ø 0.60 / 0.70, the tower ≤ 0.88 × 0.60, the kite ≤ 0.75 × 0.60 (Strategy 2026-09-30)', () => {
  assert.deepEqual(ENVELOPE.veteran.plain, { w: .60, h: .60 });
  assert.deepEqual(ENVELOPE.veteran.crafted, { w: .70, h: .70 });
  assert.deepEqual(ENVELOPE.veteran.ornate, { w: .60, h: .88, tall: true });
  assert.deepEqual(ENVELOPE.shieldmaiden.plain, { w: .60, h: .60 });
  assert.deepEqual(ENVELOPE.shieldmaiden.crafted, { w: .70, h: .70 });
  assert.deepEqual(ENVELOPE.shieldmaiden.ornate, { w: .60, h: .75, tall: true });
});

test('a conforming board passes: the tower, the kite and the rounds', () => {
  assert.deepEqual(failed(glb({ w: .6, h: .88 }), 'veteran', 'ornate'), []);
  assert.deepEqual(failed(glb({ w: .6, h: .75 }), 'shieldmaiden', 'ornate'), []);
  assert.deepEqual(failed(glb({ w: .6, h: .6 }), 'veteran', 'plain'), []);
  assert.deepEqual(failed(glb({ w: .7, h: .7 }), 'shieldmaiden', 'crafted'), []);
  assert.ok(failed(glb({ w: .74, h: .74 }), 'shieldmaiden', 'plain').includes('width X'), 'GPT\'s 0.74 round is over the Ø 0.60 cap until intake scales it');
});

test('the tower taller than 0.88 m fails: it clips the floor and the thigh in the carry sweep', () => {
  assert.deepEqual(failed(glb({ w: .6, h: 1.0 }), 'veteran', 'ornate'), ['height Y']);
  assert.ok(failed(glb({ w: .7, h: .88 }), 'veteran', 'ornate').includes('width X'));
});

test('centimetre or millimetre exports fail the metre rule; a round that is not round fails upright', () => {
  assert.ok(failed(glb({ w: 60, h: 88, depth: 6 }), 'veteran', 'ornate').includes('real metres'));
  assert.ok(failed(glb({ w: .6, h: .4 }), 'veteran', 'plain').includes('upright'));
  assert.ok(failed(glb({ w: .6, h: .5 }), 'veteran', 'ornate').includes('upright'), 'a tower whose long axis is not +Y');
});

test('the grip: the origin must sit inside the board with the face in front; the back face must be modelled', () => {
  assert.ok(failed(glb({ w: .6, h: .88, shift: [.4, 0] }), 'veteran', 'ornate').includes('origin is the grip, face +Z'));
  assert.ok(failed(glb({ w: .6, h: .88, backFace: false }), 'veteran', 'ornate').includes('back face modelled'));
  const deep = fitCheck(glb({ w: .6, h: .88, depth: .3 }), { carrier: 'veteran', band: 'ornate' }) as { rule: string; status: string }[];
  assert.equal(deep.find(r => r.rule === 'depth Z')?.status, 'WARN', 'depth has no ruling: a soft limit to judge in the stills');
});

test('one mesh, one material; a triangle cap of 6,000', () => {
  assert.ok(failed(glb({ w: .6, h: .88, segs: 1600 }), 'veteran', 'ornate').includes('triangles'));
  assert.ok(!failed(glb({ w: .6, h: .88, extraMaterial: true }), 'veteran', 'ornate').includes('one node, one mesh, one material'), 'an unused extra material is not a second draw (only used ones count)');
});

test('a carrier with no envelope is refused', () => {
  assert.throws(() => fitCheck(glb({ w: .6, h: .88 }), { carrier: 'goblin', band: 'plain' }), /no shield envelope/);
});

test('the shipped shield files pass their carrier\'s envelope (no FAIL: a WARN, such as depth, is judged in the stills)', async () => {
  const { readFileSync } = await import('node:fs');
  for (const [carrier, stem] of [['shieldmaiden', 'shieldmaiden']] as const) for (const band of ['plain', 'crafted', 'ornate']) {
    const results = fitCheck(readFileSync(new URL(`../public/shields/${stem}-${band}.glb`, import.meta.url)), { carrier, band }) as { rule: string; status: string }[];
    assert.deepEqual(results.filter(r => r.status === 'FAIL').map(r => r.rule), [], `${stem}-${band}`);
  }
});
