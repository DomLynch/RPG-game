// SKILL 1, the Witch's arm (docs/briefs/skill-witch-arm.md (a)): the `skill_witchfire` move on the SKILL action, its 900-tick cooldown
// spent at commitment, its refusals, how each defence resolves, and a Witch-fire fight that records, encodes and replays exactly.
// The defender in the scripted exchanges is a plain man with the longsword's guard (duel.ts createFighter defaults), so every number
// below is the rule's own, with no opponent's guard profile or poise folded in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialPractice, stepPractice } from '../src/combat.ts';
import { aim, createFighter, idleIntent, initialDuel, legal, movesOf, stepDuel, timing, type CombatEvent, type Duel, type Intent } from '../src/duel.ts';
import { MOVES, OPPONENTS, PLAYER_WEAPONS, RULES, WEAPONS, type SkillId } from '../src/moves.ts';
import { RECORD_VERSION, createRecorder, decodeRecord, encodeRecord, packRecord, unpackRecord } from '../src/record.ts';
import { verifyRecord } from '../src/replay.ts';
import { peekRecordHeader } from '../src/record-header.ts';

// The caster (side 0) and a longsword man (side 1) a metre apart, facing each other, both ready: inside the cast's 1.2 m cone.
function exchange(skill: SkillId | null = 'witchfire'): Duel {
  const d = initialDuel(OPPONENTS.veteran, 'longsword', skill);
  const foe = createFighter({ ...d.fighters[1].body }, 'ready');
  const p = d.fighters[0];
  p.phase = 'ready';
  p.body = { ...p.body, x: 0, z: -.5 }; foe.body = { ...foe.body, x: 0, z: .5 };
  p.body.heading = aim(p.body, foe.body); foe.body.heading = aim(foe.body, p.body);
  d.fighters[1] = foe;
  return d;
}
// Steps `ticks` ticks; `script(tick)` returns the two intents for the tick about to be stepped (tick = the duel's tick after the step).
function run(d: Duel, ticks: number, script: (tick: number) => [Intent, Intent]) {
  const events: CombatEvent[] = [];
  for (let k = 0; k < ticks; k++) { d = stepDuel(d, script(d.tick + 1)); events.push(...d.events); }
  return { duel: d, events };
}
const cast = (tick: number): Intent => ({ ...idleIntent(), action: tick === 1 ? 'skill' : null });
const CONTACT = 1 + MOVES.skill_witchfire.windup;   // cast on tick 1 (age 0), contact when age reaches the windup

test('skill_witchfire: one shared MoveDef on every weapon, with the brief\'s numbers; no existing move changed', () => {
  const m = MOVES.skill_witchfire;
  assert.deepEqual({ windup: m.windup, active: m.active, recovery: m.recovery, damage: m.damage, stamina: m.stamina, staminaDamage: m.staminaDamage, posture: m.posture, poise: m.poise, poiseFrom: m.poiseFrom, chip: m.chip, parryable: m.parryable, breaksGuard: m.breaksGuard, direction: m.direction, charges: m.charges, chamber: m.chamber, feintUntil: m.feintUntil, stepIn: m.stepIn, reach: m.reach, path: m.path, stagger: m.stagger, knockback: m.knockback },
    { windup: 40, active: 6, recovery: 40, damage: 26, stamina: 40, staminaDamage: 30, posture: 40, poise: 24, poiseFrom: 30, chip: .4, parryable: true, breaksGuard: false, direction: 'thrust', charges: false, chamber: null, feintUntil: 0, stepIn: 0, reach: 1.2, path: null, stagger: 30, knockback: 8 });
  assert.equal(RULES.skillCooldown, 900);
  for (const w of Object.values(WEAPONS)) {
    assert.equal(w.moves.skill_witchfire, m, `${w.id}: the shared entry`);
    assert.equal(timing({ ...createFighter({ x: 0, z: 0, heading: 0, distance: 0 }, 'attack', w.id), move: 'skill_witchfire' }), m, `${w.id}: timing() resolves to the cast's 40/6/40`);
  }
  for (const id of PLAYER_WEAPONS) assert.equal(movesOf({ weapon: id }).skill_witchfire.windup, 40, `${id}: movesOf resolves`);
});

