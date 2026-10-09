import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { frontierPlan, FRONTIER } from '../preview/frontier-plan.ts';
import { frontierBuild } from '../preview/frontier-plan.ts';
import { mobSpecs } from '../preview/mobs.ts';
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

test('nothing outside the loader imports a zone package (origins/zones/**)', () => {
  const root = path.resolve(import.meta.dirname, '..'), offenders: string[] = [];
  const walk = (dir: string) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'zones' && e.name !== 'node_modules') walk(p); continue; }
    if (!/\.(ts|mjs)$/.test(e.name) || e.name === 'loader.ts' || e.name === 'loader.test.ts') continue;
    if (/from\s+['"][^'"]*\/zones\/zone\d+\//.test(fs.readFileSync(p, 'utf8'))) offenders.push(path.relative(root, p));
  } };
  walk(root);
  assert.deepEqual(offenders, [], 'read a zone through loadZone(), not its files');
});

test('a zone data file is pure data: only type imports, no function, class or loop', () => {
  for (const f of zoneIds().flatMap((id) => fs.readdirSync(path.join(import.meta.dirname, `zone${id}`)).map((n) => path.join(`zone${id}`, n)))) {
    const src = fs.readFileSync(path.join(import.meta.dirname, f), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/^import\s+(?!type\b)/m.test(src), `${f}: only 'import type'`);
    assert.ok(!/=>|\bfunction\b|\bclass\b|\bfor\s*\(|\bwhile\s*\(/.test(src), `${f}: data only`);
  }
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

test('each zone walks its own world zones: Zone 1 is the Frontier as it was, Zone 2 is the Ash Reach alone with its own creatures', () => {
  const frontier = (id: string) => frontierPlan(false, id).zones.filter((q) => q.region === FRONTIER).map((q) => q.zone).sort();
  assert.deepEqual(frontier('1'), [...loadZone('1').world].sort());
  assert.deepEqual(frontier('2'), ['ash-reach']);
  const plan = frontierPlan(false, '2');
  assert.deepEqual(plan.zones.find((q) => q.zone === 'ash-reach')!.links, [], 'its road to the east road is not walked on this page');
  const specs = mobSpecs(plan, frontierBuild(plan), loadZone('2').spawns.rows);
  assert.ok(specs.length >= 4 && specs.every((m) => m.zone === 'ash-reach'), 'creatures stand in the Ash Reach only');
  assert.ok(specs.every((m) => m.level >= 2 && m.level <= 3), 'at the Zone 2 band');
  assert.equal(mobSpecs(frontierPlan(false, '1'), frontierBuild(frontierPlan(false, '1'))).some((m) => m.zone === 'ash-reach'), false);
});

test('a zone\'s mobLooks are checked: an unknown body, a tint or a scale out of range is named', () => {
  const z = loadZone(), ok = { looks: { 'character:x': { opponent: 'wolf', tint: 0x8a4a32, scale: 1.1, dressing: { soot: .1, burnt: .5 } } }, spread: { 'character:x': { tints: [0x7a4030], scale: .08, soot: .1, burnt: .1 } } };
  const edit = (f: (m: Mut<NonNullable<Zone['mobLooks']>>) => void) => { const c = clone(z), m = JSON.parse(JSON.stringify(ok)); f(m); c.mobLooks = m; return zoneProblems(c as unknown as Zone).join('|'); };
  assert.equal(edit(() => {}), '', 'a valid entry passes');
  assert.match(edit((m) => { m.looks['character:x']!.opponent = 'dragon'; }), /dragon is not a roster body/);
  assert.match(edit((m) => { m.looks['character:x']!.tint = -1; }), /tint is not a 0xrrggbb number/);
  assert.match(edit((m) => { m.looks['character:x']!.scale = 9; }), /scale 9 is out of range/);
  assert.match(edit((m) => { m.looks['character:x']!.dressing.burnt = 2; }), /soot\/burnt must be 0\.\.1/);
  assert.match(edit((m) => { m.spread['character:y'] = m.spread['character:x']!; }), /spread character:y has no mob look/);
  assert.match(edit((m) => { m.spread['character:x']!.tints = []; }), /tints must be/);
  assert.deepEqual(zoneProblems(z), [], 'Zone 1 has no mobLooks and stays valid');
});
