// THE TEST ZONE (zone 99, zone sandbox, Strategy 2026-10-15): a new zone is a content job. Zone 99 is ONLY rows (origins/zone-rows/zone99.row.json): a dome (look.sky), dusk fog, light and
// ground tint (look.*), a goblin camp (look.props.kit), no creatures, unlisted. Outside the 1-50 ladder; not "Zone 3" (Zone N = level N creatures). DELETE this file with the row when Zone 1 graduates.
import assert from 'node:assert/strict';
import test from 'node:test';

test('the server never sees the test zone: not listed, and its road is not on Zone 4\'s map', async () => {
  const { zoneIds, zonePlaces, loadZone } = await import('../origins/zones/loader.ts');
  assert.ok(!zoneIds().includes('99')); assert.ok(!zonePlaces().some((p) => p.joins.some((j) => j.to === 'test-field')));
  assert.equal(loadZone('99').unlisted, true, 'still loadable by its own id (its page)');
});
test('its own page: the rows give it a dome, a camp in its field and a start off the camp, with no code of its own', async () => {
  (globalThis as { location?: unknown }).location = { pathname: '/zone/99/', search: '' };   // the page /zone/99/ (world.ts reads the places at import, so this file imports after setting it)
  try {
    const { loadZone, zoneIds } = await import('../origins/zones/loader.ts'), { zoneSky, zoneCamp } = await import('../origins/world/goblin-field-rules.ts');
    const { frontierPlan, frontierBuild, FRONTIER } = await import('../origins/preview/frontier-plan.ts'), { frontierDress } = await import('../origins/preview/frontier-dress.ts'), { goblinFieldKit } = await import('../origins/preview/goblin-field.ts');
    assert.ok(zoneIds().includes('99'));
    const z = loadZone('99'); assert.equal(zoneSky(z)?.id, 'dusk'); assert.equal(zoneCamp(z), 'test-field');
    const F = frontierPlan(true, '99'), B = frontierBuild(F); assert.deepEqual(F.zones.filter((q) => q.region === FRONTIER).map((q) => q.zone), ['test-field']);
    const K = goblinFieldKit(F, B, frontierDress(F, B), 'test-field'); assert.ok(K.centre && K.fires.length >= 1 && K.dress.pieces.length > 50, `${K.dress.pieces.length} camp pieces`);
    assert.equal(z.spawns.rows.length, 0, 'no creatures: nothing at level 99 exists');
  } finally { delete (globalThis as { location?: unknown }).location; }
});
