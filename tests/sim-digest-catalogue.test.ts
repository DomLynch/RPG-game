// The sim digest reads the catalogue through its DEFINITIONS (tests/lib/sim-digest.ts): a field flagged sim: false never reaches the digest, a sim field does, and where a value lives (a row's own key or its
// `fields` map) does not matter. Synthetic rows and definitions, so the properties do not depend on today's data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { simDigest } from './lib/sim-digest.ts';

const ROWS = (row: string) => `const CATALOGUE_ROWS = [ ${row} ] as const;\nexport default CATALOGUE_ROWS;\n`;
const DEFS = (fields: string) => `const CATALOGUE_DEFS = { fields: [ ${fields} ], rigs: [ { id: "hero" } ] } as const;\nexport default CATALOGUE_DEFS;\n`;
const A = '{ id: "a", name: "A", rig: "hero", stats: { archetype: "x", levels: [1, 5] }, finisher: {}, blood: {}, ladder: { order: 1, hold: false }, weapon: "trident", voice: null }';
const W = { id: '"weapon"', def: '{ id: "weapon", kind: "ref", of: "weapons", required: true, sim: true }' };
const files = (row: string, fields = W.def) => ({ 'src/fight/catalogue-data.ts': ROWS(row), 'src/fight/catalogue-defs.ts': DEFS(fields) });
const base = simDigest(files(A));

test('moving a sim field under the row\'s `fields` map does not move the digest', () => {
  const moved = A.replace(', weapon: "trident"', ', fields: { weapon: "trident" }');
  assert.notEqual(moved, A);
  assert.equal(simDigest(files(moved)), base);
});
test('a new cosmetic field (sim: false), its definition and its values, does not move the digest', () => {
  const cosmetic = '{ id: "banner", kind: "ref", of: "banners", sim: false }';
  assert.equal(simDigest(files(A.replace('voice: null', 'voice: null, fields: { banner: "red" }'), `${W.def}, ${cosmetic}`)), base);
  assert.equal(simDigest(files(A.replace('name: "A"', 'name: "Renamed"'))), base, 'a rename is not the fight');
  const withCosmeticValue = (v: string) => simDigest(files(A.replace('voice: null', `voice: null, fields: { banner: "${v}" }`), `${W.def}, ${cosmetic}`));
  assert.equal(withCosmeticValue('blue'), withCosmeticValue('red'), 'a cosmetic value changing is not the fight');
});
test('a new sim field, or a changed sim value, moves the digest', () => {
  const intelligence = '{ id: "intelligence", kind: "number", min: 0, max: 100, sim: true }';
  assert.notEqual(simDigest(files(A, `${W.def}, ${intelligence}`)), base, 'a new sim field definition is the fight');
  const withInt = (n: number) => simDigest(files(A.replace('voice: null', `voice: null, fields: { intelligence: ${n} }`), `${W.def}, ${intelligence}`));
  assert.notEqual(withInt(10), withInt(11), 'a sim value changing is the fight');
  assert.notEqual(simDigest(files(A.replace('"trident"', '"cleaver"'))), base, 'the weapon is the fight');
  assert.notEqual(simDigest(files(A, W.def.replace('sim: true', 'sim: false'))), base, 'flipping a definition from sim to cosmetic is a change the guard must see');
  assert.notEqual(simDigest(files(A, W.def.replace(', sim: true', ''))), simDigest(files(A, W.def.replace('sim: true', 'sim: false'))), 'a missing flag counts as sim (fail closed)');
});
test('row order and variant rows: a roster row added moves the digest, a variant row (a body key) does not', () => {
  const b = '{ id: "b", name: "B", rig: "hero", stats: { archetype: "x", levels: [1, 5] }, finisher: {}, blood: {}, ladder: { order: 2, hold: false }, weapon: "trident", voice: null }';
  assert.notEqual(simDigest(files(`${A}, ${b}`)), base);
  assert.equal(simDigest(files(`${A}, { id: "ember", body: "a", name: "Ember", weapon: "cleaver" }`)), base);
});

test('pool definitions reach the digest as their sim rows: a sim: false pool, added or edited, does not move it; a sim pool or a changed sim default does', () => {
  const pools = (rows: string) => `{ "about": "x", "pools": [ ${rows} ] }`;
  const H = '{ "id": "health", "default": 150, "min": 1, "sim": true }', S = '{ "id": "stamina", "default": 100, "min": 1, "sim": true }', M = '{ "id": "mana", "default": 0, "min": 0, "sim": false }';
  const d = (rows: string) => simDigest({ ...files(A), 'src/fight/pool-defs.json': pools(rows) });
  const base = d(`${H}, ${S}, ${M}`);
  assert.equal(d(`${H}, ${S}, ${M.replace('"default": 0', '"default": 7')}`), base, 'a sim: false default is not the fight');
  assert.equal(d(`${H}, ${S}, ${M}, { "id": "intelligence", "default": 10, "min": 0, "max": 100, "sim": false }`), base, 'a new data-only pool is one row and moves nothing');
  assert.equal(d(`${S}, ${M}, ${H}`), base, 'row order is not the fight');
  assert.notEqual(d(`${H}, ${S.replace('100', '120')}, ${M}`), base, 'stamina\'s default is the fight');
  assert.notEqual(d(`${H}, ${S}, ${M}, { "id": "rage", "default": 0, "min": 0, "sim": true }`), base, 'a new sim pool is the fight');
  assert.notEqual(d(`${H}, ${S}, ${M.replace('"sim": false', '"sim": true')}`), base, 'flipping a pool to sim is a change the guard sees');
  assert.notEqual(d(`${H}, ${S}, ${M.replace(', "sim": false', '')}`), base, 'a missing sim flag counts as sim (fail closed)');
});
