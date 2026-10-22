import assert from 'node:assert/strict';
import test from 'node:test';
import { EXITS, loadExits, type ExitRow } from './exits.ts';
import { loadZone, zoneProblems, type Zone } from './loader.ts';
import { zoneFromRow } from './from-row.ts';
import { REGISTRY } from './registry.ts';
import DEFS from './exit-rows.json' with { type: 'json' };

// A zone row may carry its own `exits` (zone package gap 2, docs/specs/zone-package.md): the same rows as exit-rows.json, merged into EXITS, so a package brings its doors with it.
const cave = DEFS.exits[0] as ExitRow;
const own: ExitRow = { ...cave, id: 'test-door', zone: 'test-field', landmark: 'test-gate', to: '1', arrive: 'cave-mouth', warp: 'zone90-test-door' };
const zones = { '1': {}, '5': {}, '6': {}, '90': { exits: [own] } };

test('with no zone-row exits the merged list is exactly exit-rows.json (and the merged list is the file rows then the zone rows\' own: the town pair, Zone 1 <-> zone 0, 2026-10-22)', () => {
  assert.equal(JSON.stringify(EXITS), JSON.stringify([...DEFS.exits, ...Object.values(REGISTRY).flatMap((z) => (z as { exits?: readonly ExitRow[] }).exits ?? [])]));
  assert.equal(JSON.stringify(loadExits(DEFS, { '1': {}, '5': {}, '6': {} })), JSON.stringify(DEFS.exits));
});

test('a zone row\'s exits are merged after the file rows', () => {
  assert.deepEqual(loadExits(DEFS, zones).map((r) => r.id), [...DEFS.exits.map((r) => r.id), 'test-door']);
});

test('an exit id or a warp id already taken is refused, and so is a door to a zone that is not a package', () => {
  assert.throws(() => loadExits(DEFS, { ...zones, '90': { exits: [{ ...own, id: cave.id }] } }), /duplicate|twice|unique/i);
  assert.throws(() => loadExits(DEFS, { ...zones, '90': { exits: [{ ...own, warp: cave.warp }] } }), /warp .* already/);
  assert.throws(() => loadExits(DEFS, { ...zones, '90': { exits: [{ ...own, to: '77' }] } }), /not a zone package/);
  assert.throws(() => loadExits(DEFS, { ...zones, '90': { exits: [{ ...own, radiusM: 0 }] } }), /radiusM/);
});

test('a zone row passes exits through, and an exit on a world zone the package does not have is a problem', () => {
  const z1 = loadZone('1'), row = { name: z1.name, kit: z1.kit, looks: z1.looks, world: z1.world, exits: [{ ...own, zone: z1.world[0]! }] };
  assert.deepEqual(zoneFromRow(1, row).exits, row.exits);
  const bad = { ...z1, exits: [own] } as Zone;
  assert.ok(zoneProblems(bad).some((p) => /exits\[0\].*not a world zone/.test(p)));
  assert.deepEqual(zoneProblems({ ...z1, exits: [{ ...own, zone: z1.world[0]! }] } as Zone).filter((p) => p.startsWith('exits')), []);
});

// Zone package gap 2, the other half: a zone row's own `warps` (the rows of presence/warp-landmarks.json) pass through and are shape-checked; presence/warps.ts merges them.
test('a zone row passes warps through, and a bad warp row is a problem (a repeated id, a unit that is not m, a non-number place)', () => {
  const z1 = loadZone('1'), warps = [{ id: 'pkg-camp', x: 1, z: 2, unit: 'm' }], row = { name: z1.name, kit: z1.kit, looks: z1.looks, world: z1.world, warps };
  assert.deepEqual(zoneFromRow(1, row).warps, warps);
  assert.deepEqual(zoneProblems({ ...z1, warps } as Zone).filter((p) => p.startsWith('warps')), []);
  const bad = zoneProblems({ ...z1, warps: [warps[0]!, warps[0]!, { id: 'Bad Id', x: 1, z: 2, unit: 'm' }, { id: 'cm', x: 1, z: 2, unit: 'cm' }, { id: 'nan', x: Number.NaN, z: 2, unit: 'm' }] } as Zone).filter((p) => p.startsWith('warps'));
  assert.deepEqual(bad.map((p) => p.replace(/^warps\[(\d)\].*?(repeated|not a lowercase|unit is m|numbers).*$/, '$1 $2')), ['1 repeated', '2 not a lowercase', '3 unit is m', '4 numbers']);
});
