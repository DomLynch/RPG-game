import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldCombat, type FightMob } from '../src/fight/world-combat.ts';
import { newWorld, player } from '../src/fight/world.ts';
import { ME, MAX_HERO_MPS, MAX_WORLD_TICKS, STEP, heroClean, ccQuiet, WORLD_SIM_VERSION, decodeWorldRecord, encodeWorldRecord, packWorldRecord, replayWorldRecord, unpackWorldRecord, type WorldRecord } from '../src/fight/world-record.ts';
import { MAX_RECORD_TICKS, RECORD_VERSION } from '../src/fight/record.ts';
import { DEFAULT_WEAPON, PLAYER_WEAPONS } from '../src/fight/moves.ts';
import { CC_LADDER, ccApply, type CcLadder, type CcSource } from '../src/fight/cc-ladder.ts';

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
  no({ ...rec!, hero: { ...rec!.hero, weapon: 'butter-knife' as never } }, 'weapon');
  const other = PLAYER_WEAPONS.find((w) => w !== DEFAULT_WEAPON); assert.ok(other);
  no({ ...rec!, hero: { ...rec!.hero, weapon: other } }, 'weapon');   // a real weapon the server does not yet bind to the character's held one (Auditor, #2569): the replay takes DEFAULT_WEAPON only until HeroLimit.weapon lands
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

test('a record of another sim version is not replayed; the header carries the version', async () => {
  const { rec } = killWolf(); assert.ok(rec);
  assert.equal(rec!.rv, RECORD_VERSION);
  const r = replayWorldRecord({ ...rec!, rv: RECORD_VERSION - 1 }); assert.ok(!r.ok && r.reason === 'sim version');
  assert.equal((await decodeWorldRecord(await encodeWorldRecord(rec!))).rv, RECORD_VERSION);
  assert.equal(rec!.wv, WORLD_SIM_VERSION);
  const w = replayWorldRecord({ ...rec!, wv: WORLD_SIM_VERSION + 1 }); assert.ok(!w.ok && w.reason === 'sim version', 'a record of another WORLD sim version is not replayed');
  assert.equal((await decodeWorldRecord(await encodeWorldRecord(rec!))).wv, WORLD_SIM_VERSION);
});

test('a hero who is not at rest and clean opens no window (the header cannot carry his Pit fighter)', () => {
  const w = newWorld([player(ME, 0, 0, 0, { attack: 1, res: 1 }, 1)]);
  assert.ok(heroClean(w), 'a fresh hero is clean');
  const dirty = (patch: Record<string, unknown>) => ({ ...w, fighters: [{ ...w.fighters[0]!, ...patch }] }) as typeof w;
  assert.ok(!heroClean(dirty({ phase: 'recover' })) && !heroClean(dirty({ maxStamina: 40 })) && !heroClean(dirty({ cc: [{ family: 'stun', count: 1, last: 5 }] })) && !heroClean(dirty({ stance: 'aggressive' })));
  const duel = { fighters: [{ wound: 3, legWound: false, maxStamina: 100, skillCooldown: 0, move: null, phase: 'ready' }] };
  assert.ok(!heroClean({ ...w, streams: { [ME]: { duel } } } as unknown as typeof w), 'a blade wound');
});

test('the world loop never feeds a special or a skill: the live input is {attack, guard, roll}', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/fight/world-record.ts', import.meta.url), 'utf8');
  assert.ok(!/special\s*:|skill\s*:/.test(src.split('export function stepHero')[1]!.split('export const joinFighter')[0]!), 'stepHero passes no special or skill');
});

test('a hero whose CC marks have all expired is clean (the ladder is never pruned); one with a mark still counting is not', () => {
  const w = newWorld([player(ME, 0, 0, 0, { attack: 1, res: 1 }, 1)]);
  const at = (time: number, cc: CcLadder) => ({ ...w, time, fighters: [{ ...w.fighters[0]!, cc }] }) as typeof w;
  const stunned: CcLadder = [{ family: 'stun', count: 2, last: 10, end: 50 }];
  assert.ok(!heroClean(at(1, stunned)), 'tick 60: the stun mark is inside its 900-tick window from its end');
  assert.ok(!heroClean(at((50 + 900) / 60, stunned)), 'the window is inclusive at its last tick');
  assert.ok(heroClean(at((50 + 901) / 60 + 1 / 60, stunned)), 'older than the window: the mark no longer counts, so the hero is clean');
  assert.ok(heroClean(at(0, [])) && ccQuiet(undefined, 0));
});

test('an expired mark behaves exactly as no mark: every shipped CC source lands the same on a quiet ladder as on an empty one, at every later tick', () => {
  const sources: CcSource[] = Object.values(CC_LADDER.kinds).flatMap((k) => [...k.sources]);
  for (const k of Object.values(CC_LADDER.kinds)) {
    const dead: CcLadder = [{ family: k.id, count: 3, last: 100, end: 400 }];
    const now = 400 + k.window + 1;
    assert.ok(ccQuiet(dead, now), `${k.id} is quiet at ${now}`);
    for (const source of sources) for (const later of [now, now + 1, now + 5000]) {
      const a = ccApply(dead, source, later, 60), b = ccApply([], source, later, 60);
      assert.equal(a.ticks, b.ticks, `${k.id} mark, ${source} at ${later}: same duration`);
      assert.equal(a.level, b.level);
      const fam = (l: CcLadder) => l.filter((m) => m.family === CC_LADDER.kinds[Object.keys(CC_LADDER.kinds).find((id) => CC_LADDER.kinds[id]!.sources.includes(source))!]!.id);
      assert.deepEqual(fam(a.ladder), fam(b.ladder), 'the kind that landed has the same new mark');
    }
  }
});

test('the unpacker refuses a window past five minutes of world fight, and an overlong record is refused before any replay', async () => {
  const { rec } = killWolf(); assert.ok(rec);
  const long: WorldRecord = { ...rec!, steps: Array.from({ length: MAX_WORLD_TICKS + 1 }, () => rec!.steps[0]!) };
  assert.throws(() => unpackWorldRecord(packWorldRecord(long)), /bad header/);
  assert.ok(packWorldRecord({ ...rec!, steps: long.steps.slice(0, MAX_WORLD_TICKS) }).length > 0);
});
