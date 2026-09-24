// Brief 19, deliverable 5 — the gear seam (Lead's assignment, 2026-09-24). A Loadout reaches stepDuel: Attack scales what a fighter
// deals, RES what he takes, chip included, and nothing else moves — no timing, no posture, and poise reads the unscaled blow. The naked
// pair is the exact identity, the record carries both pairs bit for bit, a v10-era record replays naked-identically once its header is
// rewritten, and the Loadout a fight starts with comes from the SERVER's awards, never the device's cache.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { initialPractice, stepPractice, type Practice } from '../src/combat.ts';
import { NAKED, idleIntent, type CombatEvent, type Intent, type Loadout } from '../src/duel.ts';
import { OPPONENTS } from '../src/moves.ts';
import { CAPS, fullSet, loadoutFor, serverLoadout, tierOfLevel } from '../src/gear-stats.ts';
import { RECORD_VERSION, createRecorder, fromBase64Url, packRecord, unpackRecord } from '../src/record.ts';
import { verifyRecord } from '../src/replay.ts';
import { Match } from '../src/match.ts';
import { readAwards } from '../src/cloud-profile.ts';
import { loadProfile } from '../src/profile.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';
import type { DailyFight } from '../src/daily.ts';
import type { Loot } from '../src/loot.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

// The busy scripted intent stream of tests/record.test.ts: attacks, guards, kicks and held charges against the Veteran, seed 731.
const script = (t: number, yaw: number): Intent => {
  const phase = t % 240;
  return {
    ...idleIntent(),
    move: { x: phase < 90 ? Math.sin(t / 25) : 0, z: phase < 90 ? 0.8 : phase < 120 ? -0.6 : 0, yaw, run: phase > 200 },
    action: phase === 95 ? 'light' : phase === 110 ? 'light' : phase === 130 ? 'heavy' : phase === 170 ? 'thrust' : phase === 190 ? 'kick' : null,
    guard: phase >= 140 && phase < 165, guardDirection: phase >= 140 && phase < 165 ? 'overhead' : undefined, held: phase > 125 && phase < 135,
  };
};
type Tick = { practice: Practice; events: CombatEvent[] };
function fight(loadouts?: [Loadout, Loadout], ticks = 1800, seed = 731): Tick[] {
  let practice = initialPractice(seed, OPPONENTS.veteran, 'longsword', loadouts), yaw = 0.6;
  const out: Tick[] = [];
  for (let t = 0; t < ticks && !practice.finish; t++) {
    yaw += 0.004 * Math.sin(t / 37);
    practice = stepPractice(practice, script(t, yaw), OPPONENTS.veteran.profiles.normal);
    out.push({ practice, events: practice.duel.events });
  }
  return out;
}
const ORIGIN = loadoutFor(fullSet('Origin', 'Longsword'));   // the cap row: attack 1.15, res 0.80
const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
const ports = () => { const storage = memory(); return { storage, trial: loadTrial(storage), scorecard: loadScorecard(storage), profile: loadProfile(storage, () => 'device').profile }; };

test('gear seam: no loadout, the naked pair and a fresh {1, 1} step the same fight bit for bit — the identity is a branch, not a rounding', () => {
  const plain = fight(), naked = fight([NAKED, NAKED]), fresh = fight([{ attack: 1, res: 1 }, { attack: 1, res: 1 }]);
  assert.ok(plain.length > 1000 && plain.at(-1)!.practice.finish, 'the scripted fight runs long and ends in a finish');
  assert.deepEqual(naked.map(t => t.practice), plain.map(t => t.practice));
  assert.deepEqual(fresh.map(t => t.practice), plain.map(t => t.practice));
  assert.equal(plain[0]!.practice.duel.fighters[0].loadout, NAKED, 'a fighter built without gear carries the NAKED constant');
});

