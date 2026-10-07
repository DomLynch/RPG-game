// Lead's launch gate: the Origins writer derives a player's place from server presence, never from the request body. This is the presence side: GET /internal/where, the
// fail-closed client (origins/presence/where.ts) and the fixture the writer's tests inject (origins/presence/fixtures.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPresence } from '../origins/presence/server.ts';
import { fakeWhere, offline, standingAt, unplaced } from '../origins/presence/fixtures.ts';
import { inZone, parseWhere, presenceWhere, standsWithin } from '../origins/presence/where.ts';

const acct = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const KEY = 'test-internal-key-0123456789';
const verify = async (): Promise<string | null> => null;
const start = async (internalKey: string | undefined, clock: { t: number }) => {
  const p = createPresence({ verify, log: () => {}, internalKey, now: () => clock.t });
  await new Promise<void>(r => p.server.listen(0, '127.0.0.1', r));
  return { p, base: `http://127.0.0.1:${p.port()}` };
};
const get = (base: string, account: string, auth?: string) => fetch(`${base}/internal/where?account=${account}`, { headers: auth ? { authorization: auth } : {} });
const pose = (x: number, z: number) => ({ x, z, heading: 0, anim: 0, flags: 0 });

test('where: the service answers from its own state, offline, unplaced and placed, and the client round-trips it', async () => {
  const clock = { t: 1_000_000 };
  const { p, base } = await start(KEY, clock);
  try {
    const placed = p.world.join(acct(1), clock.t, undefined, { x: 15000, z: 16000 })!;
    p.world.join(acct(2), clock.t)!;   // no known position: placed by its first pose
    const where = presenceWhere(base, KEY);
    assert.deepEqual(await where(acct(3)), { online: false }, 'an account that is not in presence');
    assert.deepEqual(await where(acct(2)), { online: true, layer: placed.layer.id, placed: false }, 'in the world but never placed: no position is given');
    clock.t += 750;
    assert.deepEqual(await where(acct(1)), { online: true, layer: placed.layer.id, placed: true, x: 15000, z: 16000, zone: 'pit-yard', ageMs: 750 }, 'placed: the position, the zone presence computed from it, and the time since its last pose');
    p.world.move(placed, pose(15100, 16000), clock.t);
    clock.t += 40;
    assert.deepEqual(await where(acct(1)), { online: true, layer: placed.layer.id, placed: true, x: 15100, z: 16000, zone: 'pit-yard', ageMs: 40 }, 'a move updates both');
    const trader = p.world.join(acct(4), clock.t, undefined, { x: 15000, z: 11000 })!;   // world (0, -40 m): inside the Exchange
    assert.equal(((await where(acct(4))) as { zone: string | null }).zone, 'exchange', 'the zone comes from the position in the Concord frame');
    p.world.leave(trader, clock.t);
    assert.equal(((await (await get(base, acct(1).toUpperCase(), `Bearer ${KEY}`)).json()) as { online: boolean }).online, true, 'an upper-case account id is the same account');
    p.world.leave(placed, clock.t);
    assert.deepEqual(await where(acct(1)), { online: false }, 'a player who left is offline at once');
  } finally { await p.close(); }
});

test('where: no key, a wrong key, or a bad account is refused, and without a configured key the route does not exist', async () => {
  const clock = { t: 5 };
  const { p, base } = await start(KEY, clock);
  try {
    p.world.join(acct(1), clock.t, undefined, { x: 100, z: 100 });
    assert.equal((await get(base, acct(1))).status, 401, 'no Authorization header');
    assert.equal((await get(base, acct(1), 'Bearer nope')).status, 401, 'a wrong key');
    assert.equal((await get(base, acct(1), `Bearer ${KEY}x`)).status, 401, 'a key that is a prefix match plus more');
    assert.equal((await get(base, acct(1), KEY)).status, 401, 'the bare key without Bearer');
    assert.equal((await get(base, 'not-a-uuid', `Bearer ${KEY}`)).status, 400, 'a malformed account');
    const refused = await (await get(base, acct(1))).text();
    assert.doesNotMatch(refused, /"x"|"z"/, 'a refusal carries no position');
    await assert.rejects(presenceWhere(base, 'wrong')(acct(1)), /HTTP 401/, 'the client turns a refusal into an error');
  } finally { await p.close(); }
  const off = await start(undefined, clock);
  try { assert.equal((await get(off.base, acct(1), `Bearer ${KEY}`)).status, 404, 'no key configured: the route is not there'); } finally { await off.p.close(); }
});

