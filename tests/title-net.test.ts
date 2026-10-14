import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renownOf } from '../src/core/title-net.ts';
import { createServerTitle } from '../src/core/title-server.ts';
import { AUTH_KEY } from '../src/core/writer-call.ts';

test('title_get answers are read by shape: a good one, an unrenowned one (empty title), and anything malformed is null (no line)', () => {
  assert.deepEqual(renownOf({ fame: 4200, karma: -300, title: ' The Dreaded ' }), { fame: 4200, karma: -300, title: 'The Dreaded' });
  assert.deepEqual(renownOf({ fame: 0, karma: 0, title: '' }), { fame: 0, karma: 0, title: '' });
  for (const bad of [null, {}, { fame: 1, karma: 1 }, { fame: 1.5, karma: 1, title: 'x' }, { fame: 1, karma: 1, title: 7 }, { fame: 1, karma: 1, title: 'x'.repeat(81) }, { fame: 1, karma: 1, title: '<b>x</b>' }, { fame: 1, karma: 1, title: 'a\nb' }]) assert.equal(renownOf(bad), null, JSON.stringify(bad));
});

const session = (storage: Map<string, string>) => storage.set(AUTH_KEY, JSON.stringify({ access_token: 'stub', expires_at: Math.floor(Date.now() / 1000) + 3600 }));
const port = (storage: Map<string, string>) => ({ getItem: (k: string) => storage.get(k) ?? null });
const reply = (result: unknown) => new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { 'content-type': 'application/json' } });

test('the server copy: a guest has no title and sends nothing; a signed-in character reads it; a failed read leaves the last one standing', async () => {
  const guest: string[] = [], gs = new Map<string, string>();
  const guestFetch = (async (url: string) => { guest.push(String(url)); return reply({}); }) as unknown as typeof fetch;
  assert.equal(await createServerTitle({ storage: port(gs), search: '', now: Date.now, fetch: guestFetch }).refresh(), '');
  assert.deepEqual(guest, [], 'a guest sends no request');

  const storage = new Map<string, string>(); session(storage);
  let title: unknown = { fame: 2500, karma: 900, title: 'The Honoured' }, asked: { character?: string } = {};
  const fetcher = (async (url: string, init?: { body?: string }) => {
    const op = String(url).split('/').pop();
    if (op === 'open') return reply({ characters: [{ id: 'pc:stub-1', name: 'Stubbs' }], career: { version: 1 } });
    asked = JSON.parse(init?.body ?? '{}');
    return title === 'down' ? new Response('', { status: 503 }) : reply(title);
  }) as unknown as typeof fetch;
  const s = createServerTitle({ storage: port(storage), search: '', now: Date.now, fetch: fetcher });
  assert.equal(await s.refresh(), 'The Honoured'); assert.equal(asked.character, 'pc:stub-1', 'it asks for the account character');
  title = 'down'; assert.equal(await s.refresh(), 'The Honoured', 'a failed read keeps the last title');
  title = { fame: 5, karma: 0, title: '' }; assert.equal(await s.refresh(), '', 'a character that lost its title shows none');
  title = { nope: 1 }; assert.equal(await s.refresh(), '', 'a malformed answer changes nothing');
});
