import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldCombat, type FightMob } from '../src/fight/world-combat.ts';
import { MAX_HERO_MPS, STEP, decodeWorldRecord, encodeWorldRecord, packWorldRecord, replayWorldRecord, unpackWorldRecord, type WorldRecord } from '../src/fight/world-record.ts';
import { MAX_RECORD_TICKS } from '../src/fight/record.ts';

const mob = (id: string, body: string, level: number): FightMob => ({ id, body, level, name: id });
function fakeMobs(list: Array<{ spec: FightMob; x: number; z: number }>) {
  const fell: string[] = [];
  const mobs = { within: (x: number, z: number, r: number) => list.filter((m) => !fell.includes(m.spec.id) && Math.hypot(m.x - x, m.z - z) <= r).map((m) => ({ ...m, dist: Math.hypot(m.x - x, m.z - z) })), drive: () => {} };
  return { mobs, fell };
}
/** A scripted honest kill: the hero faces the wolf and cuts until it falls; the record is taken in onKill, as the page does. */
function killWolf(level = 1): { rec: WorldRecord | null; kills: string[] } {
  const f = fakeMobs([{ spec: mob('wolf-1', 'wolf', level), x: 0, z: 1.2 }]); const kills: string[] = []; let rec: WorldRecord | null = null;
  const wc = createWorldCombat({ mobs: () => f.mobs, onKill: (s) => { f.fell.push(s.id); kills.push(s.id); rec = wc.record(); }, onHeroDied: () => {}, onHeroHit: () => {} });
  for (let i = 0; i < 400 && kills.length === 0; i++) { wc.press(); for (let t = 0; t < 0.5; t += 1 / 30) { const w = wc.debug().find((x) => x.id === 'wolf-1'); wc.update(1 / 30, { x: 0, z: 0, facing: w ? Math.atan2(w.x, w.z) : 0 }); } }
  return { rec, kills };
}

test('an honest kill in the live loop replays to the same kill', () => {
  const { rec, kills } = killWolf(); assert.deepEqual(kills, ['wolf-1']); assert.ok(rec);
  const r = replayWorldRecord(rec!);
  assert.ok(r.ok, JSON.stringify(r)); if (r.ok) { assert.deepEqual(r.kills, ['wolf-1']); assert.equal(r.heroDied, false); assert.ok(r.ticks > 60); }
});

test('the pack round-trips exactly (bytes and gzip base64url), and the replay of the unpacked record is the same', async () => {
  const { rec } = killWolf(); assert.ok(rec);
  assert.deepEqual(unpackWorldRecord(packWorldRecord(rec!)), rec);
  const text = await encodeWorldRecord(rec!); assert.match(text, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(await decodeWorldRecord(text), rec);
  assert.ok(text.length < 20_000, `a ${rec!.steps.length}-step kill packs to ${text.length} chars`);
});

test('a record that does not kill, or whose presses were taken out, is not a kill', () => {
  const { rec } = killWolf(); assert.ok(rec);
  const idle: WorldRecord = { ...rec!, steps: rec!.steps.map((s) => ({ ...s, attack: null })) };
  const r = replayWorldRecord(idle); assert.ok(r.ok && r.kills.length === 0, 'no cuts, no kill');
  const cut: WorldRecord = { ...rec!, releases: [], steps: rec!.steps.slice(0, 40) };
  const c = replayWorldRecord(cut); assert.ok(c.ok && c.kills.length === 0, 'a short window has no kill');
});

test('forged headers and poses are refused', () => {
  const { rec } = killWolf(); assert.ok(rec);
  const no = (r: WorldRecord, why: string) => { const v = replayWorldRecord(r); assert.ok(!v.ok && v.reason === why, `${why}: ${JSON.stringify(v)}`); };
  no({ ...rec!, hero: { ...rec!.hero, weapon: 'trident' as never } }, 'weapon');
  no({ ...rec!, hero: { ...rec!.hero, attack: 3 } }, 'hero gear');
  no({ ...rec!, hero: { ...rec!.hero, res: 0.1 } }, 'hero gear');
  no({ ...rec!, hero: { ...rec!.hero, health: 1e9 } }, 'hero body');
  no({ ...rec!, hero: { ...rec!.hero, level: 0 } }, 'hero level');
  no({ ...rec!, joins: [{ ...rec!.joins[0]!, kind: 'nonesuch' }] }, 'join');
  no({ ...rec!, joins: [{ ...rec!.joins[0]!, level: 999 }] }, 'join');
  no({ ...rec!, releases: [{ s: 3, id: 'ghost' }] }, 'release');
  no({ ...rec!, steps: [] }, 'ticks');
  const tele = rec!.steps.map((s, k) => (k === 30 && s.pose ? { ...s, pose: { ...s.pose, x: s.pose.x + 5000 } } : s));
  no({ ...rec!, steps: tele }, 'speed');
  no({ ...rec!, steps: rec!.steps.map((s, k) => (k === 0 ? { ...s, pose: null } : s)) }, 'pose');
  const crowd: WorldRecord = { ...rec!, releases: [], joins: Array.from({ length: 9 }, (_, k) => ({ s: 0, id: `w-${k}`, kind: 'wolf', x: k * 100, z: 0, level: 1 })) };
  no(crowd, 'crowd');
});

test('the speed bound covers a real roll', () => {
  const f = fakeMobs([]); const wc = createWorldCombat({ mobs: () => f.mobs, onKill: () => {}, onHeroDied: () => {}, onHeroHit: () => {} });
  let top = 0; const hero = { x: 0, z: 0, facing: 0 };
  wc.roll({ x: 1, z: 0 }); for (let k = 0; k < 90; k++) { const d = wc.update(STEP, hero); top = Math.max(top, Math.hypot(d.dx, d.dz) / STEP); hero.x += d.dx; hero.z += d.dz; }
  assert.ok(top > 0, 'a roll moves him'); assert.ok(top <= MAX_HERO_MPS, `a roll peaks at ${top.toFixed(1)} m/s`);
});

test('a decoder takes only what is a world record', async () => {
  assert.throws(() => unpackWorldRecord(new Uint8Array([1, 2, 3])), /not a world record/);
  assert.throws(() => unpackWorldRecord(new Uint8Array([0x57, 0x52, 1, 5])), /bad header|truncated/);
  await assert.rejects(decodeWorldRecord('!!!'), /cannot decode/);
  assert.ok(MAX_RECORD_TICKS > 0);
});
