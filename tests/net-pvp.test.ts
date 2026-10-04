// PR3 of live PvP (docs/duel-architecture.md §7): the guest's view (viewAs), the wire codec, the lobby handshake and the driver over a
// lossy fake link, and Match's 'pvp' mode (nothing recorded, nothing awarded).
import assert from 'node:assert/strict';
import test from 'node:test';
import { decide, initialAi, type AiState } from '../src/ai.ts';
import { project } from '../src/combat.ts';
import { idleIntent, stepDuel, type CombatEvent, type Duel, type Intent, type Side } from '../src/duel.ts';
import { Match, type PvpDriver } from '../src/match.ts';
import { OPPONENTS, PROFILES } from '../src/moves.ts';
import { MESSAGE_CAP, PvpDuel, cleanKit, fromWire, packIntents, parseMessage, toWire, unpackIntents, type DuelMessage } from '../src/net/pvp.ts';
import { hashDuel, NET, pvpDuel, RollbackSession, sameIntent } from '../src/net/rollback.ts';
import { metricsRow, reportBody } from '../src/net/lobby.ts';
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
  const emitted: [CombatEvent[], CombatEvent[]] = [[], []];
  let earlyFinish = 0;
  for (let frame = 0; frame < frames * 2; frame++) {
    now = frame * FRAME_MS; clean = frame >= frames;
    for (let i = inFlight.length - 1; i >= 0; i--) if (inFlight[i].at <= now) { const { to, m } = inFlight[i]; inFlight.splice(i, 1); pages[to].receive(m); }
    for (const side of [0, 1] as const) {
      const shown = pages[side].frame(intentFor(side));
      emitted[side].push(...shown.events);
      if (shown.finish && !pages[side].session?.confirmedDuel().finish) earlyFinish++;
    }
    if (clean && pages.every((p) => p.settled && p.session?.duel.finish)) break;
  }
  return Object.assign(pages, { emitted, earlyFinish });
}

