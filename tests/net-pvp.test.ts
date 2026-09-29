// PR3 of live PvP (docs/duel-architecture.md §7): the guest's view (viewAs), the wire codec, the lobby handshake and the driver over a
// lossy fake link, and Match's 'pvp' mode (nothing recorded, nothing awarded).
import assert from 'node:assert/strict';
import test from 'node:test';
import { decide, initialAi, type AiState } from '../src/ai.ts';
import { project } from '../src/combat.ts';
import { idleIntent, stepDuel, type Duel, type Intent, type Side } from '../src/duel.ts';
import { Match, type PvpDriver } from '../src/match.ts';
import { OPPONENTS, PROFILES } from '../src/moves.ts';
import { PvpDuel, cleanKit, fromWire, packIntents, toWire, unpackIntents, type DuelMessage } from '../src/net/pvp.ts';
import { hashDuel, NET, pvpDuel, sameIntent } from '../src/net/rollback.ts';
import { metricsRow } from '../src/net/lobby.ts';
import { viewAs } from '../src/net/view.ts';
import { loadProfile } from '../src/profile.ts';
import { quantizeIntent, RECORD_VERSION } from '../src/record.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { loadTrial } from '../src/trial.ts';

const FRAME_MS = 1000 / 60;
const rng = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

// A fight a few seconds in, with events on its last tick, from two wardens' plain steps.
function midFight(): Duel {
  let duel = pvpDuel({ weapon: 'longsword', skill: null }, { weapon: 'estoc', skill: null });
  const ai: [AiState, AiState] = [initialAi(3), initialAi(4)];
  for (let t = 0; t < 900; t++) {
    const intents = ([0, 1] as const).map((side) => {
      if (duel.fighters[side].phase === 'sheathed') return { ...idleIntent(), action: 'light' } as Intent;
      const d = decide(duel, side, ai[side], PROFILES.normal); ai[side] = d.ai; return d.intent;
    }) as [Intent, Intent];
    const next = stepDuel(duel, intents);
    if (t > 300 && next.events.some((e) => e.target !== undefined)) return next;
    duel = next;
  }
  return duel;
}

test('viewAs: side 0 is the duel itself; side 1 swaps the men and flips every side, and twice is the original', () => {
  const duel = midFight(), guest = viewAs(duel, 1);
  assert.equal(viewAs(duel, 0), duel);
  assert.equal(guest.fighters[0], duel.fighters[1]); assert.equal(guest.fighters[1], duel.fighters[0]);
  assert.ok(duel.events.length > 0, 'the fixture has events to flip');
  duel.events.forEach((e, i) => {
    assert.equal(guest.events[i].actor, 1 - e.actor);
    if (e.target !== undefined) assert.equal(guest.events[i].target, 1 - e.target);
    else assert.equal('target' in guest.events[i], false, 'no target is invented');
  });
  assert.deepEqual(viewAs(guest, 1), duel);
  const seen = project(guest, initialAi(0));
  assert.equal(seen.playerHealth, duel.fighters[1].health, "the guest's HUD shows the guest's own health as the player's");
  assert.equal(seen.health, duel.fighters[0].health);
  const finished: Duel = { ...duel, finish: { victim: 0, location: 'head', move: 'thrust', heading: 0 } };
  assert.equal(viewAs(finished, 1).finish?.victim, 1, "the challenger's death is the guest's win");
});

test('wire: a packet round-trips bit for bit through the record columns, and stays small', () => {
  const random = rng(7), intents: Intent[] = [];
  const actions = [null, 'light', 'heavy', 'thrust', 'parry', 'dodge', 'skill'] as const, dirs = [undefined, 'left', 'right', 'overhead', 'thrust', 'low'] as const;
  for (let i = 0; i < 64; i++) {
    const it: Intent = { move: { x: random() * 2 - 1, z: random() * 2 - 1, yaw: (random() * 2 - 1) * 7, run: random() < 0.3 }, action: actions[i % actions.length], guard: random() < 0.4, lock: random() < 0.5 };
    if (random() < 0.2) it.held = true;
    if (random() < 0.1) it.cancel = true;
    const d = dirs[i % dirs.length]; if (d) it.guardDirection = d;
    intents.push(quantizeIntent(it));
  }
  assert.deepEqual(unpackIntents(packIntents(intents)), intents);
  assert.deepEqual(unpackIntents(packIntents([])), []);
  const packet = { from: 41, ack: 37, hash: [30, '0123456789abcdef'] as [number, string], intents: intents.slice(0, 15) };
  assert.deepEqual(fromWire(toWire(packet)), packet);
  assert.ok(JSON.stringify(toWire(packet)).length < 240, `a 15-intent packet fits in under 240 characters (${JSON.stringify(toWire(packet)).length}; ~1,300 as JSON)`);
});

