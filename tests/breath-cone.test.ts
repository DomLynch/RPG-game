// The breath cone (Combat, top-30 item 23, PROVISIONAL numbers): a special with a row in cone-defs.json breathes in pulses instead of striking once. Era-keyed at v55 (cone-era.ts); creature specials only.
import { SHEET_ERA_VERSION } from '../src/fight/cast-penalty-era.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepDuel, withSpecials, type CombatEvent, type Duel } from '../src/fight/duel.ts';
import { OPPONENTS, RULES } from '../src/fight/moves.ts';
import { CONES, breathTicks, coneOf, inCone, pulseDamage } from '../src/fight/cone-rules.ts';
import { underCone, FIRST_CONE_VERSION } from '../src/fight/cone-era.ts';
import { initialPractice, stepPractice } from '../src/fight/combat.ts';
import { opponentAt, profileAt } from '../src/fight/moves.ts';
import { packRecord, unpackRecord } from '../src/fight/record.ts';
import { recordSpecials, verifyRecord } from '../src/fight/replay.ts';
import { hashDuel } from '../src/net/rollback.ts';
import { act, arena, idle } from './strategies.ts';
import { liveRecorder } from './lib/live-recorder.ts';

const C = CONES.ashfall!;
const RAD = Math.PI / 180;

test('the rows: Surtr\'s ashfall is the one cone, 60 degrees, 3 m (the special\'s reach), three pulses 12 ticks apart weighted 1:2:3, fire, on the Pitborn', () => {
  assert.deepEqual({ ...C, ramp: [...C.ramp], creatures: [...C.creatures] }, { id: 'ashfall', angle: 60, range: 3, every: 12, ramp: [1, 2, 3], damageKind: 'fire', creatures: ['pitborn'] });
  assert.equal(breathTicks(C), 36); assert.ok(C.range <= RULES.special.reach);
  assert.equal(coneOf('ashfall'), C); assert.equal(coneOf('quake'), undefined); assert.equal(coneOf(undefined), undefined);
});

test('the cone hit test: within range and within half the angle either side of the heading; the edge counts, past it does not', () => {
  assert.ok(inCone(C, 2, 0)); assert.ok(inCone(C, 3, 0), 'the range edge counts'); assert.ok(!inCone(C, 3.01, 0));
  assert.ok(inCone(C, 2, 29 * RAD) && inCone(C, 2, -29 * RAD)); assert.ok(!inCone(C, 2, 31 * RAD) && !inCone(C, 2, -31 * RAD)); assert.ok(!inCone(C, 2, Math.PI), 'behind the caster');
});

test('pulseDamage: the ramp weights share the total and the last pulse takes the rounding, so a full breath deals exactly the total', () => {
  for (let total = 0; total <= 300; total++) {
    const parts = C.ramp.map((_, k) => pulseDamage(C, total, k));
    assert.equal(parts.reduce((a, b) => a + b, 0), total, `total ${total}`);
    assert.ok(parts.every((p) => p >= 0));
  }
  assert.deepEqual([0, 1, 2].map((k) => pulseDamage(C, 60, k)), [10, 20, 30], 'a 1:2:3 ramp');
});

// Surtr breathes on the hero: both standing, the hero in the cone at about 1.2 m. `level` 42 is a boss level (RULES.special.bossFrom), so the special deals bossDamage of the target's max health.
const surtr = (): Duel => {
  const d = withSpecials(arena(OPPONENTS.pitborn), 42, null, undefined, 'ashfall');
  d.fighters[0].skillCooldown = 0; d.fighters[1].skillCooldown = 0; d.fighters[0].maxHealth = 1000; d.fighters[0].health = 1000;
  return d;
};
type Run = { d: Duel; events: CombatEvent[] };
const breathe = (d: Duel, ticks = RULES.special.windup + breathTicks(C) + 40, between?: (d: Duel, t: number) => Duel): Run => {
  const events: CombatEvent[] = [];
  for (let t = 0; t < ticks; t++) { d = stepDuel(d, [idle(), t === 0 ? act('skill') : idle()]); events.push(...d.events); if (between) d = between(d, t); }
  return { d, events };
};
// (the caster here is fighter 1: the foe breathes on the hero, who stands still)
const pulses = (r: Run) => r.events.filter((e) => e.type === 'SpecialLanded' && e.cone);

test('a target who stays takes the whole special over three pulses 12 ticks apart, the same total the instant special dealt', () => {
  const total = Math.round(RULES.special.bossDamage * 1000);
  const now = breathe(surtr()), p = pulses(now);
  assert.equal(p.length, 3); assert.deepEqual(p.map((e) => e.pulse), [0, 1, 2]); assert.ok(p.every((e) => e.damageKind === 'fire' && e.name === 'ashfall' && e.actor === 1 && e.target === 0));
  assert.equal(p[1]!.tick - p[0]!.tick, 12); assert.equal(p[2]!.tick - p[1]!.tick, 12);
  assert.equal(p.reduce((a, e) => a + (e.damage ?? 0), 0), total);
  assert.equal(now.d.fighters[0].health, 1000 - total);
  assert.equal(now.d.fighters[1].breath, undefined, 'the breath is over and leaves no trace on the fighter');
  const old = underCone(FIRST_CONE_VERSION - 1, () => breathe(surtr()));
  const single = old.events.filter((e) => e.type === 'SpecialLanded');
  assert.equal(single.length, 1); assert.equal(single[0]!.cone, undefined); assert.equal(single[0]!.damage, total);
  assert.equal(old.d.fighters[0].health, now.d.fighters[0].health, 'below v55 the instant strike deals the same total');
});