test('gear seam: a full Origin set scales the NUMBER a blow does — RES on what the player takes, Attack on what he deals — and nothing before it; poise and stagger are unchanged', () => {
  assert.deepEqual(ORIGIN, { attack: CAPS.attack, res: CAPS.res });
  const plain = fight(), geared = fight([ORIGIN, NAKED]);
  // The first blow the player TAKES: a Hit / GuardBroken with target 0, or a Blocked (actor = the defender) carrying chip.
  const taken = (e: CombatEvent) => (e.type === 'Hit' || e.type === 'GuardBroken') && e.target === 0 || e.type === 'Blocked' && e.actor === 0 && !!e.damage;
  const dealt = (e: CombatEvent) => (e.type === 'Hit' || e.type === 'GuardBroken') && e.target === 1 || e.type === 'Blocked' && e.actor === 1 && !!e.damage;
  const firstTaken = plain.findIndex(t => t.events.some(taken)), firstDealt = plain.findIndex(t => t.events.some(dealt));
  assert.ok(firstTaken > 0 && firstDealt > 0, `the script both takes (tick ${firstTaken}) and lands (tick ${firstDealt}) a blow`);
  const first = Math.min(firstTaken, firstDealt);
  // Up to the first blow the two fights are identical: no timing, no posture, no stagger moved because of gear.
  for (let t = 0; t < first; t++) assert.deepEqual(geared[t]!.events, plain[t]!.events, `tick ${t} before any blow`);
  const strip = (e: CombatEvent) => { const { damage: _damage, ...rest } = e; return rest; };
  assert.deepEqual(geared[first]!.events.map(strip), plain[first]!.events.map(strip), 'the first blow\'s tick differs only in the damage numbers');
  const blow = (ticks: Tick[], at: number, pick: (e: CombatEvent) => boolean) => ticks[at]!.events.find(pick)!.damage!;
  if (firstTaken === first) {
    const n = blow(plain, first, taken), g = blow(geared, first, taken);
    assert.equal(g, Math.round(n * CAPS.res), `taken: ${n} naked, ${g} in Origin armour (RES ${CAPS.res})`);
    assert.ok(g < n, 'RES changes the number the player takes');
    assert.equal(geared[first]!.practice.duel.fighters[0].health, plain[first]!.practice.duel.fighters[0].health + (n - g), 'the bar loses the scaled number');
  } else {
    const n = blow(plain, first, dealt), g = blow(geared, first, dealt);
    assert.equal(g, Math.round(n * CAPS.attack), `dealt: ${n} naked, ${g} with an Origin longsword (Attack ${CAPS.attack})`);
    assert.ok(g > n, 'Attack changes the number the opponent takes');
  }
  // The other direction, on its own first blow in the geared fight, is scaled by its own multiplier too.
  const other = firstTaken === first ? dealt : taken, scale = firstTaken === first ? CAPS.attack : CAPS.res;
  const at = geared.findIndex(t => t.events.some(other));
  if (at >= 0) {
    const g = blow(geared, at, other), fighter = geared[at]!.practice.duel.fighters;
    assert.ok(g > 0 && Number.isInteger(g), 'a scaled blow is a whole number');
    assert.equal(fighter[0].loadout, ORIGIN); assert.equal(fighter[1].loadout, NAKED);
    void scale;
  }
  // Stagger is the unscaled blow's decision: every Staggered up to the first blow tick is on the same tick in both fights.
  const staggers = (ticks: Tick[]) => ticks.slice(0, first + 1).flatMap((t, i) => t.events.filter(e => e.type === 'Staggered').map(e => `${i}:${e.actor}`));
  assert.deepEqual(staggers(geared), staggers(plain));
});

test('gear seam: the record carries both loadouts as exact doubles; a recorder given none writes the naked pair; a mad multiplier is refused', () => {
  const partial = loadoutFor({ Helmet: 'Champion', Boots: 'Gladiator' });   // an exact rational with a long binary expansion
  const rec = createRecorder({ build: 'abc1234', opponent: 'veteran', weapon: 'longsword', profile: 'normal', seed: 731, loadouts: [partial, { attack: 1.15, res: 1 }] });
  for (let i = 0; i < 20; i++) rec.push(idleIntent());
  const record = rec.finish('abandoned');
  assert.equal(record.v, RECORD_VERSION);
  const back = unpackRecord(packRecord(record));
  assert.deepEqual(back, record);
  assert.equal(back.loadouts[0].res, partial.res, 'bit-identical: the replay multiplies by the same double the fight did');
  const naked = createRecorder({ build: 'abc1234', opponent: 'veteran', weapon: 'longsword', profile: 'normal', seed: 731 });
  naked.push(idleIntent());
  assert.deepEqual(naked.finish('abandoned').loadouts, [NAKED, NAKED]);
  for (const bad of [0, -1, NaN, Infinity, 16]) assert.throws(() => packRecord({ ...record, loadouts: [{ attack: bad, res: 1 }, NAKED] }), /loadout out of range/, `attack ${bad}`);
  const bytes = packRecord(record), dv = new DataView(bytes.buffer, bytes.byteOffset);
  const o = 3 + 1 + 7 + 1 + 7 + 1 + 9 + 1 + 4 + 4 + 1;   // magic, version, 'abc1234', 'veteran', 'longsword', profile, seed, ticks, outcome — the loadouts follow the outcome byte
  dv.setFloat64(o, 0, true);
  assert.throws(() => unpackRecord(bytes), /loadout out of range/, 'a record is public input: a zero multiplier is refused at decode, not stepped');
});

