import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, initialAi, type AiState } from '../src/ai.ts';
import { createFighter, idleIntent, initialDuel, stepDuel, type Duel, type Intent } from '../src/duel.ts';
import { MOVES, PROFILES, RULES, type AiProfile } from '../src/moves.ts';
import { RADIUS, TARGET } from '../src/sim.ts';

const idle = (): Intent => ({ ...idleIntent(), lock: true });
const act = (action: Intent['action']): Intent => ({ ...idle(), action });
const hold = (): Intent => ({ ...idle(), guard: true });
function arena(gap = 1.2): Duel {
  return { tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + gap, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] };
}
// Play the warden through the same stepDuel as the player; `player` scripts the human side from the committed state.
function play(profile: AiProfile, ticks: number, player: (d: Duel) => Intent, start = arena(), seed = 731, immortal = true) {
  let d = start, ai = initialAi(seed); const events: Duel['events'] = [], modes = new Set<string>(); let travelled = 0;
  for (let i = 0; i < ticks; i++) {
    const warden = decide(d, 1, ai, profile); ai = warden.ai;
    const before = d.fighters[1].body;
    d = stepDuel(d, [player(d), warden.intent]);
    travelled += Math.hypot(d.fighters[1].body.x - before.x, d.fighters[1].body.z - before.z);
    events.push(...d.events); modes.add(ai.mode);
    // Keep the observation fight alive on both sides without touching the warden's decisions or resources.
    if (immortal) d = { ...d, finish: null, fighters: [{ ...d.fighters[0], health: 100, stamina: 100, exhausted: false, phase: d.fighters[0].phase === 'dead' ? 'ready' : d.fighters[0].phase }, { ...d.fighters[1], health: 100, phase: d.fighters[1].phase === 'dead' ? 'ready' : d.fighters[1].phase }] };
  }
  return { duel: d, ai, events, modes, travelled };
}
const wardenAttacks = (events: Duel['events']) => events.filter(e => e.type === 'AttackStarted' && e.actor === 1);

test('the warden reacts only after its reaction delay: no defensive input can answer an attack it has not yet noticed', () => {
  for (const [name, profile] of Object.entries(PROFILES)) {
    for (const move of ['light_right', 'heavy_overhead', 'kick'] as const) {
      for (let age = 0; age < profile.reaction; age++) {
        const d = arena();
        d.fighters[0] = { ...d.fighters[0], phase: 'attack', move, age, lastMove: move };
        const ai: AiState = { ...initialAi(), mode: 'circle', decision: 500, wait: 500 };
        const { intent } = decide(d, 1, ai, profile);
        assert.equal(intent.action, null, `${name} ${move} age ${age}`); assert.equal(intent.guard, false, `${name} ${move} age ${age}`);
      }
    }
  }
  const answers = (extra: object, stamina = 100) => { const d = arena(); d.fighters[0] = { ...d.fighters[0], phase: 'attack', move: 'heavy_overhead', age: PROFILES.hard.reaction, lastMove: 'heavy_overhead', ...extra }; d.fighters[1] = { ...d.fighters[1], stamina }; const set = new Set<string>(); for (let k = 1; k < 40; k++) set.add(decide(d, 1, { ...initialAi((k * 2654435761) >>> 0), mode: 'circle', decision: 500, wait: 500 }, PROFILES.hard).ai.plan!); return [...set]; };
  const plain = answers({});
  assert.ok(plain.includes('parry') && plain.includes('dodge') && plain.includes('block'), `a plain heavy is parried, rolled or blocked for chip: ${plain.join(' ')}`);
  assert.ok(!answers({ charge: 1 }).includes('block'), 'a charging heavy will break a guard: never blocked');
  assert.ok(!answers({}, MOVES.heavy_overhead.staminaDamage - 1).includes('block'), 'a block it cannot pay for is never planned');
  // A block already planned is dropped the moment the heavy is seen to charge.
  const seen = arena(); seen.fighters[0] = { ...seen.fighters[0], phase: 'attack', move: 'heavy_overhead', age: PROFILES.hard.reaction + 5, lastMove: 'heavy_overhead', charge: 2 };
  assert.notEqual(decide(seen, 1, { ...initialAi(), mode: 'circle', decision: 500, wait: 500, plan: 'block' }, PROFILES.hard).ai.plan, 'block');
});

