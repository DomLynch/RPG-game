import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ARENA_THEMES } from '../src/arena-themes.ts';
import { loadZone, zoneFromAddress } from '../origins/zones/loader.ts';
import { zoneArena } from '../origins/preview/look.ts';

// The zone page builds and lights its walk-out from the LOADED zone's Pit theme (origins/preview/main.ts), not Zone 1's for every zone (Strategy's audit, 2026-10-11). Zone 1 keeps the Ash Pit's.
const keyAt = (path: string): string => zoneArena(loadZone(zoneFromAddress(path, '')), ARENA_THEMES);

test('/zone/1/, the old /zone1/ links and a page that names no zone resolve the Ash Pit theme, as before', () => {
  assert.equal(keyAt('/zone/1/'), '1');
  assert.equal(keyAt('/zone1/'), '1');
  assert.equal(keyAt('/'), '1');
});
test('/zone/2/ and /zone/3/ resolve their own theme key, and it names a real theme', () => {
  assert.equal(keyAt('/zone/2/'), '2');
  assert.equal(keyAt('/zone/3/'), '3');
  for (const k of [keyAt('/zone/2/'), keyAt('/zone/3/')]) assert.ok(ARENA_THEMES[k as keyof typeof ARENA_THEMES], `theme ${k} exists`);
  assert.notDeepEqual(ARENA_THEMES[keyAt('/zone/3/') as keyof typeof ARENA_THEMES], ARENA_THEMES['1'], 'Zone 3 does not get the Ash Pit theme');
});
test('a zone that sets no arena, or one the themes do not have, falls back to Zone 1\'s theme', () => {
  assert.equal(zoneArena({ fields: { 'look.arena': '3' }, set: [] }, ARENA_THEMES), '1', 'a default is not an override');
  assert.equal(zoneArena({ fields: { 'look.arena': '99' }, set: ['look.arena'] }, ARENA_THEMES), '1');
  assert.equal(zoneArena({}, ARENA_THEMES), '1');
});
test('the zone page takes its theme through zoneArena of the loaded zone, never a fixed key', () => {
  const main = readFileSync('origins/preview/main.ts', 'utf8');
  assert.match(main, /const theme = ARENA_THEMES\[zoneArena\(loadZone\(\), ARENA_THEMES\)/);
  assert.doesNotMatch(main, /ARENA_THEMES\['1'\]/);
});
