// Fame x karma titles: the table loads through the shared loader, forms a full grid, every cell cites a legend-style source, and the resolver is a pure function of (fame, karma).
import assert from 'node:assert/strict';
import test from 'node:test';
import { TITLE_ROWS, titleFor, titleRowFor, type TitleRow } from '../src/fight/titles.ts';
import { loadRegistry, tableFromFile } from '../src/core/registry.ts';
import MANIFEST from '../src/fight/title-rows.manifest.json' with { type: 'json' };
import TITLES from '../src/fight/title-rows.json' with { type: 'json' };

const FAMES = [...new Set(TITLE_ROWS.map((r) => r.fameFloor))].sort((a, b) => a - b);
const KARMAS = [...new Set(TITLE_ROWS.map((r) => r.karmaFloor))].sort((a, b) => a - b);

test('titles: a full grid, one row per (fame band, karma band), keys unique', () => {
  assert.equal(TITLE_ROWS.length, FAMES.length * KARMAS.length);
  assert.deepEqual([FAMES.length, KARMAS.length], [5, 11]);
  for (const f of FAMES) for (const k of KARMAS) assert.equal(TITLE_ROWS.filter((r) => r.fameFloor === f && r.karmaFloor === k).length, 1, `cell ${f}/${k}`);
  assert.equal(new Set(TITLE_ROWS.map((r) => r.id)).size, TITLE_ROWS.length);
});

test('titles: bands ascend from zero fame and span negative to positive karma', () => {
  assert.equal(FAMES[0], 0);
  assert.ok(KARMAS[0]! < 0 && KARMAS[KARMAS.length - 1]! > 0);
});

test('titles: every non-empty title is unique and every row cites a source (legends-rule)', () => {
  const texts = TITLE_ROWS.filter((r) => r.text !== '').map((r) => r.text);
  assert.equal(new Set(texts).size, texts.length);
  for (const r of TITLE_ROWS) assert.ok(r.source.length >= 8, `${r.id} source`);
  assert.equal(TITLE_ROWS.filter((r) => r.text === '').length, 1, 'only the neutral lowest-fame cell is untitled');
});

test('titles: no scripture of a living religion as a source (legends-rule)', () => {
  for (const r of TITLE_ROWS) assert.doesNotMatch(r.source, /bible|testament|quran|koran|vedas?\b|torah|gospel|psalm/i, r.id);
});

test('titles: the resolver picks the highest fame band then the highest karma band at or below the values', () => {
  const row = (fame: number, karma: number): TitleRow => titleRowFor(fame, karma)!;
  assert.deepEqual([row(0, 0).fameFloor, row(0, 0).karmaFloor], [0, -625]);
  assert.deepEqual([row(1249, 0).fameFloor, row(1250, 0).fameFloor], [0, 1250]);
  assert.deepEqual([row(15000, 15000).fameFloor, row(15000, 15000).karmaFloor], [10000, 10000]);
  assert.equal(row(15000, 15000).text, 'the Great');
  assert.equal(row(15000, -15000).text, 'the Impaler');
  assert.equal(row(5000, 624).karmaFloor, -625);
  assert.equal(row(5000, 625).karmaFloor, 625);
});

test('titles: values past the table edges clamp to the nearest cell, and the neutral newcomer has no title', () => {
  assert.equal(titleRowFor(-5, -99999)!.karmaFloor, KARMAS[0]);
  assert.equal(titleFor(0, 0), '');
  assert.equal(titleFor(99999, 99999), 'the Great');
});

test('titles: a bad row is refused by the loader (missing source)', () => {
  const bad = { titles: [{ id: 'x', fameFloor: 0, karmaFloor: 0, text: 't' }] };
  assert.throws(() => loadRegistry([tableFromFile(MANIFEST.tables[0] as never, bad, 'bad.json')]));
  loadRegistry([tableFromFile(MANIFEST.tables[0] as never, TITLES, 'title-rows.json')]);
});
