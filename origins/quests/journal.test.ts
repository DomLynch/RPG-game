// O2 quest journal: transitions, branching, final states, conditions, once-only rewards and story events, append-only entries, the
// contracts' parse/migrate round trip, and a seeded property run.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Result } from '../contracts/core.ts';
import * as C from '../contracts/fixtures.ts';
import type { CharacterInstanceId, QuestId } from '../contracts/ids.ts';
import { checkQuestState, parseQuestDefinition, parseQuestState, statusFor, type QuestDefinition } from '../contracts/story.ts';
import { concordCommission, smithsFavour } from './fixtures.ts';
import { advance, entries, loadJournal, newJournal, progressOf, type AdvanceContext, type Advanced, type Journal } from './journal.ts';

const must = <T>(r: Result<T>): T => { assert.ok(r.ok, JSON.stringify(!r.ok && r.issues)); return r.value; };
const refused = (r: Result<unknown>, code: string, path: string): void => {
  assert.ok(!r.ok && r.issues.some((i) => i.code === code && i.path === path), `want ${code} at ${path}; got ${JSON.stringify(r)}`);
};
const PC = C.PC as CharacterInstanceId;
const CQ = 'quest:concord-commission' as QuestId, FQ = 'quest:smiths-favour' as QuestId;
const defs = (...raws: unknown[]): Map<QuestId, QuestDefinition> => new Map(raws.map((r) => must(parseQuestDefinition(r))).map((d) => [d.id, d]));
const QUESTS = defs(concordCommission(), smithsFavour());
const ctx = (patch: Partial<AdvanceContext> = {}): AdvanceContext =>
  ({ quests: QUESTS, standing: { source: 'server', careerLevel: 11 }, at: C.AT, hasItem: (i: string) => i === 'item:exchange-ore', ...patch });
// Advance through stages (each [quest, stage, choice?]); every step must succeed.
const walk = (steps: [QuestId, string, string?][], j: Journal = newJournal(PC), c: Partial<AdvanceContext> = {}): { j: Journal; out: Advanced[] } => {
  const out: Advanced[] = [];
  for (const [q, s, choice] of steps) { const a = must(advance(j, q, s, ctx({ choice, ...c }))); out.push(a); j = a.journal; }
  return { j, out };
};
const SMITH: [QuestId, string, string?][] = [[CQ, 'smith'], [CQ, 'fetch'], [CQ, 'forge', 'smith'], [CQ, 'returned']];
const BROKER: [QuestId, string, string?][] = [[CQ, 'smith'], [CQ, 'fetch'], [CQ, 'broker', 'broker'], [CQ, 'exposed', 'lie']];

test('fixture: the Concord Commission parses — talk, fetch, smith or broker, return or be exposed', () => {
  const q = QUESTS.get(CQ)!;
  assert.deepEqual(q.stages.map((s) => s.id), ['smith', 'fetch', 'forge', 'broker', 'returned', 'exposed']);
  assert.deepEqual(q.stages.find((s) => s.id === 'fetch')!.transitions.map((t) => t.to), ['forge', 'broker']);
});

test('starting: only at the start stage, behind the gate; hostile ids and a bad clock are refusals', () => {
  const j = newJournal(PC);
  assert.equal(progressOf(j, CQ), 'not-started');
  refused(advance(j, CQ, 'fetch', ctx()), 'rule-violation', 'stage');
  refused(advance(j, CQ, 'smith', ctx({ standing: { source: 'server', careerLevel: 10 } })), 'rule-violation', 'gate');
  refused(advance(j, CQ, 'smith', ctx({ standing: { source: 'device', careerLevel: 46 } })), 'rule-violation', 'gate');
  refused(advance(j, CQ, 'smith', ctx({ at: 'yesterday' })), 'wrong-type', 'at');
  for (const id of ['toString', '__proto__', 'constructor', 'quest:hasOwnProperty']) {
    refused(advance(j, id as QuestId, 'smith', ctx()), 'unknown-id', 'quest');
    refused(advance(j, CQ, id, ctx()), 'unknown-id', 'stage');
    assert.equal(progressOf(j, id as QuestId), 'not-started');
  }
  assert.equal(j.quests.size, 0);
  assert.equal(progressOf(walk([[CQ, 'smith']]).j, CQ), 'active');
});

