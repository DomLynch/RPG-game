import test from 'node:test';
import assert from 'node:assert/strict';
import { BUNDLE } from '../region1/content.ts';
import { REGION1_NPCS } from '../region1/npcs.ts';
import { REGION1_SHOPS } from '../region1/shops.ts';
import { CONCORD, CONCORD_REGION } from '../world/concord.ts';
import { atWork, validateNpcRows, type NpcContext, type NpcRow } from './row.ts';

const characters = new Set(BUNDLE.filter((r) => r.kind === 'character-definition').map((r) => r.id as string));
const zones = CONCORD.regions[CONCORD_REGION]!.zones as Record<string, { layout?: Record<string, unknown> }>;
const ctx: NpcContext = {
  character: (id) => characters.has(id),
  shop: (service) => REGION1_SHOPS.has(service),
  landmark: (zone, at) => zones[zone]?.layout?.[at] !== undefined,
};

test('Region 1 rows are valid; the counters World has not placed yet are listed, not refused', () => {
  const { issues, unplaced } = validateNpcRows(REGION1_NPCS, ctx);
  assert.deepEqual(issues, []);
  assert.deepEqual(unplaced, ['exchange/provisioner-stall', 'exchange/inn', 'exchange-quarter/quarter-forge', 'exchange-quarter/quarter-healer', 'exchange-quarter/quarter-fence'],
    'World places these counters; the bank and the contract board already exist');
  assert.ok(REGION1_NPCS.some((r) => r.roles.includes('banker') && r.hours === 'always'), 'Dom: the bank never closes');
  assert.ok(REGION1_NPCS.some((r) => r.roles.includes('vendor') && r.shop === 'service:exchange-provisioner'), 'the Exchange shop has its vendor');
});

test('each rule has a failing row', () => {
  const row = (over: Partial<NpcRow>): NpcRow => ({ npc: 'character:banker-exchange', roles: ['banker'], zone: 'exchange', at: 'bank', hours: 'always', ...over });
  const paths = (rows: NpcRow[]) => validateNpcRows(rows, ctx).issues.map((i) => i.path);
  assert.deepEqual(paths([row({ npc: 'character:nobody' })]), ['npcs[0].npc']);
  assert.deepEqual(paths([row({}), row({})]), ['npcs[1].npc']);
  assert.deepEqual(paths([row({ roles: [] })]), ['npcs[0].roles']);
  assert.deepEqual(paths([row({ roles: ['king' as never] })]), ['npcs[0].roles']);
  assert.deepEqual(paths([row({ roles: ['banker', 'banker'] })]), ['npcs[0].roles']);
  for (const hours of [[6, 6], [6, 24], [-1, 5], [6.5, 9]] as [number, number][]) assert.deepEqual(paths([row({ hours })]), ['npcs[0].hours'], `hours ${hours}`);
  assert.deepEqual(paths([row({ roles: ['vendor'] })]), ['npcs[0].shop'], 'a vendor without a shop');
  assert.deepEqual(paths([row({ roles: ['vendor'], shop: 'service:nope' })]), ['npcs[0].shop'], 'a vendor with no list');
  assert.deepEqual(paths([row({ shop: 'service:exchange-provisioner' })]), ['npcs[0].shop'], 'a banker with a shop');
});

test('atWork: open hours, wrap past midnight, always', () => {
  const day: NpcRow = { npc: 'x', roles: ['vendor'], zone: 'z', at: 'a', hours: [6, 22] }, night: NpcRow = { ...day, hours: [20, 4] };
  assert.deepEqual([5.99, 6, 21.99, 22, 4].map((h) => atWork(day, h)), [false, true, true, false, false]);
  assert.deepEqual([19.99, 20, 23.5, 0, 3.99, 4].map((h) => atWork(night, h)), [false, true, true, true, true, false]);
  assert.equal(atWork({ ...day, hours: 'always' }, 4), true, 'Dom: a 4 am player is never blocked at the bank');
});