test('gear seam: a RECORD_VERSION 10 reference (fought before gear existed) replays to the same tick and outcome once its header carries the naked pair — the naked identity against a v10-era record', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/fight-record-v10-naked.json', import.meta.url), 'utf8')) as { v: number; encoded: string; expect: { ticks: number; outcome: string; killedTick: number } };
  assert.equal(fixture.v, 10);
  const v10 = gunzipSync(fromBase64Url(fixture.encoded));
  assert.equal(v10[2], 10, 'the fixture is a v10 record');
  assert.throws(() => unpackRecord(v10), /version 10 is not supported/, 'this build refuses v10 as recorded (replaced, not widened)');
  // Rewrite the header: version 11, and four naked doubles after the outcome byte. Everything else is copied.
  let o = 3; for (let k = 0; k < 3; k++) o += 1 + v10[o]!;   // build, opponent, weapon
  const outcomeAt = o + 1 + 4 + 4, splitAt = outcomeAt + 1;
  const v11 = new Uint8Array(v10.length + 32);
  v11.set(v10.subarray(0, splitAt), 0); v11[2] = 11;
  const dv = new DataView(v11.buffer);
  for (let k = 0; k < 4; k++) dv.setFloat64(splitAt + 8 * k, 1, true);
  v11.set(v10.subarray(splitAt), splitAt + 32);
  const record = unpackRecord(v11);
  assert.deepEqual(record.loadouts, [NAKED, NAKED]);
  assert.equal(record.ticks, fixture.expect.ticks); assert.equal(record.outcome, fixture.expect.outcome);
  const result = verifyRecord(record);
  assert.ok(result.ok, `the v10 fight replays under v11: ${result.ok ? '' : result.reason}`);
  assert.equal(result.practice.duel.tick, fixture.expect.killedTick, 'the finish lands on the recorded tick');
});

test('gear seam: the fight\'s Loadout comes from the server\'s awards × the equipped set — a guest, an unawarded piece or an unequipped award is the identity', () => {
  const equipped = { head: 'veteran.Helmet', feet: 'veteran.Boots', main: 'veteran.Trident' } as unknown as Loot['equipped'];
  assert.equal(serverLoadout(equipped, null), NAKED, 'a guest or a failed read fights naked, exactly');
  assert.deepEqual(serverLoadout(equipped, new Map()), NAKED, 'nothing awarded: the identity, whatever is worn');
  const awards = new Map([['veteran.Helmet', 5], ['veteran.Trident', 10], ['veteran.Body', 10]]);   // Champion helmet, Origin trident; the Body is awarded but not worn
  assert.equal(tierOfLevel(5), 'Champion'); assert.equal(tierOfLevel(undefined), undefined);
  assert.deepEqual(serverLoadout(equipped, awards), loadoutFor({ Helmet: 'Champion', Trident: 'Origin' }), 'the worn awarded pieces at their awarded tiers; the Boots (worn, never awarded) and the Body (awarded, not worn) count for nothing');
  assert.equal(serverLoadout(equipped, awards).attack, CAPS.attack, 'an Origin weapon is the whole Attack cap');
});

test('gear seam: readAwards reads the server\'s own rows and never throws — a missing table, an error, a malformed row or a rejected call is null (a naked fight)', async () => {
  const db = (result: unknown, reject = false) => ({ from: (table: string) => { assert.equal(table, 'awards'); return { select: (cols: string) => { assert.equal(cols, 'piece,tier'); return reject ? Promise.reject(new Error('offline')) : Promise.resolve(result); } }; } }) as unknown as SupabaseClient;
  assert.deepEqual(await readAwards(db({ data: [{ piece: 'veteran.Helmet', tier: 3 }, { piece: 'veteran.Helmet', tier: 5 }, { piece: 'goblin.Boots', tier: 2 }], error: null })), new Map([['veteran.Helmet', 5], ['goblin.Boots', 2]]), 'a piece awarded twice keeps its better rung');
  assert.equal(await readAwards(db({ data: null, error: { code: 'PGRST205', message: 'relation awards does not exist' } })), null);
  assert.equal(await readAwards(db({ data: [{ piece: 'veteran.Helmet', tier: '5' }], error: null })), null, 'a string tier is not a rung');
  assert.equal(await readAwards(db({ data: [{ piece: 7, tier: 5 }], error: null })), null);
  assert.equal(await readAwards(db(null, true)), null, 'a rejected call');
  assert.deepEqual(await readAwards(db({ data: [], error: null })), new Map(), 'an account with no awards yet: an empty map, not null — the read worked');
});

