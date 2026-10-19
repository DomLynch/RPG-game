// Measure the creature bodies for the height ladder (origins/zones/height-ladder.json, `bodies`): each GLB's rest-pose bounds from three's loader, in metres at scale 1: heightM = the y extent, lengthM = the longer of the
// x and z extents (the biggest horizontal dimension; the rest pose may have the arms out, so a humanoid's length is its arm span). The row also pins the GLB's sha256, which the unit test compares, so a changed body
// fails until this script is run again.
//   node scripts/body-heights.mjs            rewrite the `bodies` rows from the GLBs (ids = the rows already in the file; add an id there first)
//   node scripts/body-heights.mjs --check    exit 1 when any row differs from the GLB (the numbers to the millimetre, or the hash)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url)), FILE = join(ROOT, 'origins/zones/height-ladder.json');
globalThis.self = globalThis;   // three's loader looks for `self`; the texture warnings it prints are about the images, which are not measured

async function measure(row) {
  const buf = readFileSync(join(ROOT, 'public', row.glb)), ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await new Promise((ok, no) => loader.parse(ab, '', ok, no));
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => { if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); } });
  const size = new THREE.Box3().setFromObject(gltf.scene, true).getSize(new THREE.Vector3());
  return { ...row, heightM: +size.y.toFixed(3), lengthM: +Math.max(size.x, size.z).toFixed(3), sha256: createHash('sha256').update(buf).digest('hex') };
}

const defs = JSON.parse(readFileSync(FILE, 'utf8')), measured = [];
for (const row of defs.bodies) measured.push(await measure(row));
const differs = measured.filter((m, i) => JSON.stringify(m) !== JSON.stringify(defs.bodies[i]));
if (process.argv.includes('--check')) {
  for (const m of differs) console.error(`body-heights: ${m.id} differs from its GLB (${m.heightM} m high, ${m.lengthM} m long, sha ${m.sha256.slice(0, 12)})`);
  console.log(differs.length ? `body-heights: ${differs.length} row(s) stale: run node scripts/body-heights.mjs` : `body-heights: ${measured.length} bodies match their GLBs`);
  process.exit(differs.length ? 1 : 0);
}
defs.bodies = measured;
const text = JSON.stringify(defs, null, 2).replace(/\{\n\s+"id": "([^"]+)",\n\s+"heightM": ([^,]+),\n\s+"lengthM": ([^,]+),\n\s+"glb": "([^"]+)",\n\s+"sha256": "([^"]+)"\n\s+\}/g, '{ "id": "$1", "heightM": $2, "lengthM": $3, "glb": "$4", "sha256": "$5" }');
writeFileSync(FILE, `${text}\n`);
console.log(`body-heights: wrote ${measured.length} bodies (${differs.length} changed)`);
