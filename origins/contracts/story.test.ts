// O1 story: QuestDefinition (named stages, branching conditions, soft-lock-free graph, migrations) and QuestState (story version,
// checked against content, migrated or refused).
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Result } from './core.ts';
import * as F from './fixtures.ts';
import { checkQuestState, grantStageRewards, migrateQuestState, parseQuestDefinition, parseQuestState, type QuestDefinition, type QuestState } from './story.ts';

type Raw = Record<string, unknown>;
const refused = (r: Result<unknown>, code: string, path?: string): void => {
  assert.equal(r.ok, false, `expected ${code}${path ? ` at ${path}` : ''}`);
  if (r.ok) return;
  assert.ok(r.issues.some((i) => i.code === code && (path === undefined || i.path === path)), `want ${code}${path ? ` at ${path}` : ''}; got ${JSON.stringify(r.issues)}`);
};
const must = <T>(r: Result<T>): T => { assert.ok(r.ok, JSON.stringify(!r.ok && r.issues)); return r.value; };
const quest = (): QuestDefinition => must(parseQuestDefinition(F.stolenName()));
const state = (patch: Raw = {}): QuestState => must(parseQuestState({ ...F.questState(), ...patch }));
type Stage = ReturnType<typeof F.stolenName>['stages'][number];
const withStages = (stages: unknown[], patch: Raw = {}) => parseQuestDefinition({ ...F.stolenName(), stages, migrations: [], ...patch });
const stage = (id: string, kind: string, to: string[] = []): Raw => ({ id, kind, journal: id, rewards: { loot: null, standing: [] }, transitions: to.map((t) => ({ to: t, when: [], label: null })) });

test('quest definition: The Stolen Name parses — five-plus stages, three branches to three endings', () => {
  const q = quest();
  assert.equal(q.stages.length, 6);
  assert.equal(q.stages.find((s) => s.id === 'ruin')!.transitions.length, 3);
  assert.deepEqual(q.stages.filter((s) => s.kind === 'finish').map((s) => s.id), ['returned', 'bargained', 'exposed']);
});

test('quest definition: an unsupported condition is reported, never guessed', () => {
  const stages = F.stolenName().stages as Stage[];
  const bad = stages.map((s) => (s.id === 'erased' ? { ...s, transitions: [{ to: 'courier', when: [{ kind: 'script', source: 'SetJournalIndex 20' }], label: null }] } : s));
  refused(parseQuestDefinition({ ...F.stolenName(), stages: bad }), 'unknown-kind', 'stages[0].transitions[0].when[0].kind');
  const badTier = stages.map((s) => (s.id === 'erased' ? { ...s, transitions: [{ to: 'courier', when: [{ kind: 'tier-at-least', tier: 11 }], label: null }] } : s));
  refused(parseQuestDefinition({ ...F.stolenName(), stages: badTier }), 'wrong-type', 'stages[0].transitions[0].when[0].tier');
  const extra = stages.map((s) => (s.id === 'erased' ? { ...s, transitions: [{ to: 'courier', when: [{ kind: 'choice', choice: 'go', weight: 2 }], label: null }] } : s));
  refused(parseQuestDefinition({ ...F.stolenName(), stages: extra }), 'unknown-field', 'stages[0].transitions[0].when[0].weight');
});

test('quest definition: the story graph — every soft lock and dangling stage is a content error', () => {
  must(withStages([stage('a', 'progress', ['b']), stage('b', 'finish')], { start: 'a' }));
  refused(withStages([stage('a', 'progress', ['b']), stage('b', 'finish')], { start: 'z' }), 'unknown-id', 'start');
  refused(withStages([stage('a', 'progress', ['zz']), stage('b', 'finish')], { start: 'a' }), 'unknown-id', 'stages[0].transitions[0].to');
  refused(withStages([stage('a', 'progress', ['b']), stage('b', 'finish', ['a'])], { start: 'a' }), 'rule-violation', 'stages[1].transitions');
  refused(withStages([stage('a', 'progress'), stage('b', 'finish')], { start: 'a' }), 'rule-violation', 'stages[0].transitions');
  refused(withStages([stage('a', 'progress', ['b']), stage('b', 'fail')], { start: 'a' }), 'rule-violation', 'stages'); // no finish
  refused(withStages([stage('a', 'progress', ['b']), stage('b', 'finish'), stage('orphan', 'finish')], { start: 'a' }), 'rule-violation', 'stages[2]');
  // A loop with no exit: c and d point only at each other.
  refused(withStages([stage('a', 'progress', ['b', 'c']), stage('b', 'finish'), stage('c', 'progress', ['d']), stage('d', 'progress', ['c'])], { start: 'a' }), 'rule-violation', 'stages[2]');
  refused(withStages([stage('a', 'progress', ['b']), stage('b', 'finish'), stage('b', 'finish')], { start: 'a' }), 'duplicate-id', 'stages[2].id');
  refused(withStages([stage('A', 'progress', ['b']), stage('b', 'finish')], { start: 'A' }), 'wrong-type', 'stages[0].id');
});