test('an unblockable swing it cannot parry or roll is answered with a backstep out of reach', () => {
  const d = arena(1.6); d.fighters[0] = { ...d.fighters[0], phase: 'attack', move: 'heavy_overhead', age: PROFILES.hard.reaction, lastMove: 'heavy_overhead' };
  d.fighters[1] = { ...d.fighters[1], stamina: 25, parryCooldown: 20 };
  const { intent, ai } = decide(d, 1, { ...initialAi(), mode: 'circle', decision: 500, wait: 500 }, { ...PROFILES.hard, parry: 0, dodge: 0 });
  assert.equal(ai.plan, 'evade'); assert.equal(intent.action, 'backstep');
  const after = stepDuel(d, [idle(), intent]);
  assert.equal(after.fighters[1].phase, 'backstep');
});

test('the warden uses the same combat API: its attacks cost stamina, obey range and resolve through the same contact rules', () => {
  const { events, duel } = play(PROFILES.normal, 600, () => idle());
  const first = wardenAttacks(events)[0];
  assert.ok(first, 'a stationary armed player is attacked');
  assert.ok(events.some(e => e.type === 'Hit' && e.actor === 1), 'and hit through the shared blade sweep');
  assert.ok(duel.fighters[1].stamina < 100 || events.some(e => e.type === 'StaminaExhausted' && e.actor === 1));
  let d = arena(6), ai = initialAi();
  for (let i = 0; i < 30; i++) { const w = decide(d, 1, ai, PROFILES.hard); ai = w.ai; d = stepDuel(d, [idle(), w.intent]); }
  assert.ok(!wardenAttacks(d.events).length && d.fighters[1].stamina === 100, 'out of reach it closes distance instead of swinging at air');
});

test('a passive opponent sees a readable opener: at easy and normal the first attack is always a heavy; hard also pressures with lights', () => {
  for (const level of ['easy', 'normal'] as const) for (const seed of [731, 1, 99, 4242]) {
    const { events } = play(PROFILES[level], 2400, () => idle(), arena(), seed);
    const attacks = wardenAttacks(events).filter(e => e.move !== 'kick');
    assert.ok(attacks.length >= 3, `${level} seed ${seed} attacked ${attacks.length} times`);
    assert.ok(attacks.every(e => e.move === 'heavy_overhead'), `${level} seed ${seed}: ${attacks.map(e => e.move).join(' ')}`);
  }
  const hard = wardenAttacks(play(PROFILES.hard, 3600, () => idle()).events);
  assert.ok(hard.some(e => e.move === 'light_right' || e.move === 'light_left'));
});

test('against a settled guard the warden holds its heavy to the charge that breaks it, and releases as soon as it is charged', () => {
  let d = arena(1.5); d.fighters[0] = { ...d.fighters[0], phase: 'guard', age: 30 };
  let ai: AiState = { ...initialAi(), mode: 'approach', decision: 500, wait: 0, next: 'heavy' };
  const first = decide(d, 1, ai, PROFILES.normal); ai = first.ai;
  assert.equal(first.intent.action, 'heavy'); assert.equal(first.intent.heavyHeld, true, 'a heavy at a guard is thrown held');
  d = stepDuel(d, [hold(), first.intent]);
  let charged = 0, released = 0;
  for (let i = 0; i < 120 && d.fighters[1].phase === 'attack'; i++) {
    const w = decide(d, 1, ai, PROFILES.normal); ai = w.ai;
    if (d.fighters[1].charge < RULES.charge.min) assert.equal(w.intent.heavyHeld, true, `held while charging (charge ${d.fighters[1].charge})`); else released++;
    d = stepDuel(d, [hold(), w.intent]); charged += d.events.filter(e => e.type === 'Charged' && e.actor === 1).length;
  }
  assert.equal(charged, 1, 'the hold reaches the charge'); assert.ok(released > 0, 'and lets go once charged'); assert.ok(d.events.length >= 0);
  assert.equal(d.fighters[1].phase, 'ready'); assert.ok(!decide(d, 1, ai, PROFILES.normal).ai.hold, 'the hold ends with the swing');
  // Against an unguarded opponent the same heavy is a plain, faster swing.
  const open = decide({ ...arena(1.5) }, 1, { ...initialAi(), mode: 'approach', decision: 500, wait: 0, next: 'heavy' }, PROFILES.normal).intent;
  assert.equal(open.action, 'heavy'); assert.equal(!!open.heavyHeld, false);
});

