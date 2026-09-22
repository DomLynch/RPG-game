import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { OPPONENTS } from '../src/moves.ts';
import { createRecorder, decodeRecord } from '../src/record.ts';
import { MAX_STORED_CHARS, SHORT_ID, fetchSharedRecord, mintShare, publishRecord, sharedIdFrom, shortId, shortLink, shortParam } from '../src/share-store.ts';

const record = (ticks = 60) => { const rec = createRecorder({ weapon: 'longsword', build: 'dev', opponent: OPPONENTS.veteran.id, profile: 'normal', seed: 9 }); for (let i = 0; i < ticks; i++) rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true }); return rec.finish('abandoned'); };
// A fake client: records every insert and answers as told.
const fakeDb = (answers: ({ code?: string; message?: string } | null)[]) => { const inserts: Record<string, unknown>[] = []; const db = { from: (table: string) => ({ insert: async (row: Record<string, unknown>) => { assert.equal(table, 'fight_records'); inserts.push(row); return { error: answers.shift() ?? null }; } }) } as unknown as SupabaseClient; return { db, inserts }; };

test('share store: a short id is eight base64url symbols drawn from the random bytes; the link and the parameter round-trip; a malformed id is not a link', () => {
  const id = shortId(n => new Uint8Array(n).map((_, i) => i * 37));
  assert.match(id, SHORT_ID); assert.equal(id.length, 8);
  assert.equal(shortId(n => new Uint8Array(n).fill(0)), 'AAAAAAAA'); assert.equal(shortId(n => new Uint8Array(n).fill(63)), '--------');
  assert.match(shortId(), SHORT_ID, 'the default draws from crypto');
  assert.equal(shortLink('https://frankendom.com', '1a'), 'https://frankendom.com/s/1a');
  assert.equal(sharedIdFrom(new URL(shortLink('https://frankendom.com', 'Ab3_-9xZ')).pathname, ''), 'Ab3_-9xZ', 'an 8-character id minted before the sequence still resolves');
  assert.equal(shortParam('?r=short'), null); assert.equal(shortParam('?r=Ab3_-9xZtoolong'), null); assert.equal(shortParam('?opponent=goblin'), null);
});

test('share store: publish inserts the owner\'s row with the encoded record, draws a fresh id on a collision, and gives up on any other refusal or an oversized record', async () => {
  const good = fakeDb([null]);
  const id = await publishRecord(good.db, 'user-1', record());
  assert.match(id, SHORT_ID);
  assert.deepEqual(Object.keys(good.inserts[0]).sort(), ['id', 'opponent', 'record', 'user_id']);
  assert.equal(good.inserts[0].user_id, 'user-1'); assert.equal(good.inserts[0].opponent, 'veteran'); assert.equal(good.inserts[0].id, id);
  assert.deepEqual(await decodeRecord(good.inserts[0].record as string), record(), 'the stored text is the encoded record');
  const collide = fakeDb([{ code: '23505', message: 'duplicate key' }, null]);
  await publishRecord(collide.db, 'user-1', record());
  assert.equal(collide.inserts.length, 2); assert.notEqual(collide.inserts[0].id, collide.inserts[1].id, 'a collision draws again');
  const refused = fakeDb([{ code: '42501', message: 'new row violates row-level security policy' }]);
  await assert.rejects(publishRecord(refused.db, 'user-1', record()), /row-level security/);
  const exhausted = fakeDb([{ code: '23505' }, { code: '23505' }, { code: '23505' }]);
  await assert.rejects(publishRecord(exhausted.db, 'user-1', record()), /could not store/);
  const huge = fakeDb([null]);
  const rec = createRecorder({ weapon: 'longsword', build: 'dev', opponent: 'veteran', profile: 'normal', seed: 1 });
  for (let i = 0; i < 60000; i++) rec.push({ move: { x: Math.random() * 2 - 1, z: Math.random() * 2 - 1, yaw: Math.random() * 6 - 3, run: i % 2 === 0 }, action: (['light', 'heavy', 'thrust', null] as const)[i % 4], guard: false, lock: true });
  await assert.rejects(publishRecord(huge.db, 'user-1', rec.finish('abandoned')), /too long to store/);
  assert.equal(huge.inserts.length, 0, 'nothing is sent for a record over the cap');
});