test('where: fails closed: an unreachable service, a timeout and a malformed answer are errors, never a position', async () => {
  const clock = { t: 5 };
  const { p, base } = await start(KEY, clock);
  await p.close();
  await assert.rejects(presenceWhere(base, KEY, 300)(acct(1)), /./, 'a service that is down');
  const wrong = (body: unknown, status = 200): typeof fetch => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
  await assert.rejects(presenceWhere('http://x', KEY, 300, wrong({ online: true, layer: 1, placed: true, x: 1, z: 2, zone: null }))(acct(1)), /malformed/, 'a placed answer without ageMs');
  await assert.rejects(presenceWhere('http://x', KEY, 300, wrong({ online: true, layer: 1, placed: true, x: 1, z: 2, ageMs: 0 }))(acct(1)), /malformed/, 'a placed answer without a zone field');
  await assert.rejects(presenceWhere('http://x', KEY, 300, wrong({ online: true, layer: 1, placed: true, x: 1, z: 2, zone: 7, ageMs: 0 }))(acct(1)), /malformed/, 'a zone that is neither a string nor null');
  await assert.rejects(presenceWhere('http://x', KEY, 300, wrong({ online: 'yes' }))(acct(1)), /malformed/);
  await assert.rejects(presenceWhere('http://x', KEY, 300, wrong({ online: true, layer: 1, placed: true, x: 'a', z: 2, ageMs: 0 }))(acct(1)), /malformed/, 'a non-numeric position');
  await assert.rejects(presenceWhere('http://x', KEY, 300, wrong({}, 500))(acct(1)), /HTTP 500/);
  assert.throws(() => parseWhere(null), /malformed/);
  assert.throws(() => parseWhere({ online: true, layer: NaN, placed: false }), /malformed/);
});

test('standsWithin: only a placed, fresh player inside the radius is at the place; offline, unplaced, stale and outside are all no', () => {
  const area = { x: 15000, z: 15000, radiusCm: 1000 }, fresh = 5000;
  assert.equal(standsWithin(standingAt(15000, 15000, 0), area, fresh), true, 'at the centre');
  assert.equal(standsWithin(standingAt(16000, 15000, 0), area, fresh), true, 'exactly on the radius counts as inside');
  assert.equal(standsWithin(standingAt(16001, 15000, 0), area, fresh), false, 'one centimetre outside');
  assert.equal(standsWithin(standingAt(15000, 15000, fresh), area, fresh), true, 'a pose exactly maxAge old is still fresh');
  assert.equal(standsWithin(standingAt(15000, 15000, fresh + 1), area, fresh), false, 'a stale pose never counts, however close');
  assert.equal(standsWithin(unplaced(), area, fresh), false, 'unplaced: position unknown');
  assert.equal(standsWithin(offline(), area, fresh), false, 'offline');
});

test('inZone: X1\'s test is zone === the named zone AND fresh; the wrong zone, a null zone, stale, unplaced and offline are all no', () => {
  const trader = standingAt(15000, 11000, 0), fresh = 8000;   // the Exchange
  assert.equal(inZone(trader, 'exchange', fresh), true);
  assert.equal(inZone(standingAt(15000, 11000, fresh), 'exchange', fresh), true, 'exactly maxAge old is fresh');
  assert.equal(inZone(standingAt(15000, 11000, fresh + 1), 'exchange', fresh), false, 'stale');
  assert.equal(inZone(standingAt(15000, 15000, 0), 'exchange', fresh), false, 'the Pit yard is not the Exchange');
  assert.equal(inZone(standingAt(100, 100, 0), 'exchange', fresh), false, 'a null zone (open ground) is not the Exchange');
  assert.equal(inZone(unplaced(), 'exchange', fresh), false);
  assert.equal(inZone(offline(), 'exchange', fresh), false);
});

test('fixtures: fakeWhere answers from a table, an unknown account is offline, and a broken one throws like a down service', async () => {
  const where = fakeWhere({ [acct(1)]: standingAt(10, 20, 30, 2), [acct(2)]: unplaced() });
  assert.deepEqual(await where(acct(1)), { online: true, layer: 2, placed: true, x: 10, z: 20, zone: null, ageMs: 30 }, 'a spot in neither zone has zone null');
  assert.deepEqual(await where(acct(2)), { online: true, layer: 1, placed: false });
  assert.deepEqual(await where(acct(9)), { online: false });
  await assert.rejects(fakeWhere({}, true)(acct(1)), /unreachable/);
});