type Link = { latencyMs: number; jitterMs: number; loss: number };
// Two pages over one link: the handshake (hello, pings, go) and the fight, every message delayed, jittered and dropped alike.
function duelOver(link: Link, frames: number, seed = 1) {
  const random = rng(seed), inFlight: { at: number; to: Side; m: DuelMessage }[] = [];
  let now = 0, clean = false;
  const sender = (from: Side) => (m: DuelMessage) => {
    if (!clean && random() < link.loss) return;
    inFlight.push({ at: now + (clean ? 0 : link.latencyMs + random() * link.jitterMs), to: from === 0 ? 1 : 0, m: JSON.parse(JSON.stringify(m)) as DuelMessage });
  };
  const pages: [PvpDuel, PvpDuel] = [
    new PvpDuel(0, { weapon: 'longsword', skill: 'pommel', gear: ['veteran.helmet', 'executioner.body'] }, sender(0), () => now),
    new PvpDuel(1, { weapon: 'estoc', skill: null, gear: [] }, sender(1), () => now),
  ];
  const ai: [AiState, AiState] = [initialAi(seed), initialAi(seed + 1)];
  const intentFor = (side: Side): Intent => {
    const duel = pages[side].session?.duel;
    if (!duel || duel.finish) return idleIntent();
    if (duel.fighters[side].phase === 'sheathed') return { ...idleIntent(), action: 'light' };
    const d = decide(duel, side, ai[side], PROFILES.normal); ai[side] = d.ai; return d.intent;
  };
  for (let frame = 0; frame < frames * 2; frame++) {
    now = frame * FRAME_MS; clean = frame >= frames;
    for (let i = inFlight.length - 1; i >= 0; i--) if (inFlight[i].at <= now) { const { to, m } = inFlight[i]; inFlight.splice(i, 1); pages[to].receive(m); }
    for (const side of [0, 1] as const) pages[side].frame(intentFor(side));
    if (clean && pages.every((p) => p.settled && p.session?.duel.finish)) break;
  }
  return pages;
}

for (const [name, link] of [['same city', { latencyMs: 15, jitterMs: 10, loss: 0.02 }], ['far, lossy', { latencyMs: 125, jitterMs: 30, loss: 0.1 }]] as const) {
  test(`handshake and duel over a ${name} link: both pages confirm the same fight (and the same settled finish when it ends), no desync`, () => {
    const [a, b] = duelOver(link, 7200, name.length);
    assert.equal(a.stage, 'fighting'); assert.equal(b.stage, 'fighting');
    const [x, y] = [a.session!, b.session!];
    assert.ok(x.confirmed >= 1800 && y.confirmed >= 1800, `both confirmed half a minute at least (${x.confirmed}, ${y.confirmed})`);
    assert.equal(x.duel.fighters[0].weapon, 'longsword'); assert.equal(y.duel.fighters[1].weapon, 'estoc', 'the kits came through the handshake');
    const upTo = Math.min(x.confirmed, y.confirmed);
    for (const side of [0, 1] as const) for (let t = 0; t < upTo; t++) assert.ok(sameIntent(x.log[side][t], y.log[side][t]), `side ${side} tick ${t + 1}`);
    for (const [t, hash] of x.hashes) if (y.hashes.has(t)) assert.equal(y.hashes.get(t), hash, `fingerprint at ${t}`);
    assert.ok([...x.hashes.keys()].filter((t) => y.hashes.has(t)).length > 5, 'fingerprints were compared');
    assert.equal(x.stats.desyncs.length + y.stats.desyncs.length, 0);
    assert.equal(b.practice.playerHealth, y.duel.fighters[1].health, "the guest's page shows the guest as the player");
    if (x.duel.finish || y.duel.finish) {   // two wardens do not always settle it (fixture.ts: "a fight nobody wins"); when they do, it is one finish
      assert.ok(a.settled && b.settled, 'both finishes are settled');
      assert.deepEqual(x.duel.finish, y.duel.finish);
      assert.equal(a.practice.finish?.victim, x.duel.finish!.victim); assert.equal(b.practice.finish?.victim, 1 - x.duel.finish!.victim);
    }
    assert.ok(x.delay >= NET.delay && x.delay <= NET.maxDelay);
    // The record: both kits whole (the gear ids the verifier derives each Loadout from), and both streams replay to the same fingerprints.
    const record = a.record('dev')!;
    assert.deepEqual(record.kits, b.record('dev')!.kits);
    assert.deepEqual(record.kits[0].gear, ['veteran.helmet', 'executioner.body']); assert.deepEqual(record.kits[1].gear, []);
    const streams = [unpackIntents(record.intents[0]), unpackIntents(record.intents[1])];
    let replay = pvpDuel(record.kits[0], record.kits[1]);
    for (let t = 1; t <= record.ticks; t++) { replay = stepDuel(replay, [streams[0][t - 1], streams[1][t - 1]]); if (x.hashes.has(t)) assert.equal(hashDuel(replay), x.hashes.get(t), `replay at ${t}`); }
  });
}

