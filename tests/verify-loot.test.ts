import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { OPPONENTS, opponentAt, profileAt } from '../src/moves.ts';
import type { Intent } from '../src/duel.ts';
import { createRecorder, decodeRecord, encodeRecord, packRecord, toBase64Url } from '../src/record.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { acceptHeld, fightHash, HELD_MAX_VERSION, psqlAdapter, refusal, report, verifyClaims } from '../scripts/verify-loot.mjs';

// A fight the player wins: the Goblin at easy on seed 1 falls to a walk-in with an attack every 45 ticks (920 ticks); every 44 is a
// second, different win (1,265 ticks). `build` is only a label: two builds of one fight are ONE fight to the verifier (F2).
async function goblinKill(build = 'test', every = 45): Promise<string> {
  const rec = createRecorder({ build, opponent: 'goblin', weapon: 'longsword', level: 6, seed: 1 });
  const acts = ['light', 'heavy', 'thrust'] as const;
  let practice = initialPractice(1, opponentAt(OPPONENTS.goblin, 6));   // the level's body, as the game builds it
  for (let t = 0; t < 20000 && !practice.finish; t++) {
    const intent: Intent = { move: { x: 0, z: t % 120 < 60 ? 0.8 : 0, yaw: 0, run: false }, action: t % every === 0 ? acts[(t / every) % 3]! : null, guard: false, lock: true };
    practice = stepPractice(practice, rec.push(intent), profileAt(OPPONENTS.goblin, 6));
  }
  assert.equal(practice.finish?.victim, 1, 'the scripted fight is a player win');
  return encodeRecord(rec.finish('killed'));
}

const FRESH = { marks: 0, owned: [] as string[] };   // a fresh account's standing: rank level 1, floor 1
type Row = { id: number; user_id: string; opponent: string; piece: string | null; record: string };
const U = '11111111-1111-4111-8111-111111111111';

type Share = { id: string; user_id: string | null; record: string };
// The sweep's view of the database: one page, the wait rule over unchecked earlier claims, a fixed standing, every settle recorded, and
// fight_hash on claims and shared fights (rows in id order stand in for (created_at, id); shares in array order, the earliest first).
function fakeDb(rows: Row[], standing = { marks: 4, owned: [] as string[] }, shares: Share[] = []) {
  const settled = new Map<number, { verified: boolean; note: string | null; award: { piece: string; tier: number } | null }>();
  const fights = new Map<string, string>();   // `${kind}:${id}` -> fight_hash
  return {
    settled, fights,
    unhashed: async (limit: number) => [...shares.map(s => ({ kind: 'share', id: s.id, record: s.record })), ...rows.map(r => ({ kind: 'claim', id: String(r.id), record: r.record }))]
      .filter(r => !fights.has(`${r.kind}:${r.id}`)).slice(0, limit),
    hash: async (kind: string, id: string, fight: string) => { fights.set(`${kind}:${id}`, fight); },
    twin: async (claim: number, fight: string) => {
      const won = rows.find(r => r.id !== claim && fights.get(`claim:${r.id}`) === fight && (settled.get(r.id)?.verified || /^HELD v/.test(settled.get(r.id)?.note ?? '')));
      const share = shares.find(s => fights.get(`share:${s.id}`) === fight);
      return { claim: won?.id ?? null, shared: share ? { owner: share.user_id } : null };
    },
    pending: async () => rows.filter(row => !settled.has(row.id)),
    waiting: async (id: number) => rows.some(row => row.id < id && row.user_id === rows.find(r => r.id === id)!.user_id && !settled.has(row.id)),
    standing: async () => standing,
    settle: async (id: number, outcome: { verified: boolean; note: string | null; award: { piece: string; tier: number } | null }) => { settled.set(id, outcome); },
  };
}

