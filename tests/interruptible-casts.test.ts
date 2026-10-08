// Interruptible special wind-ups (#1507 item 1, docs/specs/combat/interruptible-windups.md): damage taken while a special counts down cuts it at
// RULES.special.interruptAt of max health. Constructed fights, real blows from the foe, no AI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepDuel, withSpecials, type Action, type CombatEvent, type Duel } from '../src/duel.ts';
import { OPPONENTS, RULES, SPECIAL_ROWS } from '../src/moves.ts';
import { clarityOf } from '../src/combat.ts';
import { RECORD_VERSION, READABLE_VERSIONS, packRecord, unpackRecord } from '../src/record.ts';
import { liveRecorder } from './lib/live-recorder.ts';
import { act, arena, idle } from './strategies.ts';

const S = RULES.special;
const cast = (): Duel => {
  const d = withSpecials(arena(OPPONENTS.veteran), 6, 'shove'); d.fighters[0].skillCooldown = 0; d.fighters[1].skillCooldown = 0;
  return stepDuel(d, [act('skill'), idle()]);
};
type Frame = { tick: number; before: Duel; after: Duel; events: CombatEvent[] };
// The foe swings `action` every `every` ticks while the caster stands still, for `until` ticks.
const fight = (d: Duel, action: Action, every: number, until = S.windup + 10): Frame[] => {
  const frames: Frame[] = [];
  for (let t = 0; t < until && !d.finish; t++) { const before = d; d = stepDuel(d, [idle(), t % every === 0 ? act(action) : idle()]); frames.push({ tick: d.tick, before, after: d, events: d.events }); }
  return frames;
};
const has = (f: Frame[], type: CombatEvent['type'], actor = 0) => f.some(x => x.events.some(e => e.type === type && e.actor === actor));
const hitOn0 = (f: Frame) => f.events.find(e => e.type === 'Hit' && e.target === 0);

test('interrupt: an unhit cast lands on its trunk tick and castHurt never appears on the fighter (same hash stream)', () => {
  const start = cast(), frames = fight(start, 'light', 1e9, 0);
  assert.equal(frames.length, 0);
  const seen: Frame[] = []; let d = start;
  for (let t = 0; t < S.windup + 5; t++) { const before = d; d = stepDuel(d, [idle(), idle()]); seen.push({ tick: d.tick, before, after: d, events: d.events }); assert.equal('castHurt' in d.fighters[0], false); }
  const landed = seen.filter(f => f.events.some(e => e.type === 'SpecialLanded'));
  assert.equal(landed.length, 1);
  assert.equal(landed[0].tick, start.tick + S.windup - 1);
  assert.equal(has(seen, 'SpecialInterrupted'), false);
});

test('interrupt: a hit below interruptAt lands the cast; a hit at or over it cuts it on that tick', () => {
  const max = cast().fighters[0].maxHealth, threshold = S.interruptAt * max;
  const light = fight(cast(), 'light', 1e9, S.windup + 5), lightHit = light.find(hitOn0)!, lightDamage = hitOn0(lightHit)!.damage!;
  assert.ok(lightDamage < threshold, 'a light is below the threshold');
  assert.equal(has(light, 'SpecialInterrupted'), false);
  assert.equal(has(light, 'SpecialLanded'), true);
  assert.equal(lightHit.after.fighters[0].castHurt, lightDamage, 'the hit is counted');

  const heavy = fight(cast(), 'heavy', 1e9, S.windup + 5), cut = heavy.find(f => f.events.some(e => e.type === 'SpecialInterrupted'))!;
  assert.ok(cut, 'a heavy cuts the cast');
  const hit = hitOn0(cut)!;
  assert.ok(hit.damage! >= threshold, 'a heavy is at or over the threshold');
  assert.equal(hit.tick, cut.tick, 'cut on the tick of the blow');
  const f = cut.after.fighters[0];
  assert.deepEqual([f.special, f.castHurt, f.skillCooldown, f.specialRecover ?? 0], [0, undefined, S.interruptCooldown, 0]);
  assert.equal(has(heavy, 'SpecialLanded'), false);
  assert.equal(has(heavy, 'SpecialFizzled'), false);
  assert.equal(heavy.filter(x => x.events.some(e => e.type === 'SpecialInterrupted')).length, 1, 'fires once');
  assert.equal(cut.events.find(e => e.type === 'SpecialInterrupted')!.damage, hit.damage);
});

