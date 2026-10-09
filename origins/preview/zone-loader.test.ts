import assert from 'node:assert/strict';
import test from 'node:test';
import { loadZone, zoneProblems, type Zone } from './zone-loader.ts';
// The import ban and the data-only lint live in tests/zone-packages.test.ts (AST-based, with negative controls).

type Mut<T> = T extends readonly (infer U)[] ? Mut<U>[] : T extends object ? { -readonly [K in keyof T]: Mut<T[K]> } : T;
const clone = (z: Zone): Mut<Zone> => JSON.parse(JSON.stringify(z));

test('Zone 1 loads: level 1, six rows of [1, 2], every opener a row, the kit and looks valid', () => {
  const z = loadZone();
  assert.equal(z.id, '1'); assert.equal(z.level, 1); assert.equal(z.spawns.rows.length, 6);
  assert.deepEqual(zoneProblems(z), []);
  assert.equal(loadZone('1'), z, 'cached: the same package');
  assert.throws(() => loadZone('99'), /no zone 99/);
});

test('the validator names each way a package can be wrong', () => {
  const z = loadZone(), edit = (f: (c: Mut<Zone>) => void) => { const c = clone(z); f(c); return zoneProblems(c as unknown as Zone).join('|'); };
  assert.match(edit((c) => { c.spawns.rows[1]!.id = c.spawns.rows[0]!.id; }), /duplicate row/);
  assert.match(edit((c) => { c.spawns.rows[0]!.level = [2, 3]; }), /not the zone rule 1-2/);
  assert.match(edit((c) => { c.spawns.openers['x'] = 'character:nobody'; }), /not a row/);
  assert.match(edit((c) => { c.kit.kinds[0]!.nodes = ['no_such_node']; }), /not a kit node/);
  assert.match(edit((c) => { c.kit.landmarks.push(c.kit.nodes[0]!); }), /both a node and a landmark/);
  assert.match(edit((c) => { c.kit.url = '/elsewhere.glb'; }), /kit url/);
  assert.match(edit((c) => { c.looks['frontier-haze']!.fog = 'red'; }), /not #rrggbb/);
  assert.match(edit((c) => { c.looks['frontier-haze']!.exposure = 9; }), /out of range/);
});
