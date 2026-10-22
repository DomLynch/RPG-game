// Drop the animation keys a clip does not need: a key is dropped when the track still reproduces it, within `eps`, by interpolating the
// kept keys around it (linear for translation/scale, slerp for rotation: what three.js plays). First and last key of every track stay, so each
// clip keeps its duration, and a track that never moves collapses to those two. Blender samples every bone on every frame, and 70% of a world
// body's tracks are bones a clip does not move: the clips were most of the file (dwarf: 744 KB of 1.5 MB), the mesh and the atlas the rest.
//   node scripts/reduce-anim-keys.mjs <in.glb> <out.glb> [eps 1e-4] [--keep=Clip,Clip] [--drop-rest]   (--keep drops every other clip: scripts/world-body-clips.ts names the ones a world body needs; --drop-rest drops the tracks of bones no kept clip moves; input: an unpacked single-buffer GLB, as world_body.py writes it)
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WIDTH = { SCALAR: 1, VEC3: 3, VEC4: 4 };

function slerpInto(out, a, b, u) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], sign = 1;
  if (d < 0) { d = -d; sign = -1; }
  let s0, s1;
  if (d > 0.9995) { s0 = 1 - u; s1 = u * sign; } else { const th = Math.acos(d), sn = Math.sin(th); s0 = Math.sin((1 - u) * th) / sn; s1 = Math.sin(u * th) / sn * sign; }
  for (let k = 0; k < 4; k++) out[k] = a[k] * s0 + b[k] * s1;
}

/** STEP sampler: a key holds its value until the next key, so a key equal (within eps) to the last kept one is redundant; first and last stay. */
export function steppedKeys(values, width, rotation, eps) {
  const n = values.length / width, keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  let last = 0;
  for (let i = 1; i < n - 1; i++) {
    let err = 0, errNeg = 0;
    for (let k = 0; k < width; k++) { err = Math.max(err, Math.abs(values[i * width + k] - values[last * width + k])); errNeg = Math.max(errNeg, Math.abs(values[i * width + k] + values[last * width + k])); }
    if (rotation) err = Math.min(err, errNeg);
    if (err > eps) { keep[i] = 1; last = i; }
  }
  return keep;
}

/** Indices (ascending) of the keys to keep: Douglas-Peucker on the interpolation error, so every dropped key is within eps of the FINAL track. */
export function keptKeys(times, values, width, rotation, eps) {
  const n = times.length, keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]], a = new Float64Array(width), b = new Float64Array(width), s = new Float64Array(width);
  while (stack.length) {
    const [lo, hi] = stack.pop();
    if (hi - lo < 2) continue;
    for (let k = 0; k < width; k++) { a[k] = values[lo * width + k]; b[k] = values[hi * width + k]; }
    let worst = -1, worstErr = eps;
    for (let i = lo + 1; i < hi; i++) {
      const u = (times[i] - times[lo]) / (times[hi] - times[lo]);
      if (rotation) slerpInto(s, a, b, u); else for (let k = 0; k < width; k++) s[k] = a[k] + (b[k] - a[k]) * u;
      let err = 0, errNeg = 0;
      for (let k = 0; k < width; k++) { const v = values[i * width + k]; err = Math.max(err, Math.abs(v - s[k])); errNeg = Math.max(errNeg, Math.abs(v + s[k])); }
      if (rotation) err = Math.min(err, errNeg);   // q and -q are one rotation
      if (err > worstErr) { worstErr = err; worst = i; }
    }
    if (worst >= 0) { keep[worst] = 1; stack.push([lo, worst], [worst, hi]); }
  }
  return keep;
}