for (const [name, link] of [['same city', { latencyMs: 15, jitterMs: 10, loss: 0.02 }], ['far, lossy', { latencyMs: 125, jitterMs: 30, loss: 0.1 }]] as const) {
  test(`handshake and duel over a ${name} link: both pages confirm the same fight (and the same settled finish when it ends), no desync`, () => {
    const run = duelOver(link, 7200, name.length), [a, b] = run;
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
    // Gate 2: every event a page sounded or showed is a confirmed tick's, in order, and no finish showed before it was confirmed.
    for (const [side, page] of [[0, a], [1, b]] as const) {
      const s = page.session!, events: CombatEvent[] = [];
      let d = pvpDuel(page.kits![0], page.kits![1]);
      for (let t = 1; t <= s.confirmed; t++) { d = stepDuel(d, [s.log[0][t - 1], s.log[1][t - 1]]); events.push(...viewAs(d, side).events); }
      assert.deepEqual(run.emitted[side], events, `side ${side}: the events shown are exactly the confirmed ticks' events`);
    }
    assert.equal(run.earlyFinish, 0, 'no finish was shown before it was confirmed');
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
  assert.throws(() => match.end(false), /settled/, 'an early caller cannot record an unverified PvP win');
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
  assert.equal(row.result, null, 'no result until the duel has one');
  assert.equal(metricsRow(m, { ...meta, result: 'forfeit-win' })!.result, 'forfeit-win');
  assert.equal(row.reconnects, 0, 'a page that never dropped sends 0, always present');
  assert.equal(metricsRow(m, { ...meta, reconnects: 3 })!.reconnects, 3);
  assert.equal(metricsRow(m, { ...meta, reconnects: 5000 })!.reconnects, 1000, 'clamped to the column check');
  assert.equal(metricsRow(m, { ...meta, reconnects: -2 })!.reconnects, 0);
});

// Two idle pages over a clean one-frame link with a switch for each direction and each page's frames (gate 3's harness).
function idlePair() {
  const inFlight: { to: Side; m: DuelMessage }[] = [], sent: [number, number] = [0, 0];
  let now = 0;
  const link = { up: [true, true] as [boolean, boolean], framing: [true, true] as [boolean, boolean] };
  const sender = (from: Side) => (m: DuelMessage) => { sent[from]++; if (link.up[from]) inFlight.push({ to: from === 0 ? 1 : 0, m: JSON.parse(JSON.stringify(m)) as DuelMessage }); };
  const pages: [PvpDuel, PvpDuel] = [new PvpDuel(0, { weapon: 'longsword', skill: null }, sender(0), () => now, 'room0000'), new PvpDuel(1, { weapon: 'estoc', skill: null }, sender(1), () => now, 'room0000')];
  const step = (frames: number) => {
    for (let f = 0; f < frames; f++) {
      now += FRAME_MS;
      for (const { to, m } of inFlight.splice(0)) pages[to].receive(m);
      for (const side of [0, 1] as const) if (link.framing[side]) pages[side].frame(idleIntent());
    }
  };
  return { pages, step, link, sent };
}
const seconds = (s: number) => Math.round(s * 60);

// An already lethal confirmed fixture makes the interval before the first hash check observable.
// Both real rollback sessions still exchange their own inputs, acks and fingerprints.
function finishingPair(diverge = false, loseNotice = false) {
  let now = 0, dropped = false;
  const pending: { to: Side; message: DuelMessage }[] = [];
  const send = (from: Side) => (message: DuelMessage) => {
    if (loseNotice && from === 0 && message.k === 'net') message = { ...message, p: { ...message.p, h: null } };
    if (loseNotice && from === 0 && (message.k as string) === 'desync' && !dropped) { dropped = true; return; }
    pending.push({ to: from === 0 ? 1 : 0, message });
  };
  const kit = { weapon: 'longsword', skill: null } as const;
  const pages: [PvpDuel, PvpDuel] = [new PvpDuel(0, kit, send(0), () => now, 'room0000'), new PvpDuel(1, kit, send(1), () => now, 'room0000')];
  for (const side of [0, 1] as const) {
    const duel = pvpDuel();
    duel.finish = { victim: 1, location: 'head', move: 'thrust', heading: 0 };
    if (diverge && side === 1) duel.fighters[0].health -= 1;
    pages[side].session = new RollbackSession(side, duel);
    pages[side].stage = 'fighting';
  }
  const step = (frames: number) => {
    for (let f = 0; f < frames; f++) {
      now += FRAME_MS;
      for (const { to, message } of pending.splice(0)) pages[to].receive(message);
      for (const page of pages) page.frame(idleIntent());
    }
  };
  return { pages, step };
}

test('desync settlement: a short confirmed finish waits for the peer fingerprint before declaring a result', () => {
  const { pages, step } = finishingPair();
  step(8);
  for (const page of pages) {
    assert.ok(page.session!.confirmedDuel().finish);
    assert.ok(page.session!.acked >= 2, 'the peer has acked the lethal inputs');
    assert.equal(page.settled, false, 'input acknowledgment alone cannot certify equal states');
    assert.equal(page.result, null);
  }
  step(60);
  for (const page of pages) { assert.equal(page.settled, true); assert.equal(page.result, 'finished'); }
});

test('desync settlement: differing confirmed states end both pages as No contest without advancing again', () => {
  const { pages, step } = finishingPair(true);
  step(70);
  for (const page of pages) {
    assert.equal(page.result, 'no-contest');
    assert.equal(page.settled, false);
    assert.equal(page.over, true);
    assert.ok(page.session!.stats.desyncs.length > 0, 'the original mismatch tick remains diagnostic evidence');
  }
  const ticks = pages.map(p => p.session!.duel.tick);
  step(100);
  assert.deepEqual(pages.map(p => p.session!.duel.tick), ticks, 'a disagreement never resumes the simulation');
});

test('desync settlement: the peer receives No contest even if its hash comparison and first notice were lost', () => {
  const { pages, step } = finishingPair(true, true);
  step(100);
  assert.ok(pages[0].session!.stats.desyncs.length > 0);
  assert.deepEqual(pages[1].session!.stats.desyncs, [], 'the second page learned the terminal outcome from its peer');
  for (const page of pages) { assert.equal(page.result, 'no-contest'); assert.equal(page.settled, false); }
});

test('desync settlement: a fingerprint received before its local checkpoint stops the confirming frame', () => {
  const { pages, step } = finishingPair();
  pages[0].receive({ k: 'net', r: 'room0000', p: { f: 3, a: 2, h: [30, '0000000000000000'], i: packIntents([]) } });
  assert.deepEqual(pages[0].session!.stats.desyncs, [], 'a future fingerprint is not yet a disagreement');
  step(70);
  assert.deepEqual(pages[0].session!.stats.desyncs, [30]);
  for (const page of pages) assert.equal(page.result, 'no-contest');
});

test('desync settlement: a peer without the settlement protocol is refused before play', () => {
  const page = new PvpDuel(0, { weapon: 'longsword', skill: null }, () => {}, () => 0, 'room0000');
  page.receive({ k: 'hello', r: 'room0000', v: RECORD_VERSION, kit: { weapon: 'longsword', skill: null } });
  page.frame(idleIntent());
  assert.equal(page.stage, 'refused');
  assert.equal(page.session, null);
  assert.match(page.refused!, /reload/i);
});

test('desync settlement: a delayed mismatching checkpoint revokes a previously settled result', () => {
  const { pages, step } = finishingPair();
  step(70);
  assert.equal(pages[0].result, 'finished');
  const packet = pages[1].session!.outgoing();
  pages[0].receive({ k: 'net', r: 'room0000', p: toWire({ ...packet, hash: [30, '0000000000000000'] }) });
  assert.deepEqual(pages[0].session!.stats.desyncs, [30]);
  assert.equal(pages[0].settled, false);
  assert.equal(pages[0].result, 'no-contest');
});

test('desync settlement: a peer\'s bare desync notice cannot void a finish this page has settled (Auditor F2)', () => {
  const { pages, step } = finishingPair();
  step(70);
  assert.equal(pages[0].result, 'finished');
  pages[0].receive({ k: 'desync', r: 'room0000' });
  assert.equal(pages[0].stage, 'fighting', 'an unproven claim changes nothing once the finish is settled');
  assert.equal(pages[0].settled, true);
  assert.equal(pages[0].result, 'finished');
});

test('duel report: both settled pages build agreeing reports (opposite results, same hash); none before settling, none for a stranger or a nameless page', () => {
  const { pages: [a, b], step } = finishingPair();
  assert.equal(reportBody(a, 'room0000', { name: 'Aldren', level: 5 }), null, 'nothing before the finish settles');
  step(70);
  const ra = reportBody(a, 'room0000', { name: 'Aldren', level: 5 })!, rb = reportBody(b, 'room0000', { name: 'Bo', level: 6 })!;
  assert.ok(ra && rb);
  assert.deepEqual([ra.p_result, rb.p_result].sort(), ['loss', 'win']);
  assert.equal(ra.p_hash, rb.p_hash);
  assert.match(String(ra.p_hash), /^[0-9a-f]{16}$/);
  assert.equal(reportBody(a, 'room0000', null), null);
  assert.equal(reportBody(a, 'room0000', { name: '\u0007 ', level: 5 }), null);
  assert.equal(reportBody(a, 'x', { name: 'Aldren', level: 5 }), null);
});

test('gate 3: a cut link says "waiting" after 3 s and is abandoned on both pages after 15 s; an abandoned page stops sending', () => {
  const { pages: [a, b], step, link, sent } = idlePair();
  step(seconds(10));
  assert.equal(a.stage, 'fighting'); assert.equal(b.stage, 'fighting');
  link.up = [false, false];
  step(seconds(2)); assert.equal(a.silent, false, 'two seconds is not yet silence');
  step(seconds(2)); assert.ok(a.silent && b.silent, 'both pages say they are waiting');
  step(seconds(10)); assert.equal(a.stage, 'fighting', 'fourteen seconds: still a duel');
  step(seconds(2)); assert.equal(a.stage, 'abandoned'); assert.equal(b.stage, 'abandoned');
  assert.ok(!a.settled && !b.settled, 'no result: No contest');
  const count = [...sent];
  step(seconds(5)); assert.deepEqual(sent, count, 'an abandoned page sends nothing');
  link.up = [true, true];
  step(seconds(1)); assert.equal(a.stage, 'abandoned', 'a late packet does not revive an abandoned duel');
});

test('gate 3: a page hidden for 10 s (no frames, still receiving) resumes the same duel; the other page only waited', () => {
  const { pages: [a, b], step, link } = idlePair();
  step(seconds(10));
  link.framing[1] = false;
  step(seconds(10));
  assert.ok(a.silent, 'the peer of a hidden page says it is waiting');
  assert.equal(a.stage, 'fighting');
  const frozen = a.session!.duel.tick;
  step(seconds(1)); assert.ok(a.session!.duel.tick - frozen <= 1, 'the fight is frozen by the rollback window, not played on alone');
  link.framing[1] = true;
  step(seconds(10));
  assert.equal(a.stage, 'fighting'); assert.equal(b.stage, 'fighting'); assert.equal(a.silent, false);
  const upTo = Math.min(a.session!.confirmed, b.session!.confirmed), at = upTo - (upTo % NET.hashEvery);
  assert.ok(upTo > seconds(15), `both confirm past the gap (${upTo})`);
  assert.equal(a.session!.hashes.get(at), b.session!.hashes.get(at));
  assert.deepEqual(a.session!.stats.desyncs, []);
});

test('gate 1: the message door refuses an oversized text, another room, and a bad field, without throwing', () => {
  const kit = { weapon: 'longsword', skill: null } as const;
  assert.deepEqual(parseMessage(JSON.stringify({ k: 'ping', n: 3, r: 'roomA' }), 'roomA'), { k: 'ping', r: 'roomA', n: 3 });
  assert.equal(parseMessage(JSON.stringify({ k: 'ping', n: 3, r: 'roomB' }), 'roomA'), null, 'another duel');
  assert.equal(parseMessage('{"k":"ping","n":3,"r":"roomA","pad":"' + 'x'.repeat(MESSAGE_CAP) + '"}', 'roomA'), null, 'over the cap');
  assert.equal(parseMessage('{not json', 'roomA'), null);
  assert.equal(parseMessage({ k: 'go', r: 'roomA', delay: 1e6, kits: [kit, kit] }, 'roomA'), null, 'a delay outside NET');
  assert.equal(parseMessage({ k: 'net', r: 'roomA', p: { f: 3, a: 2, h: null, i: packIntents(Array(NET.redundancy + 1).fill(idleIntent())) } }, 'roomA'), null, 'more intents than a packet carries');
});

test('gate 1: RollbackSession refuses a packet that acks what was never sent or skips ahead, and changes nothing', () => {
  const s = new RollbackSession(0, pvpDuel(), 2);
  for (let i = 0; i < 5; i++) s.frame(idleIntent());
  const before = JSON.stringify({ out: s.outgoing(), tick: s.duel.tick, known: s.known, acked: s.acked });
  const idle = [idleIntent()];
  assert.equal(s.receive({ from: 3, ack: 10_000, hash: null, intents: idle }), false, 'an ack of a tick never sent');
  assert.equal(s.receive({ from: 50, ack: 2, hash: null, intents: idle }), false, 'a start past the first unheard tick');
  assert.equal(s.receive({ from: 3, ack: 2, hash: [31, '0123456789abcdef'], intents: idle }), false, 'a fingerprint off the 30-tick grid');
  assert.equal(s.receive({ from: 3, ack: 2, hash: null, intents: Array(NET.redundancy + 1).fill(idleIntent()) }), false);
  assert.equal(JSON.stringify({ out: s.outgoing(), tick: s.duel.tick, known: s.known, acked: s.acked }), before);
  assert.equal(s.receive({ from: 3, ack: 2, hash: null, intents: idle }), true, 'the honest packet is taken');
});

// Reconnect and forfeit (Strategy 2026-10-01). Each page tells its driver how its OWN link to the relay is (setLink: the relay's beats). A peer
// that comes back inside 10 s resumes the same duel; past it, the page whose link held wins by forfeit and the page whose link broke left.
const hearing = (a: PvpDuel, b: PvpDuel, up: [boolean | null, boolean | null]) => { a.setLink(up[0]); b.setLink(up[1]); };

test('reconnect: a peer that drops and is back inside 10 s resumes the same duel, with the same fingerprints and no forfeit', () => {
  const { pages: [a, b], step, link } = idlePair();
  hearing(a, b, [true, true]); step(seconds(10));
  link.up = [false, false]; hearing(a, b, [true, false]);   // b's socket drops
  step(seconds(4)); assert.ok(a.silent, 'the page that stayed says the peer is reconnecting');
  step(seconds(5)); assert.equal(a.stage, 'fighting', 'nine seconds in: still a duel');
  link.up = [true, true]; hearing(a, b, [true, true]);   // b is back with its same page state
  step(seconds(10));
  assert.equal(a.stage, 'fighting'); assert.equal(b.stage, 'fighting'); assert.equal(a.silent, false);
  assert.equal(a.result, null, 'and it is still going on');
  const upTo = Math.min(a.session!.confirmed, b.session!.confirmed), at = upTo - (upTo % NET.hashEvery);
  assert.ok(upTo > seconds(15), `both confirm past the gap (${upTo})`);
  assert.equal(a.session!.hashes.get(at), b.session!.hashes.get(at));
  assert.deepEqual(a.session!.stats.desyncs, []); assert.deepEqual(b.session!.stats.desyncs, []);
});

test('forfeit: past 10 s the page whose link held wins, the page whose link broke left, and neither sends another packet', () => {
  const { pages: [a, b], step, link, sent } = idlePair();
  hearing(a, b, [true, true]); step(seconds(10));
  link.up = [false, false]; hearing(a, b, [true, false]);
  step(seconds(9)); assert.equal(a.stage, 'fighting'); assert.equal(a.result, null);
  step(seconds(2));
  assert.equal(a.stage, 'forfeit'); assert.equal(a.result, 'forfeit-win', 'the page that stayed wins by forfeit');
  assert.equal(b.stage, 'left'); assert.equal(b.result, 'forfeit-loss', 'the page that dropped lost');
  assert.ok(!a.settled && !b.settled, 'no settled finish: the duel never decided it');
  const count = [...sent];
  link.up = [true, true]; hearing(a, b, [true, true]);   // b's link returns after the forfeit
  step(seconds(5));
  assert.deepEqual(sent, count, 'an ended duel sends nothing');
  assert.equal(a.stage, 'forfeit', 'a late return does not undo the forfeit'); assert.equal(b.stage, 'left'); assert.equal(b.result, 'forfeit-loss');
});

test('forfeit: a page whose own link broke even for a moment never claims the win, and both links down means neither wins', () => {
  const { pages: [a, b], step, link } = idlePair();
  hearing(a, b, [true, true]); step(seconds(10));
  link.up = [false, false]; step(2);   // what was already in flight lands first
  hearing(a, b, [false, false]);
  step(seconds(2)); hearing(a, b, [true, true]);   // both links come back, but the peers still cannot hear each other (a black hole between them)
  step(seconds(10));
  assert.equal(a.stage, 'left'); assert.equal(b.stage, 'left');
  assert.equal(a.result, 'forfeit-loss'); assert.equal(b.result, 'forfeit-loss', 'two pages that both lost their link: neither is handed the win');
});

test('forfeit: a link that was never reported keeps the old rule, No contest after 15 s and no winner', () => {
  const { pages: [a, b], step, link } = idlePair();
  step(seconds(10)); link.up = [false, false];
  step(seconds(11)); assert.equal(a.stage, 'fighting', 'eleven seconds with no link information is not yet a forfeit');
  step(seconds(5)); assert.equal(a.stage, 'abandoned'); assert.equal(b.stage, 'abandoned');
  assert.equal(a.result, 'no-contest'); assert.equal(b.result, 'no-contest');
});

test('forfeit (Auditer F1): a page hidden past the rejoin window never claims the win, even though its socket kept receiving', () => {
  const { pages: [a, b], step, link } = idlePair();
  hearing(a, b, [true, true]); step(seconds(10));
  link.framing[1] = false;   // b's tab is hidden: it receives, and sends and steps nothing
  step(seconds(11)); assert.equal(a.stage, 'forfeit', 'the peer of a page that stopped sending wins by forfeit');
  step(seconds(3)); link.framing[1] = true;   // b comes back; a is quiet now
  step(seconds(30));
  assert.equal(b.stage, 'left', 'the page that was away loses, however long it then waits');
  assert.equal(b.result, 'forfeit-loss'); assert.equal(a.result, 'forfeit-win');
});

test('forfeit (Auditer F1): a page hidden for less than the rejoin window resumes the duel and loses nothing', () => {
  const { pages: [a, b], step, link } = idlePair();
  hearing(a, b, [true, true]); step(seconds(10));
  link.framing[1] = false; step(seconds(8)); link.framing[1] = true;
  step(seconds(10));
  assert.equal(a.stage, 'fighting'); assert.equal(b.stage, 'fighting'); assert.equal(a.result, null); assert.equal(b.result, null);
});

test('forfeit (Auditer F1, Strategy): both pages hidden past the rejoin window: neither records the win, both left', () => {
  const { pages: [a, b], step, link } = idlePair();
  hearing(a, b, [true, true]); step(seconds(10));
  link.framing = [false, false]; step(seconds(15));   // both tabs hidden: nothing steps, nothing is sent
  link.framing = [true, true]; step(seconds(3));
  assert.equal(a.stage, 'left'); assert.equal(b.stage, 'left');
  assert.equal(a.result, 'forfeit-loss'); assert.equal(b.result, 'forfeit-loss', 'two pages that were both away: no winner');
});

test('ready gate (Option A): a page still loading its rigs holds the duel; no silence or forfeit runs against it, and the duel starts when both are in', () => {
  const { pages: [a, b], step } = idlePair();
  a.setReady(false); b.setReady(false); hearing(a, b, [true, true]);
  step(seconds(40));   // far past the 10 s rejoin window and the 15 s abandon: both are only loading
  assert.equal(a.stage, 'waiting'); assert.equal(b.stage, 'waiting'); assert.ok(!a.session && !b.session, 'nobody has started');
  assert.deepEqual([a.peer?.weapon, b.peer?.weapon], ['estoc', 'longsword'], 'the kits were exchanged all the same: that is what lets the rigs load');
  a.setReady(true); step(seconds(10));
  assert.equal(a.stage, 'waiting', 'one side in, the other still loading: still waiting');
  b.setReady(true); step(seconds(10));
  assert.equal(a.stage, 'fighting'); assert.equal(b.stage, 'fighting');
  assert.equal(a.result, null); assert.equal(b.result, null);
});


test('desync settlement: a reordered legacy go cannot bypass the protocol handshake', () => {
  const kit = { weapon: 'longsword', skill: null } as const;
  const page = new PvpDuel(1, kit, () => {}, () => 0, 'room0000');
  page.receive({ k: 'go', r: 'room0000', delay: 2, kits: [kit, kit] });
  assert.equal(page.session, null);
  assert.equal(page.stage, 'refused');
});
