// The Origins writer's story ops (quest_advance, talk_pick) on a fake database that keeps the migration's commit rules in memory: event ids are
// unique (O0001), versioned rows refuse a stale write (O0002), a row for a character outside the batch's account is refused (O0010), a batch is
// all or nothing. No Postgres; the real cluster runs in scripts/origins-writer-check.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { parseQuestDefinition, type QuestDefinition } from '../origins/contracts/story.ts';
import type { CharacterId, QuestId } from '../origins/contracts/ids.ts';
import { creditFromMarks, levelOfCredit, basePay, TYPE_WEIGHTS } from '../origins/progression/model.ts';
import { concordCommission, smithsFavour } from '../origins/quests/fixtures.ts';
import { orla } from '../origins/talk/fixtures.ts';
import { loadTalk, type Talk } from '../origins/talk/talk.ts';
import { DbError, type Db } from '../origins/server/db.ts';
import { BadRequest, handlers, type Ctx } from '../origins/server/handlers.ts';
import { questAdvance } from '../origins/server/quest-advance.ts';
import { createWriter } from '../origins/server/server.ts';
import type { StoryContent } from '../origins/server/story.ts';
import { talkPick } from '../origins/server/talk-pick.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PA = 'pc:aaaa', PB = 'pc:bbbb';
const CQ = 'quest:concord-commission', NPC = 'character:smith-orla';
const NOW = new Date('2026-10-06T12:00:00.000Z');
const ok = <T>(r: { ok: true; value: T } | { ok: false; issues: unknown }): T => { assert.ok(r.ok, JSON.stringify(r)); return r.value; };
const quests = new Map<QuestId, QuestDefinition>([concordCommission(), smithsFavour()].map(r => ok(parseQuestDefinition(r))).map(d => [d.id, d]));
const CONTENT: StoryContent = { quests, talks: new Map<CharacterId, Talk>([[NPC as CharacterId, ok(loadTalk(orla()))]]) };
const questOp = questAdvance(CONTENT, () => NOW), talkPickOp = talkPick(CONTENT, () => NOW);
type Moved = { quest: string; stage: string; status: string; cp: number; replay: boolean };
const advanceOp = async (ctx: Ctx, body: Record<string, unknown>): Promise<Moved> => (await questOp(ctx, body)) as Moved;
const talkOp = async (ctx: Ctx, body: Record<string, unknown>): Promise<{ reply: string; effects: unknown[]; cp: number }> => (await talkPickOp(ctx, body)) as { reply: string; effects: unknown[]; cp: number };

type Row = Record<string, unknown>;
type World = { career: Row; quests: Row[]; journal: Row[]; talk: Row[]; events: Map<string, Row>; items: Row[] };
const MARKS = 10;   // level 11 (Gladiator I): the Concord Commission's outer gate is open
const SEED = creditFromMarks(MARKS);

