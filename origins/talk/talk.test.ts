// O2 NPC talk: load-time validation, condition filtering, priority order, once-lines, quest hooks, refusals, and a seeded property run.
import assert from 'node:assert/strict';
import test from 'node:test';
import { fail, ok, type Result } from '../contracts/core.ts';
import type { ItemId, QuestId } from '../contracts/ids.ts';
import { orla } from './fixtures.ts';
import { choices, loadTalk, newTalkState, pick, type Advance, type Facts, type TalkState } from './talk.ts';

const must = <T>(r: Result<T>): T => { assert.ok(r.ok, JSON.stringify(!r.ok && r.issues)); return r.value; };
const refused = (r: Result<unknown>, code: string, path?: string): void => {
  assert.ok(!r.ok && r.issues.some((i) => i.code === code && (path === undefined || i.path === path)), `want ${code} at ${path}; got ${JSON.stringify(r)}`);
};
const ORLA = must(loadTalk(orla()));
const CQ = 'quest:concord-commission' as QuestId, ORE = 'item:exchange-ore' as ItemId;

// A stand-in for the quest journal (not merged yet): The Concord Commission's start and transitions, keyed by the choice each needs.
type World = ReadonlyMap<QuestId, { stage: string; rewarded: string[] }>;
const EDGES = new Map<string, [string, string | null][]>([
  ['smith', [['fetch', null]]], ['fetch', [['forge', 'smith'], ['broker', 'broker']]], ['forge', [['returned', null]]], ['broker', [['returned', 'confess'], ['exposed', 'lie']]],
]);
const journal = (w: World, calls: string[]): Advance<World> => (q, stage, choice) => {
  const cur = w.get(q);
  const legal = cur === undefined ? stage === 'smith' : (EDGES.get(cur.stage) ?? []).some(([to, c]) => to === stage && c === choice);
  if (!legal) return fail('rule-violation', 'stage', `no way to "${stage}"`);
  calls.push(stage);
  return ok(new Map(w).set(q, { stage, rewarded: [...(cur?.rewarded ?? []), stage] }));
};
const facts = (w: World, o: { level?: number; ore?: boolean; source?: 'server' | 'device' } = {}): Facts =>
  ({ standing: { source: o.source ?? 'server', careerLevel: o.level ?? 11 }, quest: (id) => w.get(id), hasItem: (i) => o.ore === true && i === ORE });
const ids = (s: TalkState, f: Facts): string[] => choices(ORLA, s, f).map((l) => l.id);

// Pick each line in turn (each must succeed); returns the final talk state, world and every journal step requested.
const say = (lineIds: string[], o: Parameters<typeof facts>[1] = {}) => {
  let s = newTalkState(), w: World = new Map();
  const calls: string[] = [], effects: string[] = [];
  for (const id of lineIds) {
    const p = must(pick(ORLA, s, id, facts(w, o), journal(w, calls)));
    s = p.state; w = p.journal ?? w; effects.push(...p.effects.map((e) => e.kind));
  }
  return { s, w, calls, effects };
};

test('load: Orla parses; lines sorted by priority, ties in content order', () => {
  assert.deepEqual(ORLA.lines.map((l) => l.id), ['greet-first', 'greet', 'cold', 'offer', 'take-job', 'collect', 'confess', 'hand-ore', 'lie', 'broker-offer', 'where-ore', 'done', 'farewell']);
});

test('load: bad content is refused with a path, never guessed', () => {
  const withLine = (patch: Record<string, unknown>) => ({ ...orla(), lines: [{ ...orla().lines[0], ...patch }] });
  refused(loadTalk({ ...orla(), kind: 'quest-definition' }), 'unknown-kind', 'kind');
  refused(loadTalk({ ...orla(), schemaVersion: 2 }), 'unsupported-version', 'schemaVersion');
  refused(loadTalk({ ...orla(), npc: 'faction:concord' }), 'wrong-namespace', 'npc');
  refused(loadTalk({ ...orla(), lines: [orla().lines[0], orla().lines[0]] }), 'duplicate-id', 'lines[1].id');
  refused(loadTalk(withLine({ id: '__proto__' })), 'wrong-type', 'lines[0].id');
  refused(loadTalk(withLine({ mood: 'grim' })), 'unknown-field', 'lines[0].mood');
  refused(loadTalk(withLine({ when: [{ kind: 'script', source: 'Info_AddChoice' }] })), 'unknown-kind', 'lines[0].when[0].kind');
  refused(loadTalk(withLine({ when: [{ kind: 'choice', choice: 'smith' }] })), 'content-rule', 'lines[0].when[0].kind');
  refused(loadTalk(withLine({ when: [{ kind: 'quest-at', quest: CQ }] })), 'missing-field', 'lines[0].when[0].stage');
  refused(loadTalk(withLine({ effects: [{ kind: 'give-gold', amount: 5 }] })), 'unknown-kind', 'lines[0].effects[0].kind');
  const two = { kind: 'quest', quest: CQ, stage: 'smith', choice: null };
  refused(loadTalk(withLine({ effects: [two, { ...two, stage: 'fetch' }] })), 'content-rule', 'lines[0].effects');
});

