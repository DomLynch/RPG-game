import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { saveFailure, writeFighter } from '../src/core/cloud-profile.ts';

// The REAL supabase-js client against a stubbed PostgREST (the T4 zone-rename run's finding): a revision-guarded update that matches no row is answered 406 / PGRST116 "0 rows", and supabase-js
// passes that through as an error (it only turns a 0-row miss into null data for a read). The Pit's account line must call that a conflict ("Save changed on another device. Retry…"), not a failure
// (which sends a defect to Sentry and tells the player the save failed).
const stalePostgrest: typeof fetch = async () => new Response(JSON.stringify({ code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' }), { status: 406, headers: { 'content-type': 'application/json' } });
const client = (fetchStub: typeof fetch) => createClient('http://sb.test', 'key', { global: { fetch: fetchStub }, auth: { persistSession: false, autoRefreshToken: false } });
const fighter = { version: 1 as const, id: 'device-0001', name: 'Brand' };

test('a stale-revision write through the real client is a conflict for the account line', async () => {
  const failure = await writeFighter(client(stalePostgrest), 'user-1', fighter, 4).then(() => null, (error: unknown) => error);
  assert.ok(failure, 'the write is refused');
  assert.equal(saveFailure(failure), 'conflict');
});
test('a real failure is still a failure (a 500 is not a conflict) and a too-large loot is still too-large', async () => {
  const boom = await writeFighter(client(async () => new Response(JSON.stringify({ code: 'XX000', message: 'boom' }), { status: 500, headers: { 'content-type': 'application/json' } })), 'user-1', fighter, 4).then(() => null, (error: unknown) => error);
  assert.equal(saveFailure(boom), 'failed');
  assert.equal(saveFailure({ code: '23514', message: 'violates check constraint "fighter_profiles_loot_check"' }), 'too-large');
});
