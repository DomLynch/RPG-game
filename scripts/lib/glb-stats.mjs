// Reads a GLB's JSON and counts what a phone pays for (Characters 2026-10-09; the Auditor's MEDIUM on the phone-budget tests: they counted triangles only on INDEXED primitives, so a
// non-indexed mesh read as zero and slipped under any ceiling). One helper for every budget test and script: an indexed primitive is index count / 3, a non-indexed one is its POSITION
// count / 3 (glTF: no `indices` means the vertices are drawn in order); strips and fans count their own triangles; points and lines are not triangles.
import fs from 'node:fs';

/** @param {{ meshes?: { primitives: { indices?: number; attributes: { POSITION: number }; mode?: number }[] }[]; accessors: { count: number }[] }} json */
export function trianglesOf(json) {
  let total = 0;
  for (const mesh of json.meshes ?? []) for (const p of mesh.primitives) {
    const mode = p.mode ?? 4, count = json.accessors[p.indices !== undefined ? p.indices : p.attributes.POSITION].count;
    total += mode === 4 ? count / 3 : mode === 5 || mode === 6 ? Math.max(0, count - 2) : 0;
  }
  return Math.round(total);
}

/** The JSON chunk of a .glb file. */
export function glbJson(path) {
  const bytes = fs.readFileSync(path);
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
}

/** What the budget tests and the catalogue read from a GLB: triangles, textures, the first skin's joints, the clip names, the file size. */
export function glbStats(path) {
  const json = glbJson(path), skin = json.skins?.[0];
  return {
    bytes: fs.statSync(path).size, tris: trianglesOf(json), images: (json.images ?? []).length,
    jointNames: new Set((json.skins ?? []).flatMap((s) => s.joints.map((i) => json.nodes[i].name))), joints: skin ? skin.joints.length : 0,
    clips: (json.animations ?? []).map((a) => a.name),
  };
}