test('skill_witchfire: an unblocked cast lands for 26 on the torso and spends the cooldown at commitment', () => {
  const { duel, events } = run(exchange(), CONTACT, t => [cast(t), idleIntent()]);
  const started = events.filter(e => e.type === 'AttackStarted' && e.actor === 0);
  assert.deepEqual(started.map(e => [e.tick, e.move, e.direction]), [[1, 'skill_witchfire', 'thrust']]);
  const hit = events.find(e => e.type === 'Hit');
  assert.ok(hit, 'the cast landed');
  assert.equal(hit.tick, CONTACT); assert.equal(hit.actor, 0); assert.equal(hit.move, 'skill_witchfire'); assert.equal(hit.location, 'torso');
  assert.equal(hit.damage, 26); assert.equal(hit.counter, false); assert.equal(hit.rear, false);
  assert.equal(duel.fighters[1].health, RULES.health - 26);
  assert.equal(duel.fighters[0].skillCooldown, RULES.skillCooldown - (CONTACT - 1), 'spent on tick 1, ticking down since');
});

test('skill_witchfire: a blocked cast chips 10 (26 × .4 = 10.4, rounded) and costs the blocker 30 stamina', () => {
  const guard = (): Intent => ({ ...idleIntent(), guard: true, guardDirection: 'thrust' });   // the straight guard: a thrust-side cast is met by name
  const { duel, events } = run(exchange(), CONTACT, t => [cast(t), guard()]);
  const blocked = events.find(e => e.type === 'Blocked');
  assert.ok(blocked, 'the cast was blocked');
  assert.equal(blocked.tick, CONTACT); assert.equal(blocked.actor, 1); assert.equal(blocked.target, 0); assert.equal(blocked.move, 'skill_witchfire');
  assert.equal(blocked.perfect, false); assert.equal(blocked.damage, 10); assert.equal(blocked.stamina, 30);
  assert.equal(duel.fighters[1].health, RULES.health - 10);
  assert.equal(duel.fighters[1].stamina, 100 - 30, 'a full bar, less the block');
  assert.equal(events.some(e => e.type === 'Hit'), false);
});

test('skill_witchfire: it is parryable — a parry in window staggers the caster parryStun', () => {
  const press = CONTACT - 5;   // the parry window is 10 ticks: pressed 5 before contact, still open at it
  const parry = (t: number): Intent => ({ ...idleIntent(), guard: t >= press, guardDirection: 'thrust', action: t === press ? 'parry' : null });
  const { duel, events } = run(exchange(), CONTACT, t => [cast(t), parry(t)]);
  const parried = events.find(e => e.type === 'Parried');
  assert.ok(parried, 'the cast was parried');
  assert.equal(parried.tick, CONTACT); assert.equal(parried.actor, 1); assert.equal(parried.target, 0); assert.equal(parried.move, 'skill_witchfire');
  assert.ok(events.some(e => e.type === 'Staggered' && e.actor === 0 && e.ticks === RULES.parryStun));
  assert.equal(duel.fighters[0].phase, 'hurt'); assert.equal(duel.fighters[0].stun, RULES.parryStun);
  assert.equal(duel.fighters[1].health, RULES.health, 'no damage through a parry');
});