test('quest definition: shape rejections', () => {
  refused(parseQuestDefinition({ ...F.stolenName(), schemaVersion: 2 }), 'unsupported-version');
  refused(parseQuestDefinition({ ...F.stolenName(), storyVersion: 0 }), 'out-of-range', 'storyVersion');
  refused(parseQuestDefinition({ ...F.stolenName(), scope: 'guild' }), 'wrong-type', 'scope');
  refused(parseQuestDefinition({ ...F.stolenName(), gate: 'gladiator' }), 'wrong-type', 'gate');
  const stages = F.stolenName().stages as Stage[];
  refused(parseQuestDefinition({ ...F.stolenName(), stages: [{ ...stages[0], rewards: { loot: null, standing: [{ faction: 'faction:ferry-court', delta: 500 }] } }, ...stages.slice(1)] }), 'out-of-range', 'stages[0].rewards.standing[0].delta');
  refused(parseQuestDefinition({ ...F.stolenName(), stages: [{ ...stages[0], journal: 'x'.repeat(601) }, ...stages.slice(1)] }), 'out-of-range', 'stages[0].journal');
});

test('quest definition: migration rules', () => {
  const m = F.stolenName().migrations[0]!;
  refused(parseQuestDefinition({ ...F.stolenName(), migrations: [{ ...m, fromVersion: 2 }] }), 'rule-violation', 'migrations[0].fromVersion');
  refused(parseQuestDefinition({ ...F.stolenName(), migrations: [m, m] }), 'duplicate-id', 'migrations[1].fromVersion');
  refused(parseQuestDefinition({ ...F.stolenName(), migrations: [{ ...m, checkpoint: 'gone' }] }), 'unknown-id', 'migrations[0].checkpoint');
  refused(parseQuestDefinition({ ...F.stolenName(), migrations: [{ ...m, stageMap: [{ from: 'old', to: 'gone' }] }] }), 'unknown-id', 'migrations[0].stageMap[0].to');
  refused(parseQuestDefinition({ ...F.stolenName(), migrations: [{ ...m, stageMap: [{ from: 'old', to: 'erased' }, { from: 'old', to: 'courier' }] }] }), 'duplicate-id', 'migrations[0].stageMap[1].from');
});

test('quest state: parses and checks against its definition', () => {
  assert.deepEqual(checkQuestState(state(), quest()), []);
  refused(parseQuestState({ ...F.questState(), flags: { Bad: true } }), 'bad-id', 'flags.Bad');
  refused(parseQuestState({ ...F.questState(), flags: { ok: 'yes' } }), 'wrong-type', 'flags.ok');
  refused(parseQuestState({ ...F.questState(), flags: [] }), 'not-object', 'flags');
  refused(parseQuestState({ ...F.questState(), status: 'done' }), 'wrong-type', 'status');
  refused(parseQuestState({ ...F.questState(), schemaVersion: 0 }), 'unsupported-version');
  refused(parseQuestState({ ...F.questState(), journal: [{ stage: 'erased', text: '', at: F.AT }] }), 'out-of-range', 'journal[0].text');
  assert.equal(checkQuestState(state({ stage: 'nowhere' }), quest())[0]!.code, 'unknown-id');
  assert.equal(checkQuestState(state({ stage: 'returned' }), quest())[0]!.code, 'rule-violation'); // a finish stage is 'finished'
  assert.deepEqual(checkQuestState(state({ stage: 'returned', status: 'finished' }), quest()), []);
  assert.equal(checkQuestState(state({ quest: 'quest:other' }), quest())[0]!.code, 'rule-violation');
  assert.deepEqual(checkQuestState(state({ storyVersion: 1 }), quest()).map((i) => i.code), ['story-version-mismatch']);
});

