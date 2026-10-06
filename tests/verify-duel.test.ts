// The PvP verifier (duel step 2): a room's result is re-derived from BOTH pages' PvpRecords. An honest duel passes; a forged winner, a
// forged fingerprint, an intent column changed on one page, and a room with one record are each refused (the last as unverified).
import assert from 'node:assert/strict';
import test from 'node:test';
import { decide, initialAi, type AiState } from '../src/ai.ts';
import { idleIntent, stepDuel, type Intent, type Side } from '../src/duel.ts';
import { PROFILES } from '../src/moves.ts';
import { packIntents, unpackIntents, type PvpRecord } from '../src/net/pvp.ts';
import { verifyDuel, type DuelClaim } from '../src/net/verify-duel.ts';
import { hashDuel, NET, pvpDuel, type Kit } from '../src/net/rollback.ts';
import { quantizeIntent, RECORD_VERSION } from '../src/record.ts';
import { REASON_MAX, UNVERIFIED_AFTER_MS, verifyRooms } from '../scripts/verify-duels.mjs';

const KITS: [Kit, Kit] = [{ weapon: 'longsword', skill: 'pommel', gear: ['veteran.helmet'] }, { weapon: 'estoc', skill: null, gear: [] }];

// Two wardens fight a real duel through pvpDuel, as the pages' sessions would log it; the first seed that ends in a kill (not a draw or a
// stalemate) is the fixture. Returns what each page would hold: the record, plus the checkpoint hash and winner it would report.
function honest(): { record: PvpRecord; hash: string; winner: Side } {
  for (let seed = 1; seed < 200; seed++) {
    let duel = pvpDuel(...KITS);
    const ai: [AiState, AiState] = [initialAi(seed), initialAi(seed + 1)];
    const log: [Intent[], Intent[]] = [[], []];
    for (let t = 1; t <= 3600; t++) {
      const intents = ([0, 1] as const).map((side): Intent => {
        if (duel.finish) return idleIntent();
        if (duel.fighters[side].phase === 'sheathed') return { ...idleIntent(), action: 'light' };
        const d = decide(duel, side, ai[side], PROFILES.normal); ai[side] = d.ai; return quantizeIntent(d.intent);   // the pages log quantized intents
      }) as [Intent, Intent];
      log[0].push(intents[0]); log[1].push(intents[1]); duel = stepDuel(duel, intents);
      if (duel.finish) break;
    }
    if (!duel.finish || duel.finish.draw) continue;
    const finishedAt = ((): number => { let d = pvpDuel(...KITS); for (let t = 1; t <= log[0].length; t++) { d = stepDuel(d, [log[0][t - 1], log[1][t - 1]]); if (d.finish) return t; } throw new Error('unreachable'); })();
    const checkpoint = Math.max(1, Math.ceil(finishedAt / NET.hashEvery)) * NET.hashEvery;
    while (log[0].length < checkpoint + 5) { log[0].push(idleIntent()); log[1].push(idleIntent()); }   // the pages confirm a little past the checkpoint
    let d = pvpDuel(...KITS), hash = '';
    for (let t = 1; t <= checkpoint; t++) { d = stepDuel(d, [log[0][t - 1], log[1][t - 1]]); if (t === checkpoint) hash = hashDuel(d); }
    return { record: { v: RECORD_VERSION, build: 'test', delay: 2, kits: KITS, ticks: log[0].length, intents: [packIntents(log[0]), packIntents(log[1])] }, hash, winner: duel.finish.victim === 1 ? 0 : 1 };
  }
  throw new Error('no seed gave a decided duel');
}

const claims = (fight: ReturnType<typeof honest>, record: [PvpRecord | null, PvpRecord | null] = [fight.record, fight.record]): [DuelClaim, DuelClaim] =>
  [0, 1].map((side) => ({ side: side as Side, won: fight.winner === side, hash: fight.hash, record: record[side] })) as [DuelClaim, DuelClaim];
const withColumn = (record: PvpRecord, column: 0 | 1, change: (intents: Intent[]) => void): PvpRecord => {
  const columns = [unpackIntents(record.intents[0]), unpackIntents(record.intents[1])]; change(columns[column]);
  return { ...record, intents: [packIntents(columns[0]), packIntents(columns[1])] };
};

test('verify duel: an honest duel, both pages\' records, passes with the winner both reported', () => {
  const fight = honest();
  assert.deepEqual(verifyDuel(claims(fight)), { ok: true, winner: fight.winner });
});