/** @param {Buffer} raw @param {number} [eps] @param {Set<string> | null} [keep] @param {boolean} [dropRest] */
export function reduceAnimKeys(raw, eps = 1e-4, keep = null, dropRest = false) {
  assert.equal(raw.readUInt32LE(0), 0x46546c67, 'Expected GLB');
  const jl = raw.readUInt32LE(12), j = JSON.parse(raw.subarray(20, 20 + jl)), bin = raw.subarray(28 + jl);
  assert.ok(!j.extensionsUsed?.some((x) => /meshopt|draco|quantization/.test(x)), 'Source must be uncompressed');
  assert.equal(j.buffers.length, 1, 'one embedded buffer');
  assert.ok(!j.accessors.some((a) => a.sparse), 'no sparse accessors');
  const animAcc = new Set();
  for (const an of j.animations || []) for (const s of an.samplers) { animAcc.add(s.input); animAcc.add(s.output); }
  const animViews = new Set([...animAcc].map((i) => j.accessors[i].bufferView));
  assert.ok(j.accessors.every((a, i) => animAcc.has(i) || !animViews.has(a.bufferView)), 'animation accessors must not share a buffer view with geometry');
  const readF = (ai) => {
    const a = j.accessors[ai], v = j.bufferViews[a.bufferView], w = WIDTH[a.type], off = (v.byteOffset || 0) + (a.byteOffset || 0);
    assert.equal(a.componentType, 5126, 'float animation data');
    const f = new Float64Array(a.count * w);
    for (let i = 0; i < f.length; i++) f[i] = bin.readFloatLE(off + i * 4);
    return f;
  };
  const chunks = [], views = [], accessors = [];
  let at = 0;
  const push = (bytes, target) => { views.push({ buffer: 0, byteOffset: at, byteLength: bytes.length, ...(target ? { target } : {}) }); chunks.push(bytes); at += bytes.length; const pad = (4 - (at % 4)) % 4; if (pad) { chunks.push(Buffer.alloc(pad)); at += pad; } return views.length - 1; };
  // geometry and the rest: copied as they are, accessors keep their order
  const viewMap = new Map(), accMap = new Map();
  j.accessors.forEach((a, i) => {
    if (animAcc.has(i)) return;
    if (!viewMap.has(a.bufferView)) { const v = j.bufferViews[a.bufferView]; viewMap.set(a.bufferView, push(bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength), v.target)); if (v.byteStride) views[views.length - 1].byteStride = v.byteStride; }
    accMap.set(i, accessors.length); accessors.push({ ...a, bufferView: viewMap.get(a.bufferView) });
  });
  // images live in buffer views no accessor names
  const imageView = new Map();
  for (const im of j.images || []) if (im.bufferView !== undefined) { const v = j.bufferViews[im.bufferView]; if (!imageView.has(im.bufferView)) imageView.set(im.bufferView, push(bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength))); im.bufferView = imageView.get(im.bufferView); }
  // One accessor per distinct content: the constant tracks of a clip all share one pair of times, and a bone's rest value repeats across clips,
  // so thousands of accessors and views (most of the JSON, which is what the file mostly was) collapse to a few hundred.
  // The data of all of them sits in ONE buffer view per element type (times, VEC3, VEC4), each accessor a byteOffset into it: a view per accessor
  // cost ~110 B of JSON each once packed.
  const known = new Map(), pools = { SCALAR: [], VEC3: [], VEC4: [] }, poolSize = { SCALAR: 0, VEC3: 0, VEC4: 0 };
  const added = (arr, type, count, extra = {}) => {
    const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength), id = `${type}:${bytes.toString('base64')}`;
    if (known.has(id)) return known.get(id);
    accessors.push({ pool: type, byteOffset: poolSize[type], componentType: 5126, count, type, ...extra }); pools[type].push(bytes); poolSize[type] += bytes.length;
    known.set(id, accessors.length - 1); return accessors.length - 1;
  };
  let keysIn = 0, keysOut = 0, restDropped = 0;
  if (keep) {   // clips outside the list are dropped whole (their accessors were never copied above)
    const names = new Set((j.animations || []).map((a) => a.name));
    for (const n of keep) assert.ok(names.has(n), `--keep names a clip the file does not have: ${n}`);
    j.animations = j.animations.filter((a) => keep.has(a.name));
  }
  if (dropRest) {   // a bone no kept clip ever moves, held at its node's own rest pose, needs no track in any clip: the mixer never touches it, it stays where the node puts it
    const state = new Map();   // "node/path" -> { moves, value }
    for (const an of j.animations) for (const c of an.channels) {
      const out = readF(an.samplers[c.sampler].output), w = WIDTH[j.accessors[an.samplers[c.sampler].output].type], key = `${c.target.node}/${c.target.path}`, e = state.get(key) ?? { moves: false, value: out.slice(0, w) };
      for (let i = 0; i < out.length && !e.moves; i++) if (Math.abs(out[i] - e.value[i % w]) > 1e-4) e.moves = true;
      state.set(key, e);
    }
    const rest = (key, value) => { const [node, path] = key.split('/'), n = j.nodes[node], r = path === 'rotation' ? n.rotation ?? [0, 0, 0, 1] : path === 'translation' ? n.translation ?? [0, 0, 0] : n.scale ?? [1, 1, 1]; return value.every((x, k) => Math.abs(x - r[k]) < 1e-3) || (path === 'rotation' && value.every((x, k) => Math.abs(x + r[k]) < 1e-3)); };
    const drop = new Set([...state].filter(([key, e]) => !e.moves && rest(key, e.value)).map(([key]) => key));
    for (const an of j.animations) {
      an.channels = an.channels.filter((c) => !drop.has(`${c.target.node}/${c.target.path}`));
      const used = [...new Set(an.channels.map((c) => c.sampler))], at3 = new Map(used.map((s, i) => [s, i]));
      an.samplers = used.map((s) => an.samplers[s]); an.channels.forEach((c) => { c.sampler = at3.get(c.sampler); });
      assert.ok(an.channels.length, `${an.name}: every track dropped`);
    }
    restDropped = drop.size;
  }
  for (const an of j.animations || []) {
    const done = new Map();
    an.samplers = an.samplers.map((s, si) => {
      const ch = an.channels.find((c) => c.sampler === si), path = ch.target.path;
      const mode = s.interpolation || 'LINEAR';
      if (mode !== 'LINEAR' && mode !== 'STEP') { assert.fail(`${an.name}: ${mode} sampler`); }
      const key = `${s.input}/${s.output}/${path}`;
      if (done.has(key)) return done.get(key);
      const t = readF(s.input), w = WIDTH[j.accessors[s.output].type], v = readF(s.output), keep = mode === 'STEP' ? steppedKeys(v, w, path === 'rotation', eps) : keptKeys(t, v, w, path === 'rotation', eps);
      const idx = []; keep.forEach((k, i) => { if (k) idx.push(i); });
      keysIn += t.length; keysOut += idx.length;
      const nt = new Float32Array(idx.length), nv = new Float32Array(idx.length * w);
      idx.forEach((i, o) => { nt[o] = t[i]; for (let k = 0; k < w; k++) nv[o * w + k] = v[i * w + k]; });
      const input = added(nt, 'SCALAR', idx.length, { min: [nt[0]], max: [nt[nt.length - 1]] }), output = added(nv, j.accessors[s.output].type, idx.length);
      const out = mode === 'STEP' ? { input, output, interpolation: 'STEP' } : { input, output }; done.set(key, out); return out;   // LINEAR is the default: no "interpolation" text on every sampler
    });
    const unique = [], at2 = new Map();   // samplers that read and write the same accessors are one
    an.channels.forEach((c) => { const s = an.samplers[c.sampler], id = `${s.input}/${s.output}`; if (!at2.has(id)) { at2.set(id, unique.length); unique.push(s); } c.sampler = at2.get(id); });
    an.samplers = unique;
  }
  for (const type of Object.keys(pools)) {
    if (!pools[type].length) continue;
    const view = push(Buffer.concat(pools[type]));
    for (const a of accessors) if (a.pool === type) { a.bufferView = view; delete a.pool; }
  }
  for (const m of j.meshes) for (const p of m.primitives) {
    for (const k of Object.keys(p.attributes)) p.attributes[k] = accMap.get(p.attributes[k]);
    if (p.indices !== undefined) p.indices = accMap.get(p.indices);
    for (const tg of p.targets || []) for (const k of Object.keys(tg)) tg[k] = accMap.get(tg[k]);
  }
  for (const s of j.skins || []) if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = accMap.get(s.inverseBindMatrices);
  j.accessors = accessors; j.bufferViews = views; j.buffers = [{ byteLength: at }];
  const json = Buffer.from(JSON.stringify(j)), jpad = (4 - (json.length % 4)) % 4, jsonChunk = Buffer.concat([json, Buffer.alloc(jpad, 0x20)]);
  const body = Buffer.concat(chunks), total = 12 + 8 + jsonChunk.length + 8 + body.length;
  const head = Buffer.alloc(20); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8); head.writeUInt32LE(jsonChunk.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  const binHead = Buffer.alloc(8); binHead.writeUInt32LE(body.length, 0); binHead.writeUInt32LE(0x004e4942, 4);
  return { glb: Buffer.concat([head, jsonChunk, binHead, body]), keysIn, keysOut, restDropped };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const args = process.argv.slice(2), flag = args.find((a) => a.startsWith('--keep=')), [input, output, eps = '1e-4'] = args.filter((a) => !a.startsWith('--'));
  if (!input || !output) throw new Error('usage: node scripts/reduce-anim-keys.mjs <in.glb> <out.glb> [eps] [--keep=Clip,Clip] [--drop-rest]');
  const { glb, keysIn, keysOut, restDropped } = reduceAnimKeys(fs.readFileSync(input), Number(eps), flag ? new Set(flag.slice(7).split(',')) : null, args.includes('--drop-rest'));
  fs.writeFileSync(output, glb);
  console.log(`${input}: ${keysIn} -> ${keysOut} keys (${(keysOut / keysIn * 100).toFixed(0)}%)${restDropped ? `, ${restDropped} never-moving bone tracks dropped` : ''}, ${fs.statSync(input).size} -> ${glb.length} B`);
}
