// Pins the world boss event: stage order, refusals, the 10% contribution boundary, one event and one loot request per eligible
// character exactly once, replay idempotence, the cooldown, and a seeded property run over random sequences.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MINT_KEY_PATTERN } from '../contracts/core.ts';
import { award, newCareer } from '../progression/model.ts';
import { dormant, parseBossDefinition, sharePermille, step, type Action, type BossDefinition, type BossState, type Step } from './boss.ts';
import { matriarch } from './fixtures.ts';

const parsed = parseBossDefinition(matriarch());
assert.ok(parsed.ok, JSON.stringify(!parsed.ok && parsed.issues));
const DEF: BossDefinition = parsed.value;

const go = (state: BossState, action: Action, def = DEF): Step => {
  const r = step(def, state, action);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.issues));
  return r.value;
};
const hit = (character: string, amount: number, at = 100, party: string | null = null, level = 12): Action =>
  ({ kind: 'damage', at, character, amount, level, party });
// A boss already up: woken at 0, twelve hounds killed.
function bossUp(def = DEF): BossState {
  let s = go(dormant(def), { kind: 'wake', at: 0 }, def).state;
  for (let i = 0; i < 12; i++) s = go(s, { kind: 'foe-killed', at: 10 + i }, def).state;
  return s;
}

test('fixture: the Matriarch parses; a threshold that disagrees with the progression model is refused', () => {
  assert.equal(DEF.encounter.name, 'The Ash Hound Matriarch');
  assert.deepEqual([DEF.level, DEF.health, DEF.encounter.stages[0]!.killsToAdvance], [12, 12_000, 12]);
  const bad = matriarch();
  bad.encounter.rewards.minContributionPercent = 5;
  const r = parseBossDefinition(bad);
  assert.ok(!r.ok && r.issues.some(i => i.code === 'rule-violation'));
  assert.ok(!parseBossDefinition({ ...matriarch(), extra: 1 }).ok);
});

test('stage order: dormant → gathering → boss → defeated → dormant after the cooldown', () => {
  let s = dormant(DEF);
  s = go(s, { kind: 'wake', at: 0 }).state;
  assert.equal(s.stage, 'gathering');
  for (let i = 0; i < 11; i++) s = go(s, { kind: 'foe-killed', at: 1 }).state;
  assert.deepEqual([s.stage, s.kills], ['gathering', 11]);
  s = go(s, { kind: 'foe-killed', at: 2 }).state;
  assert.deepEqual([s.stage, s.kills, s.health], ['boss', 0, 12_000]);
  const done = go(s, hit('pc:dom-1', 12_000, 50));
  assert.deepEqual([done.state.stage, done.state.since, done.state.defeats], ['defeated', 50, 1]);
  assert.equal(go(done.state, { kind: 'reset', at: 3650 }).state.stage, 'dormant');
});

test('waves: a two-wave encounter advances through both bars before the boss', () => {
  const raw = matriarch();
  raw.encounter.stages.push({ ...raw.encounter.stages[0]!, id: 'den', killsToAdvance: 2 });
  const two = parseBossDefinition(raw);
  assert.ok(two.ok);
  let s = go(dormant(two.value), { kind: 'wake', at: 0 }, two.value).state;
  for (let i = 0; i < 12; i++) s = go(s, { kind: 'foe-killed', at: 1 }, two.value).state;
  assert.deepEqual([s.stage, s.wave, s.kills], ['gathering', 1, 0]);
  s = go(go(s, { kind: 'foe-killed', at: 2 }, two.value).state, { kind: 'foe-killed', at: 2 }, two.value).state;
  assert.equal(s.stage, 'boss');
});

