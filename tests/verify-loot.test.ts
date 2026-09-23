import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { OPPONENTS } from '../src/moves.ts';
import type { Intent } from '../src/duel.ts';
import { createRecorder, decodeRecord, encodeRecord } from '../src/record.ts';
import { psqlAdapter, refusal, verifyClaims } from '../scripts/verify-loot.mjs';

// A fight the player wins: the Goblin at easy on seed 1 falls to a walk-in with an attack every 45 ticks (920 ticks).
async function goblinKill(build = 'test'): Promise<string> {
  const rec = createRecorder({ build, opponent: 'goblin', weapon: 'longsword', profile: 'easy', seed: 1 });
  const acts = ['light', 'heavy', 'thrust'] as const;
  let practice = initialPractice(1, OPPONENTS.goblin);
  for (let t = 0; t < 20000 && !practice.finish; t++) {
    const intent: Intent = { move: { x: 0, z: t % 120 < 60 ? 0.8 : 0, yaw: 0, run: false }, action: t % 45 === 0 ? acts[(t / 45) % 3]! : null, guard: false, lock: true };
    practice = stepPractice(practice, rec.push(intent), OPPONENTS.goblin.profiles.easy);
  }
  assert.equal(practice.finish?.victim, 1, 'the scripted fight is a player win');
  return encodeRecord(rec.finish('killed'));
}

type Row = { id: number; user_id: string; opponent: string; piece: string | null; record: string };
const U = '11111111-1111-4111-8111-111111111111';

// The sweep's view of the database: one page, the wait rule over unchecked earlier claims, a fixed standing, and every settle recorded.
function fakeDb(rows: Row[], standing = { marks: 14, owned: [] as string[] }) {
  const settled = new Map<number, { verified: boolean; note: string | null; award: { piece: string; tier: number } | null }>();
  return {
    settled,
    pending: async () => rows.filter(row => !settled.has(row.id)),
    waiting: async (id: number) => rows.some(row => row.id < id && row.user_id === rows.find(r => r.id === id)!.user_id && !settled.has(row.id)),
    standing: async () => standing,
    settle: async (id: number, outcome: { verified: boolean; note: string | null; award: { piece: string; tier: number } | null }) => { settled.set(id, outcome); },
  };
}

test('the win is proven from the record: its opponent, a player kill, a replay that ends there — and nothing throws', async () => {
  const record = await goblinKill();
  assert.equal(await refusal({ opponent: 'goblin', record }), null);
  assert.match(String(await refusal({ opponent: 'veteran', record })), /record is against goblin/);
  assert.match(String(await refusal({ opponent: 'goblin', record: 'AAAA' })), /unreadable record/);
  const lie = await encodeRecord({ ...(await decodeRecord(record)), intents: (await decodeRecord(record)).intents.slice(0, 400), ticks: 400 });   // cut short: no finish
  assert.match(String(await refusal({ opponent: 'goblin', record: lie })), /does not reach its finish/);
  assert.match(String(await refusal({ opponent: 'goblin', record: 'not base64 at all!' })), /unreadable record/);
});

test('a sweep settles every claim it checks: a refused win with its reason, an off-kit take as a mark with its reason, a take as an award', async () => {
  const win = await goblinKill('a'), win2 = await goblinKill('b');
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
  const db = fakeDb([{ id: 1, user_id: U, opponent: 'goblin', piece: null, record: await goblinKill('a') }, { id: 2, user_id: U, opponent: 'goblin', piece: null, record: await goblinKill('b') }]);
  const reversed = { ...db, pending: async () => (await db.pending()).reverse() };
  assert.equal((await verifyClaims(reversed)).waiting, 1);
  assert.deepEqual([...db.settled.keys()], [1]);
  assert.equal((await verifyClaims(fakeDb([{ id: 5, user_id: U, opponent: 'goblin', piece: null, record: 'AAAA' }]), { dry: true })).refused.length, 1);
  const dry = fakeDb([{ id: 5, user_id: U, opponent: 'goblin', piece: null, record: 'AAAA' }]);
  await verifyClaims(dry, { dry: true });
  assert.equal(dry.settled.size, 0);
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
