// The writer tells presence after a gear op succeeds, so other players see new gear at once (the wornPoke rows in server-rules.json list the ops). Never before the commit, never on a refusal,
// never for an op outside the rows, and a failing poke never fails the op.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createWriter } from './server.ts';
import { Refused } from './errors.ts';
import type { Db } from './db.ts';
import type { Handler } from './handlers.ts';
import { presenceWornPoke } from '../presence/where.ts';
import rules from './server-rules.json' with { type: 'json' };

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const db: Db = { run: async () => { throw Error('no db in this test'); } };
async function start(poked: string[], order: string[], poke?: (a: string) => Promise<void>) {
  const handlers: Record<string, Handler> = {
    gear_equip: async () => { order.push('commit'); return { ok: true }; },
    gear_unequip: async () => { throw new Refused(422, 'nothing worn there'); },
    gear_import: async () => ({ ok: true }),
    bank_move: async () => ({ ok: true }),
  };
  const server = createWriter({ db, verify: async () => A, where: async () => ({ online: false }), handlers,
    wornPoke: poke ?? (async (account) => { order.push('poke'); poked.push(account); }) });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const post = (op: string) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/origins/${op}`, { method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' }, body: '{}' });
  return { server, post };
}
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 30));

test('a successful gear op pokes presence for that account, after the commit; a refusal, and an op outside the rows, poke nothing', async () => {
  const poked: string[] = [], order: string[] = [], { server, post } = await start(poked, order);
  try {
    assert.equal((await post('gear_equip')).status, 200); await settle();
    assert.deepEqual(poked, [A]); assert.deepEqual(order, ['commit', 'poke'], 'the poke follows the commit');
    assert.equal((await post('gear_unequip')).status, 422); await settle();
    assert.equal((await post('bank_move')).status, 200); await settle();
    assert.deepEqual(poked, [A], 'a refused op and an op outside the rows (bank_move) poke nothing');
    assert.equal((await post('gear_import')).status, 200); await settle();
    assert.deepEqual(poked, [A, A], 'gear_import is in the rows too');
  } finally { server.close(); }
});

test('the ops that poke are exactly the wornPoke rows, and a failing or hanging poke never fails or delays the op', async () => {
  assert.deepEqual(rules.wornPoke.map((r) => r.id), ['gear_equip', 'gear_unequip', 'gear_import']);
  const { server, post } = await start([], [], async () => { throw new Error('presence is down'); });
  try {
    const t0 = Date.now(), res = await post('gear_equip');
    assert.equal(res.status, 200, 'the op succeeded');
    assert.deepEqual(((await res.json()) as { ok: boolean }).ok, true);
    assert.ok(Date.now() - t0 < 1000, 'and did not wait on presence');
  } finally { server.close(); }
});

test('the writer\'s poke client posts the account with the key and treats any non-200 as a failure', async () => {
  const seen: { url: string; auth: string; body: string }[] = [];
  const ok = presenceWornPoke('http://127.0.0.1:8793', 'KEY', 1000, (async (url: string, init: RequestInit) => { seen.push({ url, auth: String((init.headers as Record<string, string>).authorization), body: String(init.body) }); return new Response('{}', { status: 200 }); }) as unknown as typeof fetch);
  await ok(A);
  assert.deepEqual(seen, [{ url: 'http://127.0.0.1:8793/internal/worn', auth: 'Bearer KEY', body: JSON.stringify({ account: A }) }]);
  const bad = presenceWornPoke('http://x', 'KEY', 1000, (async () => new Response('', { status: 401 })) as unknown as typeof fetch);
  await assert.rejects(bad(A), /HTTP 401/);
});