test('the win is proven from the record: its opponent, a player kill, a replay that ends there — and nothing throws', async () => {
  const record = await goblinKill();
  assert.equal(await refusal({ opponent: 'goblin', record }, FRESH), null);
  assert.match(String(await refusal({ opponent: 'veteran', record }, FRESH)), /record is against goblin/);
  assert.match(String(await refusal({ opponent: 'goblin', record: 'AAAA' }, FRESH)), /unreadable record/);
  const lie = await encodeRecord({ ...(await decodeRecord(record)), intents: (await decodeRecord(record)).intents.slice(0, 400), ticks: 400 });   // cut short: no finish
  assert.match(String(await refusal({ opponent: 'goblin', record: lie }, FRESH)), /does not reach its finish/);
  assert.match(String(await refusal({ opponent: 'goblin', record: 'not base64 at all!' }, FRESH)), /unreadable record/);
  const loss = await encodeRecord({ ...(await decodeRecord(record)), outcome: 'died' });   // Backend N2: a loss is refused here, not only in the DB check
  assert.match(String(await refusal({ opponent: 'goblin', record: loss }, FRESH)), /outcome is died, not a win/);
});

test('a sweep settles every claim it checks: a refused win with its reason, an off-kit take as a mark with its reason, a take as an award', async () => {
  const win = await goblinKill('a'), win2 = await goblinKill('b', 44);
  const db = fakeDb([
    { id: 1, user_id: U, opponent: 'goblin', piece: null, record: 'AAAA' },
    { id: 2, user_id: U, opponent: 'goblin', piece: 'veteran.Helmet', record: win },
    { id: 3, user_id: U, opponent: 'goblin', piece: 'goblin.Knife', record: win2 },
  ]);
  const receipt = await verifyClaims(db);
  assert.deepEqual([receipt.checked, receipt.verified, receipt.awarded, receipt.refused.length, receipt.unawarded.length], [3, 2, 1, 1, 1]);
  assert.equal(db.settled.get(1)!.verified, false);
  assert.match(db.settled.get(1)!.note!, /unreadable record/);
  assert.deepEqual({ ...db.settled.get(2)!, note: /not in goblin's kit/.test(db.settled.get(2)!.note!) }, { verified: true, note: true, award: null });
  assert.deepEqual(db.settled.get(3), { verified: true, note: null, award: { piece: 'goblin.Knife', tier: 1 } });
});

test('a claim waits while an earlier one from its account is unchecked; a dry sweep writes nothing', async () => {
  const db = fakeDb([{ id: 1, user_id: U, opponent: 'goblin', piece: null, record: await goblinKill('a') }, { id: 2, user_id: U, opponent: 'goblin', piece: null, record: await goblinKill('b', 44) }]);
  const reversed = { ...db, pending: async () => (await db.pending()).reverse() };
  assert.equal((await verifyClaims(reversed)).waiting, 1);
  assert.deepEqual([...db.settled.keys()], [1]);
  assert.equal((await verifyClaims(fakeDb([{ id: 5, user_id: U, opponent: 'goblin', piece: null, record: 'AAAA' }]), { dry: true })).refused.length, 1);
  const dry = fakeDb([{ id: 5, user_id: U, opponent: 'goblin', piece: null, record: 'AAAA' }]);
  await verifyClaims(dry, { dry: true });
  assert.equal(dry.settled.size, 0);
});

test('a database error on one claim is reported and the sweep moves on (Backend N1)', async () => {
  const db = fakeDb([{ id: 1, user_id: U, opponent: 'goblin', piece: null, record: 'AAAA' }, { id: 2, user_id: '22222222-2222-4222-8222-222222222222', opponent: 'goblin', piece: null, record: 'AAAA' }]);
  const flaky = { ...db, settle: async (id: number, outcome: Parameters<typeof db.settle>[1]) => { if (id === 1) throw Error('psql: connection reset'); await db.settle(id, outcome); } };
  const receipt = await verifyClaims(flaky);
  assert.deepEqual(receipt.errors, [{ id: 1, error: 'psql: connection reset' }]);
  assert.ok(db.settled.has(2));
});

test('the psql adapter settles in one transaction as the verifier and refuses malformed values', async () => {
  const statements: string[] = [];
  const run = ((_cmd: string, args: string[]) => { statements.push(args[args.indexOf('-c') + 1]!); return { status: 0, stdout: '14|["goblin.Body"]', stderr: '' }; }) as never;
  const db = psqlAdapter('postgres://verifier@db/postgres', run);
  await db.settle(7, { verified: true, note: "it's", award: { piece: 'goblin.Knife', tier: 2 } });
  assert.equal(statements.at(-1), "begin; update public.loot_claims set verified = true, checked_at = now(), note = 'it''s' where id = 7; insert into public.awards (claim_id, piece, tier) values (7, 'goblin.Knife', 2); commit;");
  assert.deepEqual(await db.standing(U, 7), { marks: 14, owned: ['goblin.Body'] });
  await assert.rejects(db.standing("x'; drop table y; --", 7), /malformed user id/);
  await assert.rejects(db.settle(Number.NaN, { verified: false, note: null, award: null }), /malformed claim id/);
  await assert.rejects(db.waiting(-1), /malformed claim id/);
});

test('the level a win was fought at must clear the dial floor under the SERVER rank before it: rank − DIAL_TRAIL, never below 1 (Lead, #621)', async () => {
  const record = await goblinKill('level');   // fought at level 6
  assert.equal(await refusal({ opponent: 'goblin', record }, { marks: 10, owned: [] }), null, 'rank 11, floor 6: level 6 is exactly the floor');
  assert.match(String(await refusal({ opponent: 'goblin', record }, { marks: 11, owned: [] })), /didn't count \(level 6; your rank is level 12, floor 7\)/);
  assert.match(String(await refusal({ opponent: 'goblin', record }, { marks: 19, owned: [] })), /your rank is level 20, floor 15/);
  const db = fakeDb([{ id: 1, user_id: U, opponent: 'goblin', piece: 'goblin.Knife', record }], { marks: 19, owned: [] });
  const receipt = await verifyClaims(db);
  assert.deepEqual([receipt.verified, receipt.refused.length], [0, 1], 'a low-level win is refused: no mark, no award');
  assert.match(db.settled.get(1)!.note!, /floor 15/);
});

// HELD (Strategy/Lead 2026-09-29): an engine-bound record (v ≤ 19) whose replay diverges is held for a hand check in real browsers;
// every other refusal stays plain. A cut-short record stands in for the ulp drift: to the verifier both are "the replay diverged".
const cutShort = async (record: string) => { const r = await decodeRecord(record); return encodeRecord({ ...r, intents: r.intents.slice(0, 400), ticks: 400 }); };

test('HELD marks only a replay divergence on a record up to v19; other refusals stay plain and the sweep lists the held ones', async () => {
  // Version-agnostic: `heldMax: v` treats this build's version as engine-bound, `v - 1` as past it (v20+ detmath).
  const win = await goblinKill('held'), v = (await decodeRecord(win)).v, bound = { heldMax: v };
  assert.equal(HELD_MAX_VERSION, 19, 'the last Math.* version (Strategy 2026-09-29)');
  const diverged = await cutShort(win);
  assert.match(String(await refusal({ opponent: 'goblin', record: diverged }, FRESH, bound)), new RegExp(`^HELD v${v}: .*does not reach its finish`));
  assert.doesNotMatch(String(await refusal({ opponent: 'veteran', record: win }, FRESH)), /HELD/);
  assert.doesNotMatch(String(await refusal({ opponent: 'goblin', record: 'AAAA' }, FRESH)), /HELD/);
  const stranger = await encodeRecord({ ...(await decodeRecord(win)), opponent: 'nobody' as never });   // steps nothing: unknown opponent
  assert.match(String(await refusal({ opponent: 'nobody', record: stranger }, FRESH, bound)), /^unknown opponent/, 'a record the sim cannot step is never HELD');
  assert.doesNotMatch(String(await refusal({ opponent: 'goblin', record: await encodeRecord({ ...(await decodeRecord(win)), outcome: 'died' }) }, FRESH)), /HELD/);
  assert.doesNotMatch(String(await refusal({ opponent: 'goblin', record: win }, { marks: 19, owned: [] })), /HELD/, 'a low-level win is a plain refusal');
  assert.equal(await refusal({ opponent: 'goblin', record: diverged }, FRESH, { replay: false }), null, '--accept path: every check but the replay');
  assert.match(String(await refusal({ opponent: 'goblin', record: diverged }, FRESH, { heldMax: v - 1 })), /^the fight ended|^the record does not reach/, 'past the engine-bound versions (v20+ detmath) a divergence is a plain refusal');
  const db = fakeDb([{ id: 1, user_id: U, opponent: 'goblin', piece: null, record: diverged }, { id: 2, user_id: '22222222-2222-4222-8222-222222222222', opponent: 'goblin', piece: null, record: 'AAAA' }]);
  const receipt = await verifyClaims(db, bound);
  assert.deepEqual(receipt.held.map((h: { id: number; opponent: string }) => [h.id, h.opponent]), [[1, 'goblin']]);
  assert.equal(receipt.refused.length, 2);
  assert.deepEqual([db.settled.get(1)!.verified, /^HELD v/.test(db.settled.get(1)!.note!), db.settled.get(1)!.award], [false, true, null], 'held = settled unverified, no award, nothing blocked');
});

test('--accept grants only a HELD engine-bound claim, re-runs every other check, and appends the audit line', async () => {
  const win = await goblinKill('accept'), diverged = await cutShort(win), v = (await decodeRecord(win)).v;
  const heldNote = String(await refusal({ opponent: 'goblin', record: diverged }, FRESH, { heldMax: v }));
  const claims: Record<number, Row & { verified: boolean; note: string | null }> = {
    1: { id: 1, user_id: U, opponent: 'goblin', piece: 'goblin.Knife', record: diverged, verified: false, note: heldNote },
    2: { id: 2, user_id: U, opponent: 'goblin', piece: null, record: 'AAAA', verified: false, note: 'unreadable record: x' },
    3: { id: 3, user_id: U, opponent: 'goblin', piece: null, record: win, verified: true, note: null },
    4: { id: 4, user_id: U, opponent: 'veteran', piece: null, record: diverged, verified: false, note: heldNote },
  };
  const db = { ...fakeDb([], FRESH), claim: async (id: number) => claims[id] ?? null };
  const now = new Date('2026-09-29T10:00:00Z');
  await assert.rejects(acceptHeld(db, 1, ''), /needs --engines/);
  await assert.rejects(acceptHeld(db, 1, 'chromium @1800'), /needs --engines/, 'the audit line must name the build the hand check ran on');
  await assert.rejects(acceptHeld(db, 2, 'chromium @1800 on fc2254aa'), /not HELD/);
  await assert.rejects(acceptHeld(db, 3, 'chromium @1800 on fc2254aa'), /not HELD/);
  await assert.rejects(acceptHeld(db, 9, 'chromium @1800 on fc2254aa'), /not found/);
  await assert.rejects(acceptHeld(db, 4, 'chromium @1800 on fc2254aa', { heldMax: v }), /fails a check other than the replay: record is against goblin/);
  await assert.rejects(acceptHeld(db, 1, 'chromium @1800 on fc2254aa', { heldMax: v - 1 }), new RegExp(`v${v} record: its replay is engine-independent`), 'a v20+ record is never accepted');
  assert.equal(db.settled.size, 0, 'every refusal wrote nothing');
  const outcome = await acceptHeld(db, 1, 'chromium+webkit @920 on fc2254aa', { now, heldMax: v });
  assert.deepEqual(outcome.award, { piece: 'goblin.Knife', tier: 1 });
  assert.equal(outcome.verified, true);
  assert.match(outcome.note!, /^HELD v\d+: .* \| ACCEPTED 2026-09-29T10:00:00.000Z by runbook: chromium\+webkit @920 on fc2254aa$/);
  assert.ok(Buffer.byteLength(outcome.note!) <= 200);
  assert.deepEqual(db.settled.get(1), outcome);
});

test('Sentry: no DSN sends nothing; a HELD claim is one event; a stale claim is reported once, not every sweep', async () => {
  const receipt = { held: [{ id: 7, version: 19, opponent: 'veteran', reason: 'HELD v19: the replay ends in "died"' }] };
  const posts: { url: string; body: string }[] = [];
  const send = async (url: string, init: { body: string }) => { posts.push({ url, body: init.body }); return { ok: true, status: 200 }; };
  assert.deepEqual(await report(receipt, [3], { dsn: undefined, send }), { sent: 0, skipped: 'no SENTRY_DSN' });
  assert.equal(posts.length, 0);
  const stateFile = join(mkdtempSync(join(tmpdir(), 'verify-loot-')), 'stale-reported');
  const dsn = 'https://abc123@o1.ingest.sentry.io/42';
  assert.deepEqual(await report(receipt, [3], { dsn, stateFile, send }), { sent: 2 });
  assert.match(posts[0]!.url, /^https:\/\/o1\.ingest\.sentry\.io\/api\/42\/envelope\/\?sentry_key=abc123/);
  const event = JSON.parse(posts[0]!.body.split('\n')[2]!);
  assert.deepEqual([event.tags.claim_id, event.tags.record_version, event.tags.opponent], ['7', '19', 'veteran']);
  assert.match(JSON.parse(posts[1]!.body.split('\n')[2]!).message.formatted, /1 loot claim\(s\) unchecked/);
  assert.deepEqual(await report({ held: [] }, [3], { dsn, stateFile, send }), { sent: 0 }, 'the same stale claim next sweep: silent');
  assert.deepEqual(await report({ held: [] }, [3, 4], { dsn, send }), { sent: 0 }, 'a hand sweep with no state file reports no stale claims');
  assert.deepEqual(await report({ held: [] }, [3, 5], { dsn, stateFile, send }), { sent: 1 }, 'a newly stale claim: one event');
  assert.match(JSON.parse(posts[2]!.body.split('\n')[2]!).tags.claim_ids, /^5$/);
  await assert.rejects(report({ held: [] }, [8], { dsn, stateFile, send: async () => ({ ok: false, status: 429 }) }), /HTTP 429/);
});

// A claim a later bump can no longer read (record.ts REACH, e.g. bump 20's Plague Doctor): a v18 Veteran record from level 6 is this
// build's instance of it (V18_REACH). HELD `reach` up to v19, cleared by --accept after the hand check on the last build that reads it.
const gzip = async (bytes: Uint8Array) => new Uint8Array(await new Response(new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
async function withVersion(opponent: 'veteran' | 'goblin', level: number, version: number, outcome: 'killed' | 'died' = 'killed'): Promise<string> {
  const rec = createRecorder({ build: 'reach', opponent, weapon: 'longsword', level, seed: 1 });
  for (let t = 0; t < 10; t++) rec.push({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
  const bytes = packRecord(rec.finish(outcome));
  bytes[2] = version;   // the version byte (record.ts: 'F', 'K', version)
  return toBase64Url(await gzip(bytes));
}

test('a reach refusal up to v19 is HELD (never lost to a publish); a plain unsupported version is not; --accept clears it with the audit line', async () => {
  const record = await withVersion('veteran', 6, 18);
  const held = String(await refusal({ opponent: 'veteran', record }, FRESH));
  assert.match(held, /^HELD v18: reach: Fight record: version 18 is not supported for the veteran from level 6/);
  assert.match(String(await refusal({ opponent: 'veteran', record }, FRESH, { heldMax: 17 })), /^unreadable record: .*not supported for the veteran/, 'past heldMax a reach refusal is plain');
  assert.match(String(await refusal({ opponent: 'goblin', record: await withVersion('goblin', 6, 3) }, FRESH)), /^unreadable record: Fight record: version 3 is not supported \(/, 'an unreadable version is not a reach hold');
  const db = { ...fakeDb([], FRESH), claim: async (id: number) => (id === 1 ? { id: 1, user_id: U, opponent: 'veteran', piece: null, record, verified: false, note: held.slice(0, 200) } : null) };
  await assert.rejects(acceptHeld(db, 1, 'chromium @10 on fc2254aa', { heldMax: 17 }), /v18 record: its replay is engine-independent/);
  assert.equal(db.settled.size, 0);
  const outcome = await acceptHeld(db, 1, 'chromium+webkit @10 on fc2254aa', { now: new Date('2026-09-29T11:00:00Z') });
  assert.deepEqual([outcome.verified, outcome.award], [true, null]);
  assert.match(outcome.note!, /^HELD v18: reach: .* \| ACCEPTED 2026-09-29T11:00:00.000Z by runbook: chromium\+webkit @10 on fc2254aa$/);
  assert.ok(Buffer.byteLength(outcome.note!) <= 200);
});

test('--accept on a reach hold still refuses a lost fight or another opponent from the header; a divergence hold that no longer decodes is refused; nothing is written', async () => {
  const held = (record: string, opponent: string) => ({ id: 1, user_id: U, opponent, piece: null, record, verified: false, note: 'HELD v18: reach: Fight record: version 18 is not supported for the veteran from level 6' });
  const lost = { ...fakeDb([], FRESH), claim: async () => held(await withVersion('veteran', 6, 18, 'died'), 'veteran') };
  await assert.rejects(acceptHeld(lost, 1, 'chromium @10 on fc2254aa'), /record outcome is died, not a win/);
  const other = { ...fakeDb([], FRESH), claim: async () => held(await withVersion('veteran', 6, 18), 'goblin') };
  await assert.rejects(acceptHeld(other, 1, 'chromium @10 on fc2254aa'), /record is against veteran, claim says goblin/);
  const noHeader = { ...fakeDb([], FRESH), claim: async () => held('AAAA', 'veteran') };
  await assert.rejects(acceptHeld(noHeader, 1, 'chromium @10 on fc2254aa'), /reach hold with no readable record header/);
  const gone = { ...fakeDb([], FRESH), claim: async () => ({ ...held('AAAA', 'goblin'), note: 'HELD v19: the replay ends in "died", the record says "killed"' }) };
  await assert.rejects(acceptHeld(gone, 1, 'chromium @10 on fc2254aa'), (error: Error) => !/reach hold|fails a check/.test(error.message), 'a divergence hold whose record no longer decodes: the decode error itself');
  for (const db of [lost, other, noHeader, gone]) assert.equal(db.settled.size, 0);
});

// F2 (Auditer on 0895d84c; Strategy's A+ 2026-10-01): one FIGHT is one claim, whatever its string.
const V = '22222222-2222-4222-8222-222222222222';
// The same packed bytes through another compressor: Node's zlib at level 1 with another mtime, not CompressionStream's output.
const regzip = async (record: string) => toBase64Url(new Uint8Array(gzipSync(packRecord(await decodeRecord(record)), { level: 1 })));

test('F2 (a): the same fight re-gzipped, or relabelled with another build, is refused as a duplicate; the first keeps its mark and award', async () => {
  const win = await goblinKill('a'), again = await regzip(win), relabelled = await goblinKill('b');
  assert.notEqual(again, win, 'a different string');
  assert.deepEqual(await decodeRecord(again), await decodeRecord(win), 'the same decoded fight');
  assert.equal(await fightHash(again), await fightHash(win));
  assert.equal(await fightHash(relabelled), await fightHash(win), 'build is a label, not the fight');
  assert.notEqual(await fightHash(await goblinKill('a', 44)), await fightHash(win), 'a different fight is a different hash');
  const db = fakeDb([
    { id: 1, user_id: U, opponent: 'goblin', piece: 'goblin.Knife', record: win },
    { id: 2, user_id: U, opponent: 'goblin', piece: 'goblin.Knife', record: again },
    { id: 3, user_id: V, opponent: 'goblin', piece: 'goblin.Knife', record: relabelled },
  ]);
  const receipt = await verifyClaims(db);
  assert.deepEqual([receipt.hashed, receipt.verified, receipt.awarded], [3, 1, 1]);
  assert.deepEqual(db.settled.get(1), { verified: true, note: null, award: { piece: 'goblin.Knife', tier: 1 } }, 'the first claim keeps its award');
  assert.deepEqual(db.settled.get(2), { verified: false, note: 'same fight as claim 1', award: null }, 'no mark, no award');
  assert.deepEqual(db.settled.get(3), { verified: false, note: 'same fight as claim 1', award: null }, 'another account, same fight');
});

test('F2 (b) + (c): a fight first shared by another account or a guest is refused; the owner may claim after his own share', async () => {
  const win = await goblinKill('a'), stolen = await regzip(win);
  const theft = fakeDb([{ id: 1, user_id: V, opponent: 'goblin', piece: 'goblin.Knife', record: stolen }], undefined, [{ id: 'k1', user_id: U, record: win }]);
  await verifyClaims(theft);
  assert.deepEqual(theft.settled.get(1), { verified: false, note: "someone else's shared fight", award: null }, '(b) shared by X, claimed by Y');
  const guest = fakeDb([{ id: 1, user_id: V, opponent: 'goblin', piece: null, record: win }], undefined, [{ id: 'k1', user_id: null, record: win }]);
  await verifyClaims(guest);
  assert.equal(guest.settled.get(1)!.note, "someone else's shared fight", 'a guest share blocks every account (the accepted beta cost)');
  const later = fakeDb([{ id: 1, user_id: U, opponent: 'goblin', piece: 'goblin.Knife', record: win }], undefined, [{ id: 'k1', user_id: U, record: win }, { id: 'k2', user_id: V, record: stolen }]);
  await verifyClaims(later);
  assert.deepEqual(later.settled.get(1), { verified: true, note: null, award: { piece: 'goblin.Knife', tier: 1 } }, '(c) the owner after his own share; a later re-share by another account decides nothing');
});

test('F2: --accept refuses a HELD claim whose fight another claim already won; a dry sweep writes no hash', async () => {
  const win = await goblinKill('a');
  const rows = [{ id: 1, user_id: U, opponent: 'goblin', piece: null, record: win }, { id: 2, user_id: U, opponent: 'goblin', piece: null, record: await regzip(win) }];
  const base = fakeDb(rows), db = { ...base, claim: async (id: number) => ({ ...rows[id - 1]!, verified: false, note: 'HELD v19: diverged' }) };   // as if claim 2 had been held before this rule
  await verifyClaims(db);
  base.settled.delete(2);
  await assert.rejects(acceptHeld(db, 2, 'chromium @10 on fc2254aa', { heldMax: 99 }), /same fight as claim 1/);
  const dry = fakeDb([{ id: 1, user_id: U, opponent: 'goblin', piece: null, record: win }]);
  await verifyClaims(dry, { dry: true });
  assert.equal(dry.fights.size, 0);
});

test('F2: the psql adapter writes and reads fight hashes as the verifier and refuses malformed values', async () => {
  const statements: string[] = [];
  const run = ((_cmd: string, args: string[]) => { statements.push(args[args.indexOf('-c') + 1]!); return { status: 0, stdout: '{"claim":null,"shared":null}', stderr: '' }; }) as never;
  const db = psqlAdapter('postgres://verifier@db/postgres', run), h = 'a'.repeat(64);
  await db.hash('claim', '7', h);
  assert.equal(statements.at(-1), `update public.loot_claims set fight_hash = '${h}' where id = 7`);
  await db.hash('share', 'k1', h);
  assert.equal(statements.at(-1), `update public.fight_records set fight_hash = '${h}' where id = 'k1'`);
  assert.deepEqual(await db.twin(7, h), { claim: null, shared: null });
  await assert.rejects(db.hash('share', "k'1", h), /malformed row/);
  await assert.rejects(db.hash('claim', '7', "x'; drop"), /malformed fight hash/);
  await assert.rejects(db.twin(7, 'nope'), /malformed fight hash/);
});

test('F2: a claim whose hash will not write holds only itself; a share whose hash will not write holds the sweep (Lead)', async () => {
  const win = await goblinKill('a'), other = await goblinKill('b', 44);
  const rows = [{ id: 1, user_id: U, opponent: 'goblin', piece: null, record: win }, { id: 2, user_id: V, opponent: 'goblin', piece: null, record: other }];
  const base = fakeDb(rows), refusing = { ...base, hash: async (kind: string, id: string, fight: string) => { if (`${kind}:${id}` === 'claim:1') throw Error('duplicate key value violates unique constraint "loot_claims_one_win_per_fight"'); await base.hash(kind, id, fight); } };
  const receipt = await verifyClaims(refusing);
  assert.deepEqual(receipt.errors.map((e: { id: string | number }) => e.id), ['1']);
  assert.equal(base.settled.get(1), undefined, 'a pending claim without its hash is never settled: it would be verified outside the unique index (Auditer F1)');
  assert.deepEqual([base.settled.get(2)?.verified, receipt.waiting], [true, 1], 'every other claim settles');
  const shared = fakeDb([rows[1]!], undefined, [{ id: 'k1', user_id: U, record: other }]);
  const held = await verifyClaims({ ...shared, hash: async (kind: string, id: string, fight: string) => { if (kind === 'share') throw Error('psql: connection reset'); await shared.hash(kind, id, fight); } });
  assert.deepEqual([held.waiting, shared.settled.size], [1, 0], 'an unhashed share could hide a theft: nothing settles');
});