// One account's rows (A, owning PA; PB is B's) and the migration's commit rules over them.
function fakeDb(o: { items?: Row[] } = {}) {
  let w: World = {
    career: { seed_credit: SEED, world_credit: 0, rested: 0, rested_at: 0, heat: {}, beaten: [], story: [], version: 1 },
    quests: [], journal: [], talk: [], events: new Map(), items: o.items ?? [],
  };
  const owner: Record<string, string> = { [PA]: A, [PB]: B };
  const commits: { account: string; batch: Row[] }[] = [];
  const apply = (account: string, batch: Row[]): void => {
    const n: World = structuredClone(w);
    const mine = (c: unknown): void => { if (owner[String(c)] !== account) throw new DbError('O0010', 'outside this batch\'s accounts'); };
    for (const op of batch) {
      if (op.op === 'event') {
        if (n.events.has(String(op.event_id))) throw new DbError('O0001', `event ${op.event_id} already settled`);
        if (op.account !== account) throw new DbError('O0010', 'event outside');
        n.events.set(String(op.event_id), op);
      } else if (op.op === 'career_set') {
        if (op.account !== account || op.expected_version !== n.career.version) throw new DbError('O0002', 'career write is stale');
        if (Number(op.world_credit) < Number(n.career.world_credit)) throw new DbError('O0004', 'credit never decreases');
        n.career = { ...n.career, world_credit: op.world_credit, rested: op.rested, rested_at: op.rested_at, heat: op.heat, story: op.story, beaten: op.beaten, version: Number(n.career.version) + 1 };
      } else if (op.op === 'quest_set') {
        mine(op.character);
        const i = n.quests.findIndex(q => q.character === op.character && q.quest === op.quest);
        const row = { character: op.character, quest: op.quest, story_version: op.story_version, stage: op.stage, status: op.status, flags: op.flags, rewarded: op.rewarded };
        if (op.expected_version === undefined) { if (i >= 0) throw new DbError('23505', 'duplicate key'); n.quests.push({ ...row, version: 1 }); }
        else { if (i < 0 || n.quests[i].version !== op.expected_version) throw new DbError('O0002', 'quest write is stale'); n.quests[i] = { ...row, version: Number(n.quests[i].version) + 1 }; }
        const seq0 = n.journal.filter(j => j.character === op.character && j.quest === op.quest).length;
        (op.journal_append as Row[]).forEach((e, k) => n.journal.push({ character: op.character, quest: op.quest, seq: seq0 + k, stage: e.stage, text: e.text, at: String(e.at).replace('Z', '+00:00') }));
      } else if (op.op === 'talk_set') {
        mine(op.character);
        const i = n.talk.findIndex(t => t.character === op.character);
        const row = { character: op.character, told: op.told, flags: op.flags };
        if (op.expected_version === undefined) { if (i >= 0) throw new DbError('23505', 'duplicate key'); n.talk.push({ ...row, version: 1 }); }
        else { if (i < 0 || n.talk[i].version !== op.expected_version) throw new DbError('O0002', 'talk write is stale'); n.talk[i] = { ...row, version: Number(n.talk[i].version) + 1 }; }
      } else throw new DbError('O0011', `unknown op ${op.op}`);
    }
    w = n;
  };
  const db: Db = {
    async run(sql, vars = {}) {
      await new Promise(r => setImmediate(r));   // every call yields, so two requests can interleave like two connections
      const fn = /origins_\w+/.exec(sql)![0];
      if (fn === 'origins_open') {
        return JSON.stringify({
          marks: MARKS, career: { ...w.career, total_credit: SEED + Number(w.career.world_credit) },
          characters: [{ id: PA, account: A, name: 'Aldren' }], items: w.items, quests: w.quests, journal: w.journal, talk: w.talk,
        });
      }
      if (fn === 'origins_pit_pending') return '[]';
      if (fn === 'origins_commit') { const batch = JSON.parse(vars.b) as Row[]; commits.push({ account: vars.a, batch }); apply(vars.a, batch); return '[]'; }
      throw Error(`unscripted ${fn}`);
    },
  };
  return { db, commits, world: () => w, ctx: { db, account: A } as Ctx };
}

const STEP_CP = basePay(TYPE_WEIGHTS['story-step'], levelOfCredit(SEED), levelOfCredit(SEED));
const ore = (owner = PA): Row => ({ id: 'it:1', item: 'item:exchange-ore', loc_kind: 'pack', loc_owner: owner, quantity: 1 });
const step = (f: ReturnType<typeof fakeDb>, stage: string, choice?: string) => advanceOp(f.ctx, { character: PA, quest: CQ, stage, ...(choice ? { choice } : {}) });

test('quest_advance: taking a quest writes the state, its journal line, the quest-stage event and the story CP in one batch', async () => {
  const f = fakeDb();
  const res = await step(f, 'smith');
  assert.deepEqual(res, { quest: CQ, stage: 'smith', status: 'active', cp: STEP_CP, replay: false });
  assert.ok(STEP_CP > 0);
  assert.equal(f.commits.length, 1);
  assert.deepEqual(f.commits[0].batch.map(o => `${o.op}${o.kind ? `:${o.kind}` : ''}`), ['quest_set', 'event:quest-stage', 'event:story-step', 'career_set']);
  const [qs, qe, se, cs] = f.commits[0].batch;
  assert.equal(qs.expected_version, undefined, 'a first stage inserts the row');
  assert.deepEqual(qs.journal_append, [{ stage: 'smith', text: 'Orla the smith at the Concord Exchange needs ore for a commission.', at: NOW.toISOString() }]);
  assert.deepEqual([qe.event_id, se.event_id], [`quest:${PA}:${CQ}:smith`, `story:${PA}:${CQ}:smith`]);
  assert.deepEqual([cs.expected_version, cs.world_credit, cs.story], [1, STEP_CP, [`${CQ}:smith`]]);
  const w = f.world();
  assert.deepEqual([w.quests[0].stage, w.quests[0].rewarded, w.journal.length, w.career.world_credit], ['smith', ['smith'], 1, STEP_CP]);

  const next = await step(f, 'fetch');
  assert.equal(next.stage, 'fetch');
  assert.equal(f.commits[1].batch[0].expected_version, 1, 'a later stage updates at the stored version');
  assert.deepEqual(f.world().journal.map(j => j.seq), [0, 1]);
});