test('interrupt: the cooldown after a cut is interruptCooldown, ticking down from the cut', () => {
  const frames = fight(cast(), 'heavy', 1e9, 60), cut = frames.findIndex(f => f.events.some(e => e.type === 'SpecialInterrupted'));
  assert.ok(cut >= 0);
  assert.equal(frames[cut].after.fighters[0].skillCooldown, S.interruptCooldown);
  assert.equal(frames[cut + 5].after.fighters[0].skillCooldown, S.interruptCooldown - 5);
});

test('interrupt: two small hits whose sum reaches the threshold cut the cast on the second', () => {
  const frames = fight(cast(), 'light', 40, S.windup + 5), hits = frames.filter(hitOn0);
  assert.ok(hits.length >= 2, 'two lights landed');
  const max = hits[0].before.fighters[0].maxHealth, dmg = (f: Frame) => hitOn0(f)!.damage!;
  assert.ok(dmg(hits[0]) < S.interruptAt * max && dmg(hits[0]) + dmg(hits[1]) >= S.interruptAt * max);
  assert.equal(hits[0].events.some(e => e.type === 'SpecialInterrupted'), false);
  assert.equal(hits[1].events.some(e => e.type === 'SpecialInterrupted'), true);
  assert.equal(frames.filter(f => f.events.some(e => e.type === 'SpecialInterrupted')).length, 1);
});

test('interrupt: a caster who dies fizzles, never interrupts, and castHurt is cleared', () => {
  const d = cast(); d.fighters[0].health = 5;
  const frames = fight(d, 'heavy', 1e9, 60);
  assert.equal(has(frames, 'SpecialFizzled'), true);
  assert.equal(has(frames, 'SpecialInterrupted'), false);
  const end = frames[frames.length - 1].after.fighters[0];
  assert.deepEqual([end.special, end.castHurt], [0, undefined]);
});

test('interrupt: an interruptible: false special is never cut', () => {
  const d = cast(); d.fighters[0].specialName = 'quake';
  SPECIAL_ROWS.quake = { interruptible: false };
  try {
    const frames = fight(d, 'heavy', 30, S.windup + 5);
    assert.equal(frames.some(hitOn0), true, 'he was hit');
    assert.equal(has(frames, 'SpecialInterrupted'), false);
    assert.equal(has(frames, 'SpecialLanded'), true);
    assert.equal(frames.every(f => !('castHurt' in f.after.fighters[0])), true, 'nothing accumulates');
  } finally { delete SPECIAL_ROWS.quake; }
});

test('interrupt: a cast releasing this tick is never cut, and castHurt is cleared by the release', () => {
  const d = cast(); d.fighters[0].special = 1; d.fighters[0].castHurt = 1e6;   // would trip the rule if it ran on a release
  const next = stepDuel(d, [idle(), idle()]);
  assert.equal(next.events.some(e => e.type === 'SpecialInterrupted'), false);
  assert.equal(next.events.some(e => e.type === 'SpecialLanded'), true);
  assert.equal(next.fighters[0].castHurt, undefined);
});

test('clarityOf derives AttackInterrupted from SpecialInterrupted', () => {
  const frames = fight(cast(), 'heavy', 1e9, 60), cut = frames.find(f => f.events.some(e => e.type === 'SpecialInterrupted'))!;
  const cuts = (f: Frame) => clarityOf(f.after, f.before).filter(e => e.type === 'AttackInterrupted');
  assert.deepEqual(cuts(cut).map(e => [e.actor, e.tick]), [[0, cut.tick]]);
  assert.deepEqual(cuts(frames[0]), []);
});

test('record: a specials fight packs and unpacks at the bumped version', () => {
  const rec = liveRecorder({ build: 'interrupt', opponent: 'veteran', weapon: 'longsword', skill: 'pommel', level: 6, seed: 3, specials: true });
  rec.push(idle());
  const back = unpackRecord(packRecord(rec.finish('abandoned')));
  assert.equal(back.specials, true);
  assert.ok((READABLE_VERSIONS as readonly number[]).includes(back.v) && back.v <= RECORD_VERSION);
  assert.equal(RECORD_VERSION, 39);   // N attackers on one creature (39; the header gains a group flag and one byte, only a group stream writes it) stacks on the start pose (38; the header gains a pose flag and five float32, only a posed fight writes it) stacks on the Cinder Bear (37; a new held opponent, no codec change) stacks on the Tusked Boar (36; a new held opponent, no codec change) stacks on the Ash Wolf (35; a new held opponent, no codec change) stacks on stances (34; only a stances fight writes it) stack on the Gambit (33), on patron perks (32; a no-patron fight still writes 31) stack on RV31 (the early spammer read) stacks on RV30 (the three own rows), which stacks on RV29 (the rule batch), which stacks on #1507's 28
});
