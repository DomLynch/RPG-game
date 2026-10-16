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
    const z = loadZone('90'); assert.equal(zoneSky(z)?.id, 'fortress'); assert.deepEqual(zonePropKit(z), { kit: 'goblin-camp', at: 'test-field', rim: true }); assert.deepEqual(zoneMarkers(z), { alert: false, name: false, card: 'target', growl: true, ring: false, lock: 'soft' }, 'the biome turns the creature markers off'); assert.equal(z.fields?.['look.sky'], 'fortress', 'the biome row, not the zone row, sets the sky'); assert.equal(z.fields?.['look.props.density'], 0.25, 'and thins the game\'s own rock and scrub kit');
    const F = frontierPlan(true, '90'), B = frontierBuild(F); assert.deepEqual(F.zones.filter((q) => q.region === FRONTIER).map((q) => q.zone), ['test-field']);
    const K = propKit(F, B, frontierDress(F, B), 'test-field', 'goblin-camp'); assert.ok(K.centre && K.fires.length >= 1 && K.dress.pieces.length > 50, `${K.dress.pieces.length} camp pieces`);
    const SK = frontierBuild(F, 'goblin'), zp = F.zones.find((q) => q.zone === 'test-field')!;   // the goblin huts and tower (Dom 2026-10-16) stand as skinned plank buildings with the same solids
    for (const name of ['test-hut-1-house', 'test-hut-2-house', 'test-tower-watchtower']) assert.ok(zp.landmarks[name], `${name} is a landmark of the Test Field`);
    assert.ok(SK.pieces.filter((p) => p.layer === 'plain').length >= 30, 'the huts, tower and gate are plank pieces'); assert.ok(B.solids.length > 0);
    const gone = B.solids.filter((s) => !SK.solids.some((k) => k.x === s.x && k.z === s.z && k.r === s.r)); assert.ok(gone.every((s) => s.r === 0.6), 'only the bare landmark markers stop blocking (r 0.6); every building and gate footprint stays'); assert.ok(SK.solids.every((s) => B.solids.some((k) => k.x === s.x && k.z === s.z && k.r === s.r)), 'the skin adds no obstacle of its own');
    const bricks = (b: typeof B) => b.pieces.filter((p) => p.layer === 'stone' && p.shape[0] === 'box' && ((p.shape[1] === 0.8 && p.shape[2] === 1) || (p.shape[1] === 0.6 && p.shape[2] === 3)));   // the cairn marker (0.8 x 1 x 0.8) and the way-on gate post (0.6 x 3 x 0.6); signs are boards, not bricks   // the brick cairn markers and gate posts on the plain landmarks
    assert.ok(bricks(B).length >= 16,'unskinned, each plain landmark and the gate posts stand as brick boxes'); assert.equal(bricks(SK).length, 0, 'the goblin skin leaves no brick marker or gate post at the spawn spots and the gate');
    const KR = propKit(F, B, frontierDress(F, B), 'test-field', 'goblin-camp', undefined, true); assert.ok(KR.dress.pieces.length > K.dress.pieces.length + 40, `the stake ring adds pieces: ${K.dress.pieces.length} -> ${KR.dress.pieces.length}`);
    assert.deepEqual(z.spawns.rows.map((r) => r.id), ['character:giant-salamander', 'character:cave-troll', 'character:pit-goblin', 'character:ash-wolf', 'character:ash-boar'], 'Dom 2026-10-16: salamander, troll, pit goblin, wolf and boar stand here, at the level-1 band its row asks for');
    assert.ok(z.spawns.rows.every((r) => r.behaviour.campSize?.join() === '1,1'), 'every spot holds ONE creature (Dom: spread evenly, one in each location)'); assert.deepEqual(['character:giant-salamander', 'character:ash-wolf', 'character:pit-goblin'].map((id) => z.mobLooks?.looks[id]?.scale), [6, 4, 1.25], 'Dom 2026-10-16: salamander and wolf doubled again, goblin a quarter bigger');
    const groups = z.place!.spawns, count = (id: string) => groups.filter((g) => g.characters[0] === id).length, lay = (z.place!.zones['test-field'] as { layout: Record<string, { u: number; v: number }> }).layout;
    assert.deepEqual(['character:cave-troll', 'character:giant-salamander', 'character:pit-goblin', 'character:ash-wolf', 'character:ash-boar'].map(count), [3, 3, 6, 2, 2], 'trolls, salamanders, goblins, wolves, boars');
    const spots = groups.map((g) => lay[g.at]!), ring = spots.map((p) => Math.hypot(p.u - 0.5, p.v - 0.5) * 100);   // a 100 m zone: metres from its centre
    assert.ok(Math.max(...ring) <= 40, `no spot in the outer 10% (45 m) plus roam room: ${Math.max(...ring)}`); assert.ok(Math.min(...ring) >= 12, 'none on the camp');
    const gap = Math.min(...spots.flatMap((p, i) => spots.slice(i + 1).map((q) => Math.hypot(p.u - q.u, p.v - q.v) * 100))); assert.ok(gap >= 10, `evenly spread: nearest two spots ${gap} m apart`);
    const same = Math.min(...groups.flatMap((g, i) => groups.slice(i + 1).filter((h) => h.characters[0] === g.characters[0]).map((h) => Math.hypot(lay[g.at]!.u - lay[h.at]!.u, lay[g.at]!.v - lay[h.at]!.v) * 100))); assert.ok(same >= 22, `Dom: no two of a kind side by side, they rotate: nearest same-type pair ${same} m apart`);
    const { variantLook } = await import('../origins/preview/mob-looks.ts');   // the per-frame reader that threw on a row with no mobLooks.spread (2026-10-16: the page froze, the hero stayed a capsule)
    for (const id of ['character:giant-salamander', 'character:cave-troll']) for (let v = 0; v < 4; v++) assert.doesNotThrow(() => variantLook(id, v, z), `${id} variant ${v}`);
    assert.equal(z.level, 1);
  } finally { delete (globalThis as { location?: unknown }).location; delete process.env.VITE_UNLISTED_ZONES; }
});
