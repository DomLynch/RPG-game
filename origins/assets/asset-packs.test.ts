// Asset-pack manifest: CC0 only, every link is https, every target is a live creature, landmark or zone.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadRegistry, tableFromFile, type Manifest } from '../../src/core/registry.ts';

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
type Pack = { pageUrl: string; licence: string; licenceUrl: string; licenceEvidence: string; status: string; files: { name: string; url: string; bytes: number | null; note?: string }[] };
type Need = { kind: string; target: string; packs: string[] };
type Zone = { spawns: { rows: { id?: string; character?: string }[] }; kit: { landmarks: string[] } };
const DATA = read('./asset-packs.json') as { packs: Record<string, Pack>; needs: Record<string, Need> };
const MANIFEST = read('./asset-packs.manifest.json') as { tables: Manifest[] };
const zones = [1, 2, 3, 4].map((n) => read(`../zone-rows/zone${n}.row.json`) as Zone);

test('asset packs: rows load with the shared loader and every ref resolves', () => {
  const reg = loadRegistry(MANIFEST.tables.map((m) => tableFromFile(m, DATA)));
  assert.ok(reg);
});

test('asset packs: every pack that can be pulled is CC0 with an https licence link and https files', () => {
  for (const [id, p] of Object.entries(DATA.packs)) {
    assert.ok(p.pageUrl.startsWith('https://'), id);
    assert.ok(p.licenceUrl.startsWith('https://'), id);
    assert.ok(p.licenceEvidence.length > 20, `${id}: say where the licence was read`);
    if (p.status === 'listed') {
      assert.equal(p.licence, 'CC0-1.0', `${id}: only CC0 or public domain may be listed`);
      assert.ok(p.files.length >= 1, `${id}: list its files`);
    } else assert.equal(p.status, 'hold-licence');
    for (const f of p.files) {
      assert.ok(f.url.startsWith('https://'), `${id}/${f.name}`);
      assert.ok(f.bytes === null ? typeof f.note === 'string' : Number.isInteger(f.bytes) && f.bytes > 0, `${id}/${f.name}: a size, or a null with a note why`);
    }
  }
});

test('asset packs: a held pack is never named by a need without a listed pack beside it', () => {
  for (const [id, n] of Object.entries(DATA.needs)) {
    assert.ok(n.packs.some((p) => DATA.packs[p].status === 'listed'), `${id}: needs at least one pullable pack`);
  }
});

test('asset packs: creature, landmark and zone targets are live ids', () => {
  const chars = new Set(zones.flatMap((z) => z.spawns.rows.map((r) => String(r.id ?? r.character))));
  const marks = new Set(zones.flatMap((z) => z.kit.landmarks));
  const zoneIds = new Set(['zone1', 'zone2', 'zone3', 'zone4']);
  for (const [id, n] of Object.entries(DATA.needs)) {
    if (n.kind === 'creature-kit') assert.ok(chars.has(n.target), `${id}: ${n.target} is not a spawn`);
    if (n.kind === 'map-tile') assert.ok(zoneIds.has(n.target), `${id}: ${n.target} is not a zone`);
    if (n.kind === 'prop' && n.target.startsWith('landmark_')) assert.ok(marks.has(n.target), `${id}: ${n.target} is not a landmark`);
  }
  for (const z of zoneIds) assert.ok(Object.values(DATA.needs).some((n) => n.target === z), `${z} has no map tile need`);
});