test('quest_advance: a retry pays nothing, a racing double commits once, the ledger refuses a forged second payment', async () => {
  const f = fakeDb();
  await step(f, 'smith');
  const credit = f.world().career.world_credit;
  const again = await step(f, 'smith');
  assert.deepEqual([again.cp, again.replay, f.commits.length, f.world().career.world_credit], [0, true, 1, credit], 'the same stage again: replay, no write');

  const g = fakeDb();
  const raced = await Promise.allSettled([step(g, 'smith'), step(g, 'smith')]);
  assert.deepEqual(raced.map(r => r.status).sort(), ['fulfilled', 'rejected']);
  const lost = raced.find(r => r.status === 'rejected') as PromiseRejectedResult;
  assert.ok(lost.reason instanceof DbError, String(lost.reason));
  assert.deepEqual([g.world().career.world_credit, g.world().events.size, g.world().journal.length], [STEP_CP, 2, 1], 'paid once');

  // a batch that repeats a settled stage event is refused whole, so the career_set in it never lands
  const h = fakeDb();
  await step(h, 'smith');
  const replayed = h.commits[0].batch.filter(o => o.op !== 'quest_set').map(o => (o.op === 'career_set' ? { ...o, expected_version: 2, world_credit: 2 * STEP_CP } : o));
  await assert.rejects(h.db.run('select public.origins_commit()', { a: A, b: JSON.stringify(replayed) }), (e: unknown) => e instanceof DbError && e.code === 'O0001');
  assert.equal(h.world().career.world_credit, STEP_CP);
});

test('quest_advance: another account\'s character, or none, is refused before anything is written', async () => {
  const f = fakeDb();
  for (const character of [PB, 'pc:nobody', undefined, 7]) {
    await assert.rejects(advanceOp(f.ctx, { character, quest: CQ, stage: 'smith' }), BadRequest, String(character));
  }
  assert.equal(f.commits.length, 0);
});

test('quest_advance: account, reward, credit and stage results in the body are ignored', async () => {
  const f = fakeDb();
  const res = await advanceOp(f.ctx, {
    character: PA, quest: CQ, stage: 'smith', account: B, cp: 999_999, world_credit: 999_999, rewards: { loot: 'loottable:x' }, status: 'finished', rewarded: ['returned'], journal: [{ text: 'forged' }],
  });
  assert.equal(res.cp, STEP_CP);
  assert.equal(f.commits[0].account, A);
  const [qs, qe, se, cs] = f.commits[0].batch;
  assert.deepEqual([qs.status, qs.rewarded, (qs.journal_append as Row[]).length], ['active', ['smith'], 1]);
  assert.deepEqual([qe.account, se.account, cs.account, cs.world_credit], [A, A, A, STEP_CP]);
  assert.deepEqual(qe.payload, { stage: 'smith', rewards: { loot: null, standing: [] }, unpaid: [] });
});

test('quest_advance: illegal moves are refused with nothing written', async () => {
  const f = fakeDb();
  await assert.rejects(step(f, 'fetch'), BadRequest, 'a quest starts only at its start stage');
  await step(f, 'smith'); await step(f, 'fetch');
  const n = f.commits.length;
  await assert.rejects(step(f, 'forge', 'smith'), BadRequest, 'no ore in the snapshot');
  await assert.rejects(step(f, 'returned'), BadRequest, 'no transition from fetch to returned');
  await assert.rejects(step(f, 'forge', 'broker'), BadRequest, 'the broker choice does not lead to forge');
  await assert.rejects(advanceOp(f.ctx, { character: PA, quest: 'quest:nope', stage: 'smith' }), BadRequest, 'unknown quest');
  for (const bad of [{ quest: 7 }, { stage: '' }, { choice: 3 }, { quest: 'q'.repeat(121) }]) {
    await assert.rejects(advanceOp(f.ctx, { character: PA, quest: CQ, stage: 'forge', ...bad }), BadRequest, JSON.stringify(bad));
  }
  assert.equal(f.commits.length, n);
  // the ore must be this character's: one held by another character does not count
  const g = fakeDb({ items: [ore(PB)] });
  await step(g, 'smith'); await step(g, 'fetch');
  await assert.rejects(step(g, 'forge', 'smith'), BadRequest);
  // below the outer gate's tier the quest cannot be taken: the level is the server's, from the career row
  const low = fakeDb();
  const lowDb: Db = { run: async (sql, vars) => { const out = await low.db.run(sql, vars); return /origins_open/.test(sql) ? JSON.stringify({ ...JSON.parse(out), career: { ...JSON.parse(out).career, total_credit: 0 } }) : out; } };
  await assert.rejects(advanceOp({ db: lowDb, account: A }, { character: PA, quest: CQ, stage: 'smith' }), BadRequest);
});

