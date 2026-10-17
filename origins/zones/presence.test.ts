import assert from 'node:assert/strict';
import test from 'node:test';
import { loadZone, zoneProblems, type Zone } from './loader.ts';
import { zoneFromRow } from './from-row.ts';

// The optional zone-row `presence` block (per world zone: speed, quiet, caps). Fields only: nothing enforces caps.
const withPresence = (presence: unknown): Zone => ({ ...loadZone('1'), presence } as Zone);
const problems = (presence: unknown): string[] => zoneProblems(withPresence(presence)).filter((p) => p.startsWith('presence'));

test('a zone with no presence block has no presence problems', () => {
  assert.deepEqual(problems(undefined), []);
});

test('a row passes presence through to the zone', () => {
  const z1 = loadZone('1'), world = z1.world[0]!;
  const row = { name: z1.name, kit: z1.kit, looks: z1.looks, presence: { [world]: { speed: 1, quiet: false, caps: { floor: 8, soft: 20, hard: 30 } } } };
  assert.deepEqual(zoneFromRow(1, row).presence, row.presence);
});

test('a valid block is accepted', () => {
  assert.deepEqual(problems({ [loadZone('1').world[0]!]: { speed: 1, quiet: true, caps: { floor: 8, soft: 20, hard: 30 } } }), []);
});

test('a key that is not a world zone of the package fails at load', () => {
  assert.match(problems({ nowhere: { quiet: true } })[0] ?? '', /not a world zone/);
});

test('bad speed and bad caps fail at load', () => {
  const w = loadZone('1').world[0]!;
  assert.match(problems({ [w]: { speed: 0 } })[0] ?? '', /speed/);
  assert.match(problems({ [w]: { caps: { floor: 30, soft: 20, hard: 8 } } })[0] ?? '', /caps/);
  assert.match(problems({ [w]: { caps: { soft: 1.5 } } })[0] ?? '', /caps/);
});
