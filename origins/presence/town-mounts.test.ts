import assert from 'node:assert/strict';
import test from 'node:test';
import { CONCORD, CONCORD_REGION, concordMounts } from '../world/concord.ts';
import { resolveZone } from '../world/resolve.ts';
import { toMetres, toWorld } from '../world/derive.ts';
import { ZONE_ROWS, landmarkCm, CENTRE_CM } from './zones.ts';
import TOWN from './town-zones.json' with { type: 'json' };

// A town zone's frame is the `mount` on its town-zones.json row (no zone name is compared in zones.ts). The corners and landmark points must be exactly what the old `id === 'pit-yard' ? pit : exchange` gave.
const mounts = concordMounts();
const was = (id: 'pit-yard' | 'exchange') => (id === 'pit-yard' ? (mounts.ok ? mounts.value.pit : null) : mounts.ok ? mounts.value.exchange : null)!;

test('the town zones name their mounts', () => {
  assert.deepEqual(TOWN.zones.map((z) => [z.id, z.mount]), [['pit-yard', 'pit'], ['exchange', 'exchange']]);
});

test('the town zones\' corners equal what the pit-yard / exchange comparison gave', () => {
  for (const id of ['pit-yard', 'exchange'] as const) {
    const params = resolveZone(CONCORD, CONCORD_REGION, id);
    assert.ok(params.ok);
    const t = toMetres(params.value), m = was(id);
    const corners = ([[-t.width / 2, 0], [t.width / 2, 0], [t.width / 2, t.depth], [-t.width / 2, t.depth]] as const).map(([x, d]) => toWorld({ x, d }, m));
    assert.deepEqual(ZONE_ROWS.find((r) => r.id === id)!.corners, corners, id);
  }
});

test('landmarkCm uses the same frames', () => {
  const params = resolveZone(CONCORD, CONCORD_REGION, 'exchange');
  assert.ok(params.ok);
  const l = toMetres(params.value).landmarks['outer-gate']!, w = toWorld({ x: l.x, d: l.d }, was('exchange'));
  assert.deepEqual(landmarkCm('exchange', 'outer-gate'), { x: Math.round(CENTRE_CM + w.x * 100), z: Math.round(CENTRE_CM + w.z * 100) });
});
