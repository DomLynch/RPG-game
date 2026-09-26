// The Pitborn's rag sash (scripts/character/parts.py `sash()`) is ONE band of cloth, from the left shoulder across the chest to the right
// hip. Until 2026-09-25 its "front only" cut was a plane 8 cm BEHIND the body's mid-plane, so the lumbar hollow of the tunic passed it too,
// and a separate 82-vertex scrap of linen rode the small of his back: pale on green skin, it read as a loose skin flap (Character Main's
// live audit, char/opponent-audit-0925). The check: the sash mesh is one connected piece, with vertices welded by position (a UV seam splits
// vertices without splitting the cloth).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function islands(file: string, node: string): number[] {
  const bytes = readFileSync(new URL(`../src/assets/${file}`, import.meta.url));
  const size = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + size).toString()), bin = 20 + size + 8;
  const n = json.nodes.find((x: { name?: string; mesh?: number }) => x.name === node && x.mesh !== undefined);
  assert.ok(n, `${file} has a "${node}" mesh`);
  const prim = json.meshes[n.mesh].primitives[0];
  assert.ok(!prim.extensions, `${node}: an uncompressed primitive (this check reads raw accessors)`);
  const view = (i: number) => { const a = json.accessors[i], v = json.bufferViews[a.bufferView]; return { a, at: bin + (v.byteOffset ?? 0) + (a.byteOffset ?? 0), stride: v.byteStride }; };
  const pos = view(prim.attributes.POSITION), idx = view(prim.indices), keys: string[] = [];
  for (let i = 0; i < pos.a.count; i++) {
    const o = pos.at + i * (pos.stride ?? 12);
    keys.push([0, 4, 8].map(k => Math.round(bytes.readFloatLE(o + k) * 1e5)).join(','));
  }
  const parent = keys.map((_, i) => i), root = (i: number): number => parent[i] === i ? i : (parent[i] = root(parent[i]));
  const first = new Map<string, number>();
  keys.forEach((k, i) => { const j = first.get(k); if (j === undefined) first.set(k, i); else parent[root(i)] = root(j); });
  const wide = idx.a.componentType === 5125, read = (t: number) => wide ? bytes.readUInt32LE(idx.at + t * 4) : bytes.readUInt16LE(idx.at + t * 2);
  for (let t = 0; t < idx.a.count; t += 3) { const [a, b, c] = [read(t), read(t + 1), read(t + 2)]; parent[root(b)] = root(a); parent[root(c)] = root(a); }
  const count = new Map<number, number>();
  keys.forEach((_, i) => count.set(root(i), (count.get(root(i)) ?? 0) + 1));
  return [...count.values()].sort((x, y) => y - x);
}

test('the Pitborn\'s rag sash is one piece of cloth: no stray scrap on his back', () => {
  const parts = islands('pitborn.glb', 'Gambeson');
  assert.equal(parts.length, 1, `the sash is ${parts.length} separate pieces (vertices per piece: ${parts.join(', ')})`);
});