test('share store: a shared record is fetched by id from the REST endpoint with the public key and read only when it is a well-formed row', async () => {
  const api = { url: 'https://x.supabase.co', key: 'pk' }, calls: { url: string; init?: RequestInit }[] = [];
  const answer = (status: number, body: unknown) => (async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init }); return { ok: status < 300, status, json: async () => body } as Response; }) as typeof fetch;
  assert.equal(await fetchSharedRecord(api, 'Ab3_-9xZ', answer(200, [{ record: 'AAAA' }])), 'AAAA');
  assert.equal(calls[0].url, 'https://x.supabase.co/rest/v1/fight_records?select=record&id=eq.Ab3_-9xZ');
  assert.equal((calls[0].init?.headers as Record<string, string>).apikey, 'pk');
  await assert.rejects(fetchSharedRecord(api, 'Ab3_-9xZ', answer(200, [])), /no such fight/);
  await assert.rejects(fetchSharedRecord(api, 'Ab3_-9xZ', answer(200, [{ record: 'not base64url!' }])), /no such fight/);
  await assert.rejects(fetchSharedRecord(api, 'Ab3_-9xZ', answer(200, [{ record: 'A'.repeat(MAX_STORED_CHARS + 1) }])), /no such fight/);
  await assert.rejects(fetchSharedRecord(api, 'Ab3_-9xZ', answer(503, null)), /answered 503/);
  await assert.rejects(fetchSharedRecord(api, 'nope', answer(200, [])), /no such fight/, 'a well-formed id with no row: unknown or expired'); await assert.rejects(fetchSharedRecord(api, 'no pe!', answer(200, [])), /not a fight link/);
  assert.equal(calls.length, 6, 'a malformed id never reaches the network (the well-formed nope did, once)');
});

// One link shape for everyone (owner 2026-09-22): `/s/<id>` carries a store-minted id; the pre-2026-09-22 `?r=` form still resolves
// until 2026-10-22; the store mints for guests (public key) and signed-in fighters (their token) alike, and a refusal is an error, never a long link.
test('share store: /s/<id> and the older ?r= form both name the shared record; mint_share is called with the caller\'s token and its id is validated', async () => {
  assert.equal(sharedIdFrom('/s/1a', ''), '1a'); assert.equal(sharedIdFrom('/s/zz9/', '?opponent=goblin'), 'zz9');
  assert.equal(sharedIdFrom('/', '?r=Ab3_-9xZ'), 'Ab3_-9xZ'); assert.equal(sharedIdFrom('/', ''), null);
  assert.equal(sharedIdFrom('/s/', ''), null); assert.equal(sharedIdFrom('/s/way-too-long-for-an-id', ''), null); assert.equal(sharedIdFrom('/settings', ''), null);
  const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
  const api = { url: 'https://x.supabase.co', key: 'anon-key' };
  const ok = (id: unknown) => (async (url: string, init?: RequestInit) => { calls.push({ url, headers: init!.headers as Record<string, string>, body: String(init!.body) }); return new Response(JSON.stringify(id), { status: 200 }); }) as unknown as typeof fetch;
  assert.equal(await mintShare(api, record(), null, ok('1a')), '1a');
  assert.equal(calls[0]!.url, 'https://x.supabase.co/rest/v1/rpc/mint_share'); assert.equal(calls[0]!.headers.Authorization, 'Bearer anon-key', 'a guest mints with the public key');
  assert.equal(JSON.parse(calls[0]!.body).opponent, 'veteran'); assert.ok(typeof JSON.parse(calls[0]!.body).record === 'string');
  await mintShare(api, record(), 'user-jwt', ok('1b')); assert.equal(calls[1]!.headers.Authorization, 'Bearer user-jwt', 'a signed-in fighter mints as themself');
  await assert.rejects(mintShare(api, record(), null, ok(42)), /no id/);
  await assert.rejects(mintShare(api, record(), null, (async () => new Response('nope', { status: 429 })) as unknown as typeof fetch), /refused the record \(429\)/);
});

test('share store: a minted short id (1–6 lowercase base-36) passes the reader\'s id check and is fetched by id; provenance keeps it', async () => {
  const calls: string[] = [];
  const fetchFn = (async (url: string) => { calls.push(url); return new Response(JSON.stringify([{ record: 'AAAA' }]), { status: 200 }); }) as unknown as typeof fetch;
  assert.equal(await fetchSharedRecord({ url: 'https://x.supabase.co', key: 'k' }, '1a', fetchFn), 'AAAA');
  assert.match(calls[0]!, /id=eq\.1a$/);
  await assert.rejects(fetchSharedRecord({ url: 'https://x.supabase.co', key: 'k' }, 'not an id at all', fetchFn), /not a fight link/);
});