test('illegal transitions are refused and the journal is unchanged', () => {
  const { j } = walk([[CQ, 'smith']]);
  const before = structuredClone(j);
  refused(advance(j, CQ, 'forge', ctx({ choice: 'smith' })), 'rule-violation', 'stage'); // skips fetch
  refused(advance(j, CQ, 'returned', ctx()), 'rule-violation', 'stage');
  const at = walk([[CQ, 'fetch']], j).j;
  refused(advance(at, CQ, 'smith', ctx()), 'rule-violation', 'stage'); // no way back
  assert.deepEqual(j, before);
});

test('branching both ways, chosen by the caller; finished and failed are final', () => {
  const smith = walk(SMITH).j, broker = walk(BROKER).j;
  assert.deepEqual([progressOf(smith, CQ), smith.quests.get(CQ)!.stage], ['finished', 'returned']);
  assert.deepEqual([progressOf(broker, CQ), broker.quests.get(CQ)!.stage], ['failed', 'exposed']);
  assert.equal(walk([...BROKER.slice(0, 3), [CQ, 'returned', 'confess']]).j.quests.get(CQ)!.status, 'finished');
  for (const [j, at] of [[smith, 'returned'], [broker, 'exposed']] as const) {
    for (const s of ['smith', 'fetch', 'forge', 'broker', 'returned', 'exposed'].filter((s) => s !== at)) refused(advance(j, CQ, s, ctx({ choice: 'confess' })), 'rule-violation', 'status');
    assert.deepEqual(must(advance(j, CQ, at, ctx())), { journal: j, rewards: null, event: null }, 'replaying the ending is a no-op');
  }
});

test('conditions gate: choice, item, tier, prior quest stage, flag, standing, encounter', () => {
  const { j } = walk([[CQ, 'smith'], [CQ, 'fetch']]);
  refused(advance(j, CQ, 'forge', ctx()), 'rule-violation', 'stage'); // no choice made
  refused(advance(j, CQ, 'forge', ctx({ choice: 'broker' })), 'rule-violation', 'stage'); // the other branch's choice
  refused(advance(j, CQ, 'forge', ctx({ choice: 'smith', hasItem: () => false })), 'rule-violation', 'stage');
  refused(advance(j, CQ, 'forge', ctx({ choice: 'smith', hasItem: undefined })), 'rule-violation', 'stage');
  const forge = walk([[CQ, 'forge', 'smith']], j).j;
  refused(advance(forge, CQ, 'returned', ctx({ standing: { source: 'device', careerLevel: 46 } })), 'rule-violation', 'stage'); // tier needs the server
  // The follow-up opens on the smith branch only.
  const favour = walk([[FQ, 'asked']], forge).j;
  assert.equal(walk([[FQ, 'done']], favour).j.quests.get(FQ)!.status, 'finished');
  const sold = walk([[FQ, 'asked'], [CQ, 'broker', 'broker']], j).j;
  refused(advance(sold, FQ, 'done', ctx()), 'rule-violation', 'stage');
  // The contracts' sample quest: flag, standing and encounter conditions, from a stored state.
  const stolen = defs(C.stolenName()), SQ = 'quest:stolen-name' as QuestId;
  const at = (stage: string, flags: Record<string, boolean>) => must(loadJournal(PC, [{ ...C.questState(), stage, flags }], stolen));
  const c = (patch: Partial<AdvanceContext>) => ctx({ quests: stolen, ...patch });
  refused(advance(at('courier', { 'heard-testimony': false }), SQ, 'ruin', c({})), 'rule-violation', 'stage');
  refused(advance(at('courier', {}), SQ, 'ruin', c({})), 'rule-violation', 'stage');
  must(advance(at('courier', { 'heard-testimony': true }), SQ, 'ruin', c({})));
  const ruin = at('ruin', {});
  refused(advance(ruin, SQ, 'bargained', c({ choice: 'bargain', standingWith: () => 99 })), 'rule-violation', 'stage');
  must(advance(ruin, SQ, 'bargained', c({ choice: 'bargain', standingWith: (f: string) => (f === 'faction:ferry-court' ? 100 : 0) })));
  refused(advance(ruin, SQ, 'exposed', c({ choice: 'expose' })), 'rule-violation', 'stage');
  must(advance(ruin, SQ, 'exposed', c({ choice: 'expose', cleared: (e: string) => e === 'encounter:ruin-vigil' })));
});

