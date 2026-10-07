// The writer's item ops from the loaded content (content-ops.ts): consume and apply_upgrade exist in production, the smith is data (never invented), and a content problem is a warning, not an outage.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Db } from './db.ts';
import { parseServiceDefinition, parseUpgradeCostTable } from '../contracts/economy.ts';
import * as F from '../contracts/fixtures.ts';
import { loadEncounterContent, type EncounterContent } from '../encounters/encounters.ts';
import { fakeWhere } from '../presence/fixtures.ts';
import { createWriter } from './server.ts';
import { handlers } from './handlers.ts';
import { itemContent, itemOps } from './content-ops.ts';

const region1 = loadEncounterContent();
const ACCOUNT = '11111111-1111-4111-8111-111111111111';

test('Region 1 content: the item ops are served on top of every base op, and its items resolve', () => {
  assert.ok(region1.ok, region1.ok ? '' : region1.issues.map((i) => i.message).join('; '));
  const ops = itemOps(region1);
  for (const op of Object.keys(handlers)) assert.ok(typeof ops[op] === 'function', `base op ${op} is kept`);
  assert.ok(typeof ops.consume === 'function' && typeof ops.apply_upgrade === 'function');
  assert.equal(itemContent(region1.value).lookup('item:grave-iron' as never)?.id, 'item:grave-iron');
});

test('Region 1 authors no smith yet: apply_upgrade is a 501 over HTTP, before any database use, and the route is not a 404', async () => {
  assert.equal(itemContent(region1.ok ? region1.value : (assert.fail('no content'), undefined as never)).smith, undefined, 'if Region 1 gains a smith service + cost table, this pin and the 501 below should be updated');
  const dbUsed: string[] = [], db: Db = { async run(sql) { dbUsed.push(sql); throw new Error('no database in this test'); } };
  const writer = createWriter({ db, verify: async (t) => (t === 'tok' ? ACCOUNT : null), where: fakeWhere({}), handlers: itemOps(region1) });
  await new Promise<void>((ok) => writer.listen(0, '127.0.0.1', ok));
  try {
    const base = `http://127.0.0.1:${(writer.address() as AddressInfo).port}/origins`, post = (op: string, token?: string) => fetch(`${base}/${op}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ character: 'pc:one', op: 'smith:helm:l2:abc', instance: 'inst:1', toLevel: 2 }) });
    assert.equal((await post('apply_upgrade')).status, 401, 'signed out is refused before anything else');
    const res = await post('apply_upgrade', 'tok');
    assert.equal(res.status, 501);
    assert.match(JSON.stringify(await res.json()), /no smith in this content/);
    assert.deepEqual(dbUsed, [], 'the refusal needs no database');
    assert.notEqual((await post('consume', 'tok')).status, 404, 'consume is a served route now');
  } finally { await new Promise<void>((ok) => writer.close(() => ok())); }
});

test('the smith is the first upgrade service (by id) whose cost table is in the registry; one without its table is skipped', () => {
  const service = (id: string, table: string) => { const r = parseServiceDefinition({ ...F.blacksmith(), id, costTable: table }); return r.ok ? r.value : assert.fail(JSON.stringify(r.issues)); };
  const costs = parseUpgradeCostTable(F.forgeCosts()); assert.ok(costs.ok);
  const registry = { items: new Map(), services: new Map([['service:b', service('service:b', costs.value.id)], ['service:a', service('service:a', 'costtable:missing')], ['service:c', service('service:c', costs.value.id)]]), costTables: new Map([[costs.value.id, costs.value]]) };
  const smith = itemContent({ region: { registry } } as unknown as EncounterContent).smith;
  assert.equal(smith?.service.id, 'service:b', 'a is skipped (no table), b is first of the rest');
  assert.equal(smith?.costs.id, costs.value.id);
});

test('content that does not load is a warning and the base ops, never a throw', () => {
  const warned: string[] = [], ops = itemOps({ ok: false, issues: [{ code: 'missing', path: 'x', message: 'region file gone' }] } as never, (m) => warned.push(m));
  assert.deepEqual(Object.keys(ops).sort(), Object.keys(handlers).sort());
  assert.equal(ops.consume, undefined);
  assert.equal(warned.length, 1);
  assert.match(warned[0]!, /region file gone.*not served/);
});

// scripts/origins-writer.mjs boots from env and a database, so its wiring is pinned by source: the item ops come from itemOps(loadEncounterContent()) and the base `handlers` are no longer spread bare.
import { readFileSync } from 'node:fs';
test('the writer entry point serves the item ops from the loaded Region 1 content', () => {
  const src = readFileSync(new URL('../../scripts/origins-writer.mjs', import.meta.url), 'utf8').split('\n').filter((l) => !l.trimStart().startsWith('//')).join('\n');
  assert.match(src, /\.\.\.itemOps\(loadEncounterContent\(\)\)/);
  assert.doesNotMatch(src, /\.\.\.handlers\b/, 'the bare base ops would drop consume and apply_upgrade');
});
