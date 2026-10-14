// The feel and look numbers of nine src/fight files as rows (Dom's data-layer rule), pinned to the values they held in code. Most of those files import three, so the rows are pinned from the data.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRegistry, tableFromFile, type Manifest } from '../src/core/registry.ts';
import raw from '../src/fight/feel-rules.json' with { type: 'json' };
import man from '../src/fight/feel-rules.manifest.json' with { type: 'json' };
import { BEAR_RENDER_SCALE, BOAR_RENDER_SCALE, WOLF_RENDER_SCALE } from '../src/fight/beast-scale.ts';
import { HAMSTRUNG_SOURCE_PELVIS } from '../src/fight/hamstrung.ts';
import { STANDOFF_MS } from '../src/fight/standoff.ts';

test('each row keeps the number the file held in code', () => {
  assert.deepEqual(raw.beastScaleRule, [{ id: 'beastScale', wolf: 2, boar: 1.8, bear: 2.2 }]);
  assert.deepEqual(raw.openedRule, [{ id: 'opened', chunk: 2048, stepMs: 8, scan: 100000 }]);
  assert.deepEqual(raw.hamstrungRule, [{ id: 'hamstrung', sourcePelvis: 0.95 }]);
  assert.deepEqual(raw.skillImpactRule, [{ id: 'skillImpact', flash: 0.12, flashSize: 0.9, sparks: 10, life: 0.4, reach: 0.28 }]);
  assert.deepEqual(raw.spellSchoolRule, [{ id: 'spellSchool', softFloor: 12 }]);
  assert.deepEqual(raw.standoffRule, [{ id: 'standoff', standoffMs: 800 }]);
  assert.deepEqual(raw.witchfireRule, [{ id: 'witchfire', pool: 200 }]);
  assert.deepEqual(raw.zoneFinisherRule, [{ id: 'zoneFinisher', headLife: 12, severAt: 0.05 }]);
  assert.deepEqual(raw.zoneFxRule, [{ id: 'zoneFx', idleS: 12 }]);
});

test('the pure modules export the row values', () => {
  assert.deepEqual([WOLF_RENDER_SCALE, BOAR_RENDER_SCALE, BEAR_RENDER_SCALE], [2, 1.8, 2.2]);
  assert.equal(HAMSTRUNG_SOURCE_PELVIS, 0.95);
  assert.equal(STANDOFF_MS, 800);
});

test('the rows file loads through the registry, one row per table', () => {
  assert.ok(loadRegistry(man.tables.map((t) => tableFromFile(t as unknown as Manifest, raw, 'feel-rules.json'))));
  for (const rows of Object.values(raw)) assert.equal(rows.length, 1);
});