test('the warden punishes a whiff with a light and kicks or breaks a standing guard', () => {
  // A cut swung facing away whiffs at any distance, leaving the warden in reach to punish the recovery.
  let d = arena(1.2), ai = initialAi(); const moves: string[] = []; let whiffed = false;
  d.fighters[0] = { ...d.fighters[0], body: { ...d.fighters[0].body, heading: 0 } };
  for (let i = 0; i < 400; i++) { const w = decide(d, 1, ai, PROFILES.normal); ai = w.ai; d = stepDuel(d, [i === 0 ? { ...act('light'), lock: false } : { ...idle(), lock: false }, w.intent]); whiffed ||= d.events.some(e => e.type === 'AttackMissed' && e.actor === 0); for (const e of d.events) if (e.type === 'AttackStarted' && e.actor === 1) moves.push(e.move!); }
  assert.ok(whiffed, 'the scripted light must whiff');
  assert.ok(moves.length && ['light_right', 'light_left'].includes(moves[0]), `whiff punished with ${moves.join(' ')}`);
  const guarded = play(PROFILES.normal, 1800, () => hold()).events;
  const opener = wardenAttacks(guarded)[0];
  assert.ok(opener && (opener.move === 'heavy_overhead' || opener.move === 'kick'), `standing guard is opened with ${opener?.move}`);
  assert.ok(wardenAttacks(guarded).some(e => e.move === 'kick') || guarded.some(e => e.type === 'Charged' && e.actor === 1), 'a standing guard is kicked or charged through');
  assert.ok(guarded.some(e => e.type === 'GuardBroken' && e.target === 1), 'and it does get opened');
  const lights = wardenAttacks(guarded).filter(e => e.move === 'light_right' || e.move === 'light_left');
  for (const e of lights) assert.ok(guarded.some(o => o.tick < e.tick && o.tick > e.tick - 60 && ((o.type === 'Hit' && o.actor === 1) || (o.type === 'AttackStarted' && o.actor === 1 && o.move !== 'kick'))), 'a light against a guarding player only punishes a fresh opening or chains');
});

test('parry frequency follows the profile: a light-spamming player is parried at hard and never by a profile without parries', () => {
  const spam = (d: Duel) => (d.fighters[0].phase === 'ready' ? act('light') : idle());
  const hard = play(PROFILES.hard, 3600, spam).events;
  assert.ok(hard.some(e => e.type === 'Parried' && e.actor === 1), 'hard parries');
  const paced = play(PROFILES.hard, 3600, d => (d.fighters[0].phase === 'ready' && d.tick % 150 === 0 ? act('light') : idle())).events;
  assert.ok(paced.some(e => e.type === 'ActionStarted' && e.action === 'roll' && e.actor === 1), 'hard rolls when it has the stamina');
  const passive = play({ ...PROFILES.hard, parry: 0, dodge: 0 }, 3600, spam).events;
  assert.ok(!passive.some(e => (e.type === 'Parried' || (e.type === 'ActionStarted' && e.action === 'roll')) && e.actor === 1));
  assert.ok(passive.some(e => e.type === 'Blocked' && e.actor === 1), 'without parries it still blocks');
});

test('the warden never idles out of reach: a stationary guarding fighter is attacked at least every eight seconds at every level', () => {
  for (const [name, profile] of Object.entries(PROFILES)) {
    const { events } = play(profile, 3600, () => hold());
    let last = 0, longest = 0;
    for (const e of wardenAttacks(events)) { longest = Math.max(longest, e.tick - last); last = e.tick; }
    longest = Math.max(longest, 3600 - last);
    assert.ok(longest <= 480, `${name} idled ${longest} ticks`);
  }
});

