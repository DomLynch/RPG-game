// Reproducible review of actual pilot GLBs, using the existing frozen character harness.
// node scripts/character-pilots.mjs [--build] [--check] [--family wraith|minotaur]
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const dir = 'artifacts/character/pilots', args = process.argv.slice(2);
const only = args.includes('--family') ? args[args.indexOf('--family') + 1] : undefined;
assert(!only || ['wraith', 'minotaur'].includes(only), 'Unknown pilot family');
await fs.mkdir(dir, { recursive: true });
if (args.includes('--build') || !(await fs.stat(`${dir}/minotaur.glb`).catch(() => null))) {
  const run = spawnSync(process.env.BLENDER || 'blender', ['-b', '-P', 'scripts/character/pilots.py'], { encoding: 'utf8', timeout: 180000 });
  await fs.writeFile(`${dir}/build.log`, `${run.stdout ?? ''}\n${run.stderr ?? ''}`);
  assert.equal(run.status, 0, `Blender failed: ${run.error ?? run.stderr}`);
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function glb(raw) {
  const size = raw.readUInt32LE(12);
  return { doc: JSON.parse(raw.subarray(20, 20 + size)), bin: raw.subarray(28 + size) };
}
const generatorHash = digest(await fs.readFile('scripts/character/pilots.py'));
const receipts = [];
for (const [name, base] of [['wraith', 'nightborn'], ['minotaur', 'pitborn']]) {
  const original = await fs.readFile(`src/assets/${base}.glb`), output = await fs.readFile(`${dir}/${name}.glb`);
  const a = glb(original), b = glb(output);
  assert.equal(b.doc.extras.characterPilot.sourceSha256, digest(original), 'Pilot source became stale; rebuild');
  assert.equal(b.doc.extras.characterPilot.generatorSha256, generatorHash, 'Pilot generator became stale; rebuild');
  assert.deepEqual(b.bin.subarray(0, a.bin.length), a.bin, 'Original binary changed');
  for (const key of ['animations', 'skins', 'images', 'textures', 'samplers']) assert.deepEqual(b.doc[key], a.doc[key], key);
  assert.deepEqual(b.doc.accessors.slice(0, a.doc.accessors.length), a.doc.accessors);
  for (const [i, node] of a.doc.nodes.entries()) {
    // The only permitted old-node edit is hiding a replaced art mesh.
    const before = { ...node }, after = { ...b.doc.nodes[i] };
    if ('mesh' in before && !('mesh' in after)) {
      assert((name === 'wraith' ? ['Ruby'] : ['Face', 'Photo', 'PhotoEyes', 'PhotoTeeth', 'Bone', 'BoneWorn']).includes(node.name), 'Only replaced art may be hidden');
      delete before.mesh; delete before.skin;
    }
    if (before.children) after.children = after.children.filter(n => n < a.doc.nodes.length);
    assert.deepEqual(after, before, `Original node ${node.name ?? i} changed`);
  }
  const faceMesh = a.doc.nodes.find(n => n.name === 'Photo').mesh;
  for (const [i, mesh] of a.doc.meshes.entries()) {
    if (name === 'wraith' && i === faceMesh) {
      const before = structuredClone(mesh), after = structuredClone(b.doc.meshes[i]);
      for (const [j, p] of before.primitives.entries()) {
        delete p.indices; delete after.primitives[j].indices;
        for (const key of ['POSITION', 'NORMAL']) { delete p.attributes[key]; delete after.primitives[j].attributes[key]; }
      }
      assert.deepEqual(after, before, 'Face UVs and skin weights preserved');
    } else assert.deepEqual(b.doc.meshes[i], mesh, `Original mesh ${i} changed`);
  }
  let addedTriangles = 0;
  for (const node of b.doc.nodes.filter(n => n.extras?.pilot)) {
    const p = b.doc.meshes[node.mesh].primitives[0];
    addedTriangles += b.doc.accessors[p.indices].count / 3;
    for (const key of ['POSITION', 'NORMAL', 'WEIGHTS_0']) {
      const ac = b.doc.accessors[p.attributes[key]], view = b.doc.bufferViews[ac.bufferView], width = key === 'WEIGHTS_0' ? 4 : 3;
      for (let i = 0; i < ac.count; i++) {
        let sum = 0;
        for (let c = 0; c < width; c++) { const v = b.bin.readFloatLE(view.byteOffset + (i * width + c) * 4); assert(Number.isFinite(v)); sum += v; if (key === 'WEIGHTS_0') assert(v >= 0 && v <= 1); }
        if (key === 'WEIGHTS_0') assert(Math.abs(sum - 1) < 1e-5, 'Unnormalized skin weights');
      }
    }
  }
  const visibleMeshes = new Set(b.doc.nodes.filter(n => n.mesh !== undefined).map(n => n.mesh));
  const totalTriangles = [...visibleMeshes].reduce((sum, i) => sum + b.doc.meshes[i].primitives.reduce((n, p) => n + b.doc.accessors[p.indices ?? p.attributes.POSITION].count / 3, 0), 0);
  assert(totalTriangles < 60000, `${name}: ${totalTriangles} triangles exceeds the existing 60k ceiling`);
  receipts.push({ name, base, sha256: digest(output), bytes: output.length, addedTriangles, totalTriangles, addedDraws: b.doc.nodes.filter(n => n.extras?.pilot).length, animationsPreserved: a.doc.animations.length, originalBinaryPreserved: true });
}
if (!args.includes('--check')) {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
    for (const { name } of receipts.filter(r => !only || r.name === only)) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }), errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`${r.status()} ${r.url()}`); });
      await page.goto(`${server.resolvedUrls.local[0]}character-preview.html?enemy=/artifacts/character/pilots/${name}.glb`);
      await page.waitForFunction(() => window.__preview?.loaded || window.__preview?.error, null, { timeout: 90000 });
      assert.equal(await page.evaluate(() => window.__preview.error), null);
      const save = async (file, data) => fs.writeFile(`${dir}/${name}-${file}.png`, Buffer.from(data.split(',')[1], 'base64'));
      const headDistance = name === 'minotaur' ? 1.85 : 1.1;
      const views = [['front', 0], ['three-quarter', .7], ['profile', 1.57], ['rear', Math.PI]];
      await save('head', await page.evaluate(([views, distance]) => __preview.details(views.map(([n, az]) => [n, 'Armed', 0, 'Head', distance, az, .08, [0, .11, .03]]), 'opponent'), [views, headDistance]));
      await save('body', await page.evaluate(views => __preview.details(views.map(([n, az]) => [n, 'Armed', 0, 'pelvis', 4.9, az, 0, [0, .12, 0]]), 'opponent'), views));
      await save('poses', await page.evaluate(() => __preview.details([['guard', 'Guard', .5], ['heavy preparation', 'Heavy', .2], ['heavy contact', 'Heavy', .48], ['roll', 'Roll', .4], ['walk', 'ArmedWalk', .3], ['hit', 'Hit', .35], ['death', 'Death', .6], ['death settled', 'Death', .99]].map(([n,c,t]) => [n,c,t,'pelvis',4.9,.6,.08,[0,.12,0]]), 'opponent')));
      for (const orientation of ['portrait', 'landscape']) await save(orientation, await page.evaluate(o => __preview.lockStill(o, 'ready'), orientation));
      assert.deepEqual(errors, [], 'Browser errors');
      await page.close();
      console.log(`Captured ${name}: head, body, poses, portrait, landscape`);
    }
  } finally { await browser?.close(); await server.close(); }
}
await fs.writeFile(`${dir}/integrity.json`, JSON.stringify(receipts, null, 2));
console.log(JSON.stringify(receipts));