test('skill_witchfire: after one cast SKILL is refused for 900 ticks and legal again on the tick the cooldown reaches 0', () => {
  let d = exchange();
  d = stepDuel(d, [cast(1), idleIntent()]);
  assert.equal(d.tick, 1); assert.equal(d.fighters[0].skillCooldown, 900); assert.equal(d.fighters[0].stamina, 100 - 40, 'the 40 stamina, paid on the same tick');
  const lit: number[] = [];
  while (d.tick < 1000) {
    d = stepDuel(d, [idleIntent(), idleIntent()]);
    if (d.tick === 900) assert.equal(d.fighters[0].skillCooldown, 1);
    if (legal(d.fighters[0], 'skill')) lit.push(d.tick);
  }
  assert.equal(lit[0], 901, 'first legal on tick 901: cast on tick 1 + 900');
  assert.equal(d.fighters[0].skillCooldown, 0);
  assert.equal(lit.length, 1000 - 901 + 1, 'and stays legal while nothing else refuses it');
});

test('skill_witchfire: refused under 40 stamina (39 no, 40 yes, all else equal)', () => {
  const p = exchange().fighters[0];
  assert.equal(legal({ ...p, stamina: 39 }, 'skill'), false);
  assert.equal(legal({ ...p, stamina: 40 }, 'skill'), true);
  assert.equal(legal({ ...p, stamina: 40, skillCooldown: 1 }, 'skill'), false, 'cooling');
  assert.equal(legal({ ...p, stamina: 100, exhausted: true }, 'skill'), false, 'exhausted, as a heavy');
  assert.equal(legal({ ...p, phase: 'sheathed' }, 'skill'), false, 'sheathed, as a heavy: the draw comes first');
  assert.equal(legal({ ...p, phase: 'attack', move: 'thrust', age: 0 }, 'skill'), false, 'mid-swing, as a heavy');
});

test('skill_witchfire: refused with no skill equipped; every default fighter and every opponent has none', () => {
  const d = exchange(null), p = d.fighters[0];
  assert.equal(p.skill, null); assert.equal(p.skillCooldown, 0);
  assert.equal(legal(p, 'skill'), false);
  assert.equal(legal({ ...p, skill: 'witchfire' }, 'skill'), true, 'the same fighter with the skill equipped');
  for (const f of initialDuel().fighters) assert.equal(f.skill, null);
  for (const o of Object.values(OPPONENTS)) assert.equal(initialDuel(o).fighters[1].skill, null, `${o.id}: no warden casts`);
  const { events } = run(d, CONTACT, t => [cast(t), idleIntent()]);
  assert.equal(events.some(e => e.type === 'AttackStarted'), false, 'the press does nothing');
});

// A live fight with Witch-fire equipped against the Veteran on his own profile: walk in, draw, cast whenever SKILL is lit.
function witchfireFight(seed = 731, ticks = 6000) {
  const opponent = OPPONENTS.veteran, rec = createRecorder({ weapon: 'longsword', skill: 'witchfire', build: 'skill', opponent: 'veteran', profile: 'normal', seed });
  let practice = initialPractice(seed, opponent, 'longsword', 'witchfire'), casts = 0;
  const log: CombatEvent[] = [];
  for (let t = 0; t < ticks && !practice.finish; t++) {
    const p = practice.duel.fighters[0];
    const action = p.phase === 'sheathed' ? 'light' : legal(p, 'skill') ? 'skill' : t % 60 === 30 ? 'light' : null;
    practice = stepPractice(practice, rec.push({ ...idleIntent(), move: { x: 0, z: .8, yaw: 0, run: false }, action }), opponent.profiles.normal);
    log.push(...practice.events);
    casts += practice.events.filter(e => e.type === 'AttackStarted' && e.actor === 0 && e.move === 'skill_witchfire').length;
  }
  return { record: rec.finish(practice.finish ? (practice.finish.victim === 1 ? 'killed' : 'died') : 'abandoned'), practice, casts, log };
}

