// SCOPE 2026-10-16 item 3: a guest's kills, loot and fight results never reach a leaderboard, the kill ledger or any persistent row. A guest has no account: presence mints its identity (not a uuid, no token),
// so every writer route must refuse it, and nothing may be written. This pins that for EVERY op the production writer serves (the same composition as scripts/origins-writer.mjs, so a new op is covered
// the day it is added), through the real Bearer check, plus the internal routes and the anonymous-Supabase-user case.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { supabaseVerify } from './auth.ts';
import { loadEncounterContent } from '../encounters/encounters.ts';
import type { Db } from './db.ts';
import { encounterOps } from './encounter.ts';
import { groundOps } from './ground-take.ts';
import { itemOps } from './content-ops.ts';
import { storyOps, type Handler } from './handlers.ts';
import { createWriter } from './server.ts';
import { worldSpawnOps } from './world-spawns.ts';

const REAL = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b';
const production = (): Record<string, Handler> => ({ ...itemOps(loadEncounterContent()), ...storyOps(null), ...groundOps(null), ...worldSpawnOps(null), ...encounterOps(null) });
// Supabase Auth, faked: it vouches for the real token only; the anonymous token answers a user flagged is_anonymous (a Supabase anonymous sign-in); anything else is 401.
const auth = (async (_url, init) => {
  const bearer = String((init?.headers as Record<string, string>).authorization).slice(7);
  if (bearer === 'real') return new Response(JSON.stringify({ id: REAL }), { status: 200 });
  if (bearer === 'anon') return new Response(JSON.stringify({ id: '7c1d4a52-9b3e-4f60-8a21-5e0c9d7b1f34', is_anonymous: true }), { status: 200 });
  return new Response('{}', { status: 401 });
}) as typeof fetch;

async function serve() {
  const touched: string[] = [], called: string[] = [];
  const db: Db = { async run(sql) { touched.push(sql.slice(0, 60)); return '[]'; } };
  const spies = Object.fromEntries(Object.keys(production()).map((op) => [op, (async () => { called.push(op); return {}; }) as Handler]));
  const server = createWriter({ db, verify: supabaseVerify('http://auth.test', 'anon-key', auth), where: async () => ({ online: false }), handlers: spies });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, touched, called, ops: Object.keys(spies), close: () => new Promise((r) => server.close(r)) };
}
const post = (url: string, op: string, authorization?: string) => fetch(`${url}/origins/${op}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) }, body: JSON.stringify({ character: 'pc:dom-1' }) });

test('the production writer serves the routes a guest could aim at (a drift sentinel: kill/loot claims, ledger, gear, bank, shop, encounters)', async () => {
  const s = await serve();
  try {
    for (const op of ['kill_report', 'engage', 'touch', 'ground_take', 'encounter_settle', 'gear_open', 'gear_equip', 'gear_unequip', 'bank_move', 'shop_buy', 'consume', 'open', 'create_character']) assert.ok(s.ops.includes(op), `${op} is a writer op`);
  } finally { await s.close(); }
});

test('every writer route refuses a guest: no token, a guest-minted identity as the token, an anonymous Supabase user, a token Auth refuses: 401, no handler runs, the database is never touched', async () => {
  const s = await serve();
  try {
    for (const op of s.ops) {
      for (const authorization of [undefined, 'Bearer guest', 'Bearer guest:42', 'Bearer anon', 'Bearer ' + 'x'.repeat(64), 'Basic Z3Vlc3Q6']) {
        const res = await post(s.url, op, authorization);
        assert.equal(res.status, 401, `${op} with ${authorization ?? 'no token'} answers 401`);
      }
    }
    assert.deepEqual(s.called, [], 'no handler ran for a guest');
    assert.deepEqual(s.touched, [], 'nothing was written or read');
  } finally { await s.close(); }
});

test('the internal routes refuse a guest identity: a position save or a read for a non-uuid account is 400 (and with no key 401), and nothing is written', async () => {
  const touched: string[] = [], db: Db = { async run(sql) { touched.push(sql.slice(0, 60)); return '[]'; } };
  const server = createWriter({ db, verify: supabaseVerify('http://auth.test', 'anon-key', auth), where: async () => ({ online: false }), handlers: {}, internal: { key: 'internal-key' } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/internal/location`, key = { authorization: 'Bearer internal-key' };
  try {
    for (const account of ['guest', 'guest:42', 'g-7', '']) {
      const save = await fetch(url, { method: 'POST', headers: key, body: JSON.stringify({ account, x: 100, z: 100 }) });
      assert.equal(save.status, 400, `a position save for "${account}" is refused`);
      assert.equal((await fetch(`${url}?account=${encodeURIComponent(account)}`, { headers: key })).status, 400, `a read for "${account}" is refused`);
      assert.equal((await fetch(`${url}?account=${encodeURIComponent(account)}&worn=1`, { headers: key })).status, 400, `a worn read for "${account}" is refused`);
    }
    assert.equal((await fetch(url, { method: 'POST', body: JSON.stringify({ account: REAL, x: 100, z: 100 }) })).status, 401, 'no key, no write');
    assert.deepEqual(touched, [], 'nothing was written or read');
  } finally { await new Promise((r) => server.close(r)); }
});

test('the same writer still serves a signed-in account (the guard is the token, not a blanket refusal)', async () => {
  const s = await serve();
  try {
    assert.equal((await post(s.url, 'gear_open', 'Bearer real')).status, 200);
    assert.deepEqual(s.called, ['gear_open']);
  } finally { await s.close(); }
});
