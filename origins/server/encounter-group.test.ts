// The group verifier + payout (origins/server/encounter-group.ts): N streams of one shared-health creature are verified TOGETHER against the server's parameters, then paid per
// docs/specs/combat/threat-list.md "Anti-gank and loot". Records are played the way tests/streams.test.ts plays a group.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decide, initialAi, type AiState } from '../../src/fight/ai.ts';
import { initialPractice } from '../../src/fight/combat.ts';
import { idleIntent, type Duel, type Intent } from '../../src/fight/duel.ts';
import { OPPONENTS, PROFILES, opponentAt, profileAt } from '../../src/fight/moves.ts';
import { startStreams, stepStreams, streamRecordGroup, type StreamGroup } from '../../src/fight/pack.ts';
import { playScaleFor, setLateNotice, setPlayScale } from '../../src/fight/play-radius.ts';
import { RECORD_VERSION, createRecorder, packRecord, unpackRecord, type FightRecord } from '../../src/fight/record.ts';
import { setStab } from '../../src/fight/stab-rule.ts';
import type { EncounterParams } from './encounter-verify.ts';
import { JOIN_MULTIPLIER, verifyEncounterGroup } from './encounter-group.ts';

const foe = OPPONENTS.veteran, LEVEL = 6, profile = profileAt(foe, LEVEL);
const live = () => { setPlayScale(playScaleFor('veteran', RECORD_VERSION)); setLateNotice(true); setStab(true); };
const start = (seed: number) => initialPractice(seed, opponentAt(foe, LEVEL), 'longsword', null);
const driver = (seed: number) => { let ai = initialAi(seed); return (d: Duel): Intent => { if (d.fighters[0].phase === 'sheathed') return { ...idleIntent(), action: 'light' }; const r = decide(d, 0, ai, PROFILES.hard); ai = r.ai; return r.intent; }; };

function playGroup(n: number, opts: { silent?: number[] } = {}) {
  live();
  const seeds = Array.from({ length: n }, (_, k) => 100 + k), starts = seeds.map(start);
  let g: StreamGroup = startStreams(starts.map((p) => p.duel));
  const picks = seeds.map(driver), ai: AiState[] = starts.map((p) => p.ai);
  const recs = seeds.map((seed, i) => createRecorder({ build: 'abc1234', opponent: 'veteran', weapon: 'longsword', level: LEVEL, seed, group: { n, index: i, incoming: [], held: [] } }));
  for (let t = 0; t < 2500 && g.duels.some((d) => !d.finish); t++) {
    const player = g.duels.map((d, i) => (d.finish ? idleIntent() : recs[i]!.push(opts.silent?.includes(i) ? idleIntent() : picks[i]!(d))));
    const foeI = g.duels.map((d, i) => { if (d.finish) return idleIntent(); const r = decide(d, 1, ai[i]!, profile); ai[i] = r.ai; return r.intent; });
    g = stepStreams(g, player, foeI);
  }
  const records: FightRecord[] = recs.map((rec, i) => {
    const d = g.duels[i]!, outcome = !d.finish ? 'abandoned' : d.finish.draw ? 'draw' : d.finish.victim === 1 ? 'killed' : 'died';
    return unpackRecord(packRecord({ ...rec.finish(outcome), group: streamRecordGroup(g, i) }));
  });
  const params: EncounterParams[] = records.map((r) => ({ seed: r.seed, enemy: 'veteran', level: LEVEL, bar: null, flags: [], layer: null }));
  return { g, records, params };
}

test('the join-order multiplier is 1, .5, .25 then .1 for the fourth and every later attacker', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 6].map(JOIN_MULTIPLIER), [1, 0.5, 0.25, 0.1, 0.1, 0.1]);
});

