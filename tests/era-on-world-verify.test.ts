// The LIVE era's twin of origins/server/world-verify.test.ts (the world kill's money path): the rest of the unit suite imports ./lib/era-off.ts and so never replays a world record under
// the rules the game plays today (the sandbox era, RV79..RV86 rows). This file imports ./lib/era-on.ts FIRST instead; `node --test` runs each file in its own process, so it cannot leak.
// The hero MOVES: under the live reach bands a stand-and-swing hero loses to the wolf (world-verify.test.ts honest() fails here), so he steps in to his weapon's best band, cuts, and steps
// back out when the wolf winds up (the hit-and-run shape of scripts/kite-farm.ts `hitrun` and tests/world-evade.test.ts `kite`, at the band edges of src/fight/bands.ts).
import './lib/era-on.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorldCombat } from '../src/fight/world-combat.ts';
import { DEFAULT_WEAPON } from '../src/fight/moves.ts';
import { bestRange } from '../src/fight/bands.ts';
import { SPEEDS } from '../src/fight/speeds.ts';
import { sandboxFor } from '../src/fight/sandbox-era.ts';
import { RECORD_VERSION } from '../src/fight/record.ts';
import { WORLD_SIM_VERSION, encodeWorldRecord, replayWorldRecord, type WorldRecord } from '../src/fight/world-record.ts';
import SERVER_RULES from '../origins/server/server-rules.json' with { type: 'json' };
import { verifyWorldRecord } from '../origins/server/world-verify.ts';
import { createVerifyPool } from '../origins/server/world-verify-pool.ts';
import { worldSpawnOps, defaultZoneSpawns, type Spawn } from '../origins/server/world-spawns.ts';
import { loadEncounterContent } from '../origins/encounters/encounters.ts';
import { PC } from '../src/core/server.ts';
import type { CareerRow, Json } from '../origins/server/store.ts';
import type { Db } from '../origins/server/db.ts';

