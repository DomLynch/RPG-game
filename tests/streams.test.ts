import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, initialAi, type AiState } from '../src/ai.ts';
import { initialPractice } from '../src/combat.ts';
import { idleIntent, stepDuel, type Duel, type Intent } from '../src/duel.ts';
import { crossCheck } from '../src/group-verify.ts';
import { OPPONENTS, PROFILES, opponentAt, profileAt } from '../src/moves.ts';
import { TOKENS, groupKill, startStreams, stepStreams, streamRecordGroup, type StreamGroup } from '../src/pack.ts';
import { playScaleFor, setLateNotice, setPlayScale } from '../src/play-radius.ts';
import { RECORD_VERSION, createRecorder, packRecord, unpackRecord, type FightRecord } from '../src/record.ts';
import { verifyRecord } from '../src/replay.ts';
import { setStab } from '../src/stab-rule.ts';

// RV39: N attackers on one creature, parallel ordinary duels sharing one health pool through Duel.incoming. Players are driven by decide() (the brain a warden uses); each creature copy by its own decide().
const foe = OPPONENTS.veteran, LEVEL = 6, profile = profileAt(foe, LEVEL);
const live = () => { setPlayScale(playScaleFor('veteran', RECORD_VERSION)); setLateNotice(true); setStab(true); };
const start = (seed: number) => initialPractice(seed, opponentAt(foe, LEVEL), 'longsword', null);
const driver = (seed: number) => { let ai = initialAi(seed); return (d: Duel): Intent => { if (d.fighters[0].phase === 'sheathed') return { ...idleIntent(), action: 'light' }; const r = decide(d, 0, ai, PROFILES.hard); ai = r.ai; return r.intent; }; };

test('no incoming is today\'s fight byte for byte; incoming lands once, after the blows, through the same death door', () => {
  live();
  const a = start(1).duel, pick = driver(1);
  let plain: Duel = a, zero: Duel = { ...a, incoming: 0 };
  for (let t = 0; t < 200; t++) { const i = pick(plain); plain = stepDuel(plain, [i, idleIntent()]); zero = stepDuel(zero, [i, idleIntent()]); }
  assert.deepEqual(zero, plain, 'incoming 0 or absent changes nothing');
  const d0 = start(1).duel, max = d0.fighters[1].maxHealth, hit = stepDuel({ ...d0, incoming: 10 }, [idleIntent(), idleIntent()]);
  assert.equal(hit.fighters[1].health, max - 10); assert.deepEqual(hit.events.filter((e) => e.type === 'SharedHit').map((e) => e.damage), [10]);
  assert.equal(hit.incoming, undefined, 'the returned duel does not carry it: it lands once');
  assert.equal(stepDuel(hit, [idleIntent(), idleIntent()]).fighters[1].health, max - 10);
  const dead = stepDuel({ ...d0, incoming: max + 5 }, [idleIntent(), idleIntent()]);
  assert.equal(dead.fighters[1].health, 0); assert.equal(dead.finish?.victim, 1); assert.equal(dead.fighters[1].phase, 'dead');
  assert.ok(dead.events.some((e) => e.type === 'Killed' && e.target === 1));
});

test('a group is 2..7 streams: a lone stream or an 8th is refused', () => {
  live();
  assert.throws(() => startStreams([start(1).duel]), /2\.\.7/);
  assert.throws(() => startStreams(Array.from({ length: 8 }, (_, k) => start(k + 1).duel)), /2\.\.7/);
  assert.equal(startStreams([start(1).duel, start(2).duel]).duels.length, 2);
});

// The live run of a group, recording every stream. `silent[i]`: that attacker has dropped (idle intents, still stepping). Records are built the way a client would: createRecorder per stream, the group header from the layer's log.
function playGroup(n: number, opts: { silent?: number[]; max?: number } = {}) {
  live();
  const seeds = Array.from({ length: n }, (_, k) => 100 + k), starts = seeds.map(start);
  let g: StreamGroup = startStreams(starts.map((p) => p.duel));
  const picks = seeds.map(driver), ai: AiState[] = starts.map((p) => p.ai);
  const recs = seeds.map((seed, i) => createRecorder({ build: 'abc1234', opponent: 'veteran', weapon: 'longsword', level: LEVEL, seed, group: { n, index: i, incoming: [], held: [] } }));
  const steps: number[] = new Array(n).fill(0);
  for (let t = 0; t < (opts.max ?? 2500) && g.duels.some((d) => !d.finish); t++) {
    const player = g.duels.map((d, i) => (d.finish ? idleIntent() : recs[i]!.push(opts.silent?.includes(i) ? idleIntent() : picks[i]!(d))));
    const foeI = g.duels.map((d, i) => { if (d.finish) return idleIntent(); const r = decide(d, 1, ai[i]!, profile); ai[i] = r.ai; return r.intent; });
    g.duels.forEach((d, i) => { if (!d.finish) steps[i]!++; });
    g = stepStreams(g, player, foeI);
  }
  const records: FightRecord[] = recs.map((rec, i) => {
    const d = g.duels[i]!, outcome = !d.finish ? 'abandoned' : d.finish.draw ? 'draw' : d.finish.victim === 1 ? 'killed' : 'died';
    return unpackRecord(packRecord({ ...rec.finish(outcome), group: streamRecordGroup(g, i) }));
  });
  return { g, records };
}

