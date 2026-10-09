// The page's spawn client (spawn-net.ts) against the REAL writer handlers (createWriter + worldSpawnOps) over HTTP, with a stateful stand-in for migration 202610080014: one token per
// instance per account, at most 4 open, a kill consumes its token once and must clear the time-to-kill floor from ITS OWN issue time. The real-Postgres proof of the same rules is
// scripts/origins-spawns-check.mjs (#1949); this one proves the page drives them: three creatures on one player = three engages, three kill reports, the 5th engage refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { PC } from '../contracts/fixtures.ts';
import { loadEncounterContent } from '../encounters/encounters.ts';
import { fakeWhere } from '../presence/fixtures.ts';
import type { Db } from '../server/db.ts';
import { createWriter } from '../server/server.ts';
import { minHits, minKillMs, worldSpawnOps, zone1Spawns } from '../server/world-spawns.ts';
import { onCombatEvent, spawnTracker, SPENT_MS, TOUCH_EVERY_MS, engagedOf, killedOf } from './spawn-net.ts';

const loaded = loadEncounterContent();
if (!loaded.ok) throw new Error('Region 1 content must load for these tests');
const content = loaded.value, spawns = zone1Spawns(content), ids = [...spawns.keys()];
const ACCOUNT = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b';
const career = { seed_credit: 5000, world_credit: 0, total_credit: 5000, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 3 };

