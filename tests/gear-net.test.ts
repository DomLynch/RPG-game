// The engine's gear screen's network half (origins/preview/gear-net.ts) against a fake writer: the calls, their order, and that a refusal or a bad reply never throws.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isOffline, openGear, runOp } from '../src/gear-net.ts';
import type { GearPiece, GearView } from '../src/gear-ledger.ts';

const piece = (id: string, lootId: string, where: GearPiece['where'], paperdoll: string | null = null): GearPiece => ({ id, item: `item:loot.${lootId}`, lootId, slot: null, where, index: where === 'equipped' ? null : 0, paperdoll, tier: null, version: 1 });
const view = (pieces: GearPiece[], worn: Record<string, string>): GearView => ({ pieces, worn, packSize: 8, bankSize: 100 });
const start = view([piece('i1', 'goblin.Body', 'equipped', 'chest'), piece('i2', 'veteran.Body', 'pack')], { chest: 'i1' });
const swapped = view([piece('i1', 'goblin.Body', 'pack'), piece('i2', 'veteran.Body', 'equipped', 'chest')], { chest: 'i2' });
type Seen = { op: string; body: Record<string, unknown>; auth: string | null };
const writer = (answers: Array<unknown | number>, seen: Seen[]): typeof fetch => (async (url: string, init: RequestInit) => {
  seen.push({ op: String(url).split('/').at(-1)!, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get('authorization') });
  const a = answers.shift();
  return typeof a === 'number' ? { status: a, json: async () => ({}) } : { status: 200, json: async () => ({ ok: true, result: a }) };
}) as never;

test('gear_open posts {character} with the bearer token and reads the view; no token is offline without a request', async () => {
  const seen: Seen[] = []; const got = await openGear('tok', 'c1', { fetch: writer([start], seen) });
  assert.deepEqual(got, start); assert.deepEqual(seen, [{ op: 'gear_open', body: { character: 'c1' }, auth: 'Bearer tok' }]);
  const none: Seen[] = []; assert.deepEqual(await openGear(null, 'c1', { fetch: writer([], none) }), { offline: 'no-session' }); assert.equal(none.length, 0);
});
test('wearing over an occupied slot is unequip then equip, in that order, and the last view is the answer', async () => {
  const seen: Seen[] = [];
  const out = await runOp('tok', 'c1', start, { kind: 'wear', id: 'veteran.Body' as never }, { fetch: writer([view([piece('i1', 'goblin.Body', 'pack'), piece('i2', 'veteran.Body', 'pack')], {}), swapped], seen) });
  assert.deepEqual(seen.map((s) => [s.op, s.body.id]), [['gear_unequip', 'i1'], ['gear_equip', 'i2']]);
  assert.deepEqual(out, { view: swapped, refused: false });
});
test('a refusal (422) stops the op and re-reads what the server holds; a malformed reply is the same; nothing throws', async () => {
  const seen: Seen[] = [];
  const out = await runOp('tok', 'c1', start, { kind: 'wear', id: 'veteran.Body' as never }, { fetch: writer([422, start], seen) });
  assert.deepEqual(seen.map((s) => s.op), ['gear_unequip', 'gear_open']); assert.deepEqual(out, { view: start, refused: true });
  const bad = await runOp('tok', 'c1', start, { kind: 'stow', key: 'chest' }, { fetch: writer([{ nope: 1 }, start], []) });
  assert.equal(bad.refused, true); assert.equal(isOffline(await openGear('tok', 'c1', { fetch: (() => { throw new Error('down'); }) as never })), true);
});

test('a swap whose equip is refused (the rank check): the occupant is put back before the re-read, so the slot is never left empty', async () => {
  const seen: Seen[] = [];
  const out = await runOp('tok', 'c1', start, { kind: 'wear', id: 'veteran.Body' as never }, { fetch: writer([view([piece('i1', 'goblin.Body', 'pack'), piece('i2', 'veteran.Body', 'pack')], {}), 422, start, start], seen) });
  assert.deepEqual(seen.map((s) => [s.op, s.body.id]), [['gear_unequip', 'i1'], ['gear_equip', 'i2'], ['gear_equip', 'i1'], ['gear_open', undefined]]);
  assert.deepEqual(out, { view: start, refused: true });
});
test('a refusal of the FIRST step has nothing to put back: just the re-read', async () => {
  const seen: Seen[] = [];
  await runOp('tok', 'c1', start, { kind: 'wear', id: 'veteran.Body' as never }, { fetch: writer([422, start], seen) });
  assert.deepEqual(seen.map((s) => s.op), ['gear_unequip', 'gear_open']);
});
