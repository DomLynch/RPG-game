// Per-layer spawns (docs/specs/origins/per-layer-spawns.md): the presence side is GET /internal/layers, the ids of the layers that exist now, for the writer's spawn janitor; and its fail-closed client.
import './lib/era-off.ts';   // RV78: the legacy suite runs on trunk's rules; sandbox-era.ts is the one switch (tests/lib/era-off.ts)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPresence } from '../origins/presence/server.ts';
import { RULES } from '../origins/presence/interest.ts';
import { presenceLayers } from '../origins/presence/where.ts';

const acct = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const KEY = 'test-internal-key-0123456789';
const verify = async (): Promise<string | null> => null;
const start = async (internalKey: string | undefined, clock: { t: number }) => {
  const p = createPresence({ verify, log: () => {}, internalKey, now: () => clock.t, rules: { ...RULES, softCap: 1, hardCap: 1 }, maxLayers: 3 });
  await new Promise<void>((r) => p.server.listen(0, '127.0.0.1', r));
  return { p, base: `http://127.0.0.1:${p.port()}` };
};

test('layers: the ids that exist now, in order, and a layer that closed (empty past emptyLayerMs) is gone', async () => {
  const clock = { t: 1_000_000 };
  const { p, base } = await start(KEY, clock);
  try {
    const a = p.world.join(acct(1), clock.t)!, b = p.world.join(acct(2), clock.t)!;   // softCap 1: the second account opens a second layer
    const layers = presenceLayers(base, KEY);
    assert.deepEqual(await layers(), [a.layer.id, b.layer.id].sort((x, y) => x - y));
    p.world.leave(b, clock.t);
    clock.t += RULES.emptyLayerMs + 1;
    p.world.sweep(clock.t);
    assert.deepEqual(await layers(), [a.layer.id], 'the empty layer was closed by the sweep and no longer listed');
  } finally { await p.close(); }
});

test('layers: no key, a wrong key or no configured key is refused, and the answer carries no account or position', async () => {
  const clock = { t: 5 };
  const { p, base } = await start(KEY, clock);
  try {
    p.world.join(acct(1), clock.t, undefined, { x: 100, z: 100 });
    assert.equal((await fetch(`${base}/internal/layers`)).status, 401);
    assert.equal((await fetch(`${base}/internal/layers`, { headers: { authorization: 'Bearer nope' } })).status, 401);
    const ok = await (await fetch(`${base}/internal/layers`, { headers: { authorization: `Bearer ${KEY}` } })).text();
    assert.doesNotMatch(ok, /"x"|"z"|[0-9a-f]{8}-[0-9a-f]{4}/, 'layer ids only');
    await assert.rejects(presenceLayers(base, 'wrong')(), /HTTP 401/, 'the client turns a refusal into an error: the janitor deletes nothing');
  } finally { await p.close(); }
  const off = await start(undefined, clock);
  try { assert.equal((await fetch(`${off.base}/internal/layers`, { headers: { authorization: `Bearer ${KEY}` } })).status, 404, 'no key configured: the route is not there'); } finally { await off.p.close(); }
});

test('layers client: a malformed answer is an error, never an empty list', async () => {
  for (const body of [{}, { layers: 'x' }, { layers: [0] }, { layers: [1.5] }, { layers: ['1'] }]) {
    const fetchImpl = (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
    await assert.rejects(presenceLayers('http://x', 'k', 1000, fetchImpl)(), /malformed/, JSON.stringify(body));
  }
});