// 0014 in memory: the database clock is `clock.ms`.
function fakeSpawnDb(clock: { ms: number }) {
  type E = { token: string; character: string; instance: string; issuedAt: number; touchedAt: number; result: null | 'killed' | 'dead' };
  const engages = new Map<string, E>(), dead = new Set<string>(), calls: string[] = [];
  const open = () => [...engages.values()].filter((e) => e.result === null);
  const db: Db = { async run(sql, v = {}) {
    const fn = /public\.(origins_spawn_\w+)\(/.exec(sql.split('\\if :spawns')[1] ?? '')?.[1];
    if (fn) calls.push(fn);
    const iso = new Date(clock.ms).toISOString();
    if (fn === 'origins_spawn_engage') {
      if (dead.has(v.i!)) return JSON.stringify({ refused: 'dead' });
      const had = open().find((e) => e.instance === v.i);
      if (had) return JSON.stringify({ token: had.token, instance: had.instance, generation: 0, kind: v.k, issuedAt: iso, expiresAt: iso });
      if (open().length >= 4) return JSON.stringify({ refused: 'too-many' });
      engages.set(v.t!, { token: v.t!, character: v.c!, instance: v.i!, issuedAt: clock.ms, touchedAt: clock.ms, result: null });
      return JSON.stringify({ token: v.t, instance: v.i, generation: 0, kind: v.k, issuedAt: iso, expiresAt: iso });
    }
    if (fn === 'origins_spawn_engage_get') {
      const e = engages.get(v.t!);
      return JSON.stringify(e && e.result === null ? { token: e.token, character: e.character, instance: e.instance, generation: 0, issuedAt: iso, expiresAt: iso } : null);
    }
    if (fn === 'origins_spawn_touch') { const e = engages.get(v.t!); if (e) e.touchedAt = clock.ms; return JSON.stringify({ token: v.t, expiresAt: iso }); }
    if (fn === 'origins_spawn_kill') {
      const e = engages.get(v.t!)!;
      if (clock.ms - e.issuedAt < Number(v.m)) return JSON.stringify({ refused: 'too-fast' });
      e.result = 'killed'; dead.add(e.instance);
      return JSON.stringify({ result: 'killed', instance: e.instance, respawnAt: new Date(clock.ms + Number(v.r) * 1000).toISOString() });
    }
    if (/origins_metal_of/.test(sql)) return 'absent';
    return JSON.stringify({ marks: 0, career, characters: [{ id: PC, pack_slots: 20, bank_slots: 10 }], items: [], quests: [], journal: [], talk: [] });
  } };
  return { db, engages, calls, open };
}

async function writer(clock: { ms: number }) {
  const fake = fakeSpawnDb(clock);
  const w = createWriter({ db: fake.db, verify: async (t) => (t === 'tok' ? ACCOUNT : null), where: fakeWhere({}), handlers: worldSpawnOps({ content, spawns, now: () => new Date(clock.ms), log: () => {} }) });
  await new Promise<void>((ok) => w.listen(0, '127.0.0.1', ok));
  return { ...fake, base: `http://127.0.0.1:${(w.address() as AddressInfo).port}/origins`, close: () => new Promise<void>((ok) => w.close(() => ok())) };
}

test('three creatures on one player: three engages (three tokens), three kill reports each on its own token, the 5th engage refused while four are open', async () => {
  const clock = { ms: Date.parse('2026-10-09T10:00:00Z') }, w = await writer(clock);
  try {
    const t = spawnTracker({ token: () => 'tok', character: () => PC, now: () => clock.ms, base: w.base });
    const pack = ids.slice(0, 3);
    const got = await Promise.all(pack.map((id) => t.engaged(id)));   // three FightStarted in one step
    const tokens = got.map((g) => (engagedOf(g) as { token: string }).token);
    assert.equal(new Set(tokens).size, 3, 'three distinct tokens');
    assert.deepEqual(got.map((g) => (g as { instance: string }).instance), pack);
    assert.equal(await t.engaged(pack[0]!), got[0], 'a re-fired FightStarted reuses the open engage: no second request');
    assert.equal(w.calls.filter((c) => c === 'origins_spawn_engage').length, 3);
    assert.ok(!('offline' in await t.engaged(ids[3]!)), 'a 4th creature fits the cap');
    assert.deepEqual(await t.engaged(ids[4]!), { offline: 'http-429' }, 'a 5th engage while four are open is refused (too-many)');
    assert.ok(!t.open().includes(ids[4]!), 'a refused engage holds nothing');
    clock.ms += 60_000;   // past every creature's time-to-kill floor
    for (const id of pack) for (let i = 0; i < minHits(spawns.get(id)!.hp) + 2; i++) t.hit(id);
    const killed = [];
    for (const id of pack) killed.push(await t.killed(id));
    assert.deepEqual(killed.map((k) => killedOf(k)?.instance), pack, 'three kill reports, each accepted and paid once');
    assert.deepEqual(tokens.map((tk) => w.engages.get(tk)!.result), ['killed', 'killed', 'killed']);
    assert.deepEqual(await t.killed(pack[0]!), { offline: 'not-engaged' }, 'a second fall of the same creature sends nothing');
    assert.deepEqual(t.open(), [ids[3]], 'only the 4th creature is still held');
  } finally { await w.close(); }
});

test('each token keeps its own floor: a creature engaged late (at the kill) is refused too-fast, one engaged when it joined is paid', async () => {
  const clock = { ms: Date.parse('2026-10-09T10:00:00Z') }, w = await writer(clock);
  try {
    const t = spawnTracker({ token: () => 'tok', character: () => PC, now: () => clock.ms, base: w.base });
    const [early, late] = [ids[0]!, ids[1]!];
    await t.engaged(early);
    clock.ms += 60_000;
    await t.engaged(late);
    for (const id of [early, late]) for (let i = 0; i < minHits(spawns.get(id)!.hp); i++) t.hit(id);
    assert.equal(killedOf(await t.killed(early))?.result, 'killed');
    assert.ok(minKillMs(spawns.get(late)!.hp) > 0, 'every Zone 1 creature has a time floor');
    assert.deepEqual(await t.killed(late), { offline: 'http-422' }, 'engaged at the kill: too fast on its own floor, nothing paid');
  } finally { await w.close(); }
});

test('touch: a hit touches the token at most every TOUCH_EVERY_MS; tick touches a quiet one; evaded drops it with no report; no session or character sends nothing', async () => {
  const clock = { ms: 0 }, w = await writer(clock);
  try {
    const t = spawnTracker({ token: () => 'tok', character: () => PC, now: () => clock.ms, base: w.base });
    await t.engaged(ids[0]!);
    t.hit(ids[0]!); t.hit(ids[0]!);
    clock.ms += TOUCH_EVERY_MS; t.hit(ids[0]!);
    clock.ms += TOUCH_EVERY_MS; t.tick();
    await new Promise((ok) => setTimeout(ok, 50));
    assert.equal(w.calls.filter((c) => c === 'origins_spawn_touch').length, 2, 'one touch per window: the third hit, then the tick');
    t.evaded(ids[0]!);
    assert.deepEqual(await t.killed(ids[0]!), { offline: 'not-engaged' });
    assert.ok(!w.calls.includes('origins_spawn_kill'), 'an evaded creature is never reported');
    const anon = spawnTracker({ token: () => null, character: () => PC, now: () => 0, base: w.base });
    assert.deepEqual(await anon.engaged(ids[1]!), { offline: 'no-session' });
    const none = spawnTracker({ token: () => 'tok', character: () => null, now: () => 0, base: w.base });
    assert.deepEqual(await none.engaged(ids[1]!), { offline: 'no-character' });
    assert.equal(w.calls.filter((c) => c === 'origins_spawn_engage').length, 1);
  } finally { await w.close(); }
});

test('onCombatEvent: FightStarted alone engages (a tell, a swing or a first blow does not); his hits count per creature; a wander-past or another player\'s event engages nothing; Evaded drops', () => {
  const log: string[] = [];
  const t = { engaged: (i: string) => { log.push(`engage ${i}`); return Promise.resolve({ offline: 'x' }); }, hit: (i: string) => log.push(`hit ${i}`), evaded: (i: string) => log.push(`evade ${i}`), tick() {}, killed: () => Promise.resolve({ offline: 'x' }), open: () => [] };
  const on = onCombatEvent(t, 'me');
  on({ type: 'FightStarted', creature: 'wolves-1', player: 'me' });
  on({ type: 'FightStarted', creature: 'wolves-9', player: 'someone-else' });
  on({ type: 'Telegraph', id: 'wolves-2' });
  on({ type: 'Telegraph', id: 'me' });
  on({ type: 'Hit', attacker: 'me', victim: 'wolves-3' });
  on({ type: 'Hit', attacker: 'wolves-4', victim: 'me' });
  on({ type: 'Blocked', attacker: 'me', victim: 'wolves-5' });
  on({ type: 'Evaded', id: 'wolves-2' });
  assert.deepEqual(log, ['engage wolves-1', 'hit wolves-3', 'evade wolves-2']);
});

test('FightStarted twice for one creature (it left reach and came back) = ONE engage on its open token; after Evaded a new FightStarted engages again', async () => {
  const clock = { ms: Date.parse('2026-10-09T10:00:00Z') }, w = await writer(clock);
  try {
    const t = spawnTracker({ token: () => 'tok', character: () => PC, now: () => clock.ms, base: w.base }), on = onCombatEvent(t, 'me');
    on({ type: 'FightStarted', creature: ids[0]!, player: 'me' });
    const first = await t.engaged(ids[0]!);
    on({ type: 'FightStarted', creature: ids[0]!, player: 'me' });
    assert.equal(await t.engaged(ids[0]!), first, 'the same open engage');
    assert.equal(w.calls.filter((c) => c === 'origins_spawn_engage').length, 1, 'one request to the server');
    on({ type: 'Evaded', id: ids[0]! });
    assert.deepEqual(t.open(), []);
    on({ type: 'FightStarted', creature: ids[0]!, player: 'me' });
    await t.engaged(ids[0]!);
    assert.equal(w.calls.filter((c) => c === 'origins_spawn_engage').length, 2, 'a fresh fight after Evaded engages again (the server returns its still-open token)');
  } finally { await w.close(); }
});

test('killed BEFORE the killing Hit is delivered (any event order): the late Hit / FightStarted opens no new token; after SPENT_MS a respawned creature engages again', async () => {
  const clock = { ms: Date.parse('2026-10-09T10:00:00Z') }, w = await writer(clock);
  try {
    const t = spawnTracker({ token: () => 'tok', character: () => PC, now: () => clock.ms, base: w.base }), on = onCombatEvent(t, 'me');
    on({ type: 'FightStarted', creature: ids[0]!, player: 'me' });
    await t.engaged(ids[0]!);
    for (let i = 0; i < minHits(spawns.get(ids[0]!)!.hp); i++) on({ type: 'Hit', attacker: 'me', victim: ids[0]! });
    clock.ms += 60_000;
    assert.equal(killedOf(await t.killed(ids[0]!))?.result, 'killed');
    on({ type: 'Hit', attacker: 'me', victim: ids[0]! });   // the killing blow, delivered late
    on({ type: 'Hit', attacker: ids[0]!, victim: 'me' });
    on({ type: 'Telegraph', id: ids[0]! });
    assert.deepEqual(await t.engaged(ids[0]!), { offline: 'spent' });
    assert.deepEqual(t.open(), [], 'no 4th token held');
    assert.equal(w.calls.filter((c) => c === 'origins_spawn_engage').length, 1, 'no engage request after the kill');
    clock.ms += SPENT_MS;
    // past SPENT_MS the page asks again (the server answers by its own respawn clock)
    on({ type: 'FightStarted', creature: ids[0]!, player: 'me' });
    await t.engaged(ids[0]!);   // the same request (the open engage), awaited
    assert.equal(w.calls.filter((c) => c === 'origins_spawn_engage').length, 2, 'a respawned creature is engaged again');
  } finally { await w.close(); }
});