test('rewards and story events are paid once: a step per stage, the chapter at the finish, nothing for a failure or a replay', () => {
  const { j, out } = walk(SMITH);
  assert.deepEqual(out.map((a) => a.event), [
    { kind: 'story', type: 'story-step', id: 'quest:concord-commission:smith' }, { kind: 'story', type: 'story-step', id: 'quest:concord-commission:fetch' },
    { kind: 'story', type: 'story-step', id: 'quest:concord-commission:forge' }, { kind: 'story', type: 'story-chapter', id: 'quest:concord-commission:returned' },
  ]);
  const q = QUESTS.get(CQ)!;
  assert.deepEqual(out.map((a) => a.rewards), SMITH.map(([, s]) => q.stages.find((x) => x.id === s)!.rewards));
  assert.deepEqual(j.quests.get(CQ)!.rewarded, ['smith', 'fetch', 'forge', 'returned']);
  // Replaying any step of the walk, at its own point, returns nothing new.
  let k = newJournal(PC);
  for (const [qq, s, choice] of SMITH) {
    k = must(advance(k, qq, s, ctx({ choice }))).journal;
    assert.deepEqual(must(advance(k, qq, s, ctx({ choice }))), { journal: k, rewards: null, event: null });
  }
  const failed = walk(BROKER).out.at(-1)!;
  assert.equal(failed.event, null);
  assert.deepEqual(failed.rewards, q.stages.find((x) => x.id === 'exposed')!.rewards, 'a fail stage still settles its own (negative) rewards');
});

test('the journal is append-only, in order, one entry per stage with text', () => {
  const steps: [QuestId, string, string?][] = [[CQ, 'smith'], [CQ, 'fetch'], [FQ, 'asked'], [CQ, 'forge', 'smith'], [FQ, 'done']];
  let j = newJournal(PC);
  const out = steps.map(([q, s, choice], i) => { const a = must(advance(j, q, s, ctx({ choice, at: `2026-10-06T12:00:0${i}Z` }))); j = a.journal; return a; });
  assert.deepEqual(entries(j).map((e) => `${e.quest}#${e.stage}`), ['quest:concord-commission#smith', 'quest:concord-commission#fetch', 'quest:smiths-favour#asked', 'quest:concord-commission#forge']);
  for (let i = 1; i < out.length; i++) {
    const a = entries(out[i - 1]!.journal), b = entries(out[i]!.journal);
    assert.deepEqual(b.slice(0, a.length), a);
  }
  assert.equal(j.quests.get(FQ)!.journal.length, 1, "an empty journal line counts but is not listed ('done')");
});

