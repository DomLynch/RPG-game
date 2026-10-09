// The engine's gear screen reads and writes the server's ledger when signed in, and falls back to the local one otherwise (src/gear-server.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServerGear } from '../src/gear-server.ts';
import type { Loot } from '../src/loot.ts';
import type { GearPiece, GearView } from '../src/gear-ledger.ts';

const piece = (id: string, lootId: string, where: GearPiece['where'], paperdoll: string | null = null): GearPiece => ({ id, item: `item:loot.${lootId}`, lootId, slot: null, where, index: where === 'equipped' ? null : 0, paperdoll, tier: null, version: 1 });
const dropped: GearView = { pieces: [piece('i1', 'goblin.Helmet', 'pack')], worn: {}, packSize: 8, bankSize: 100 };
const worn: GearView = { pieces: [piece('i1', 'goblin.Helmet', 'equipped', 'head')], worn: { head: 'i1' }, packSize: 8, bankSize: 100 };
const NOW = 1_800_000_000_000, session = JSON.stringify({ access_token: 'tok', expires_at: NOW / 1000 + 3600 });
const storage = (signedIn: boolean) => ({ getItem: (k: string) => (signedIn && k === 'frankendom.auth.v1' ? session : null) });
const opened = { career: { totalCredit: 0 }, characters: [{ id: 'c1', name: 'Dom' }], marks: 0 };
const writer = (seen: string[], answers: Record<string, unknown[]>): typeof fetch => (async (url: string) => {
  const op = String(url).split('/').at(-1)!; seen.push(op); const a = answers[op]?.shift();
  return a === undefined ? { status: 503, json: async () => ({}) } : { status: 200, json: async () => ({ ok: true, result: a }) };
}) as never;

test('signed in: opening the sheet shows the SERVER ledger (a goblin helmet dropped in Zone 1 is there), keeping the local move and skull wall', async () => {
  const seen: string[] = []; let shown: Loot | undefined;
  const g = createServerGear({ storage: storage(true), search: '', now: () => NOW, fetch: writer(seen, { open: [opened], gear_open: [dropped] }), getLoot: () => ({ owned: [], equipped: {}, skill: 'pommel' }), show: (l) => { shown = l; } });
  assert.equal(await g.refresh(), true);
  assert.deepEqual(shown?.owned, ['goblin.Helmet']); assert.deepEqual(shown?.pack, ['goblin.Helmet']); assert.equal(shown?.skill, 'pommel');
});
test('wearing is the server\'s call and the screen then shows what the server answered; the local ledger never decides', async () => {
  const seen: string[] = []; let shown: Loot | undefined;
  const g = createServerGear({ storage: storage(true), search: '', now: () => NOW, fetch: writer(seen, { open: [opened], gear_open: [dropped], gear_equip: [worn] }), getLoot: () => undefined, show: (l) => { shown = l; } });
  await g.refresh(); assert.equal(g.act({ kind: 'wear', id: 'goblin.Helmet' as never }), true);
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(seen, ['open', 'gear_open', 'gear_equip']); assert.deepEqual(shown?.equipped, { head: 'goblin.Helmet' });
});
test('a guest, or a writer that does not answer, keeps the local ledger: refresh is false and act is not handled', async () => {
  const seen: string[] = [];
  const guest = createServerGear({ storage: storage(false), search: '', now: () => NOW, fetch: writer(seen, {}), getLoot: () => undefined, show: () => assert.fail('shows nothing') });
  assert.equal(await guest.refresh(), false); assert.equal(guest.act({ kind: 'stow', key: 'head' }), false); assert.equal(seen.length, 0, 'no request without a session');
  const down = createServerGear({ storage: storage(true), search: '', now: () => NOW, fetch: writer([], {}), getLoot: () => undefined, show: () => assert.fail('shows nothing') });
  assert.equal(await down.refresh(), false); assert.equal(down.act({ kind: 'stow', key: 'head' }), false);
});

test('Zone 1\'s menu Gear button is the temporary page hop to the engine\'s gear screen, marked for deletion in the last A PR (Strategy 2026-10-09), and the Pit lands it on Profile with a way back', async () => {
  const { readFileSync } = await import('node:fs');
  const zone1 = readFileSync(new URL('../origins/preview/main.ts', import.meta.url), 'utf8'), pit = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(zone1, /TEMPORARY: deleted in the last A PR \(Strategy 10-09\)[^\n]*\n[^\n]*menu-gear[^\n]*location\.assign\('\/arena\/\?gear=1'\)/);
  assert.match(pit, /TEMPORARY: deleted in the last A PR \(Strategy 10-09\)/); assert.match(pit, /back\.addEventListener\('click', \(\) => location\.assign\('\/zone1\/'\)\)/);
});

test('no loss: the server view is SHOWN from a shadow and never written into the device profile, so a later persist of the profile (a decline, a take) saves the device\'s own ledger untouched', async () => {
  const real = { loot: { owned: ['knight.Helmet'], equipped: { head: 'knight.Helmet' }, skill: 'pommel' } as unknown as Loot }, before = JSON.stringify(real);
  const g = createServerGear({ storage: storage(true), search: '', now: () => NOW, fetch: writer([], { open: [opened], gear_open: [dropped] }), getLoot: () => real.loot, show: (l) => { g.profileFor(real).loot = l; } });
  assert.equal(g.profileFor(real), real, 'before the server answers the sheet reads the device profile');
  assert.equal(await g.refresh(), true);
  assert.notEqual(g.profileFor(real), real); assert.deepEqual(g.profileFor(real).loot?.owned, ['goblin.Helmet'], 'the sheet shows the server\'s pieces');
  assert.equal(JSON.stringify(real), before, 'the device profile is byte-identical: persisting it loses and adds nothing');
});
test('signed in with the answer still on its way, a tap is swallowed (the device ledger must not change behind the server\'s); once the writer has failed to answer it falls back to the device', async () => {
  let release!: (v: unknown) => void; const slow = new Promise((r) => { release = r; });
  const g = createServerGear({ storage: storage(true), search: '', now: () => NOW, fetch: (async () => { await slow; return { status: 503, json: async () => ({}) }; }) as never, getLoot: () => undefined, show: () => {} });
  const pending = g.refresh();
  assert.equal(g.act({ kind: 'stow', key: 'head' }), true, 'handled (ignored) while loading');
  release(1); assert.equal(await pending, false);
  assert.equal(g.act({ kind: 'stow', key: 'head' }), false, 'the writer never answered: the device ledger takes it');
});