test('illegal transitions and hostile input are refused with the state unchanged', () => {
  const asleep = dormant(DEF);
  const up = bossUp();
  const cases: [BossState, Action][] = [
    [asleep, { kind: 'foe-killed', at: 1 }], [asleep, hit('pc:dom-1', 5)], [asleep, { kind: 'abandon', at: 1 }], [asleep, { kind: 'reset', at: 1 }],
    [up, { kind: 'wake', at: 50 }], [up, { kind: 'foe-killed', at: 50 }], [up, { kind: 'reset', at: 50 }],
    [up, { kind: 'wake', at: 5 }], // time running back
    [up, hit('pc:dom-1', 0)], [up, hit('pc:dom-1', 1.5)], [up, hit('pc:dom-1', 5, 100, null, 0)], [up, hit('pc:dom-1', 5, 100, '')],
    [up, hit('account:dom', 5)], [up, hit('__proto__', 5)], [up, hit('pc:__proto__', 5)], [up, hit('pc:dom-1', 5, Number.NaN)],
    [up, { kind: 'tickle', at: 50 } as unknown as Action],
  ];
  for (const [state, action] of cases) {
    const before = structuredClone(state);
    const r = step(DEF, state, action);
    assert.ok(!r.ok && r.issues.length > 0, JSON.stringify(action));
    assert.deepEqual(state, before);
  }
  // 'pc:constructor' is a well-formed id: it is a plain Map key, never a prototype lookup.
  assert.equal(go(up, hit('pc:constructor', 7)).state.contributors.get('pc:constructor' as never)?.dealt, 7);
});

test('contribution: 9.9% is not eligible, 10.0% is; one event and one loot request per eligible character', () => {
  let s = bossUp();
  s = go(s, hit('pc:near', 1_188)).state; // 99‰
  s = go(s, hit('pc:edge', 1_200)).state; // 100‰
  s = go(s, hit('pc:edge', 1)).state; // a second hit adds to the same entry, never a second contributor
  assert.equal(s.contributors.size, 2);
  const done = go(s, hit('pc:top', 20_000, 200));
  assert.equal(sharePermille(DEF, done.state.contributors.get('pc:top' as never)!), 800); // overkill clipped to the health left
  assert.deepEqual(done.events.map(e => [e.target, e.contributionPermille]), [
    ['encounter:ash-hound-matriarch', 100], ['encounter:ash-hound-matriarch', 800],
  ]);
  const [edge] = done.events;
  assert.deepEqual(edge, {
    kind: 'kill', id: 'encounter:ash-hound-matriarch:1:pc:edge', at: 200, type: 'world-boss', target: 'encounter:ash-hound-matriarch',
    targetLevel: 12, contributionPermille: 100,
  });
  assert.deepEqual(done.loot.map(l => l.character), ['pc:edge', 'pc:top']);
  assert.deepEqual(done.loot[0], { encounter: 'encounter:ash-hound-matriarch', lootTable: 'loottable:ash-hound-matriarch', character: 'pc:edge', mintKey: edge!.id });
  assert.ok(done.loot.every(l => MINT_KEY_PATTERN.test(l.mintKey)));
});

test('party: party members carry each other\'s levels; a fifth member of one party is refused', () => {
  let s = bossUp();
  for (const [pc, level] of [['pc:a', 12], ['pc:b', 14], ['pc:c', 11], ['pc:d', 13]] as const) s = go(s, hit(pc, 2_000, 100, 'p1', level)).state;
  assert.ok(!step(DEF, s, hit('pc:e', 2_000, 100, 'p1')).ok);
  const done = go(s, hit('pc:e', 4_000, 100, null));
  assert.deepEqual(done.events.map(e => e.partyLevels), [[14, 11, 13], [12, 11, 13], [12, 14, 13], [12, 14, 11], undefined]);
});

test('idempotent: a replayed killing blow, late damage and a re-processed defeat emit nothing new', () => {
  const up = go(bossUp(), hit('pc:dom-1', 6_000)).state;
  const kill = hit('pc:rival-1', 6_000, 120);
  const first = go(up, kill), again = go(up, kill);
  assert.deepEqual(again, first); // the same input gives the same keys, for the server's unique index
  for (const late of [kill, hit('pc:dom-1', 500, 130), hit('pc:new-1', 500, 130)]) {
    const r = go(first.state, late);
    assert.deepEqual([r.events, r.loot, r.state], [[], [], first.state]);
  }
});

