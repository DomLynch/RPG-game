// World's Pit intake #2 (Lead's gate ruling, 2026-09-30): GPT's gate.glb is ONE fused mesh, but the live gate opens on foot, so the iron has
// to be a node of its own. This splits it into two nodes, both at rest exactly where the fused mesh drew them:
//   gate-arch : the stone frame, static, identity transform, base-centre origin (as GPT exported it)
//   gate-bars : the nine bars, the two cross rails and the rivet collars, ONE movable node whose origin is the bars' BASE (bottom centre),
//               so a rotation or a lift about the node's own origin is a gate opening. Its vertices are stored relative to that origin.
// The two are told apart by geometry, not by a name GPT never kept: the mesh is 52 disjoint pieces (gate.blend's objects, joined on export).
// Every stone block is ~0.5 m deep; every iron piece is under 0.1 m deep. Nothing is rebuilt: same vertices, same UVs, same one material.
// Needs @gltf-transform/core + extensions (see scripts/pit-ship.mjs).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const IRON_DEPTH = 0.2;   // metres: a piece thinner than this in z is iron; the frame's blocks are 0.46 m and up

export async function splitGate(inputPath, outputPath) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(inputPath), root = doc.getRoot();
  const [mesh] = root.listMeshes(), [prim] = mesh.listPrimitives();
  if (root.listMeshes().length !== 1 || mesh.listPrimitives().length !== 1) throw new Error('gate split: expects the fused one-mesh, one-primitive gate');
  const position = prim.getAttribute('POSITION'), index = prim.getIndices().getArray(), count = position.getCount();
  const P = Array.from({ length: count }, (_, v) => position.getElement(v, []));

  // Pieces = connected components over vertices welded by position (the export duplicates a vertex per UV/normal seam).
  const weld = new Map(), parent = [], wid = new Int32Array(count);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let v = 0; v < count; v++) {
    const key = P[v].map((c) => Math.round(c * 1e4)).join(',');
    if (!weld.has(key)) { weld.set(key, parent.length); parent.push(parent.length); }
    wid[v] = weld.get(key);
  }
  for (let t = 0; t < index.length; t += 3) { const a = find(wid[index[t]]); parent[find(wid[index[t + 1]])] = a; parent[find(wid[index[t + 2]])] = a; }
  const pieces = new Map();   // root → { tris: number[], minZ, maxZ }
  for (let t = 0; t < index.length; t += 3) {
    const r = find(wid[index[t]]); let piece = pieces.get(r);
    if (!piece) pieces.set(r, piece = { tris: [], minZ: Infinity, maxZ: -Infinity });
    piece.tris.push(t);
    for (let k = 0; k < 3; k++) { const z = P[index[t + k]][2]; piece.minZ = Math.min(piece.minZ, z); piece.maxZ = Math.max(piece.maxZ, z); }
  }
  const iron = [], stone = [];   // triangle start offsets into the index list
  for (const piece of pieces.values()) (piece.maxZ - piece.minZ < IRON_DEPTH ? iron : stone).push(...piece.tris);
  if (!iron.length || !stone.length) throw new Error(`gate split: ${iron.length} iron / ${stone.length} stone triangles, expected both`);
  if ((iron.length + stone.length) * 3 !== index.length) throw new Error('gate split: triangles lost');

  // The bars' base: bottom centre of the iron's bounding box (x centred, y its lowest point, z the middle of its depth).
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const t of iron) for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) { const c = P[index[t + k]][a]; min[a] = Math.min(min[a], c); max[a] = Math.max(max[a], c); }
  const pivot = [+((min[0] + max[0]) / 2).toFixed(4), +min[1].toFixed(4), +((min[2] + max[2]) / 2).toFixed(4)];

  const material = prim.getMaterial();
  const build = (name, tris, origin) => {
    const remap = new Map(), used = [];
    const compact = new (count < 65536 ? Uint16Array : Uint32Array)(tris.length * 3);
    tris.forEach((t, n) => { for (let k = 0; k < 3; k++) { const v = index[t + k]; if (!remap.has(v)) { remap.set(v, used.length); used.push(v); } compact[n * 3 + k] = remap.get(v); } });
    const out = doc.createPrimitive().setMaterial(material).setIndices(doc.createAccessor().setType('SCALAR').setArray(compact));
    for (const semantic of prim.listSemantics()) {
      const src = prim.getAttribute(semantic), size = src.getElementSize(), array = new (src.getArray().constructor)(used.length * size), el = [];
      used.forEach((v, n) => { src.getElement(v, el); for (let k = 0; k < size; k++) array[n * size + k] = el[k] - (semantic === 'POSITION' ? origin[k] : 0); });
      out.setAttribute(semantic, doc.createAccessor().setType(src.getType()).setArray(array).setNormalized(src.getNormalized()));
    }
    return doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(out)).setTranslation(origin);
  };
  const node = root.listNodes()[0], scene = root.listScenes()[0];
  const arch = build('gate-arch', stone, [0, 0, 0]), bars = build('gate-bars', iron, pivot);
  arch.setExtras(node.getExtras());
  scene.removeChild(node); node.dispose(); mesh.dispose(); prim.dispose();
  scene.addChild(arch); scene.addChild(bars);
  await io.write(outputPath, doc);
  return { archTris: stone.length, barsTris: iron.length, pieces: pieces.size, pivot };
}

if (process.argv[1]?.endsWith('pit-gate-split.mjs')) {
  const [input, output] = process.argv.slice(2);
  console.log(JSON.stringify(await splitGate(input, output)));
}