test('quest state: migration maps a stage, falls back to the checkpoint, keeps the journal, and refuses what it cannot do', () => {
  const q = quest();
  assert.deepEqual(migrateQuestState(state(), q), { ok: true, value: state() }, 'current version: unchanged');
  const mapped = must(migrateQuestState(state({ storyVersion: 1, stage: 'missing' }), q));
  assert.deepEqual([mapped.storyVersion, mapped.stage, mapped.status], [2, 'courier', 'active']);
  assert.deepEqual(mapped.journal, state().journal, 'what the player read is never rewritten');
  const checkpoint = must(migrateQuestState(state({ storyVersion: 1, stage: 'some-removed-stage' }), q));
  assert.equal(checkpoint.stage, 'erased');
  assert.deepEqual(checkQuestState(checkpoint, q), []);
  refused(migrateQuestState(state({ storyVersion: 3 }), q), 'story-version-mismatch', 'storyVersion');
  refused(migrateQuestState(state({ storyVersion: 1 }), { ...q, migrations: [] }), 'no-migration', 'storyVersion');
  refused(migrateQuestState(state({ quest: 'quest:other' }), q), 'rule-violation', 'quest');
});

const withMigration = (stageMap: { from: string; to: string }[]): QuestDefinition => ({ ...quest(), migrations: [{ fromVersion: 1, stageMap, checkpoint: 'erased' }] });

test('quest state: a finished or failed quest stays terminal across a migration — never sent back to a checkpoint', () => {
  // Finished, and the new version's map does not name its ending: refused, not reopened at the checkpoint (where its rewards could pay again).
  refused(migrateQuestState(state({ storyVersion: 1, stage: 'returned', status: 'finished' }), withMigration([])), 'no-migration', 'stage');
  refused(migrateQuestState(state({ storyVersion: 1, stage: 'old-ending', status: 'failed' }), quest()), 'no-migration', 'stage');
  // Mapped onto an ending of the same kind: it stays finished there.
  const kept = must(migrateQuestState(state({ storyVersion: 1, stage: 'old-ending', status: 'finished' }), withMigration([{ from: 'old-ending', to: 'bargained' }])));
  assert.deepEqual([kept.storyVersion, kept.stage, kept.status], [2, 'bargained', 'finished']);
  assert.deepEqual(checkQuestState(kept, quest()), []);
  // Mapped onto a progress stage, or onto an ending of the other kind: refused.
  refused(migrateQuestState(state({ storyVersion: 1, stage: 'old-ending', status: 'finished' }), withMigration([{ from: 'old-ending', to: 'courier' }])), 'rule-violation', 'stage');
  refused(migrateQuestState(state({ storyVersion: 1, stage: 'old-ending', status: 'failed' }), withMigration([{ from: 'old-ending', to: 'returned' }])), 'rule-violation', 'stage');
});

test('quest state: stage rewards are recorded when granted and can never be granted again, across migrations', () => {
  const q = quest();
  assert.deepEqual(state().rewarded, [], 'a state written before the record existed reads as nothing granted');
  const granted = must(grantStageRewards(state(), q, 'ruin'));
  assert.deepEqual(granted.rewards, q.stages.find((s) => s.id === 'ruin')!.rewards);
  assert.deepEqual(granted.state.rewarded, ['ruin']);
  refused(grantStageRewards(granted.state, q, 'ruin'), 'duplicate-id', 'rewarded');
  refused(grantStageRewards(state(), q, 'courier'), 'rule-violation', 'stage'); // rewards are granted at the stage the quest is at
  refused(grantStageRewards(state({ storyVersion: 1 }), q, 'ruin'), 'story-version-mismatch', 'storyVersion');
  // Migration carries the record through the stage map: 'missing' (granted under v1) is now 'courier', which therefore never pays again.
  const migrated = must(migrateQuestState(state({ storyVersion: 1, stage: 'missing', rewarded: ['erased', 'missing', 'gone-for-good'] }), q));
  assert.deepEqual([migrated.stage, migrated.rewarded], ['courier', ['erased', 'courier']]);
  refused(grantStageRewards(migrated, q, 'courier'), 'duplicate-id', 'rewarded');
  // A finished quest keeps its record through the migration too.
  const done = must(migrateQuestState(state({ storyVersion: 1, stage: 'old-ending', status: 'finished', rewarded: ['old-ending'] }), withMigration([{ from: 'old-ending', to: 'returned' }])));
  refused(grantStageRewards(done, q, 'returned'), 'duplicate-id', 'rewarded');
  // The record's own shape.
  refused(parseQuestState({ ...F.questState(), rewarded: ['ruin', 'ruin'] }), 'duplicate-id', 'rewarded[1]');
  refused(parseQuestState({ ...F.questState(), rewarded: ['Ruin'] }), 'wrong-type', 'rewarded[0]');
  assert.equal(checkQuestState(state({ rewarded: ['nowhere'] }), q)[0]!.code, 'unknown-id');
});