test('cooldown: reset is refused before restartSeconds and allowed at it; the next defeat has new keys', () => {
  const first = go(bossUp(), hit('pc:dom-1', 12_000, 100));
  const done = first.state;
  assert.ok(!step(DEF, done, { kind: 'reset', at: 3699 }).ok);
  let s = go(done, { kind: 'reset', at: 3700 }).state;
  assert.deepEqual([s.stage, s.contributors.size, s.health, s.defeats], ['dormant', 0, 12_000, 1]);
  s = go(s, { kind: 'wake', at: 3700 }).state;
  for (let i = 0; i < 12; i++) s = go(s, { kind: 'foe-killed', at: 3701 }).state;
  const second = go(s, hit('pc:dom-1', 12_000, 3800));
  assert.equal(second.events[0]!.id, 'encounter:ash-hound-matriarch:2:pc:dom-1');
  // The progression model, not this module, makes the second kill pay nothing.
  const paid = award(newCareer(10), first.events[0]!);
  assert.equal(paid.reason, 'ok');
  assert.equal(award(paid.state, second.events[0]!).reason, 'already-beaten');
});

test('abandon: everyone leaving drops gathering or a live boss back to dormant with no events', () => {
  const g = go(go(dormant(DEF), { kind: 'wake', at: 0 }).state, { kind: 'foe-killed', at: 1 }).state;
  const up = go(bossUp(), hit('pc:dom-1', 6_000)).state;
  for (const s of [g, up]) {
    const r = go(s, { kind: 'abandon', at: 60 });
    assert.deepEqual([r.state.stage, r.state.kills, r.state.contributors.size, r.events.length], ['dormant', 0, 0, 0]);
  }
});

// A small deterministic generator (no Math.random: a failure must replay).
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
const EDGES: ReadonlySet<string> = new Set([
  'dormant>dormant', 'dormant>gathering', 'gathering>gathering', 'gathering>boss', 'gathering>dormant',
  'boss>boss', 'boss>defeated', 'boss>dormant', 'defeated>defeated', 'defeated>dormant',
]);

test('property: 500 seeded runs — events only on defeat, never duplicated, shares ≤ 100%, no stage skipped', () => {
  const pcs = ['pc:a', 'pc:b', 'pc:c', 'pc:d', 'pc:e', 'pc:f'];
  for (let seed = 1; seed <= 500; seed++) {
    const rnd = lcg(seed), pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
    const seen = new Set<string>();
    let s = dormant(DEF), at = 0;
    for (let n = 0; n < 80; n++) {
      at += Math.floor(rnd() * 900);
      const roll = rnd();
      const action: Action = roll < 0.08 ? { kind: 'wake', at } : roll < 0.4 ? { kind: 'foe-killed', at } : roll < 0.43 ? { kind: 'abandon', at }
        : roll < 0.5 ? { kind: 'reset', at } : hit(pick(pcs), 1 + Math.floor(rnd() * 3_000), at, pick([null, 'p1', 'p2']), 1 + Math.floor(rnd() * 20));
      const r = step(DEF, s, action);
      if (!r.ok) continue;
      const { state, events, loot } = r.value;
      assert.ok(EDGES.has(`${s.stage}>${state.stage}`), `seed ${seed}: ${s.stage} → ${state.stage}`);
      const defeated = s.stage === 'boss' && state.stage === 'defeated';
      if (!defeated) assert.deepEqual([events.length, loot.length], [0, 0], `seed ${seed}: output without a defeat`);
      else assert.ok(events.length >= 1 && events.length === loot.length, `seed ${seed}: a solo-able boss always pays someone`);
      for (const e of events) {
        assert.ok(!seen.has(e.id), `seed ${seed}: duplicate ${e.id}`);
        seen.add(e.id);
      }
      const shares = [...state.contributors.values()].reduce((sum, c) => sum + sharePermille(DEF, c), 0);
      assert.ok(shares <= 1000 && state.health >= 0, `seed ${seed}: shares ${shares}`);
      s = state;
    }
  }
});
