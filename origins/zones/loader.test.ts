import assert from 'node:assert/strict';
import test from 'node:test';
import { loadZone, pageZoneId, zoneFromAddress, zoneIds, zoneProblems, type Zone } from './loader.ts';

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

test('a page address names its zone: /zone/<id>/ or ?zone=<id>, else Zone 1; zoneIds lists every package', () => {
  assert.deepEqual(zoneIds(), ['1', '2']);
  assert.equal(zoneFromAddress('/zone1/', ''), '1');
  assert.equal(zoneFromAddress('/preview/origins/', '?region=1'), '1');
  assert.equal(zoneFromAddress('/zone/2/', ''), '2');
  assert.equal(zoneFromAddress('/zone/2', '?zone=3'), '2', 'the path wins');
  assert.equal(zoneFromAddress('/zone1/', '?zone=2&x=1'), '2');
  assert.equal(pageZoneId(), '1', 'no page (the server, the tests): Zone 1');
  assert.throws(() => loadZone(zoneFromAddress('/zone/99/', '')), /no zone 99/);
});

test('Zone 2 loads: level 2, six rows of [2, 3], the opener a row, its own looks', () => {
  const z = loadZone('2');
  assert.equal(z.id, '2'); assert.equal(z.level, 2); assert.equal(z.spawns.rows.length, 6);
  assert.deepEqual(zoneProblems(z), []);
  assert.equal(z.spawns.openers['ash-reach'], 'character:ash-wolf');
  assert.notEqual(z.looks['frontier-haze']!.fog, loadZone('1').looks['frontier-haze']!.fog, 'its own haze');
  assert.deepEqual(Object.keys(z.looks), Object.keys(loadZone('1').looks), 'the preset names the page asks for');
});