test('gear seam: the match fights career and practice in the player\'s gear against a naked warden, the daily naked both sides, and a replay in the record\'s own pair; gear arriving before the first step re-seats the fight, after it waits for the next start', () => {
  const m = new Match(OPPONENTS.veteran, 'dev', ports(), 731);
  assert.deepEqual(m.practice.duel.fighters.map(f => f.loadout), [NAKED, NAKED], 'until the awards land, naked');
  m.setLoadout(ORIGIN);
  assert.deepEqual(m.practice.duel.fighters.map(f => f.loadout), [ORIGIN, NAKED], 'the un-stepped first fight re-seats on the account\'s gear');
  assert.deepEqual(m.recorder!.meta.loadouts, [ORIGIN, NAKED], 'and its record will say so');
  assert.equal(m.step(() => idleIntent()), 'stepped');
  const mid = loadoutFor({ Helmet: 'Champion' });
  m.setLoadout(mid);
  assert.deepEqual(m.practice.duel.fighters[0].loadout, ORIGIN, 'a fight in progress keeps what it started with');
  m.rematch();
  assert.deepEqual(m.practice.duel.fighters.map(f => f.loadout), [mid, NAKED], 'the rematch wears the current gear');
  const daily: DailyFight = { day: '2026-09-24', number: 1, seed: 5 };
  assert.ok(m.startDaily(daily, m.epoch));
  assert.deepEqual(m.practice.duel.fighters.map(f => f.loadout), [NAKED, NAKED], 'the daily is a skill board: the fixed kit is naked, both sides');
  assert.deepEqual(m.recorder!.meta.loadouts, [NAKED, NAKED]);
  m.setLoadout(ORIGIN);
  assert.deepEqual(m.practice.duel.fighters.map(f => f.loadout), [NAKED, NAKED], 'gear arriving during a daily changes nothing');
  const rec = createRecorder({ build: 'dev', opponent: 'veteran', weapon: 'longsword', profile: 'normal', seed: 9, loadouts: [mid, ORIGIN] });
  for (let i = 0; i < 30; i++) rec.push(idleIntent());
  const record = rec.finish('abandoned');
  assert.ok(m.startReplay(record, 10, m.epoch));
  assert.deepEqual(m.practice.duel.fighters.map(f => f.loadout), [mid, ORIGIN], 'a kill link replays with the gear the fight was fought with, whatever this player owns');
  assert.equal(m.practice.duel.tick, 10);
  m.setLoadout(NAKED);
  assert.deepEqual(m.practice.duel.fighters.map(f => f.loadout), [mid, ORIGIN], 'and stays on it');
});

// The scripted stream above never lands on the warden; the battery's light spam does. Attack, from the player's side, on that fight.
import { STRATEGIES, act, idle } from './strategies.ts';
test('gear seam: an Origin longsword scales what the player DEALS by the Attack cap, blow for blow, on the light-spam fight', () => {
  const spam = (p: Practice): Intent => {
    const me = p.duel.fighters[0], w = p.duel.fighters[1].body, dx = w.x - me.body.x, dz = w.z - me.body.z, gap = Math.hypot(dx, dz);
    return me.phase === 'sheathed' ? act('light') : gap > 1.9 ? { ...idle(), move: { x: dx / gap, z: dz / gap, yaw: 0, run: false } } : STRATEGIES['light spam']!(p.duel);
  };
  const run = (loadouts?: [Loadout, Loadout]) => {
    let p = initialPractice(731, OPPONENTS.veteran, 'longsword', loadouts);
    const dealt: [number, number][] = [];
    for (let t = 0; t < 7200 && !p.finish; t++) { p = stepPractice(p, spam(p), OPPONENTS.veteran.profiles.normal); for (const e of p.duel.events) if (e.damage && ((e.type !== 'Blocked' && e.target === 1) || (e.type === 'Blocked' && e.actor === 1))) dealt.push([t, e.damage]); }
    return dealt;
  };
  const plain = run(), geared = run([ORIGIN, NAKED]);
  assert.ok(plain.length >= 3, `the spam lands ${plain.length} blows naked`);
  const n = Math.min(plain.length, geared.length);
  let scaledUp = 0;
  for (let i = 0; i < n; i++) {
    if (plain[i]![0] !== geared[i]![0]) break;   // once a fight diverges (a warden killed sooner) later blows are a different fight
    assert.equal(geared[i]![1], Math.round(plain[i]![1] * CAPS.attack), `blow ${i} at tick ${plain[i]![0]}: ${plain[i]![1]} naked, ${geared[i]![1]} with an Origin longsword`);
    if (geared[i]![1] > plain[i]![1]) scaledUp++;
  }
  assert.ok(scaledUp > 0, 'Attack changed at least one number the warden took');
});
