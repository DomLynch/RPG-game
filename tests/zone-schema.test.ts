// The zone schema (A1, docs/specs/origins/zone-schema.md): one field registry, defaults < biome < zone, versioned, unknown fields refused with the nearest known one. The five tests Strategy named.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadZone, zoneIds } from '../origins/zones/loader.ts';
import { badValue, overlayProblem, resolveSpec, resolveZone, wiredReport, nearest } from '../origins/zones/resolve.ts';
import { FIELDS, SCHEMA_VERSION, type Field } from '../origins/zones/schema.ts';

const folderZone = (id: string) => { const { resolved: _r, fields: _f, set: _s, ...own } = loadZone(id); return own as unknown as Record<string, unknown>; };
// A generated zone as new-zone.mjs will write it: a biome, a name, a level and nothing else.
const zone999 = { level: 999, name: 'Zone 999', biome: 'ash-wastes' };

test('1. ADD-A-FIELD: one new registry row with a default reaches Zone 1, Zone 2 and a generated zone 999 with zero edits to any zone', () => {
  const dummy: Field = { path: 'look.dummy.glow', kind: 'number', default: 0.5, group: 'look', wired: false, owner: 'World', min: 0, max: 1 };
  const fields = [...FIELDS, dummy];
  for (const [id, zone] of [['1', folderZone('1')], ['2', folderZone('2')], ['999', zone999]] as const) {
    const r = resolveZone(id, zone, { fields });
    assert.deepEqual(r.problems, [], `zone ${id}`); assert.equal(r.values['look.dummy.glow'], 0.5, `zone ${id} has the new field's default`);
    assert.equal(((r.tree.look as Record<string, Record<string, unknown>>).dummy)!.glow, 0.5);
  }
  assert.equal(resolveZone('1', { ...folderZone('1'), look: { dummy: { glow: 0.9 } } }, { fields }).values['look.dummy.glow'], 0.9, 'a zone overrides it');
  assert.equal(resolveZone('1', { ...folderZone('1'), look: { dummy: { glow: 2 } } }, { fields }).problems.length, 1, 'and a bad value is refused');
});

test('2. A zone written at schemaVersion 1 loads after a later schema version exists', () => {
  const v2: Field = { path: 'look.fog.colourName', kind: 'string', default: 'dust', group: 'look', wired: false, owner: 'World' };
  const old = { name: 'Old', level: 3, schemaVersion: 1, look: { fog: { colour: '#445566' } } };
  const r = resolveSpec(old, { fields: [...FIELDS, v2], version: 2, migrations: { 1: (s) => ({ ...s, look: { ...(s.look as object), fog: { ...((s.look as Record<string, object>).fog), colourName: 'slate' } } }) } });
  assert.deepEqual(r.problems, []); assert.equal(r.values['look.fog.colour'], '#445566'); assert.equal(r.values['look.fog.colourName'], 'slate', 'the v1->v2 step ran'); assert.equal(r.values.schemaVersion, 2);
  assert.ok(resolveSpec({ schemaVersion: 9 }).problems.some((p) => /newer than this build/.test(p)), 'a spec from the future is refused');
});

test('3. WIRED REPORT: what takes effect today, and what does not (the unwired count only goes down)', () => {
  const report = wiredReport();
  console.log(`zone schema: ${FIELDS.length} rows = ${report.wired.length} wired + ${report.unwired.length} unwired; wired fields (${report.wired.join(', ')}); unwired by owner: ${JSON.stringify(report.unwired.reduce<Record<string, number>>((m, u) => ({ ...m, [u.owner]: (m[u.owner] ?? 0) + 1 }), {}))}`);
  for (const w of ['name', 'level', 'spawns', 'kit', 'looks', 'camps']) assert.ok(report.wired.includes(w), `${w} is wired`);
  assert.ok(report.unwired.length > 0 && report.unwired.length <= 70, 'ratchet: wire fields, never add unwired ones without lowering this');
  assert.equal(FIELDS.length, new Set(FIELDS.map((f) => f.path)).size, 'one row per path');
  for (const f of FIELDS) assert.equal(badValue(f, f.default), null, `${f.path}: the default is a legal value of its own field`);
});

test('4. IDENTITY: Zone 1 and Zone 2 resolve with no problems, keep every view they had, and take only the biome\'s defaults for the new fields', () => {
  for (const id of zoneIds()) {
    const z = loadZone(id), r = z.resolved as Record<string, unknown>;
    assert.deepEqual(resolveZone(id, folderZone(id)).problems, [], `zone ${id}`);
    assert.equal(r.name, z.name); assert.equal(r.level, z.level); assert.deepEqual(r.looks, z.looks); assert.deepEqual(r.spawns, z.spawns); assert.deepEqual(r.kit, z.kit);
    assert.equal(((r.look as Record<string, Record<string, unknown>>).weather)!.preset, 'dust', 'the biome reaches the zone');
  }
  assert.equal(resolveZone('999', zone999).problems.length, 0); assert.equal(resolveZone('999', {}).values.name, 'Zone 999', 'a missing name is a placeholder, not an error');
});

test('5. A bad field is refused with its path and the nearest known field; the ?look= overlay uses the same refusal', () => {
  const r = resolveSpec({ look: { fogg: { density: 0.1 } } });
  assert.deepEqual(r.problems, ['zone: unknown field "look.fogg" (nearest: "look.fog")']);
  assert.equal(nearest('look.fog.densty'), 'look.fog.density');
  assert.match(resolveSpec({ look: { fog: { density: 'thick' } } }).problems[0]!, /look\.fog\.density must be a number/);
  assert.match(resolveSpec({ look: { fog: { colour: 'red' } } }).problems[0]!, /#rrggbb/);
  assert.match(resolveSpec({ pvp: 'maybe' }).problems[0]!, /one of off \| on \| opt-in/);
  assert.match(resolveSpec({ biome: 'moon' }).problems[0]!, /biome "moon" is not a preset/);
  assert.equal(overlayProblem('look.fog.density', 0.03), null); assert.match(overlayProblem('look.fog.densty', 0.03)!, /nearest: "look\.fog\.density"/); assert.match(overlayProblem('look.fog.density', 9)!, /above 1/);
});

test('terrain is a tagged union, one per zone, never both; weather is a reference with only intensity and probability to override', () => {
  assert.deepEqual(resolveSpec({ look: { terrain: { kind: 'generated', seed: 7, params: { hills: 2 } } } }).problems, []);
  assert.deepEqual(resolveSpec({ look: { terrain: { kind: 'heightmap', path: 'terrain.png' } } }).problems, []);
  assert.equal(resolveSpec({ look: { terrain: { kind: 'heightmap', path: 'a.png', seed: 1 } } }).problems.length, 1, 'both is refused');
  assert.equal(resolveSpec({ look: { terrain: { kind: 'generated', seed: 1 } } }).problems.length, 1);
  assert.equal(resolveSpec({ look: { weather: { preset: 'dust', intensity: 0.5, probability: 0.2 } } }).problems.length, 0);
  assert.match(resolveSpec({ look: { weather: { rainfall: 9 } } }).problems[0]!, /unknown field "look\.weather\.rainfall" \(nearest: "look\.weather/);
  assert.equal(SCHEMA_VERSION, 1);
});
