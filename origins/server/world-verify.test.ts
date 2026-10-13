import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeWorldRecord, type WorldRecord } from "../../src/fight/server.ts";
import { createWorldCombat as live } from '../../src/fight/world-combat.ts';
import { verifyWorldRecord } from './world-verify.ts';
import { worldSpawnOps, defaultZoneSpawns, type Spawn } from './world-spawns.ts';
import { loadEncounterContent, lookupOf } from '../encounters/encounters.ts';
import { openInventory } from '../inventory/inventory.ts';
import { ACCOUNT, PC } from '../../src/core/server.ts';
import type { CharacterInstanceId } from '../../src/core/server.ts';
import { Refused } from './errors.ts';
import type { CareerRow, Json } from './store.ts';
import type { Db } from './db.ts';

const loaded = loadEncounterContent(); if (!loaded.ok) throw new Error('content');
const content = loaded.value, all = defaultZoneSpawns(content);
const base = [...all.values()].find((s) => s.spec.character === 'character:ash-wolf') as Spawn;
const wolf: Spawn = { ...base, spec: { ...base.spec, level: 1 } };   // a level-1 wolf: the scripted hero kills it
const spawns = new Map([[wolf.spec.id, wolf]]);
const UID = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', TOKEN = 'T'.repeat(32);
const row = (): CareerRow => ({ seed_credit: 0, world_credit: 0, total_credit: 0, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 3 });
const pack = () => { const inv = openInventory({ owner: PC as CharacterInstanceId, account: ACCOUNT as never, items: [], packSize: 20, bankSize: 10 }, lookupOf(content)); if (!inv.ok) throw new Error('inv'); return inv.value; }; void pack;
const open = { token: TOKEN, character: PC, instance: wolf.spec.id, generation: 0, issuedAt: '2026-10-08T10:00:00Z', expiresAt: '2026-10-08T10:02:00Z' };
function stub() {
  const kills: { b: Json[] }[] = [];
  const db: Db = { async run(sql, v = {}) {
    const fn = /public\.(origins_spawn_\w+)\(/.exec(sql.split('\\if :spawns')[1] ?? sql)?.[1];
    if (fn === 'origins_spawn_kill') { kills.push({ b: JSON.parse(v.b!) }); return JSON.stringify({ result: 'killed', instance: wolf.spec.id, respawnAt: 'R' }); }
    if (fn === 'origins_spawn_engage_get') return JSON.stringify(open);
    if (fn) return 'null';
    if (/origins_metal_of/.test(sql)) return 'absent';
    return JSON.stringify({ marks: 0, career: row(), characters: [{ id: PC, pack_slots: 20, bank_slots: 10 }], items: [], quests: [], journal: [], talk: [] });
  } };
  return { db, kills };
}
async function honest(): Promise<{ rec: WorldRecord; text: string }> {
  const fell: string[] = []; let rec: WorldRecord | null = null;
  const at = { x: wolf.spec.home.x, z: wolf.spec.home.z };
  const spec = { id: wolf.spec.id, body: 'wolf', level: 1, name: 'wolf' };
  const mobs = { within: (x: number, z: number, r: number) => fell.length || Math.hypot(at.x - x, at.z - z) > r ? [] : [{ spec, x: at.x, z: at.z, dist: Math.hypot(at.x - x, at.z - z) }], drive: () => {} };
  const wc = live({ mobs: () => mobs, onKill: (s) => { fell.push(s.id); rec = wc.record(); }, onHeroDied: () => {}, onHeroHit: () => {} });
  const hero = { x: at.x, z: at.z - 1.2, facing: 0 };
  for (let i = 0; i < 400 && !fell.length; i++) { wc.press(); for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().find((q) => q.id === spec.id); hero.facing = w ? Math.atan2(w.x - hero.x, w.z - hero.z) : 0; wc.update(1 / 30, hero); } }
  assert.ok(rec, 'the scripted hero kills the wolf');
  return { rec: rec!, text: await encodeWorldRecord(rec!) };
}
const ctx = (db: Db) => ({ db, account: UID });
const mk = (extra: object = {}) => worldSpawnOps({ content, spawns, seed: () => 7, now: () => new Date('2026-10-08T10:01:00Z'), log: () => {}, ...extra });
const paidOps = (b: Json[]) => b.filter((o) => o.op !== 'event').map((o) => o.op).concat((b[0]!.payload as { cp: number }).cp > 0 ? ['cp'] : []);