test('the warden moves with seeded, bounded decisions, stays in the arena and waits for the player to draw', () => {
  const { modes, travelled, duel } = play(PROFILES.normal, 2400, () => idle());
  assert.ok(modes.has('approach') && modes.has('circle') && modes.has('guard') && modes.has('retreat'), [...modes].join(' '));
  assert.ok(travelled > 4); assert.ok(Math.hypot(duel.fighters[1].body.x, duel.fighters[1].body.z) <= RADIUS + 1e-9);
  const sheathed = play(PROFILES.hard, 600, () => idle(), initialDuel());
  assert.deepEqual(sheathed.duel.fighters[1].body, initialDuel().fighters[1].body); assert.equal(sheathed.events.length, 0);
});

test('the warden reads only committed state: identical duels decide identically, and pending player input changes nothing', () => {
  const d = arena(); d.fighters[0] = { ...d.fighters[0], phase: 'attack', move: 'light_right', age: 20, lastMove: 'light_right' };
  const a = decide(d, 1, initialAi(), PROFILES.hard), b = decide(d, 1, initialAi(), PROFILES.hard);
  assert.deepEqual(a, b);
  const pending = { ...d, fighters: [{ ...d.fighters[0], buffer: { action: 'heavy' as const, ttl: 9 } }, d.fighters[1]] } as Duel;
  assert.deepEqual(decide(pending, 1, initialAi(), PROFILES.hard).intent, a.intent);
  const frozen = arena(); Object.freeze(frozen); Object.freeze(frozen.fighters); frozen.fighters.forEach(Object.freeze);
  const ai = Object.freeze(initialAi()); decide(frozen, 1, ai, PROFILES.normal);
  assert.deepEqual(ai, initialAi());
});

test('difficulty changes outcomes through reaction, defence and aggression, not through different rules', () => {
  const spam = (d: Duel) => (d.fighters[0].phase === 'ready' ? act('light') : idle());
  const landed = (level: keyof typeof PROFILES) => play(PROFILES[level], 3600, spam).events.filter(e => e.type === 'Hit' && e.target === 1).length;
  const taken = (level: keyof typeof PROFILES) => play(PROFILES[level], 3600, spam).events.filter(e => (e.type === 'Hit' || e.type === 'GuardBroken') && e.target === 0).length;
  const easy = landed('easy'), hard = landed('hard');
  assert.ok(easy > hard, `player lands ${easy} at easy vs ${hard} at hard`);
  assert.ok(taken('hard') >= taken('easy'), 'hard hits back at least as often');
  const levels = Object.values(PROFILES);
  assert.ok(levels.every(p => p.reaction >= 1 && p.parry + p.dodge <= 1 && p.aggression > 0 && p.aggression <= 1));
  for (const id of Object.keys(MOVES)) assert.ok(MOVES[id as keyof typeof MOVES].windup > 0, 'profiles never change move data');
});

test('a landed blow earns a punish window: the warden never counter-attacks the instant its stagger ends', () => {
  // Regression: the cadence timer kept running through the stagger, so the warden swung a poised heavy straight out of a riposte and through the follow-up kick.
  let d = arena(1.2), ai = initialAi(); let staggered = false, staggerEnd = -1, nextAttack = -1;
  for (let i = 0; i < 600 && nextAttack < 0; i++) {
    const w = decide(d, 1, ai, { ...PROFILES.hard, reaction: 999 }); ai = w.ai;   // never notices the swing, so it is hit and staggered
    d = stepDuel(d, [i === 0 ? act('light') : idle(), w.intent]);
    staggered ||= d.events.some(e => e.type === 'Staggered' && e.actor === 1);
    if (staggered && staggerEnd < 0 && d.fighters[1].phase === 'ready') staggerEnd = d.tick;
    if (staggerEnd >= 0 && d.events.some(e => e.type === 'AttackStarted' && e.actor === 1)) nextAttack = d.tick;
  }
  assert.ok(staggerEnd > 0 && nextAttack > staggerEnd + 30, `warden attacked ${nextAttack - staggerEnd} ticks after recovering`);
});