const loaded = loadEncounterContent(); if (!loaded.ok) throw new Error('content');
const content = loaded.value, all = defaultZoneSpawns(content);
const base = [...all.values()].find((s) => s.spec.character === 'character:ash-wolf') as Spawn;
const wolf: Spawn = { ...base, spec: { ...base.spec, level: 1 } };   // a level-1 wolf, as world-verify.test.ts
const spawns = new Map([[wolf.spec.id, wolf]]);
const UID = '0b8e2a6c-1f3d-4c5e-9a7b-2c4d6e8f0a1b', TOKEN = 'T'.repeat(32);
const open = { token: TOKEN, character: PC, instance: wolf.spec.id, generation: 0, issuedAt: '2026-10-08T10:00:00Z', expiresAt: '2026-10-08T10:02:00Z' };
const row = (): CareerRow => ({ seed_credit: 0, world_credit: 0, total_credit: 0, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 3 });
function stub() {   // world-verify.test.ts's database: one open engagement on the wolf, every kill batch kept
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
const mk = (extra: object = {}) => worldSpawnOps({ content, verifyRecord: (job) => verifyWorldRecord(job.text, job.spawn, job.kind, job.limit, job.maxTicks), spawns, seed: () => 7, now: () => new Date('2026-10-08T10:01:00Z'), log: () => {}, ...extra });
const paidOps = (b: Json[]) => b.filter((o) => o.op !== 'event').map((o) => o.op).concat((b[0]!.payload as { cp: number }).cp > 0 ? ['cp'] : []);

// The press script: close to the far edge of the weapon's best band (bands.ts bestRange), cut while inside it, step back out of the band when the wolf is winding up or swinging.
// Walking pace is the world's own row (speeds.ts SPEEDS.player.walk), so the record's poses are an honest walk (the replay's speed bound).
const START_Z = 1.5;   // test-local: where the hero stands south of the wolf's home when it notices him. PINNED: from here the script kills the wolf and lives under RV86 / WSV65 (from a wolf 1.2-1.55 m off, 7 of 8 starts killed it untouched). Re-search if a sim bump makes the kill assert fail.
const MAX_S = 120;   // test-local: the longest the script fights before it gives up
async function honestMover(): Promise<{ rec: WorldRecord; text: string; heroHp: number; heroMax: number }> {
  const [lo, hi] = bestRange(DEFAULT_WEAPON)!, walk = SPEEDS.player.walk, dt = 1 / 30;
  const fell: string[] = []; let rec: WorldRecord | null = null, died = false;
  const at = { x: wolf.spec.home.x, z: wolf.spec.home.z };
  const spec = { id: wolf.spec.id, body: 'wolf', level: 1, name: 'wolf' };
  const mobs = { within: (x: number, z: number, r: number) => fell.length || Math.hypot(at.x - x, at.z - z) > r ? [] : [{ spec, x: at.x, z: at.z, dist: Math.hypot(at.x - x, at.z - z) }], drive: () => {} };
  const wc = createWorldCombat({ mobs: () => mobs, onKill: (s) => { fell.push(s.id); rec = wc.record(); }, onHeroDied: () => { died = true; }, onHeroHit: () => {} });
  const hero = { x: at.x, z: at.z - START_Z, facing: 0 };
  for (let k = 0; k < MAX_S / dt && !fell.length && !died; k++) {
    const w = wc.debug().find((q) => q.id === spec.id);
    if (w) {
      const dx = w.x - hero.x, dz = w.z - hero.z, d = Math.hypot(dx, dz) || 1, step = walk * dt; hero.facing = Math.atan2(dx, dz);
      const threat = (w.phase === 'windup' || w.phase === 'active') && d < hi + (hi - lo);   // its swing is coming and he is within a band's width of his own reach: get out
      const dir = threat || d < lo ? -1 : d > hi ? 1 : 0;
      if (dir) { hero.x += (dx / d) * step * dir; hero.z += (dz / d) * step * dir; } else if (wc.hero().phase === 'ready') wc.press();
    }
    const m = wc.update(dt, hero); hero.x += m.dx; hero.z += m.dz;
  }
  assert.equal(died, false, 'the moving hero lives');
  assert.ok(rec, 'the moving hero kills the wolf under the live era');
  const h = wc.hero();
  return { rec: rec!, text: await encodeWorldRecord(rec!), heroHp: h.health, heroMax: h.max };
}
const damageOf = (rec: WorldRecord): number => { const r = replayWorldRecord(rec, { tagExpiryTicks: SERVER_RULES.worldShare[0]!.tagExpiryS * 60 }); return r.ok ? r.dealt[wolf.spec.id]?.damage ?? 0 : -1; };

test('the file runs under the LIVE era: the current record version is the sandbox era\'s', () => {
  assert.equal(sandboxFor(RECORD_VERSION), true, 'era-on.ts is in force (an era-off import would make this false)');
});

test('live era: an honest MOVING kill verifies (a kill, damage to that spawn), stamped with this build\'s RECORD_VERSION and WORLD_SIM_VERSION', async () => {
  const { rec, text, heroHp } = await honestMover();
  assert.ok(heroHp > 0, 'he won it standing');
  assert.equal(rec.rv, RECORD_VERSION); assert.equal(rec.wv, WORLD_SIM_VERSION);
  const r = replayWorldRecord(rec); assert.ok(r.ok, JSON.stringify(r));
  if (r.ok) { assert.deepEqual(r.kills, [wolf.spec.id]); assert.equal(r.heroDied, false); }
  const v = await verifyWorldRecord(text, wolf, 'wolf');
  assert.ok(v.ok, `an honest live-era record must verify: ${JSON.stringify(v)} (steps ${rec.steps.length}, joins ${JSON.stringify(rec.joins)})`);
  if (v.ok) { assert.equal(v.ticks, rec.steps.length); assert.ok((v.damage ?? 0) > 0, `damage to the spawn: ${v.damage}`); assert.equal(v.damage, damageOf(rec)); }
  assert.ok((await verifyWorldRecord(text, wolf, 'wolf', { level: 1 })).ok, 'a ledger that allows the claim');
});

test('live era: the same record re-stamped to an older world sim version or record version is refused (sim version)', async () => {
  const { rec } = await honestMover();
  const reason = async (r: WorldRecord) => { const v = await verifyWorldRecord(await encodeWorldRecord(r), wolf, 'wolf'); return v.ok ? 'ok' : v.reason; };
  assert.equal(await reason({ ...rec, wv: WORLD_SIM_VERSION - 1 }), 'sim version');
  assert.equal(await reason({ ...rec, rv: RECORD_VERSION - 1 }), 'sim version');
});

test('live era: a forged or truncated record is refused', async () => {
  const { rec, text } = await honestMover();
  const reason = async (r: WorldRecord | string, s: Spawn = wolf, kind = 'wolf') => { const v = await verifyWorldRecord(typeof r === 'string' ? r : await encodeWorldRecord(r), s, kind); return v.ok ? 'ok' : v.reason; };
  assert.equal(await reason({ ...rec, steps: rec.steps.map((s) => ({ ...s, attack: null })) }), 'no kill', 'the cuts taken out');
  assert.equal(await reason({ ...rec, releases: [], steps: rec.steps.slice(0, Math.floor(rec.steps.length / 2)) }), 'no kill', 'cut off halfway: no kill');
  assert.equal(await reason({ ...rec, hero: { ...rec.hero, health: 1e9 } }), 'hero body', 'a forged hero');
  assert.equal(await reason(text, wolf, 'boar'), 'wrong creature');
  assert.equal(await reason(text, { ...wolf, spec: { ...wolf.spec, id: 'other-1' } }), 'no kill', 'claimed on another spawn');
  assert.equal(await reason('!!!'), 'undecodable');
});

test('live era: kill_report with scorecardOnlyUnverified pays an honest moving kill once and books a forged one as the event only', async () => {
  const { rec, text } = await honestMover(), ops = mk({ scorecardOnlyUnverified: true });
  const good = stub(), forged = stub();
  await ops.kill_report!({ db: good.db, account: UID }, { token: TOKEN, hits: 50, record: text });
  await ops.kill_report!({ db: forged.db, account: UID }, { token: TOKEN, hits: 50, record: await encodeWorldRecord({ ...rec, steps: rec.steps.map((s) => ({ ...s, attack: null })) }) });
  assert.equal(good.kills.length, 1, 'one batch, one token');
  assert.equal((good.kills[0]!.b[0]!.payload as { record: string }).record, 'verified');
  assert.ok(paidOps(good.kills[0]!.b).length > 0, 'the verified live-era kill pays');
  assert.equal((good.kills[0]!.b[0]!.payload as { paid: boolean }).paid, true);
  assert.deepEqual(forged.kills[0]!.b.map((o) => o.op), ['event'], 'the forged one pays nothing');
  assert.equal((forged.kills[0]!.b[0]!.payload as { paid: boolean; cp: number }).paid, false);
});

test('live era: the production pool (a real worker thread, era ON by default, no preload) verifies the honest moving kill and refuses junk', async () => {
  const { text } = await honestMover(), pool = createVerifyPool({ timeoutMs: 20_000 });
  try {
    const good = await pool.verify({ text, spawn: { spec: wolf.spec }, kind: 'wolf' });
    assert.ok(good.ok, JSON.stringify(good));
    assert.deepEqual(await pool.verify({ text: '!!!', spawn: { spec: wolf.spec }, kind: 'wolf' }), { ok: false, reason: 'undecodable' });
  } finally { pool.close(); }
});