test('verifyWorldRecord: an honest record verifies; wrong creature, no kill, forged hero and junk do not', async () => {
  const { rec, text } = await honest();
  assert.deepEqual(await verifyWorldRecord(text, wolf, 'wolf'), { ok: true, ticks: rec.steps.length });
  const no = async (t: string, s: Spawn, kind: string, why: string, limit?: { level: number; attack: number; res: number }) => { const v = await verifyWorldRecord(t, s, kind, limit); assert.ok(!v.ok && v.reason === why, `${why}: ${JSON.stringify(v)}`); };
  await no(text, wolf, 'boar', 'wrong creature');
  await no(text, { ...wolf, spec: { ...wolf.spec, level: 5 } }, 'wolf', 'wrong creature');
  await no(text, { ...wolf, spec: { ...wolf.spec, id: 'other-1' } }, 'wolf', 'no kill');
  await no(text, { ...wolf, spec: { ...wolf.spec, home: { x: wolf.spec.home.x + 500, z: wolf.spec.home.z } } }, 'wolf', 'creature out of its roam');
  await no('!!!', wolf, 'wolf', 'undecodable');
  await no(await encodeWorldRecord({ ...rec, steps: rec.steps.map((s) => ({ ...s, attack: null })) }), wolf, 'wolf', 'no kill');
  await no(text, wolf, 'wolf', 'hero beyond ledger', { level: 1, attack: 0.5, res: 1 });
  assert.ok((await verifyWorldRecord(text, wolf, 'wolf', { level: 1, attack: 1, res: 1 })).ok, 'a ledger that allows the claim');
});

test('kill_report: soak default pays exactly as today with or without a record; a bad record is logged and still pays', async () => {
  const logs: string[] = [], { text } = await honest();
  const none = stub(), withRec = stub(), bad = stub();
  await mk({ log: (l: string) => logs.push(l) }).kill_report!(ctx(none.db), { token: TOKEN, hits: 50 });
  await mk({ log: (l: string) => logs.push(l) }).kill_report!(ctx(withRec.db), { token: TOKEN, hits: 50, record: text });
  await mk({ log: (l: string) => logs.push(l) }).kill_report!(ctx(bad.db), { token: TOKEN, hits: 50, record: 'AAAA' });
  assert.ok(paidOps(none.kills[0]!.b).length > 0, 'it pays');
  assert.deepEqual(paidOps(withRec.kills[0]!.b), paidOps(none.kills[0]!.b));
  assert.deepEqual(paidOps(bad.kills[0]!.b), paidOps(none.kills[0]!.b));
  const strip = (b: Json[]) => JSON.stringify(b.map((o) => (o.op === 'event' ? { ...o, payload: { ...(o.payload as object), record: undefined } } : o)));
  assert.equal(strip(withRec.kills[0]!.b), strip(none.kills[0]!.b), 'a verified record changes nothing but the record note');
  assert.equal((none.kills[0]!.b[0]!.payload as Json & { record?: string }).record, undefined, 'no record sent: the event is byte-identical to today');
  assert.equal((withRec.kills[0]!.b[0]!.payload as { record: string }).record, 'verified');
  assert.match((bad.kills[0]!.b[0]!.payload as { record: string }).record, /^refused: undecodable/);
  assert.ok(logs.some((l) => /world record not verified \(undecodable\)/.test(l)), 'the reason is logged');
});

test('kill_report with scorecardOnlyUnverified: no record or a bad one books the event only; a verified one pays; a record is a string within the limit', async () => {
  const { text } = await honest(), ops = mk({ scorecardOnlyUnverified: true });
  const none = stub(), bad = stub(), good = stub();
  await ops.kill_report!(ctx(none.db), { token: TOKEN, hits: 50 });
  await ops.kill_report!(ctx(bad.db), { token: TOKEN, hits: 50, record: 'AAAA' });
  await ops.kill_report!(ctx(good.db), { token: TOKEN, hits: 50, record: text });
  assert.deepEqual(none.kills[0]!.b.map((o) => o.op), ['event']); assert.deepEqual(bad.kills[0]!.b.map((o) => o.op), ['event']);
  assert.equal((none.kills[0]!.b[0]!.payload as { paid: boolean; cp: number }).paid, false); assert.equal((none.kills[0]!.b[0]!.payload as { cp: number }).cp, 0);
  assert.ok(paidOps(good.kills[0]!.b).length > 0, 'verified pays');
  assert.equal(good.kills.length, 1, 'one batch, one token: paid once');
  await assert.rejects(async () => ops.kill_report!(ctx(stub().db), { token: TOKEN, hits: 50, record: 5 }), (e: unknown) => !(e instanceof Refused) && /record/.test(String(e)));
  await assert.rejects(async () => ops.kill_report!(ctx(stub().db), { token: TOKEN, hits: 50, record: 'x'.repeat(60_001) }), /record/);
});

test('heroOf: a ledger that forbids the claimed gear leaves the kill unverified', async () => {
  const { text } = await honest(), ops = mk({ scorecardOnlyUnverified: true, heroOf: async () => ({ level: 1, attack: 0.9, res: 1 }) });
  const s = stub(); await ops.kill_report!(ctx(s.db), { token: TOKEN, hits: 50, record: text });
  assert.deepEqual(s.kills[0]!.b.map((o) => o.op), ['event']); assert.match((s.kills[0]!.b[0]!.payload as { record: string }).record, /hero beyond ledger/);
});
