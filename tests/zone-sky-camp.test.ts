// A zone row asks for its dome and camp as data (zone sandbox, Strategy 2026-10-15): look.sky names a dome palette (EQEmu zone.sky), look.props.kit names the camp kit and look.props.camp
// the world zone it stands in; `unlisted` keeps a test or work-in-progress zone off every list but its own page. A row that sets none of them is unchanged.
import assert from 'node:assert/strict';
import test from 'node:test';
import { FIELDS } from '../origins/zones/schema.ts';
import { zoneFromRow } from '../origins/zones/from-row.ts';
import { listedIds, loadZone } from '../origins/zones/loader.ts';
import { goblinPalette, zoneCamp, zoneSky } from '../origins/world/goblin-field-rules.ts';

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
  assert.equal(zoneSky(zf({ 'look.sky': 'dusk' }))?.id, 'dusk');
  assert.equal(zoneSky(zf({ 'look.sky': 'fortress' })), goblinPalette('fortress'));
  for (const v of ['default', 'nope']) assert.equal(zoneSky(zf({ 'look.sky': v })), null, v);
  assert.equal(zoneSky({ fields: { 'look.sky': 'dusk' }, set: [], world: [] }), null, 'a value nobody SET (a default) does nothing');
});
test('look.props.kit = the camp kit puts the camp in look.props.camp, else the first world zone; another kit or none is no camp', () => {
  assert.equal(zoneCamp(zf({ 'look.props.kit': 'goblin-camp' })), 'a');
  assert.equal(zoneCamp(zf({ 'look.props.kit': 'goblin-camp', 'look.props.camp': 'b' })), 'b');
  assert.equal(zoneCamp(zf({ 'look.props.kit': 'goblin-camp', 'look.props.camp': 'elsewhere' })), 'a', 'a camp outside the zone falls back to its first world zone');
  assert.equal(zoneCamp(zf({ 'look.props.kit': 'other' })), null); assert.equal(zoneCamp(zf({})), null);
});
test('flag off is unchanged: Zones 1-4 set no sky, no camp kit and are listed', () => {
  for (const id of ['1', '2', '3', '4']) { const z = loadZone(id); assert.equal(zoneSky(z), null, id); assert.equal(zoneCamp(z), null, id); assert.notEqual(z.unlisted, true, id); }
});