test('cleanKit: a peer kit keeps player weapons, known skills and well-formed gear ids only, and cleaning twice changes nothing', () => {
  assert.deepEqual(cleanKit({ weapon: 'estoc', skill: 'pommel', gear: ['veteran.helmet'] }), { weapon: 'estoc', skill: 'pommel', gear: ['veteran.helmet'] });
  const dirty = cleanKit({ weapon: 'reaper' as never, skill: 'fireball' as never, gear: ['ok.id', 7, 'bad id!', 'x'.repeat(65), ...Array(30).fill('a.b')] as never });
  assert.deepEqual(dirty, { weapon: 'longsword', skill: null, gear: ['ok.id', ...Array(15).fill('a.b')] });
  assert.deepEqual(cleanKit(dirty), dirty);
  assert.deepEqual(cleanKit(null), { weapon: 'longsword', skill: null, gear: [] });
});

test('handshake: a peer on another record version refuses the duel, and says which side should reload', () => {
  const sent: DuelMessage[] = [], page = new PvpDuel(1, { weapon: 'longsword', skill: null }, (m) => sent.push(m), () => 0);
  page.receive({ k: 'hello', v: RECORD_VERSION + 1, kit: { weapon: 'longsword', skill: null } });
  assert.equal(page.stage, 'refused');
  assert.match(page.refused!, /newer build: reload/);
  assert.ok(sent.some((m) => m.k === 'hello' && m.v === RECORD_VERSION), 'it tells the peer its own version, so that page refuses too');
  page.receive({ k: 'go', delay: 2, kits: [{ weapon: 'longsword', skill: null }, { weapon: 'longsword', skill: null }] });
  assert.equal(page.session, null, 'a refused page never starts');
});

test("Match 'pvp': the driver steps the fight, the end waits for a settled finish, and nothing is recorded or awarded", () => {
  const storage = (() => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; })();
  const ports = { storage, trial: loadTrial(storage), scorecard: loadScorecard(storage), profile: loadProfile(storage, () => 'device').profile };
  const before = JSON.stringify({ card: ports.trial.card, rows: ports.scorecard.rows, profile: ports.profile });
  const match = new Match(OPPONENTS.veteran, 'dev', ports);
  const won = project({ ...pvpDuel(), finish: { victim: 1, location: 'head', move: 'thrust', heading: 0 } }, initialAi(0));
  let settled = false, frames = 0;
  const driver: PvpDriver = { practice: project(pvpDuel(), initialAi(0)), get settled() { return settled; }, frame() { frames++; return won; } };
  match.startPvp(driver);
  assert.equal(match.mode, 'pvp'); assert.equal(match.recorder, null); assert.ok(match.practiceOnly);
  assert.equal(match.step(idleIntent), 'stepped', 'a finish a rollback could still undo does not end the match');
  settled = true;
  assert.equal(match.step(idleIntent), 'ended');
  const ended = match.end(false);
  assert.deepEqual(ended, { record: null, lines: [], won: true, rewarded: false });
  assert.equal(frames, 2);
  match.rematch();
  assert.equal(match.pvp, driver, 'a rematch never drops the live duel');
  assert.equal(match.rearm('estoc'), false, "the agreed kit is never swapped under the peer");
  assert.equal(JSON.stringify({ card: ports.trial.card, rows: ports.scorecard.rows, profile: ports.profile }), before, 'no trial line, scorecard row, mark or dial turn');
});

test('duel_metrics row: in range for the migration, refused without a revision or a room', () => {
  const m = { tooSlow: false, frames: 3600, rollbacksPerMin: 12.5, depthP95: 3, maxDepth: 2, stallsPerMin: 1, delay: 3, maxDelay: 2, rttP50Ms: 80, rttP95Ms: 60, desyncs: 0 };
  const meta = { revision: 'abcdef1', room: 'abcdefgh12345678', side: 1 as const, path: 'direct' as const, candidate: 'srflx' as const, ua: 'Mozilla\n5.0' };
  const row = metricsRow(m, meta)!;
  assert.ok(row.max_depth >= row.depth_p95 && row.max_delay >= row.delay && row.rtt_p95_ms >= row.rtt_p50_ms, 'the ordering checks hold');
  assert.equal(row.ua, 'Mozilla 5.0');
  assert.equal(metricsRow(m, { ...meta, revision: null }), null);
  assert.equal(metricsRow(m, { ...meta, room: 'NOPE' }), null);
  assert.equal(metricsRow({ ...m, frames: 0 }, meta), null);
});