test('quest_advance: a stage with standing or loot rewards records them as unpaid on its event; a finish pays the chapter', async () => {
  const f = fakeDb({ items: [ore()] });
  await step(f, 'smith'); await step(f, 'fetch');
  await step(f, 'forge', 'smith');
  const forge = f.commits.at(-1)!.batch.find(o => o.kind === 'quest-stage')!;
  assert.deepEqual(forge.payload, { stage: 'forge', rewards: { loot: null, standing: [{ faction: 'faction:concord', delta: 25 }] }, unpaid: ['standing'] });
  const done = await step(f, 'returned');
  assert.equal(done.status, 'finished');
  const batch = f.commits.at(-1)!.batch;
  assert.deepEqual(batch.find(o => o.kind === 'quest-stage')!.payload, { stage: 'returned', rewards: { loot: 'loottable:concord-commission', standing: [] }, unpaid: ['loot'] });
  const story = batch.find(o => o.kind === 'story-step')!.payload as Row;
  assert.equal(story.type, 'story-chapter');
  assert.ok(Number(story.cp) > STEP_CP, 'a chapter pays more than a step');
  assert.equal((f.world().career.story as string[]).length, 4);
  await assert.rejects(step(f, 'exposed', 'lie'), BadRequest, 'finished is final');
});

test('talk_pick: a once-line and its quest step commit together; conditions read the server\'s rows', async () => {
  const f = fakeDb();
  const hello = await talkOp(f.ctx, { character: PA, npc: NPC, line: 'greet-first' });
  assert.equal(hello.cp, 0);
  assert.deepEqual(f.commits[0].batch.map(o => o.op), ['talk_set', 'event']);
  assert.deepEqual([f.commits[0].batch[0].flags, f.commits[0].batch[1].event_id], [{ 'met-orla': true }, `talk:${PA}:${NPC}:greet-first`]);
  await assert.rejects(talkOp(f.ctx, { character: PA, npc: NPC, line: 'greet-first' }), BadRequest, 'a once-line is said once');
  await assert.rejects(talkOp(f.ctx, { character: PA, npc: NPC, line: 'take-job' }), BadRequest, 'take-job needs the quest at smith');

  const offer = await talkOp(f.ctx, { character: PA, npc: NPC, line: 'offer' });
  assert.equal(offer.cp, STEP_CP);
  const batch = f.commits.at(-1)!.batch;
  assert.deepEqual(batch.map(o => `${o.op}${o.kind ? `:${o.kind}` : ''}`), ['talk_set', 'event:talk', 'quest_set', 'event:quest-stage', 'event:story-step', 'career_set']);
  assert.equal(batch[0].expected_version, 1);
  assert.deepEqual([f.world().quests[0].stage, f.world().career.world_credit], ['smith', STEP_CP]);

  // a repeatable line with no effect writes nothing
  await talkOp(f.ctx, { character: PA, npc: NPC, line: 'take-job' });
  const n = f.commits.length;
  assert.deepEqual(await talkOp(f.ctx, { character: PA, npc: NPC, line: 'where-ore' }), { reply: 'Quarry carts, past the Exchange gate.', effects: [], cp: 0 });
  assert.equal(f.commits.length, n);
  // the ore line needs the ore in this character's pack (server rows), not the body's say-so
  await assert.rejects(talkOp(f.ctx, { character: PA, npc: NPC, line: 'hand-ore', hasItem: true, items: [ore()] }), BadRequest);
});

test('talk_pick: refusals — another account\'s character, an unknown NPC or line, a forged account', async () => {
  const f = fakeDb();
  await assert.rejects(talkOp(f.ctx, { character: PB, npc: NPC, line: 'greet-first' }), BadRequest);
  await assert.rejects(talkOp(f.ctx, { character: PA, npc: 'character:nobody', line: 'greet-first' }), BadRequest);
  await assert.rejects(talkOp(f.ctx, { character: PA, npc: NPC, line: 'nope' }), BadRequest);
  await assert.rejects(talkOp(f.ctx, { character: PA, npc: NPC }), BadRequest);
  assert.equal(f.commits.length, 0);
  await talkOp(f.ctx, { character: PA, npc: NPC, line: 'greet-first', account: B });
  assert.deepEqual([f.commits[0].account, f.commits[0].batch[1].account], [A, A]);
});

test('the registry serves quest_advance and talk_pick; with no content loaded they refuse with a 400', async () => {
  const f = fakeDb();
  const server = createWriter({ db: f.db, verify: async t => (t === 'tok' ? A : null) });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  try {
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/origins/`;
    for (const [op, body] of [['quest_advance', { character: PA, quest: CQ, stage: 'smith' }], ['talk_pick', { character: PA, npc: NPC, line: 'greet-first' }]] as const) {
      assert.ok(Object.hasOwn(handlers, op));
      const res = await fetch(url + op, { method: 'POST', headers: { authorization: 'Bearer tok' }, body: JSON.stringify(body) });
      assert.equal(res.status, 400, op);
    }
    assert.equal(f.commits.length, 0);
  } finally { server.close(); }
});