test('choices: filtered by conditions, in priority order', () => {
  const w: World = new Map();
  assert.deepEqual(ids(newTalkState(), facts(w)), ['greet-first', 'offer', 'farewell']);
  const { s, w: atFetch } = say(['greet-first', 'offer', 'take-job']);
  assert.deepEqual(ids(s, facts(atFetch)), ['greet', 'where-ore', 'farewell']);
  assert.deepEqual(ids(s, facts(atFetch, { ore: true })), ['greet', 'hand-ore', 'broker-offer', 'where-ore', 'farewell']);
});

test('once-lines: said once per character, then hidden; a second pick is refused and emits nothing', () => {
  const { s, effects } = say(['greet-first']);
  assert.deepEqual(effects, ['set-flag']);
  assert.equal(s.flags.get('met-orla'), true);
  assert.ok(!ids(s, facts(new Map())).includes('greet-first'));
  const again = pick(ORLA, s, 'greet-first', facts(new Map()), journal(new Map(), []));
  refused(again, 'rule-violation', 'line');
  assert.match(JSON.stringify(again), /said once/);
});

test('quest offer: only when not started and the server-verified rank allows', () => {
  const w: World = new Map(), calls: string[] = [];
  for (const f of [facts(w, { level: 1 }), facts(w, { source: 'device' })]) {
    assert.ok(!ids(newTalkState(), f).includes('offer'));
    refused(pick(ORLA, newTalkState(), 'offer', f, journal(w, calls)), 'rule-violation', 'line');
  }
  assert.deepEqual(calls, []);
  const { s, w: started, calls: made } = say(['offer']);
  assert.deepEqual(made, ['smith']);
  assert.ok(!ids(s, facts(started)).includes('offer'));
});

test('the smith branch: each pick requests exactly one journal step, effects once', () => {
  const run = say(['greet-first', 'offer', 'take-job', 'hand-ore', 'collect', 'farewell'], { ore: true });
  assert.deepEqual(run.calls, ['smith', 'fetch', 'forge', 'returned']);
  assert.deepEqual(run.effects, ['set-flag', 'quest', 'quest', 'quest', 'quest', 'end']);
  assert.deepEqual(ids(run.s, facts(run.w)), ['greet', 'done', 'farewell']);
});

test('the broker branch: a lie fails the quest and Orla goes cold', () => {
  const run = say(['offer', 'take-job', 'broker-offer', 'lie'], { ore: true });
  assert.deepEqual(run.calls, ['smith', 'fetch', 'broker', 'exposed']);
  assert.deepEqual(ids(run.s, facts(run.w)), ['cold']);
  assert.deepEqual(must(pick(ORLA, run.s, 'cold', facts(run.w), journal(run.w, []))).effects, [{ kind: 'end' }]);
});

test('refusals leave the state and journal untouched: unknown and hostile ids, a journal refusal', () => {
  const s = newTalkState(), w: World = new Map(), calls: string[] = [];
  for (const id of ['nope', '__proto__', 'constructor', 'toString', 'hasOwnProperty', '']) refused(pick(ORLA, s, id, facts(w), journal(w, calls)), 'unknown-id', 'line');
  const no: Advance<World> = () => fail('rule-violation', 'gate', 'behind the outer gate');
  refused(pick(ORLA, s, 'offer', facts(w), no), 'rule-violation', 'gate');
  const lie = say(['offer', 'take-job', 'broker-offer'], { ore: true });
  refused(pick(ORLA, lie.s, 'lie', facts(lie.w), no), 'rule-violation', 'gate'); // its flag and end are not applied either
  assert.deepEqual([s.told.size, s.flags.size, w.size, calls.length], [0, 0, 0, 0]);
});

test('property: 300 seeded talk walks never offer a hidden or said once-line, and no effect fires twice', () => {
  let seed = 0x5eed;
  const rand = (): number => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const any = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const all = [...ORLA.lines.map((l) => l.id), 'constructor', '__proto__', 'missing'];
  for (let walk = 0; walk < 300; walk++) {
    let s = newTalkState(), w: World = new Map();
    const calls: string[] = [], once = new Set<string>();
    const o = { level: any([1, 11]), source: any(['server', 'device'] as const) };
    for (let n = 0; n < 25; n++) {
      const f = facts(w, { ...o, ore: rand() < 0.5 });
      const offered = choices(ORLA, s, f);
      for (const l of offered) {
        assert.ok(!once.has(l.id), `once-line ${l.id} offered after it was said`);
        for (const c of l.when) {
          if (c.kind === 'quest-at') assert.equal(w.get(c.quest)?.stage ?? null, c.stage, `${l.id} offered at the wrong stage`);
          if (c.kind === 'has-item') assert.ok(f.hasItem?.(c.item), `${l.id} offered without the ore`);
          if (c.kind === 'tier-at-least') assert.ok(o.level === 11 && o.source === 'server', `${l.id} offered below rank`);
          if (c.kind === 'flag') assert.equal(s.flags.get(c.name) === true, c.value, `${l.id} offered against flag ${c.name}`);
        }
      }
      const id = rand() < 0.2 ? any(all) : offered.length ? any(offered).id : any(all);
      const r = pick(ORLA, s, id, f, journal(w, calls));
      assert.equal(r.ok, offered.some((l) => l.id === id), `pick ${id}: refused iff not offered`);
      if (!r.ok) continue;
      if (ORLA.lines.find((l) => l.id === id)!.once) once.add(id);
      s = r.value.state; w = r.value.journal ?? w;
    }
    assert.equal(new Set(calls).size, calls.length, `a journal step fired twice: ${calls}`);
  }
});
