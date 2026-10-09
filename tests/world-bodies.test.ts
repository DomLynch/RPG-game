// The phone budget for every world body (public/world/<kind>.glb, what a zone draws; Lead 2026-10-09, Dom's phone black screen): at most ~8k triangles, ONE texture, the engine rig's joints and clip names.
// The boar's was 20,000 triangles (its engine file) until it was generated through scripts/character/world_body.py like the rest. A new world body over the ceiling fails here, not on Dom's phone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { CATALOGUE } from '../src/fight/catalogue-rows.ts';

const root = (p: string) => new URL(`../${p}`, import.meta.url);
function glb(path: string) {
  const b = readFileSync(root(path)), g = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  const tris = (g.meshes as { primitives: { indices?: number }[] }[]).flatMap((m) => m.primitives).reduce((n, p) => n + (p.indices === undefined ? 0 : g.accessors[p.indices].count / 3), 0);
  return { tris: Math.round(tris), images: (g.images ?? []).length, joints: g.skins?.[0]?.joints.length ?? 0, clips: ((g.animations ?? []) as { name: string }[]).map((a) => a.name).sort() };
}
const BODIES = readdirSync(root('public/world')).filter((f) => f.endsWith('.glb')).filter((f) => glb(`public/world/${f}`).joints > 0);   // the skinned bodies; the kit and town files are scenery

test('every skinned world body is at most 8,200 triangles with one texture', () => {
  assert.ok(BODIES.length >= 7, `the bodies found: ${BODIES.join(', ')}`);
  for (const f of BODIES) { const w = glb(`public/world/${f}`); assert.ok(w.tris <= 8200, `${f}: ${w.tris} tris`); assert.equal(w.images, 1, `${f}: one texture`); }
});

test('each world body carries its engine rig: the same joints and clip names, and the catalogue row points at it', () => {
  for (const row of CATALOGUE.filter((r) => r.world)) {
    const w = glb(row.world!.asset), e = glb(row.engine.asset);
    assert.equal(w.joints, e.joints, `${row.id}: joints`); assert.deepEqual(w.clips, [...e.clips].sort(), `${row.id}: clips`);
    assert.equal(w.tris, row.world!.tris, `${row.id}: the row's tri count`);
  }
  for (const f of BODIES) assert.ok(CATALOGUE.some((r) => r.world?.asset === `public/world/${f}`) || /^warrior/.test(f), `public/world/${f} has a catalogue row`);
});
