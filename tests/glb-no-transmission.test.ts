// No shipped GLB may use KHR_materials_transmission (Executioner L8/L9 ruby, 2026-10-01). three.js draws the whole opaque scene a second time
// into a render target as soon as one transmissive material is on screen (+45 draws, +135k tris, +4 framebuffer binds every frame on L9), and
// the first such frame compiles ~19 programs the warm-up never saw: a 100-135 ms swap frame on the Mac (rank-look-check row 4, L8/L9 FAIL, L10 PASS).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

// The files that still ship it, until Armour's re-issue lands (L10's ruby is plain PBR). Shrink-only: delete the entries when that PR is live,
// never add one.
const KNOWN = new Set(['looks/executioner-L8.glb', 'looks/executioner-L8-phone.glb', 'looks/executioner-L9.glb', 'looks/executioner-L9-phone.glb']);

const glbs = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? glbs(path.join(dir, e.name)) : e.name.endsWith('.glb') ? [path.join(dir, e.name)] : []));

// A GLB's JSON chunk starts at byte 20 (12-byte header, 8-byte chunk header); the materials never sit in the BIN chunk.
const transmissive = (file: string): string[] => {
  const b = fs.readFileSync(file), json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()) as { materials?: { name?: string; extensions?: Record<string, unknown> }[] };
  return (json.materials ?? []).filter((m) => m.extensions?.KHR_materials_transmission).map((m) => m.name ?? '(unnamed)');
};

test('no shipped GLB uses KHR_materials_transmission, apart from the known Executioner L8/L9 files', () => {
  const root = path.resolve(import.meta.dirname, '../public'), files = glbs(root);
  assert.ok(files.length > 100, `scanned ${files.length} GLBs under public/`);
  const bad = files.map((f) => [path.relative(root, f), transmissive(f)] as const).filter(([f, m]) => m.length && !KNOWN.has(f));
  assert.deepEqual(bad.map(([f, m]) => `${f}: ${m.join(', ')}`), [], 'a transmissive material costs a second scene pass every frame on a phone: use clearcoat/emissive instead');
});
