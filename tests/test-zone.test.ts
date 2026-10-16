// THE TEST ZONE (zone 90, zone sandbox, Strategy 2026-10-15): a new zone is a content job. Zone 90 is ONLY rows (origins/zone-rows/zone90.row.json): a dome (look.sky), dusk fog, light and
// ground tint (look.*), a goblin camp (look.props.kit), no creatures, unlisted. Outside the 1-50 ladder; not "Zone 3" (Zone N = level N creatures). DELETE this file with the row when Zone 1 graduates.
import assert from 'node:assert/strict';
import test from 'node:test';

test('the server never sees the test zone: not listed, and its road is not on Zone 4\'s map', async () => {
  const { zoneIds, zonePlaces, loadZone } = await import('../origins/zones/loader.ts');
  assert.ok(!zoneIds().includes('90')); assert.ok(!zonePlaces().some((p) => p.joins.some((j) => j.to === 'test-field')));
  assert.equal(loadZone('90', true).unlisted, true, 'loadable by its own id on a build with the VITE_UNLISTED_ZONES opt-in');
});
test('its own page: the rows give it a dome, a camp in its field and a start off the camp, with no code of its own', async () => {
  process.env.VITE_UNLISTED_ZONES = '1';   // a sandbox preview build: the explicit opt-in that opens an unlisted zone
  (globalThis as { location?: unknown }).location = { pathname: '/zone/90/', search: '' };   // the page /zone/90/ (world.ts reads the places at import, so this file imports after setting it)
  try {
    const { loadZone, zoneIds } = await import('../origins/zones/loader.ts'), { zoneSky, zonePropKit, zoneMarkers } = await import('../origins/world/goblin-field-rules.ts');
    const { frontierPlan, frontierBuild, FRONTIER } = await import('../origins/preview/frontier-plan.ts'), { frontierDress } = await import('../origins/preview/frontier-dress.ts'), { propKit } = await import('../origins/preview/prop-kit.ts');
    assert.ok(zoneIds().includes('90'));
    const z = loadZone('90'); assert.equal(zoneSky(z)?.id, 'fortress'); assert.deepEqual(zonePropKit(z), { kit: 'goblin-camp', at: 'test-field' }); assert.deepEqual(zoneMarkers(z), { alert: false, name: false, card: 'target', growl: true, ring: false, lock: 'soft' }, 'the biome turns the creature markers off'); assert.equal(z.fields?.['look.sky'], 'fortress', 'the biome row, not the zone row, sets the sky'); assert.equal(z.fields?.['look.props.density'], 0.25, 'and thins the game\'s own rock and scrub kit');
    const F = frontierPlan(true, '90'), B = frontierBuild(F); assert.deepEqual(F.zones.filter((q) => q.region === FRONTIER).map((q) => q.zone), ['test-field']);
    const K = propKit(F, B, frontierDress(F, B), 'test-field', 'goblin-camp'); assert.ok(K.centre && K.fires.length >= 1 && K.dress.pieces.length > 50, `${K.dress.pieces.length} camp pieces`);
    assert.deepEqual(z.spawns.rows.map((r) => r.id), ['character:giant-salamander', 'character:cave-troll'], 'Dom 2026-10-16: the salamander and the troll stand here, at the level-1 band its row asks for');
    const { variantLook } = await import('../origins/preview/mob-looks.ts');   // the per-frame reader that threw on a row with no mobLooks.spread (2026-10-16: the page froze, the hero stayed a capsule)
    for (const id of ['character:giant-salamander', 'character:cave-troll']) for (let v = 0; v < 4; v++) assert.doesNotThrow(() => variantLook(id, v, z), `${id} variant ${v}`);
    assert.equal(z.level, 1); assert.deepEqual(z.place?.spawns.map((g) => g.at), ['test-troll-cave', 'test-mere-bank']);
  } finally { delete (globalThis as { location?: unknown }).location; delete process.env.VITE_UNLISTED_ZONES; }
});