test('the pool law: the creature falls in every stream within one tick of each other, and sooner than a lone attacker could do it', () => {
  const { g } = playGroup(3), lone = (() => { live(); const p = start(100), pick = driver(100); let d = p.duel, ai = p.ai; for (let t = 0; t < 2500 && !d.finish; t++) { const r = decide(d, 1, ai, profile); ai = r.ai; d = stepDuel(d, [pick(d), r.intent]); } return d; })();
  assert.ok(g.duels.every((d) => d.finish?.victim === 1), 'down in every stream');
  const ticks = g.duels.map((d) => d.tick); assert.ok(Math.max(...ticks) - Math.min(...ticks) <= 1, `fell at ${ticks.join(', ')}`);
  assert.ok(lone.finish?.victim !== 1 || Math.max(...ticks) < lone.tick, `three attackers (${Math.max(...ticks)}) beat one (${lone.finish ? lone.tick : 'never'})`);
});

test('every record is self-verifying: each stream replays ALONE from its own incoming list and held spans to the live fight\'s exact final state', () => {
  const { g, records } = playGroup(3);
  records.forEach((r, i) => {
    const v = verifyRecord(r);
    assert.equal(v.ok, true, `stream ${i}: ${v.ok ? '' : v.reason}`);
    assert.deepEqual(v.practice!.duel.fighters, g.duels[i]!.fighters, `stream ${i} ends in the live fight's state`);
    assert.deepEqual(v.practice!.duel.finish, g.duels[i]!.finish);
  });
  assert.ok(records.some((r) => r.group!.incoming.length > 0), 'the siblings\' damage reached the records');
});

test('a withheld record costs only its owner: the others verify alone, and the cross-check marks what only the missing one could prove', () => {
  const { records } = playGroup(7);
  const all = crossCheck(records);
  assert.ok(all.every((c) => c.ok && c.unproven === 0), `all seven present: ${JSON.stringify(all.filter((c) => !c.ok || c.unproven))}`);
  const withheld = records.filter((_, i) => i !== 4), partial = crossCheck(withheld);
  assert.equal(partial.length, 6); assert.ok(partial.every((c) => c.ok), JSON.stringify(partial));
  assert.ok(partial.some((c) => c.unproven > 0), 'stream 4 hit the creature: the others\' incoming includes damage nobody produced a record for');
  for (const r of withheld) assert.equal(verifyRecord(r).ok, true, 'each present record still verifies alone');
});

test('a forged incoming list is caught by the cross-check when the siblings are present', () => {
  const { records } = playGroup(3);
  const k = records.findIndex((r) => r.group!.incoming.length > 0), r = records[k]!;
  const forged: FightRecord = { ...r, group: { ...r.group!, incoming: r.group!.incoming.map(([t, a], j) => (j === 0 ? [t, a + 1] as [number, number] : [t, a] as [number, number])) } };
  const checks = crossCheck(records.map((x, i) => (i === k ? forged : x)));
  assert.equal(checks[k]!.ok, false); assert.match(checks[k]!.reason ?? '', /recorded incoming/);
});

test('seven attackers: only TOKENS copies attack at once, the rest are held IN the sim (recorded, replayed), and there is exactly one kill', () => {
  const { g, records } = playGroup(7);
  assert.equal(TOKENS, 3);
  records.forEach((r, i) => { if (i >= TOKENS) assert.ok(r.group!.held.length > 0 && r.group!.held[0]![0] === 1, `stream ${i} is held from tick 1`); else assert.equal(r.group!.held[0]?.[0] === 1 && r.group!.held[0]![1] > 100, false); });
  records.slice(TOKENS).forEach((r) => { assert.equal(verifyRecord(r).ok, true, 'a held copy replays from its recorded hold'); });
  const kill = groupKill(g)!; assert.notEqual(kill, null, 'the running total reached the bar');
  const bar = g.duels[0]!.fighters[1].maxHealth, hits = g.logs.flatMap((l, index) => l.dealt.map(([tick, damage]) => ({ tick, index, damage }))).sort((x, y) => x.tick - y.tick || x.index - y.index);
  let total = 0, expect = -1; for (const h of hits) { total += h.damage; if (total >= bar) { expect = h.index; break; } }
  assert.equal(kill, expect, 'one kill: the hit that crossed zero, same-tick hits in join order');
  assert.ok(g.duels.every((d) => d.finish?.victim === 1), 'and the creature is down in every copy');
});

test('a dropped attacker keeps stepping with idle intents and is never removed from the group', () => {
  const { g, records } = playGroup(3, { silent: [1] });
  assert.equal(g.duels.length, 3); assert.ok(g.duels.every((d) => d.finish), 'the creature still fell');
  assert.ok(records.every((r) => verifyRecord(r).ok));
});
