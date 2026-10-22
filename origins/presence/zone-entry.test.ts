// A listed zone's page opens its hero INSIDE that zone (2026-10-22: /zone2/ asked presence for Zone 1's start, was refused, and the hero ended in the Pit): every listed zone has its own start warp, a landmark presence holds, and it stands in one of the zone's own world zones.
// Zone 1's is the warp table's `zone1-start`; every other zone brings `zone<N>-start` in its row's `warps`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_ZONE, loadZone, zoneIds } from '../zones/loader.ts';
import { warpPlace } from './warps.ts';
import { zoneAt } from './zones.ts';

for (const id of zoneIds()) {
  test(`zone ${id}: its page's start warp exists and lands inside the zone`, () => {
    const z = loadZone(id), warp = z.warps?.find((w) => w.id === `zone${id}-start`)?.id ?? (id === DEFAULT_ZONE ? 'zone1-start' : null);
    assert.ok(warp, `zone ${id} names its own start warp (zone${id}-start in its row's warps)`);
    const at = warpPlace(warp);
    assert.ok(at, `presence holds the landmark ${warp}`);
    const inside = zoneAt(at.x, at.z);
    assert.ok(inside !== null && z.world.includes(inside), `${warp} stands in ${String(inside)}, one of zone ${id}'s own world zones (${z.world.join(', ')})`);
  });
}
