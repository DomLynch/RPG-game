// A zone row asks for its dome and camp as data (zone sandbox, Strategy 2026-10-15): look.sky names a dome palette (EQEmu zone.sky), look.props.kit names the camp kit and look.props.camp
// the world zone it stands in; `unlisted` keeps a test or work-in-progress zone off every list but its own page. A row that sets none of them is unchanged.
import assert from 'node:assert/strict';
import test from 'node:test';
import { FIELDS } from '../origins/zones/schema.ts';
import { zoneFromRow } from '../origins/zones/from-row.ts';
import { cameraPose, setFightBack } from '../src/fight/camera.ts';
import { listedIds, loadZone } from '../origins/zones/loader.ts';
import { goblinPalette, zoneAmbience, zoneDress, zoneFightBack, zoneGround, zoneLandscapeZoom, zoneMarkers, zonePropKit, zoneSky } from '../origins/world/goblin-field-rules.ts';

const field = (path: string) => FIELDS.find((f) => f.path === path);
const zf = (fields: Record<string, unknown>, world = ['a', 'b']) => ({ fields, set: Object.keys(fields), world });

test('the schema carries unlisted (default false) and reads look.sky, look.props.kit and look.props.camp', () => {
  assert.equal(field('unlisted')?.default, false);
  for (const p of ['look.sky', 'look.props.kit', 'look.props.camp']) assert.equal(field(p)?.wired, true, `${p} is read`);
});
test('a row may say unlisted; only `true` marks the zone', () => {
  const base = { name: 'T', kit: { url: '', nodes: [], landmarks: [], kinds: [] }, looks: {} };
  assert.equal(zoneFromRow(7, { ...base, unlisted: true }).unlisted, true);
  assert.equal(zoneFromRow(7, base).unlisted, undefined);
  assert.equal(zoneFromRow(7, { ...base, unlisted: false }).unlisted, undefined);
});
test('an unlisted zone is seen only by its own page: never by the server or another page', () => {
  const pk = { 1: {}, 2: {}, 9: { unlisted: true } };
  assert.deepEqual(listedIds(pk, null), ['1', '2'], 'no page (server, tests)');
  assert.deepEqual(listedIds(pk, '2'), ['1', '2'], 'another zone\'s page');
  assert.deepEqual(listedIds(pk, '9', true), ['1', '2', '9'], 'its own page, on a build with the VITE_UNLISTED_ZONES opt-in');
  assert.deepEqual(listedIds(pk, '9', false), ['1', '2'], 'its own page on any other build');
});
test('look.sky set to a palette id is that dome; unset, "default" or unknown is no dome', () => {
  assert.equal(zoneSky(zf({ 'look.sky': 'fortress' })), goblinPalette('fortress'));
  for (const v of ['default', 'nope']) assert.equal(zoneSky(zf({ 'look.sky': v })), null, v);
  assert.equal(zoneSky({ fields: { 'look.sky': 'fortress' }, set: [], world: [] }), null, 'a value nobody SET (a default) does nothing');
});
test('look.props.kit = a kit id puts the kit in look.props.camp, else the first world zone; an unknown kit or none is no kit', () => {
  assert.deepEqual(zonePropKit(zf({ 'look.props.kit': 'goblin-camp' })), { kit: 'goblin-camp', at: 'a' });
  assert.deepEqual(zonePropKit(zf({ 'look.props.kit': 'goblin-camp', 'look.props.camp': 'b' })), { kit: 'goblin-camp', at: 'b' });
  assert.equal(zonePropKit(zf({ 'look.props.kit': 'goblin-camp', 'look.props.camp': 'elsewhere' }))?.at, 'a', 'a camp outside the zone falls back to its first world zone');
  assert.equal(zonePropKit(zf({ 'look.props.kit': 'other' })), null); assert.equal(zonePropKit(zf({})), null);
});
test('flag off is unchanged: Zones 1-4 set no sky, no camp kit and are listed', () => {
  for (const id of ['1', '2', '3', '4']) { const z = loadZone(id); assert.equal(zoneSky(z), null, id); assert.equal(zonePropKit(z), null, id); assert.equal(zoneGround(z), null, `${id}: the biome's old material "ash" has no ground row`); assert.equal(zoneAmbience(z), null, `${id}: the biome's old "wind" has no ambience row`); assert.deepEqual(zoneMarkers(z), { alert: true, name: true, card: 'full', growl: false, ring: true, lock: 'hard' }, id); assert.deepEqual(Object.values(zoneDress(z)).slice(1), [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], id); assert.notEqual(z.unlisted, true, id); }
});
test('the markers, dress, ground and ambience a zone sets are read; set off, the creature markers go', () => {
  assert.deepEqual(zoneMarkers(zf({ 'look.creatures.alert': false })), { alert: false, name: true, card: 'full', growl: false, ring: true, lock: 'hard' }); assert.deepEqual(zoneMarkers(zf({ 'look.creatures.name': false })), { alert: true, name: false, card: 'full', growl: false, ring: true, lock: 'hard' }); assert.equal(zoneMarkers(zf({ 'look.creatures.card': 'target' })).card, 'target'); assert.equal(zoneMarkers(zf({ 'look.creatures.card': 'nonsense' })).card, 'full', 'only target changes the card');
  assert.equal(zoneDress(zf({ 'look.dress': 'fortress' })).trees, 0.1); assert.equal(zoneGround(zf({ 'look.ground.material': 'fortress-ground' }))?.id, 'fortress-ground'); assert.equal(zoneGround(zf({ 'look.ground.material': 'ash' })), null);
  assert.equal(zoneAmbience(zf({ 'sound.ambience': 'fortress-wind' }))?.id, 'fortress-wind'); assert.equal(zoneAmbience(zf({ 'sound.ambience': 'wind' })), null);
});
test('?look=goblin is Zone 1 seen as the goblin-fortress biome: it gets the whole mood (sky, kit at its goblin zone, thinned clutter, mud, ambience, no creature markers); Zone 1 itself is untouched', async () => {
  const { zoneAsBiome } = await import('../origins/zones/loader.ts'), { goblinBiome, goblinZone } = await import('../origins/world/goblin-field-rules.ts');
  const z = zoneAsBiome('1', goblinBiome(), { 'look.props.camp': goblinZone() }), base = loadZone('1');
  assert.equal(zoneSky(z)?.id, 'fortress'); assert.deepEqual(zonePropKit(z), { kit: 'goblin-camp', at: goblinZone() }, 'the camp stands in the goblin zone only if that is a world zone of Zone 1');
  assert.ok(zoneDress(z).trees < 1); assert.equal(zoneGround(z)?.id, 'fortress-ground'); assert.equal(zoneAmbience(z)?.id, 'fortress-wind'); assert.deepEqual(zoneMarkers(z), { alert: false, name: false, card: 'target', growl: true, ring: false, lock: 'soft' });
  assert.equal(zoneSky(base), null); assert.deepEqual(zoneMarkers(base), { alert: true, name: true, card: 'full', growl: false, ring: true, lock: 'hard' }, 'the zone row itself did not change');
});
test('setFightBack scales the LOCKED camera back and up (same angle); 1 and the free orbit are untouched', () => {
  const s = { x: 0, z: 0, heading: 0, distance: 0 }, foe = { x: 0, z: -3 };
  setFightBack(1); const a = cameraPose(s, 0, 0, true, foe), free = cameraPose(s, 0, 0.3, false, foe);
  setFightBack(1.2); const b = cameraPose(s, 0, 0, true, foe), free2 = cameraPose(s, 0, 0.3, false, foe); setFightBack(1);
  assert.ok(Math.abs(b.z / a.z - 1.2) < 1e-9 && Math.abs(b.y / a.y - 1.2) < 1e-9, `back ${a.z} -> ${b.z}, up ${a.y} -> ${b.y}`);
  assert.deepEqual(free2, free, 'the free orbit is not the combat camera');
});
test('camera.landscapeZoom: a wide screen can look closer; unset, below 1 or above 3 is no zoom; the goblin-fortress biome asks for 1.3 and Zones 1-4 for nothing', () => {
  assert.equal(zoneLandscapeZoom(zf({ 'camera.landscapeZoom': 1.3 })), 1.3); assert.equal(zoneLandscapeZoom(zf({})), 1); assert.equal(zoneLandscapeZoom(zf({ 'camera.landscapeZoom': 0.5 })), 1); assert.equal(zoneLandscapeZoom(zf({ 'camera.landscapeZoom': 9 })), 1);
  assert.equal(field('camera.landscapeZoom')?.default, 1); assert.equal(field('camera.landscapeZoom')?.wired, true);
  assert.equal(zoneFightBack(zf({ 'camera.fightBack': 1.2 })), 1.2); assert.equal(zoneFightBack(zf({})), 1); assert.equal(zoneFightBack(zf({ 'camera.fightBack': 0.5 })), 1); assert.equal(zoneFightBack(zf({ 'camera.fightBack': 9 })), 1);
  assert.equal(field('camera.fightBack')?.default, 1); assert.equal(field('camera.fightBack')?.wired, true);
  for (const id of ['1', '2', '3', '4']) assert.equal(zoneFightBack(loadZone(id)), 1, `${id}: the real zones' combat camera is untouched`);
  for (const id of ['1', '2', '3', '4']) assert.equal(zoneLandscapeZoom(loadZone(id)), 1, id);
});
