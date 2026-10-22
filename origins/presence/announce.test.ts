// The presence `announce` frame (the boss shout, docs/specs/origins/pit-live-zone.md): its text is a row, the server alone sends it, to everyone in one zone (and layer), never to a v1 client, and a client
// cannot send one. The internal route names a row id, never text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { announceIds, announceText, loadAnnounce } from './announce.ts';
import DEFS from './announce-rows.json' with { type: 'json' };
import { presenceRule } from './presence-rules.ts';
import { createPresence } from './server.ts';
import { zoneAt } from './zones.ts';
import { joinBot } from './test-client.ts';

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const until = async (ok: () => boolean, ms = 3000): Promise<void> => { for (let t = 0; t < ms && !ok(); t += 25) await wait(25); };
const ACCOUNTS: Record<string, string> = { a: '00000000-0000-4000-8000-0000000000a1', b: '00000000-0000-4000-8000-0000000000b2', c: '00000000-0000-4000-8000-0000000000c3' };

test('the rows: the shipped table loads, an unknown id has no text, and a duplicate, an empty, a multi-line or an over-long text refuses to load', () => {
  assert.ok(announceIds().length > 0 && announceIds().every((id) => (announceText(id) ?? '') !== ''));
  assert.equal(announceText('no-such-row'), null);
  const ok = DEFS.rows[0]!;
  assert.throws(() => loadAnnounce({ rows: [ok, ok] }), /duplicate|twice|unique/i);
  assert.throws(() => loadAnnounce({ rows: [{ ...ok, text: '  ' }] }), /one non-empty line/);
  assert.throws(() => loadAnnounce({ rows: [{ ...ok, text: 'a\nb' }] }), /one non-empty line/);
  assert.throws(() => loadAnnounce({ rows: [{ ...ok, text: 'x'.repeat(presenceRule('announceMaxChars') + 1) }] }), /characters/);
  assert.throws(() => loadAnnounce({ rows: [{ id: 'no-text' }] }), /text/i);
});

const post = (port: number, body: unknown, key = 'k'): Promise<Response> =>
  fetch(`http://127.0.0.1:${port}/internal/announce`, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('the server sends it: to the players in the named zone only, a guest included, a v1 client never; the route refuses a bad key, id, zone or layer', async () => {
  const id = announceIds()[0]!, text = announceText(id)!;
  const p = createPresence({ verify: async (t) => ACCOUNTS[t] ?? null, log: () => {}, internalKey: 'k' });
  await new Promise<void>((r) => p.server.listen(0, '127.0.0.1', r));
  try {
    const pit = await joinBot(p.port(), 'a');                       // the Pit yard (the spawn)
    const guest = await joinBot(p.port(), null);                    // a guest also stands in the Pit yard
    const far = await joinBot(p.port(), 'b'); far.warp('zone1-start'); await until(() => far.hellos() === 2);
    const old = await joinBot(p.port(), 'c', { v1: true });         // a v1 client in the Pit yard cannot hold the frame
    const held = (acct: string) => p.world.byAccount.get(acct)!;
    const pitZone = zoneAt(held(ACCOUNTS.a!).x, held(ACCOUNTS.a!).z)!, farZone = zoneAt(held(ACCOUNTS.b!).x, held(ACCOUNTS.b!).z)!;
    assert.notEqual(pitZone, farZone);

    const res = await post(p.port(), { id, zone: pitZone });
    assert.deepEqual([res.status, await res.json()], [200, { sent: 2 }], 'the pit player and the guest, not the far player nor the v1 client');
    await until(() => pit.announcements().length > 0 && guest.announcements().length > 0);
    assert.deepEqual(pit.announcements(), [{ id, text }]);
    assert.deepEqual(guest.announcements(), [{ id, text }]);
    await wait(150);
    assert.deepEqual([far.announcements(), old.announcements()], [[], []]);

    const other = await post(p.port(), { id, zone: farZone, layer: held(ACCOUNTS.b!).layer.id });
    assert.deepEqual([other.status, await other.json()], [200, { sent: 1 }]);
    await until(() => far.announcements().length > 0); assert.deepEqual(far.announcements(), [{ id, text }]);
    const wrongLayer = await post(p.port(), { id, zone: farZone, layer: held(ACCOUNTS.b!).layer.id + 50 });
    assert.deepEqual([wrongLayer.status, await wrongLayer.json()], [200, { sent: 0 }], 'a layer nobody is in: nobody hears it');
    assert.equal(p.announce(farZone, null, id), 1, 'the in-process call is the same send');
    assert.equal(p.announce(farZone, null, 'no-such-row'), null);

    for (const [why, body, status] of [['no such row', { id: 'no-such-row', zone: pitZone }, 404], ['id missing', { zone: pitZone }, 400], ['no such zone', { id, zone: 'nowhere' }, 400], ['zone missing', { id }, 400],
      ['layer 0', { id, zone: pitZone, layer: 0 }, 400], ['layer 1.5', { id, zone: pitZone, layer: 1.5 }, 400], ['text in the body is not a field', { id: 'no-such-row', zone: pitZone, text: 'forged' }, 404]] as const) {
      const r = await post(p.port(), body); assert.equal(r.status, status, why);
    }
    assert.equal((await post(p.port(), { id, zone: pitZone }, 'wrong')).status, 401, 'a wrong key');
    assert.equal((await fetch(`http://127.0.0.1:${p.port()}/internal/announce`, { method: 'POST', body: '{}' })).status, 401, 'no key');
    assert.equal((await fetch(`http://127.0.0.1:${p.port()}/internal/announce`, { method: 'GET' })).status, 404, 'a GET is not the route');
    assert.deepEqual(pit.announcements().length, 1, 'the refusals sent nothing');
  } finally { await p.close(); }
});

test('no key configured: the route does not exist; a client cannot send an announce frame (the socket closes)', async () => {
  const p = createPresence({ verify: async (t) => ACCOUNTS[t] ?? null, log: () => {} });
  await new Promise<void>((r) => p.server.listen(0, '127.0.0.1', r));
  try {
    assert.equal((await post(p.port(), { id: announceIds()[0], zone: 'pit-yard' })).status, 404);
    const a = await joinBot(p.port(), 'a'); a.raw(JSON.stringify({ t: 'announce', id: announceIds()[0], text: 'forged' }));
    await until(() => a.closeCode() !== null); assert.equal(a.closeCode(), 1003);
    const g = await joinBot(p.port(), null); g.raw(JSON.stringify({ t: 'announce', id: announceIds()[0] }));
    await until(() => g.closeCode() !== null); assert.equal(g.closeCode(), 1003);
  } finally { await p.close(); }
});