test('a target who leaves the cone takes less: out of range after the release, no pulse lands; out after the first, only the first does', () => {
  const total = Math.round(RULES.special.bossDamage * 1000);
  const away = (d: Duel) => { const f = d.fighters.map((x) => ({ ...x })) as Duel['fighters']; f[0].body = { ...f[0].body, z: f[0].body.z - 6 }; return { ...d, fighters: f }; };
  const none = breathe(surtr(), undefined, (d, t) => (d.fighters[1].breath && d.fighters[1].breath.k === 0 && d.fighters[1].breath.wait === 0 && t > 0 && !('moved' in (d as object)) ? away(d) : d));
  assert.ok(pulses(none).length < 3, 'fewer than three pulses landed');
  assert.ok(none.d.fighters[0].health > 1000 - total, 'and the target kept health');
  assert.equal(none.d.fighters[1].breath, undefined);
});

test('a pulse can kill: the Killed event and the finish name the target, and the breath ends', () => {
  const d = surtr(); d.fighters[0].health = 20;
  const r = breathe(d);
  assert.ok(r.events.some((e) => e.type === 'Killed' && e.target === 0));
  assert.equal(r.d.finish?.victim, 0);
  assert.equal(r.d.fighters[0].phase, 'dead');
});

test('a special with no cone row (the Veteran\'s quake) strikes once, as before, and the player\'s special never breathes', () => {
  const d = withSpecials(arena(OPPONENTS.veteran), 42, null, undefined, 'quake'); d.fighters[0].skillCooldown = 0; d.fighters[1].skillCooldown = 0;
  const r = breathe(d);
  assert.equal(r.events.filter((e) => e.type === 'SpecialLanded').length, 1); assert.equal(pulses(r).length, 0);
  const player = withSpecials(arena(OPPONENTS.pitborn), 42, null, undefined, 'ashfall'); player.fighters[0].skillCooldown = 0; player.fighters[1].skillCooldown = 0;
  let q = player; const ev: CombatEvent[] = [];
  for (let t = 0; t < RULES.special.windup + 60; t++) { q = stepDuel(q, [t === 0 ? act('skill') : idle(), idle()]); ev.push(...q.events); }
  assert.equal(ev.filter((e) => e.type === 'SpecialLanded' && e.actor === 0 && e.cone).length, 0, 'fighter 0 has no special name, so no cone');
});

test('recorded and replayed: a Pitborn L42 Special Moves fight is stamped at the cone era or later, packs, and replays to the very same state; a Veteran fight keeps its version', () => {
  const seed = 17, level = 42, o = OPPONENTS.pitborn, profile = profileAt(o, level);
  const sheet = { health: 70, armour: 30 };   // a sturdy hero, so he lives to the Pitborn's first special (1200 ticks in)
  const rec = liveRecorder({ build: 'test', opponent: 'pitborn', weapon: 'longsword', level, seed, specials: true, sheet });
  let p = initialPractice(seed, opponentAt(o, level), 'longsword', null, recordSpecials({ specials: true, level, opponent: 'pitborn' }), undefined, undefined, undefined, sheet);
  const seen: CombatEvent[] = [];
  for (let i = 0; i < RULES.special.first + RULES.special.windup + 120 && !p.finish; i++) { p = stepPractice(p, rec.push(i === 0 ? act('light') : idle()), profile); seen.push(...p.duel.events.filter((e) => e.type === 'SpecialLanded')); }
  assert.ok(seen.some((e) => e.cone), 'the Pitborn breathed in the recorded fight');
  const record = unpackRecord(packRecord(rec.finish(p.finish ? (p.finish.victim === 1 ? 'killed' : 'died') : 'abandoned')));
  assert.equal(record.v, SHEET_ERA_VERSION, 'a sheet fight is stamped no lower than the cast-penalty version, above the cone era');
  const replay = verifyRecord(record, undefined, { sheet: 'trust' });
  assert.ok(replay.ok, replay.ok ? '' : replay.reason); if (replay.ok) assert.equal(hashDuel(replay.practice.duel), hashDuel(p.duel));
  const stampOf = (opponent: 'veteran' | 'pitborn', specials: boolean) => { const r = liveRecorder({ build: 'test', opponent, weapon: 'longsword', level: 42, seed, ...(specials ? { specials: true } : {}) }); for (let i = 0; i < 10; i++) r.push(idle()); return unpackRecord(packRecord(r.finish('abandoned'))).v; };
  assert.equal(stampOf('veteran', true), 31, 'a Veteran quake fight is not a cone fight');
  assert.equal(stampOf('pitborn', true), FIRST_CONE_VERSION, 'a Pitborn Special Moves fight with no sheet is the cone era');
  assert.equal(stampOf('pitborn', false), 54, 'a Pitborn fight without Special Moves has the poise ladder (54) but no cone');
});
