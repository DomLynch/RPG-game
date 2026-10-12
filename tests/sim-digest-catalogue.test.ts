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