test('three attackers: every stream verifies under the server\'s parameters, shares are damage / creature max health, weights carry the join multiplier, loot goes to the top damage dealer', () => {
  const { g, records, params } = playGroup(3);
  const v = verifyEncounterGroup(records, params);
  assert.equal(v.ok, true, v.ok ? '' : v.reason);
  if (!v.ok) return;
  const bar = g.duels[0]!.fighters[1].maxHealth;
  assert.equal(v.bar, bar);
  assert.equal(v.streams.length, 3);
  v.streams.forEach((s, i) => {
    const dealt = g.logs[i]!.dealt.reduce((a, [, d]) => a + d, 0);
    assert.equal(s.index, i); assert.equal(s.damage, dealt, `stream ${i} damage is recomputed from the replay`);
    assert.equal(s.share, Math.min(1, dealt / bar)); assert.equal(s.multiplier, JOIN_MULTIPLIER(i)); assert.equal(s.weight, s.share * s.multiplier);
  });
  const top = v.streams.reduce((best, s) => (s.damage > best.damage ? s : best), v.streams[0]!);
  assert.equal(v.loot, top.index, 'loot to the most damage, ties to the earlier joiner (reduce keeps the earlier on a tie)');
  assert.notEqual(v.killer, null);
});

test('a forged incoming list is refused for its owner and pays nothing to it', () => {
  const { records, params } = playGroup(3);
  const k = records.findIndex((r) => r.group!.incoming.length > 0), r = records[k]!;
  const forged: FightRecord = { ...r, group: { ...r.group!, incoming: r.group!.incoming.map(([t, a], j) => (j === 0 ? [t, a + 1] as [number, number] : [t, a] as [number, number])) } };
  const v = verifyEncounterGroup(records.map((x, i) => (i === k ? forged : x)), params);
  assert.equal(v.ok, true);
  if (v.ok) { assert.equal(v.streams[k]!.ok, false); assert.equal(v.streams[k]!.weight, 0); assert.match(v.streams[k]!.reason ?? '', /incoming|replay|record/); }
});

test('the server\'s seed wins: a stream played on a seed the server did not issue pays nothing', () => {
  const { records, params } = playGroup(3);
  const v = verifyEncounterGroup(records, params.map((p, i) => (i === 1 ? { ...p, seed: p.seed + 1 } : p)));
  assert.equal(v.ok, true);
  if (v.ok) { assert.equal(v.streams[1]!.ok, false); assert.equal(v.streams[1]!.weight, 0); assert.equal(v.streams[0]!.ok, true); }
});

test('the group must be whole and consistent: a lone record, a repeated index, another n, or params of another creature refuse the lot', () => {
  const { records, params } = playGroup(3);
  assert.equal(verifyEncounterGroup([records[0]!], [params[0]!]).ok, false, 'a lone stream is the ordinary fight');
  assert.equal(verifyEncounterGroup([records[0]!, records[0]!], [params[0]!, params[0]!]).ok, false, 'a repeated stream');
  assert.equal(verifyEncounterGroup(records, params.slice(0, 2)).ok, false, 'params and records differ in length');
  assert.equal(verifyEncounterGroup(records, params.map((p, i) => (i === 2 ? { ...p, enemy: 'knight' } : p))).ok, false, 'one stream names another creature');
  const noGroup = records.map((x) => { const y = { ...x } as Partial<FightRecord>; delete y.group; return y as FightRecord; });
  assert.equal(verifyEncounterGroup(noGroup, params).ok, false, 'records without a group header');
});

test('a withheld sibling costs only its owner: the others are paid on what they dealt, but loot and the killer are not decided without all n', () => {
  const { records, params } = playGroup(3);
  const v = verifyEncounterGroup(records.filter((_, i) => i !== 1), params.filter((_, i) => i !== 1));
  assert.equal(v.ok, true, v.ok ? '' : v.reason);
  if (!v.ok) return;
  assert.deepEqual(v.streams.map((s) => s.index), [0, 2]);
  assert.ok(v.streams.every((s) => s.ok && s.weight > 0));
  assert.equal(v.loot, null); assert.equal(v.killer, null);
});

test('the single-record verifier still refuses a group record on its own', async () => {
  const { records, params } = playGroup(2);
  const { verifyEncounter } = await import('./encounter-verify.ts');
  assert.equal(verifyEncounter(records[0]!, params[0]!).ok, false);
});