test('verify duel: a forged result is flagged (winner swapped, or a fingerprint that is not the replay\'s), even when the two lie alike', () => {
  const fight = honest(), [a, b] = claims(fight);
  const swapped = verifyDuel([{ ...a, won: !a.won }, { ...b, won: !b.won }]);
  assert.equal(swapped.ok, false); assert.match((swapped as { reason: string }).reason, /winner is not the reported one/);
  const fingerprint = verifyDuel([{ ...a, hash: '0123456789abcdef' }, { ...b, hash: '0123456789abcdef' }]);
  assert.equal(fingerprint.ok, false); assert.match((fingerprint as { reason: string }).reason, /fingerprint is not the reported one/);
  assert.equal(verifyDuel([a, { ...b, won: a.won }]).ok, false, 'both claiming the win');
});

test('verify duel: an intent column changed on one page disagrees with the other page\'s record', () => {
  const fight = honest(), other = fight.winner === 0 ? 1 : 0;
  // The loser's page rewrites the loser's own presses to idle for the whole duel: its own replay no longer ends as reported, and in any case
  // the winner's record still holds what was really sent.
  const forged = withColumn(fight.record, other, (intents) => intents.forEach((_, i) => { intents[i] = idleIntent(); }));
  const verdict = verifyDuel(claims(fight, other === 0 ? [forged, fight.record] : [fight.record, forged]));
  assert.equal(verdict.ok, false); assert.equal((verdict as { unverified: boolean }).unverified, false);
  // A single tick flipped, at a tick that does not change the outcome, is still a disagreement.
  const tick = withColumn(fight.record, 0, (intents) => { intents[3] = { ...intents[3], guard: !intents[3].guard }; });
  const small = verifyDuel(claims(fight, [tick, fight.record]));
  assert.equal(small.ok, false); assert.match((small as { reason: string }).reason, /disagree on side 0's intent at tick 4/);
});

test('verify duel: one record is unverified (no reward), never a pass; a room without both claims is not a pass either', () => {
  const fight = honest();
  for (const records of [[fight.record, null], [null, fight.record], [null, null]] as [PvpRecord | null, PvpRecord | null][]) {
    const verdict = verifyDuel(claims(fight, records));
    assert.equal(verdict.ok, false); assert.equal((verdict as { unverified: boolean }).unverified, true);
  }
});

test('verify duel: records that are not a decided fight are refused (bad version, ticks, undecodable, ends before the finish, same kits)', () => {
  const fight = honest(), base = fight.record;
  const refused = (record: PvpRecord, pattern: RegExp) => { const v = verifyDuel(claims(fight, [record, base])); assert.equal(v.ok, false); assert.match((v as { reason: string }).reason, pattern); };
  refused({ ...base, v: RECORD_VERSION + 1 }, /record version/);
  refused({ ...base, ticks: 0 }, /out of range/);
  refused({ ...base, intents: ['!!', base.intents[1]] }, /undecodable|fewer intents/);
  refused({ ...base, ticks: 10 }, /holds no finish/);
  refused({ ...base, kits: [KITS[1], KITS[0]] }, /./);
});

test('verify rooms: the sweep verifies honest rooms, flags a forged one with its reason, lists a one-record room as unverified, and a dry run writes nothing', async () => {
  const fight = honest(), forged = claims(fight).map((c) => ({ ...c, won: !c.won }));
  const rooms = [{ room: 'honest01', claims: claims(fight) }, { room: 'forged01', claims: forged }, { room: 'single01', claims: claims(fight, [fight.record, null]) }, { room: 'lonely01', claims: [claims(fight)[0]] }];
  const writes: string[] = [];
  const db = { pending: async () => rooms, verify: async (room: string) => { writes.push(`verify ${room}`); }, flag: async (room: string, reason: string) => { writes.push(`flag ${room}: ${reason}`); } };
  const receipt = await verifyRooms(db);
  assert.equal(receipt.checked, 4); assert.equal(receipt.verified, 1);
  assert.deepEqual(receipt.flagged.map((f: { room: string }) => f.room), ['forged01']);
  assert.deepEqual(receipt.unverified.map((f: { room: string }) => f.room), ['single01', 'lonely01']);
  assert.equal(writes.length, 2); assert.equal(writes[0], 'verify honest01'); assert.match(writes[1], /^flag forged01: .*winner is not the reported one/);
  writes.length = 0;
  const dry = await verifyRooms(db, { dry: true });
  assert.equal(dry.verified, 1); assert.equal(dry.flagged.length, 1); assert.deepEqual(writes, [], 'a dry run replays without writing');
});

test('verify duel: garbage in an uploaded record (null kits, an unknown weapon, junk intents, no intents) is a flag, never a throw', () => {
  const fight = honest(), base = fight.record;
  const garbage: PvpRecord[] = [
    { ...base, kits: null as never }, { ...base, kits: [KITS[0]] as never }, { ...base, kits: [{ weapon: 'reaper', skill: null }, KITS[1]] as never },
    { ...base, kits: [KITS[0], { weapon: 'estoc', skill: 'fireball', gear: [] }] as never }, { ...base, intents: null as never }, { ...base, intents: [7, {}] as never },
  ];
  for (const record of garbage) {
    const verdict = verifyDuel(claims(fight, [record, base]));
    assert.equal(verdict.ok, false); assert.equal((verdict as { unverified: boolean }).unverified, false);
  }
});

test('verify rooms: one room that throws is flagged and the sweep goes on; a one-record room past the age-out is marked unverified, a young one is not', async () => {
  const fight = honest(), now = 10_000_000_000, throws = { room: 'throws01', createdAt: now - 1000, claims: [null, null] };
  const rooms = [throws, { room: 'honest01', createdAt: now - 2000, claims: claims(fight) },
    { room: 'old0001', createdAt: now - UNVERIFIED_AFTER_MS - 1, claims: claims(fight, [fight.record, null]) }, { room: 'young01', createdAt: now - 1000, claims: claims(fight, [fight.record, null]) }];
  const writes: string[] = [];
  const db = { pending: async () => rooms, verify: async (room: string) => { writes.push(`verify ${room}`); }, flag: async (room: string, reason: string) => { writes.push(`flag ${room}: ${reason}`); }, unverify: async (room: string) => { writes.push(`unverify ${room}`); } };
  const receipt = await verifyRooms(db, { now });
  assert.equal(receipt.verified, 1); assert.deepEqual(receipt.flagged.map((f: { room: string }) => f.room), ['throws01']); assert.match(receipt.flagged[0].reason, /could not read the room/);
  assert.equal(receipt.agedOut, 1); assert.deepEqual(writes, ['flag throws01: ' + receipt.flagged[0].reason, 'verify honest01', 'unverify old0001']);
  writes.length = 0;
  assert.equal((await verifyRooms(db, { now, dry: true })).agedOut, 1); assert.deepEqual(writes, [], 'a dry run marks nothing');
});

test('verify duel: a kit whose keys came back from jsonb in another order is still clean and equal', () => {
  const fight = honest(), reorder = (k: { weapon: string; skill: unknown; gear?: readonly string[] }) => ({ gear: [...(k.gear ?? [])], skill: k.skill, weapon: k.weapon }) as never;
  const record = { ...fight.record, kits: [reorder(fight.record.kits[0]), reorder(fight.record.kits[1])] as never };
  assert.equal(verifyDuel(claims(fight, [record, fight.record])).ok, true, 'an honest record is not flagged for key order');
  const dirty = { ...fight.record, kits: [{ ...fight.record.kits[0], gear: ['x'.repeat(65)] }, fight.record.kits[1]] as never };
  assert.equal(verifyDuel(claims(fight, [dirty, dirty])).ok, false, 'a kit cleanKit would change is still refused');
});

test('verify rooms: a long reason is capped, a failing write is recorded per room and the queue goes on, a missing createdAt counts as aged', async () => {
  const fight = honest(), now = 10_000_000_000, forged = claims(fight).map((c) => ({ ...c, won: !c.won }));
  const rooms = [{ room: 'bad0001', createdAt: now - 3000, claims: forged }, { room: 'honest01', createdAt: now - 2000, claims: claims(fight) },
    { room: 'nodate1', claims: claims(fight, [fight.record, null]) }, { room: 'nan0001', createdAt: Number.NaN, claims: claims(fight, [fight.record, null]) }];
  const hostile = { get side(): never { throw new Error('y'.repeat(1000)); } };
  const writes: string[] = [];
  const db = { pending: async () => rooms, verify: async (room: string) => { writes.push(`verify ${room}`); },
    flag: async (room: string, reason: string) => { writes.push(`flag ${room} ${reason.length}`); throw new Error('x'.repeat(1000)); },
    unverify: async (room: string) => { writes.push(`unverify ${room}`); } };
  const long = await verifyRooms({ ...db, pending: async () => [{ room: 'long001', createdAt: now, claims: [hostile, hostile] as never }] }, { now });
  assert.ok(long.flagged[0].reason.length <= REASON_MAX && long.flagged[0].reason.length > 100, 'a hostile 1000-char error message is clipped');
  writes.length = 0;
  const receipt = await verifyRooms(db, { now });
  assert.deepEqual(writes, ['flag bad0001 ' + String(receipt.flagged[0].reason.length), 'verify honest01', 'unverify nodate1', 'unverify nan0001']);
  assert.ok(receipt.flagged[0].reason.length <= REASON_MAX); assert.equal(receipt.verified, 1); assert.equal(receipt.agedOut, 2);
  assert.equal(receipt.writeErrors.length, 1); assert.equal(receipt.writeErrors[0].room, 'bad0001'); assert.ok(receipt.writeErrors[0].error.length <= REASON_MAX);
});
