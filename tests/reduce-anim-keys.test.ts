import test from 'node:test';
import assert from 'node:assert/strict';
import { reduceAnimKeys, keptKeys } from '../scripts/reduce-anim-keys.mjs';

// scripts/reduce-anim-keys.mjs drops the animation keys a track does not need and the clips a world body never plays (the world bodies were mostly clip data).
function glb(build: (add: (floats: number[], type: string) => number) => object): Buffer {
  const chunks: Buffer[] = [], accessors: object[] = [], views: object[] = [];
  let at = 0;
  const add = (floats: number[], type: string) => {
    const bytes = Buffer.from(new Float32Array(floats).buffer);
    views.push({ buffer: 0, byteOffset: at, byteLength: bytes.length }); chunks.push(bytes); at += bytes.length;
    const w = { SCALAR: 1, VEC3: 3, VEC4: 4 }[type as 'SCALAR']!;
    accessors.push({ bufferView: views.length - 1, componentType: 5126, count: floats.length / w, type, ...(type === 'SCALAR' ? { min: [Math.min(...floats)], max: [Math.max(...floats)] } : {}) });
    return accessors.length - 1;
  };
  const doc = { asset: { version: '2.0' }, ...build(add), accessors, bufferViews: views, buffers: [{ byteLength: at }] };
  const json = Buffer.from(JSON.stringify(doc)), padded = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]), bin = Buffer.concat(chunks);
  const out = Buffer.alloc(28 + padded.length + bin.length);
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8); out.writeUInt32LE(padded.length, 12); out.writeUInt32LE(0x4e4f534a, 16); padded.copy(out, 20);
  out.writeUInt32LE(bin.length, 20 + padded.length); out.writeUInt32LE(0x004e4942, 24 + padded.length); bin.copy(out, 28 + padded.length);
  return out;
}
function parse(b: Buffer) {
  const jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl).toString()), bin = b.subarray(28 + jl);
  const read = (ai: number) => { const a = j.accessors[ai], v = j.bufferViews[a.bufferView], w = ({ SCALAR: 1, VEC3: 3, VEC4: 4 } as Record<string, number>)[a.type], off = (v.byteOffset ?? 0) + (a.byteOffset ?? 0); return Array.from({ length: a.count * w }, (_, i) => bin.readFloatLE(off + i * 4)); };
  return { j, read };
}

const times = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const line = times.flatMap((t) => [t * 0.1, 0, 0]);                       // moves in a straight line: 2 keys say it all
const bend = times.flatMap((t) => [t < 5 ? t : 5 + (t - 5) * 3, 0, 0]);   // bends at t=5: 3 keys
const still = times.flatMap(() => [0, 0, 0, 1]);                         // a bone this clip does not move
const spin = times.flatMap((t) => { const a = t * 0.1; return [0, Math.sin(a / 2), 0, Math.cos(a / 2)]; });   // a steady turn: slerp reproduces it from 2 keys

const source = () => glb((add) => {
  const pos = add([0, 0, 0, 1, 0, 0, 0, 1, 0], 'VEC3');
  const t = add(times, 'SCALAR');
  const clip = (name: string, tracks: [string, number, string, number[], string][]) => ({ name, channels: tracks.map(([, node, path], i) => ({ sampler: i, target: { node, path } })), samplers: tracks.map(([, , , values, type]) => ({ input: t, output: add(values, type), interpolation: 'LINEAR' })) });
  return {
    nodes: [{ name: 'root' }, { name: 'arm' }],
    meshes: [{ primitives: [{ attributes: { POSITION: pos } }] }],
    animations: [
      clip('Walk', [['', 0, 'translation', line, 'VEC3'], ['', 0, 'rotation', still, 'VEC4'], ['', 1, 'rotation', spin, 'VEC4'], ['', 1, 'translation', bend, 'VEC3']]),
      clip('Dance', [['', 0, 'translation', bend, 'VEC3']]),
    ],
  };
});

test('keptKeys: a straight run keeps its ends, a bend keeps the bend', () => {
  const k = (v: number[], w: number, rot: boolean) => Array.from(keptKeys(times, v, w, rot, 1e-4) as Uint8Array).flatMap((x, i) => (x ? [i] : []));
  assert.deepEqual(k(line, 3, false), [0, 10]);
  assert.deepEqual(k(bend, 3, false), [0, 5, 10]);
  assert.deepEqual(k(still, 4, true), [0, 10]);
  assert.deepEqual(k(spin, 4, true), [0, 10]);
});

test('reduceAnimKeys: fewer keys, same clips, same durations, same pose within eps; geometry untouched', () => {
  const src = parse(source()), { glb: out, keysIn, keysOut } = reduceAnimKeys(source(), 1e-4), got = parse(out);
  assert.ok(keysOut < keysIn / 2, `${keysOut} of ${keysIn} keys kept`);
  assert.deepEqual(got.j.animations.map((a: { name: string }) => a.name), ['Walk', 'Dance']);
  assert.deepEqual(got.read(got.j.meshes[0].primitives[0].attributes.POSITION), [0, 0, 0, 1, 0, 0, 0, 1, 0]);
  for (const [i, an] of got.j.animations.entries()) for (const [c, ch] of an.channels.entries()) {
    const was = src.j.animations[i].channels[c], a = src.j.animations[i].samplers[was.sampler], b = an.samplers[ch.sampler];
    assert.equal(ch.target.path, was.target.path); assert.equal(ch.target.node, was.target.node);
    const ta = src.read(a.input), tb = got.read(b.input);
    assert.equal(tb[0], ta[0]); assert.equal(tb.at(-1), ta.at(-1), 'the clip keeps its duration');
    assert.equal(got.j.accessors[b.input].max[0], tb.at(-1));
  }
  // a dropped key is reproduced: sample the reduced 'Walk' translation of the straight line at t=7
  const walk = got.j.animations[0], tr = walk.samplers[walk.channels[0].sampler], t = got.read(tr.input), v = got.read(tr.output);
  assert.deepEqual(t, [0, 10]); assert.ok(Math.abs(v[0] + (v[3] - v[0]) * 0.7 - 0.7) < 1e-6);
});

test('reduceAnimKeys keep: the other clips go, with their data; naming a clip the file lacks fails', () => {
  const full = reduceAnimKeys(source(), 1e-4).glb, kept = reduceAnimKeys(source(), 1e-4, new Set(['Walk'])).glb;
  assert.deepEqual(parse(kept).j.animations.map((a: { name: string }) => a.name), ['Walk']);
  assert.ok(kept.length < full.length);
  assert.throws(() => reduceAnimKeys(source(), 1e-4, new Set(['Moonwalk'])), /Moonwalk/);
});