test('skill_witchfire: a Witch-fire fight records the skill, round-trips encode/decode, and replays to the identical fight', async () => {
  const { record, practice, casts, log } = witchfireFight();
  assert.ok(casts >= 2, `the player cast ${casts} times`);
  assert.ok(log.some(e => e.actor !== undefined && e.move === 'skill_witchfire' && (e.type === 'Hit' || e.type === 'Blocked' || e.type === 'Parried' || e.type === 'Dodged' || e.type === 'AttackMissed')), 'a cast resolved');
  assert.equal(record.skill, 'witchfire');
  const encoded = await encodeRecord(record), decoded = await decodeRecord(encoded);
  assert.deepEqual(await peekRecordHeader(encoded), { v: RECORD_VERSION, build: 'skill', opponent: 'veteran', weapon: 'longsword', outcome: record.outcome }, 'the retired-link header reader steps over the skill byte');
  assert.deepEqual(decoded, record, 'the skill survives the transport');
  const check = verifyRecord(decoded);
  assert.equal(check.ok, true, check.ok ? '' : check.reason);
  assert.equal(check.practice!.duel.tick, practice.duel.tick);
  assert.deepEqual(check.practice!.duel.fighters, practice.duel.fighters, 'same fighters, bit for bit');
  assert.deepEqual(check.practice!.finish, practice.finish);
  // The same intents stepped WITHOUT the skill are a different fight: the header's skill byte is load-bearing.
  const { skill: _drop, ...naked } = decoded; void _drop;
  const without = verifyRecord(naked);
  assert.ok(!without.ok || JSON.stringify(without.practice.duel.fighters) !== JSON.stringify(practice.duel.fighters));
});

test('record v12: the header carries the skill; none is absent, an unknown skill byte is refused', () => {
  const rec = createRecorder({ weapon: 'longsword', build: 'x', opponent: 'veteran', profile: 'normal', seed: 1 });
  rec.push({ ...idleIntent(), action: 'skill' });
  const naked = rec.finish('abandoned'), bytes = packRecord(naked);
  assert.deepEqual(unpackRecord(bytes), naked, 'no skill: the key stays absent');
  assert.equal(unpackRecord(bytes).intents[0].action, 'skill', 'the SKILL action rides the action column');
  const skilled = packRecord({ ...naked, skill: 'witchfire' });
  assert.equal(unpackRecord(skilled).skill, 'witchfire');
  const at = 3 + 1 + 1 + 1 + 'veteran'.length + 1 + 'longsword'.length;   // magic, version, build 'x', opponent, weapon: then the skill byte
  assert.equal(bytes[at], 0); assert.equal(skilled[at], 1);
  const bad = new Uint8Array(skilled); bad[at] = 3;   // past the table (none, witchfire, pommel)
  assert.throws(() => unpackRecord(bad), /unknown skill/);
});

test('a naked fight is unchanged: the v11 reference fights replay to the same tick and outcome on v12', async () => {
  const { records } = JSON.parse(readFileSync(new URL('./fixtures/fight-records.json', import.meta.url), 'utf8')) as { records: { name: string; encoded: string; expect: { ticks: number; outcome: string; killedTick: number } }[] };
  const V11 = { 'veteran-walk-in': { ticks: 1677, outcome: 'died', killedTick: 1677 }, 'veteran-scripted': { ticks: 1452, outcome: 'died', killedTick: 1452 } } as const;   // pinned from the v11 fixture before this change
  for (const [name, want] of Object.entries(V11)) {
    const entry = records.find(r => r.name === name);
    assert.ok(entry, `${name} is still a reference`);
    assert.deepEqual({ ticks: entry.expect.ticks, outcome: entry.expect.outcome, killedTick: entry.expect.killedTick }, want, `${name}: the regenerated fixture kept the v11 outcome`);
    const record = await decodeRecord(entry.encoded);
    assert.equal(record.skill, undefined, `${name}: no skill equipped`);
    const check = verifyRecord(record);
    assert.equal(check.ok, true, check.ok ? '' : check.reason);
    assert.equal(check.practice!.duel.tick, want.ticks);
  }
});
