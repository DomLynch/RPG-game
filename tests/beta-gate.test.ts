// The beta gate (Dom 2026-10-22: beta = Zone 0 / Zone 1 / Zone 2 / Dungeon 1): on a normal build zones 3-6 are not there: not listed, not loadable, and no door leads to them (Zone 1's cave mouth to the Bone Hollow is closed);
// their rows stay in the repo and open only with the explicit opt-in. This file must NOT import the opt-in helper (zone-package-env.ts): it tests the closed build.
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadZone, zoneIds } from '../origins/zones/loader.ts';
import { openExits } from '../origins/zones/exits.ts';

test('a normal build lists only the beta zones: zones 3, 4, 5 and 6 are unlisted and cannot be loaded', () => {
  assert.equal(process.env.VITE_UNLISTED_ZONES, undefined, 'the closed build: no opt-in in this process');
  assert.deepEqual(zoneIds(), ['1', '2']);
  for (const id of ['3', '4', '5', '6']) assert.throws(() => loadZone(id), /no zone/, `zone ${id} is closed on a normal build`);
});
test('the doors to the closed zones are closed too: no open exit leads to zone 5 (the cave mouth) or 6 (the crypt), and the doors exist for the opt-in build', () => {
  const closed = openExits(undefined, false), open = openExits(undefined, true);
  for (const to of ['5', '6']) assert.ok(!closed.some((e) => e.to === to), `no open door to zone ${to}`);
  assert.ok(open.some((e) => e.id === 'cave-mouth' && e.to === '5'), 'the cave mouth exists in the data (opt-in build)');
});
