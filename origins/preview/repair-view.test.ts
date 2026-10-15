import assert from 'node:assert/strict';
import { test } from 'node:test';
import { repairLines, chromeText } from './repair-view.ts';
import { wearOf, repairedOf, readWear, repairPiece, repairOp, repairKey } from './repair-net.ts';

const piece = { instance: 'inst:a1', slot: 'Body', worn: 30, max: 90, baseMax: 100, quote: { points: 30, bronze: 220, metal: { item: 'item:grave-iron', qty: 3 } } };
test('a line shows the writer\'s durability and quote, and says when the limit has worn down', () => {
  const [l] = repairLines([piece], (i) => `N:${i}`);
  assert.equal(l!.durabilityText, '60 of 90 left'); assert.equal(l!.fraction, 60 / 90);
  assert.equal(l!.quoteText, 'Repair: 220 bronze and 3 N:item:grave-iron'); assert.equal(l!.shrunkText, 'Its limit has worn down from 100.');
  assert.equal(repairLines([{ ...piece, max: 100 }], (i) => i)[0]!.shrunkText, '');
});
test('no pieces, no lines: an empty list is the answer, not an error', () => { assert.deepEqual(repairLines([], (i) => i), []); assert.deepEqual(wearOf({ pieces: [] }), { pieces: [] }); });
test('gear_wear and gear_repair replies are read strictly', () => {
  assert.deepEqual(wearOf({ pieces: [piece] })!.pieces[0], piece);
  assert.equal(wearOf({ pieces: [{ ...piece, worn: 'a lot' }] }), null); assert.equal(wearOf({ pieces: [{ ...piece, quote: { points: 1, bronze: 1 } }] }), null); assert.equal(wearOf({}), null);
  const r = { instance: 'inst:a1', points: 30, cost: { bronze: 220, metal: { item: 'item:grave-iron', qty: 3 } }, piece: { worn: 0, max: 88, baseMax: 100 }, replayed: false };
  assert.deepEqual(repairedOf(r)!.piece, { worn: 0, max: 88, baseMax: 100 }); assert.equal(repairedOf({ ...r, cost: { bronze: 'x' } }), null);
});
test('the repair body is ids only (no price, tier, slot or wear) and the read body is the character', async () => {
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  const fetch = (async (url: string, init: RequestInit) => { sent.push({ url, body: JSON.parse(String(init.body)) }); return new Response(JSON.stringify({ ok: true, result: url.endsWith('gear_wear') ? { pieces: [] } : { instance: 'inst:a1', points: 1, cost: { bronze: 1, metal: { item: 'item:grave-iron', qty: 0 } }, piece: { worn: 0, max: 9, baseMax: 9 }, replayed: false } }), { status: 200 }); }) as typeof globalThis.fetch;
  await readWear('tok', 'pc:1', { fetch, base: '/origins' }); await repairPiece('tok', 'pc:1', 'inst:a1', 'repair:x-12345678', { fetch, base: '/origins' });
  assert.deepEqual(sent.map((s) => [s.url, Object.keys(s.body).sort()]), [['/origins/gear_wear', ['character']], ['/origins/gear_repair', ['character', 'instance', 'op']]]);
  assert.deepEqual(await readWear(null, 'pc:1', { fetch }), { offline: 'no-session' });
});
test('a fresh op id per click matches the writer\'s rule, and refusals read by status', () => {
  const a = repairOp('inst:A1', 1_700_000_000_000, () => 0.25), b = repairOp('inst:A1', 1_700_000_000_000, () => 0.75);
  assert.match(a, /^[a-z0-9][a-z0-9:._-]{7,119}$/); assert.notEqual(a, b);
  assert.deepEqual([repairKey('no-session'), repairKey('http-409'), repairKey('http-422'), repairKey('timeout')], ['offline', 'stale', 'refused', 'failed']);
  assert.deepEqual(['away', 'funds', 'metal', 'not-worn', 'no-wear', 'something-new'].map((c) => repairKey('http-422', c)), ['away', 'funds', 'metal', 'notWorn', 'noWear', 'refused']);   // the writer's code wins; a code the page does not know falls back to the status
  assert.equal(chromeText('repaired', { slot: 'Body', bronze: 220, qty: 3, item: 'Grave iron' }), 'Repaired your Body for 220 bronze and 3 Grave iron.');
});
test('the writer\'s 422 code reaches the page, and only a short kebab code does', async () => {
  const answer = (status: number, body: unknown) => (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as typeof globalThis.fetch;
  assert.deepEqual(await repairPiece('t', 'pc:1', 'inst:a', 'repair:x-12345678', { fetch: answer(422, { ok: false, error: 'the smith wants 40 bronze', code: 'funds' }) }), { offline: 'http-422', code: 'funds' });
  assert.deepEqual(await repairPiece('t', 'pc:1', 'inst:a', 'repair:x-12345678', { fetch: answer(409, { ok: false, error: 'stale' }) }), { offline: 'http-409' });
  for (const code of ['Not Kebab', 'x'.repeat(41), 7, null]) assert.deepEqual(await repairPiece('t', 'pc:1', 'inst:a', 'repair:x-12345678', { fetch: answer(422, { ok: false, code }) }), { offline: 'http-422' });
  assert.deepEqual(await repairPiece('t', 'pc:1', 'inst:a', 'repair:x-12345678', { fetch: answer(502, '<html>bad gateway</html>') }), { offline: 'http-502' });
});
