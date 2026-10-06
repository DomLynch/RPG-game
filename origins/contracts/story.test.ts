// O1 story: QuestDefinition (named stages, branching conditions, soft-lock-free graph, migrations) and QuestState (story version,
// checked against content, migrated or refused).
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Result } from './core.ts';
import * as F from './fixtures.ts';
import { checkQuestState, migrateQuestState, parseQuestDefinition, parseQuestState, type QuestDefinition, type QuestState } from './story.ts';

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