test('stored rows round-trip through the contracts: parse, migrate, check — and rewards stay paid after a migration', () => {
  const { j } = walk([[CQ, 'smith'], [CQ, 'fetch'], [CQ, 'forge', 'smith'], [FQ, 'asked']]);
  const rows: unknown[] = JSON.parse(JSON.stringify([...j.quests.values()]));
  assert.deepEqual(must(loadJournal(PC, rows, QUESTS)), j);
  refused(loadJournal('pc:rival-1' as CharacterInstanceId, rows, QUESTS), 'rule-violation', '[0].character');
  refused(loadJournal(PC, [rows[0], rows[0]], QUESTS), 'duplicate-id', '[1].quest');
  refused(loadJournal(PC, rows, defs(smithsFavour())), 'unknown-id', '[0].quest');
  refused(loadJournal(PC, [{ ...(rows[0] as object), stage: 'returned' }], QUESTS), 'rule-violation', '[0].status');
  // Version 2 renames 'forge' to 'anvil'. The v1 row migrates; the renamed stage keeps its paid record.
  const v2raw = concordCommission();
  const v2 = defs({ ...v2raw, storyVersion: 2, stages: v2raw.stages.map((s) => (s.id === 'forge' ? { ...s, id: 'anvil' } : { ...s, transitions: s.transitions.map((t) => (t.to === 'forge' ? { ...t, to: 'anvil' } : t)) })),
    migrations: [{ fromVersion: 1, stageMap: [{ from: 'forge', to: 'anvil' }], checkpoint: 'smith' }] });
  refused(advance(j, CQ, 'returned', ctx({ quests: v2 })), 'story-version-mismatch', 'storyVersion');
  const moved = must(loadJournal(PC, [rows[0]], v2));
  assert.deepEqual([moved.quests.get(CQ)!.stage, moved.quests.get(CQ)!.rewarded], ['anvil', ['smith', 'fetch', 'anvil']]);
  assert.deepEqual(must(advance(moved, CQ, 'anvil', ctx({ quests: v2 }))).rewards, null);
  assert.equal(must(advance(moved, CQ, 'returned', ctx({ quests: v2 }))).event!.type, 'story-chapter');
});

test('property: 500 seeded random advance sequences keep every invariant', () => {
  let seed = 0x0c0ffee;
  const rnd = (n: number): number => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % n; };
  const pick = <T>(xs: readonly T[]): T => xs[rnd(xs.length)]!;
  const STAGES = ['smith', 'fetch', 'forge', 'broker', 'returned', 'exposed', 'asked', 'done', 'constructor', '__proto__'];
  const IDS = [CQ, FQ, 'toString' as QuestId];
  let ended = 0;
  // Two in three targets are the current stage (a replay) or one of its ways out; the rest are any stage, hostile names included.
  const target = (j: Journal, q: QuestId): string => {
    const d = QUESTS.get(q), s = j.quests.get(q);
    if (!d || rnd(3) === 0) return pick(STAGES);
    return s ? pick([s.stage, ...d.stages.find((x) => x.id === s.stage)!.transitions.map((t) => t.to)]) : d.start;
  };
  for (let run = 0; run < 500; run++) {
    let j = newJournal(PC);
    const paid = new Set<string>(), events = new Set<string>();
    for (let step = 0; step < 40; step++) {
      const quest = pick(IDS), stage = target(j, quest);
      const r = advance(j, quest, stage, ctx({ choice: pick([undefined, 'smith', 'broker', 'confess', 'lie']), hasItem: () => rnd(4) > 0, standing: { source: 'server', careerLevel: pick([5, 11, 30]) } }));
      if (!r.ok) continue; // a refusal returns no journal: the caller keeps the old one
      const prev = j;
      j = r.value.journal;
      if (r.value.rewards) { assert.ok(!paid.has(`${quest}:${stage}`), 'a stage paid twice'); paid.add(`${quest}:${stage}`); }
      if (r.value.event) { assert.ok(!events.has(r.value.event.id), 'a story event twice'); events.add(r.value.event.id); }
      for (const [id, s] of j.quests) {
        const def = QUESTS.get(id)!;
        assert.deepEqual(checkQuestState(s, def), []);
        assert.equal(s.status, statusFor(def.stages.find((x) => x.id === s.stage)!.kind), 'one stage, one status');
        assert.equal(new Set(s.rewarded).size, s.rewarded.length);
        assert.deepEqual(must(parseQuestState(JSON.parse(JSON.stringify(s)))), s);
        const before = prev.quests.get(id);
        if (before) {
          assert.deepEqual(s.journal.slice(0, before.journal.length), before.journal, 'entries are append-only');
          if (before.status !== 'active') assert.equal(s, before, 'a final quest never changes');
        }
      }
    }
    ended += [...j.quests.values()].filter((s) => s.status !== 'active').length;
  }
  assert.ok(ended > 100, `the walks reach endings (${ended})`);
});
