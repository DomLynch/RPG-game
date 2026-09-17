import test from 'node:test';
import assert from 'node:assert/strict';
import { READ, decide, initialAi, readOpponent, type AiState, type Habits, type Reads } from '../src/ai.ts';
import { createFighter, elapsed, idleIntent, initialDuel, stepDuel, type Duel, type Intent } from '../src/duel.ts';
import { MOVES, PROFILES, RULES, type AiProfile } from '../src/moves.ts';
import { RADIUS, TARGET } from '../src/sim.ts';

const HP = RULES.health;   // fighters start at RULES.health; the numbers below are written against it
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
    if (immortal) d = { ...d, finish: null, fighters: [{ ...d.fighters[0], health: HP, stamina: 100, exhausted: false, phase: d.fighters[0].phase === 'dead' ? 'ready' : d.fighters[0].phase }, { ...d.fighters[1], health: HP, phase: d.fighters[1].phase === 'dead' ? 'ready' : d.fighters[1].phase }] };
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
  assert.ok(answers({ move: 'light_right', lastMove: 'light_right', charge: 2, age: PROFILES.hard.reaction - 2 }).includes('block'), 'a chambered light is only a bait: still blockable');   // perception reads age + charge
  const baited = arena(); baited.fighters[0] = { ...baited.fighters[0], phase: 'attack', move: 'light_right', age: PROFILES.hard.reaction + 3, lastMove: 'light_right', charge: 2 };
  assert.equal(decide(baited, 1, { ...initialAi(), mode: 'circle', decision: 500, wait: 500, plan: 'block' }, PROFILES.hard).ai.plan, 'block', 'and a planned block is kept');
  assert.ok(!answers({}, MOVES.heavy_overhead.staminaDamage - 1).includes('block'), 'a block it cannot pay for is never planned');
  // A block already planned is dropped the moment the heavy is seen to charge.
  const seen = arena(); seen.fighters[0] = { ...seen.fighters[0], phase: 'attack', move: 'heavy_overhead', age: PROFILES.hard.reaction + 3, lastMove: 'heavy_overhead', charge: 2 };
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

test('a passive opponent sees a readable opener: at easy and normal the first attack is always a heavy, later ones heavy or thrust; hard also pressures with lights', () => {
  let thrusts = 0, openers = 0;
  for (const level of ['easy', 'normal'] as const) for (const seed of [731, 1, 99, 4242]) {
    const { events } = play(PROFILES[level], 2400, () => idle(), arena(), seed);
    const attacks = wardenAttacks(events).filter(e => e.move !== 'kick');
    assert.ok(attacks.length >= 3, `${level} seed ${seed} attacked ${attacks.length} times`);
    assert.equal(attacks[0].move, 'heavy_overhead', `${level} seed ${seed}: the first opener is the readable heavy`);
    // The immortal observation fight resets health but not posture, so a passive player's posture eventually breaks; the break's window is finished with the
    // critical, or with the riposte when the warden cannot afford a heavy — the only other moves allowed.
    // …and the break's window is followed up (a punish light into the long stagger). Judge the openers: attacks not within 120 ticks after a critical or riposte.
    let finisherAt = -999; const openersOnly = attacks.filter(e => { if (e.move === 'critical' || e.move === 'riposte') { finisherAt = e.tick; return false; } return e.tick - finisherAt > 120; });
    assert.ok(openersOnly.every(e => e.move === 'heavy_overhead' || e.move === 'thrust'), `${level} seed ${seed}: ${attacks.map(e => e.move).join(' ')}`);
    thrusts += attacks.filter(e => e.move === 'thrust').length; openers += attacks.length - 1;
  }
  assert.ok(thrusts / openers >= .07 && thrusts / openers <= .35, `thrusts are a real but minority opener (20 % of non-light openers; the thrust's job is the stop-hit): ${thrusts}/${openers}`);
  const hard = wardenAttacks(play(PROFILES.hard, 3600, () => idle()).events);
  assert.ok(hard.some(e => e.move === 'light_right' || e.move === 'light_left'));
});

test('against a settled guard the warden holds its heavy to the charge that breaks it, and releases as soon as it is charged', () => {
  const guardedArena = () => { const d = arena(1.5); d.fighters[0] = { ...d.fighters[0], phase: 'guard', age: 30 }; return d; };
  const fresh = (seed: number): AiState => ({ ...initialAi(seed), mode: 'approach', decision: 500, wait: 0, next: 'heavy' });
  // How often the guard is charged through follows aggression: at normal some heavies at a guard are plain, at hard nearly all are held.
  const holds = (level: keyof typeof PROFILES) => [...Array(40).keys()].map(seed => decide(guardedArena(), 1, fresh(seed + 1), PROFILES[level])).filter(w => (assert.equal(w.intent.action, 'heavy'), w.intent.held)).length;
  assert.ok(holds('normal') >= 8 && holds('normal') <= 26, `normal holds ${holds('normal')}/40`); assert.ok(holds('hard') > holds('easy'), `hard ${holds('hard')} > easy ${holds('easy')}`);
  let d = guardedArena(), ai = fresh(1); let first = decide(d, 1, ai, PROFILES.normal);
  for (let seed = 2; !first.intent.held; seed++) { ai = fresh(seed); first = decide(d, 1, ai, PROFILES.normal); }
  ai = first.ai; assert.equal(first.intent.action, 'heavy'); assert.equal(first.intent.held, true, 'a heavy at a guard is thrown held');
  d = stepDuel(d, [hold(), first.intent]);
  let charged = 0, released = 0;
  for (let i = 0; i < 120 && d.fighters[1].phase === 'attack'; i++) {
    const w = decide(d, 1, ai, PROFILES.normal); ai = w.ai;
    if (d.fighters[1].charge < RULES.charge.min) assert.equal(w.intent.held, true, `held while charging (charge ${d.fighters[1].charge})`); else released++;
    d = stepDuel(d, [hold(), w.intent]); charged += d.events.filter(e => e.type === 'Charged' && e.actor === 1).length;
  }
  assert.equal(charged, 1, 'the hold reaches the charge'); assert.ok(released > 0, 'and lets go once charged'); assert.ok(d.events.length >= 0);
  assert.equal(d.fighters[1].phase, 'ready'); assert.ok(!decide(d, 1, ai, PROFILES.normal).ai.hold, 'the hold ends with the swing');
  // Against an unguarded opponent the same heavy is a plain, faster swing.
  const open = decide({ ...arena(1.5) }, 1, { ...initialAi(), mode: 'approach', decision: 500, wait: 0, next: 'heavy' }, PROFILES.normal).intent;
  assert.equal(open.action, 'heavy'); assert.equal(!!open.held, false);
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
  assert.ok(guarded.some(e => e.type === 'GuardBroken' && e.actor === 1 && e.target === 0), 'and it does get opened');
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

test('posture: a shaky warden gives ground so its bar drains, and finishes a broken player with the critical rather than a riposte', () => {
  const shaky = arena(1.3); shaky.fighters[1] = { ...shaky.fighters[1], posture: RULES.posture.max * .8 };
  const play = (start: Duel) => { const modes = new Set<string>(); let d = start, ai = { ...initialAi(), decision: 0, wait: 500 }; for (let i = 0; i < 45; i++) { const w = decide(d, 1, ai, PROFILES.normal); ai = w.ai; modes.add(ai.mode); d = stepDuel(d, [idle(), w.intent]); } return { modes, gap: Math.hypot(d.fighters[0].body.x - d.fighters[1].body.x, d.fighters[0].body.z - d.fighters[1].body.z) }; };
  const near = play(shaky), calm = play(arena(1.3));
  assert.ok(near.gap > 1.3 && !near.modes.has('approach') && (near.modes.has('retreat') || near.modes.has('circle')), `near a break it gives ground while the bar is high: gap ${near.gap.toFixed(2)} modes ${[...near.modes].join(' ')}`);   // 45 ticks: 80 → 71, still shaky
  assert.ok(calm.gap < near.gap, `with a clear bar it stays closer: ${calm.gap.toFixed(2)} vs ${near.gap.toFixed(2)}`);
  const broken = arena(1.5); broken.fighters[0] = { ...broken.fighters[0], phase: 'hurt', stun: RULES.posture.stun, age: PROFILES.normal.reaction + 1 }; broken.fighters[1] = { ...broken.fighters[1], critical: RULES.posture.stun, punish: RULES.posture.stun };
  const w = decide(broken, 1, { ...initialAi(), decision: 500, wait: 500 }, PROFILES.normal);
  assert.equal(w.intent.action, 'heavy', 'Heavy in the critical window'); assert.equal(stepDuel(broken, [idle(), w.intent]).fighters[1].move, 'critical');
});

test('reads: habits become reads only with evidence, at the documented thresholds', () => {
  const h = (o: Partial<Habits>): Habits => ({ ticks: 0, guard: 0, parries: 0, rolls: 0, lights: 0, heavies: 0, thrusts: 0, attacks: 0, parks: 0, ...o });
  assert.deepEqual(readOpponent(h({})), { parryHappy: false, turtle: false, roller: false, spammer: false, parker: false });
  assert.equal(readOpponent(h({ attacks: 1, parries: 1 })).parryHappy, false, 'one swing is not evidence'); assert.equal(readOpponent(h({ attacks: 2, parries: 1 })).parryHappy, true, 'two exchanges, half parried'); assert.equal(readOpponent(h({ attacks: 4, parries: 1 })).parryHappy, false);
  assert.equal(readOpponent(h({ ticks: 179, guard: 179 })).turtle, false); assert.equal(readOpponent(h({ ticks: 180, guard: 81 })).turtle, true); assert.equal(readOpponent(h({ ticks: 180, guard: 80 })).turtle, false);
  assert.equal(readOpponent(h({ attacks: 5, rolls: 2 })).roller, true); assert.equal(readOpponent(h({ attacks: 5, rolls: 1 })).roller, false);
  assert.equal(readOpponent(h({ lights: 1, parks: 1 })).parker, false, 'one park is not evidence'); assert.equal(readOpponent(h({ lights: 2, parks: 1 })).parker, true, 'two swings, half of them parked'); assert.equal(readOpponent(h({ lights: 3, heavies: 1, parks: 1 })).parker, false);
  assert.equal(readOpponent(h({ lights: 8, heavies: 3 })).spammer, true); assert.equal(readOpponent(h({ lights: 8, heavies: 2 })).spammer, false, 'eleven swings needed'); assert.equal(readOpponent(h({ lights: 7, heavies: 4 })).spammer, false);
  assert.equal(readOpponent(h({ lights: 7, thrusts: 4 })).spammer, false, 'thrusts are a mix, not spam'); assert.equal(readOpponent(h({ lights: 8, thrusts: 3 })).spammer, true);
});

test('the warden adapts: a turtle is kicked and charged through more; a light-spammer is parried more; a roller sees delayed swings and tail punishes; a parrier gets baited lights', () => {
  // Manual play that also sees the read at the moment of each decision.
  const watch = (profile: AiProfile, ticks: number, player: (d: Duel) => Intent, seed = 731) => {
    let d = arena(), ai = initialAi(seed); const log: { tick: number; type: string; move?: string; actor: number; read: Reads; f: Duel['fighters'][0]; m: Duel['fighters'][1] }[] = [];
    for (let i = 0; i < ticks; i++) {
      const read = readOpponent(ai.habits), before = d.fighters[0], mine = d.fighters[1];
      const w = decide(d, 1, ai, profile); ai = w.ai; d = stepDuel(d, [player(d), w.intent]);
      for (const e of d.events) log.push({ tick: d.tick, type: e.type, move: e.move, actor: e.actor, read, f: before, m: mine });
      d = { ...d, finish: null, fighters: [{ ...d.fighters[0], health: HP, stamina: 100, exhausted: false, posture: 0, phase: d.fighters[0].phase === 'dead' ? 'ready' : d.fighters[0].phase }, { ...d.fighters[1], health: HP, stamina: 100, posture: 0, phase: d.fighters[1].phase === 'dead' ? 'ready' : d.fighters[1].phase }] };
    }
    return { log, habits: ai.habits };
  };
  const starts = (log: ReturnType<typeof watch>['log']) => log.filter(e => e.type === 'AttackStarted' && e.actor === 1);
  // Turtle: hold guard. After the read, kicks are the main opener (four in five decisions at point-blank) and heavies are mostly charged.
  const turtle = watch(PROFILES.normal, 2400, () => hold());
  assert.ok(readOpponent(turtle.habits).turtle, 'turtle read');
  const late = starts(turtle.log).filter(e => e.read.turtle), kicks = late.filter(e => e.move === 'kick').length, heavies = late.filter(e => e.move === 'heavy_overhead').length;
  assert.ok(kicks + heavies >= 6, `enough openers after the read: ${kicks} kicks, ${heavies} heavies`);
  assert.ok(kicks / (kicks + heavies) >= .6, `kicks lead against a turtle: ${kicks}/${kicks + heavies}`);
  // Only a plain heavy can charge (a chained follow-up after a punish light never does), so judge the charge rate on plain heavies.
  const plainHeavies = late.filter(e => e.move === 'heavy_overhead' && e.m.chain === 0).length, held = turtle.log.filter(e => e.type === 'Charging' && e.actor === 1 && e.move === 'heavy_overhead' && e.read.turtle).length;
  assert.ok(plainHeavies === 0 || held / plainHeavies >= .5, `plain heavies at a turtle are charged: ${held}/${plainHeavies}`);
  // The charge boost itself, over 40 seeds from the same state: a heavy thrown at an unguarded opponent is held only with a roller read, and then most of the time.
  const roller = (dd: Duel) => (dd.fighters[1].phase === 'attack' && dd.fighters[1].age === 0 && dd.fighters[0].phase === 'ready' ? act('dodge') : idle());
  const heldShare = (habits: Partial<Habits>) => { const throws = [...Array(40).keys()].map(seed => decide(arena(1.5), 1, { ...initialAi(seed + 1), mode: 'approach', decision: 500, wait: 0, next: 'heavy', habits: { ticks: 600, guard: 0, parries: 0, rolls: 0, lights: 0, heavies: 0, thrusts: 0, attacks: 0, ...habits } }, PROFILES.normal).intent).filter(i => i.action === 'heavy'); return { thrown: throws.length, held: throws.filter(i => i.held).length }; };
  const calm = heldShare({}), vsRoller = heldShare({ attacks: 5, rolls: 3 });
  assert.ok(calm.thrown >= 20 && calm.held === 0, `no read, no guard: a heavy is never held (${calm.held}/${calm.thrown})`); assert.ok(vsRoller.thrown >= 20 && vsRoller.held / vsRoller.thrown >= .65, `with a roller read most heavies are held: ${vsRoller.held}/${vsRoller.thrown}`);
  // Spammer: cuts whenever ready. Normal parries 30 % of noticed swings; doubled it plans a parry for most of a spammer's cuts — and a read
  // spammer's cuts are anticipated (planned at READ.anticipate ticks, not the profile's reaction), which is what makes the parry of a 14-tick cut possible.
  let plansAfter = 0, parriesAfter = 0, plansAtReaction = 0, d = arena(), ai = initialAi();
  for (let i = 0; i < 3000; i++) {
    const w = decide(d, 1, ai, PROFILES.normal); const spam = readOpponent(ai.habits).spammer, at = spam ? Math.min(PROFILES.normal.reaction, READ.anticipate) : PROFILES.normal.reaction;
    const planned = d.fighters[0].phase === 'attack' && d.fighters[0].age === at && w.ai.plan && w.ai.plan !== 'ignore';
    if (spam && d.fighters[0].phase === 'attack' && d.fighters[0].age === PROFILES.normal.reaction && w.ai.plan && !ai.plan) plansAtReaction++;
    if (planned && readOpponent(ai.habits).spammer) { plansAfter++; if (w.ai.plan === 'parry') parriesAfter++; }
    ai = w.ai; d = stepDuel(d, [d.fighters[0].phase === 'ready' ? act('light') : idle(), w.intent]);
    d = { ...d, finish: null, fighters: [{ ...d.fighters[0], health: HP, stamina: 100, exhausted: false, posture: 0, phase: d.fighters[0].phase === 'dead' ? 'ready' : d.fighters[0].phase }, { ...d.fighters[1], health: HP, stamina: 100, posture: 0, phase: d.fighters[1].phase === 'dead' ? 'ready' : d.fighters[1].phase }] };
  }
  assert.ok(readOpponent(ai.habits).spammer, 'spammer read'); assert.ok(plansAfter >= 8, `enough plans after the read: ${plansAfter}`); assert.equal(plansAtReaction, 0, 'after the read no cut is first planned at the slow reaction');
  assert.ok(parriesAfter / plansAfter >= .45, `parry plans after the read: ${parriesAfter}/${plansAfter}`);
  // Roller: a panic roller — rolls every 70 ticks whether or not a swing is coming, and at every swing. Only after the read does the warden start a swing while the
  // player is in a roll's tail (it is free to, because those rolls were not answers to its own swings), and hold heavies although nobody is guarding.
  // Rolls go toward the ring's centre: a roller that always rolled away would end up pinned on the wall (slice Q), which is a different lesson.
  const inward = (dd: Duel): Intent['move'] => { const b = dd.fighters[0].body, r = Math.hypot(b.x, b.z) || 1; return { x: -b.x / r, z: -b.z / r, yaw: 0, run: false }; };
  const panic = (dd: Duel) => (dd.fighters[0].phase === 'ready' && ((dd.fighters[1].phase === 'attack' && dd.fighters[1].age === 0) || dd.tick % 70 === 0) ? { ...act('dodge'), move: inward(dd) } : idle());
  const rolled = watch(PROFILES.normal, 3000, panic);
  assert.ok(readOpponent(rolled.habits).roller, 'roller read');
  const tailStarts = starts(rolled.log).filter(e => e.f.phase === 'roll' && e.f.age >= RULES.safeEnd);
  const tailAfter = tailStarts.filter(e => e.read.roller).length, tailBefore = tailStarts.filter(e => !e.read.roller).length;   // a scheduled swing can coincide with a roll by chance; the punish makes it systematic
  assert.ok(tailAfter >= 5 && tailAfter >= 5 * tailBefore, `tail punishes come with the read: ${tailAfter} after, ${tailBefore} before`);
  // Parrier: press parry as each swing starts. Lights get held as baits only once the read fires; before it no light is ever held.
  const parrier = watch(PROFILES.hard, 3600, dd => (dd.fighters[1].phase === 'attack' && dd.fighters[1].age === 4 && dd.fighters[0].phase === 'ready' ? { ...act('parry'), guard: true } : idle()));
  assert.ok(readOpponent(parrier.habits).parryHappy, 'parry-happy read');
  const baits = parrier.log.filter(e => e.type === 'Charging' && e.actor === 1 && e.move !== 'heavy_overhead');
  assert.ok(baits.some(e => e.read.parryHappy) && !baits.some(e => !e.read.parryHappy), `baited lights only after the read: ${baits.length}`);
  // A neutral player triggers no read at all.
  assert.deepEqual(readOpponent(watch(PROFILES.normal, 2400, () => idle()).habits), { parryHappy: false, turtle: false, roller: false, spammer: false, parker: false });
});

test('the thrust: a minority opener planned only after the first heavy, thrown from wherever it stands (no walk-back), never into a guard — and the stop-hit into an opponent walking onto the point', () => {
  const fresh = (seed: number, extra: Partial<AiState>): AiState => ({ ...initialAi(seed), mode: 'approach', decision: 500, wait: 0, next: null, ...extra });
  // Seeds are spread with a multiplicative hash: consecutive small seeds give near-identical first draws from the LCG.
  const planned = (level: keyof typeof PROFILES, attacks: number) => [...Array(40).keys()].map(seed => decide(arena(2.4), 1, fresh(((seed + 1) * 2654435761) >>> 0, { habits: { ...initialAi().habits, attacks } }), PROFILES[level]).ai.next);
  for (const level of ['easy', 'normal', 'hard'] as const) {
    assert.ok(!planned(level, 0).includes('thrust'), `${level}: no thrust before the first heavy has shown the timing`);
    const share = planned(level, 1).filter(n => n === 'thrust').length;
    assert.ok(share >= (level === 'hard' ? 2 : 4) && share <= 16, `${level}: thrust is a minority opener: ${share}/40`);
  }
  // No walk-back: with a thrust planned the warden throws it from wherever it stands, close or at range; into a guard it never does.
  const close = decide(arena(1.2), 1, fresh(1, { next: 'thrust' }), PROFILES.normal);
  assert.equal(close.intent.action, 'thrust', 'thrown from inside cutting range too'); assert.notEqual(close.ai.mode, 'retreat', 'no stepping back to thrust range');
  const ranged = decide(arena(1.7), 1, fresh(1, { next: 'thrust' }), PROFILES.normal);
  assert.equal(ranged.intent.action, 'thrust'); assert.equal(stepDuel(arena(1.7), [idle(), ranged.intent]).fighters[1].move, 'thrust');
  const g = arena(1.85); g.fighters[0] = { ...g.fighters[0], phase: 'guard', age: 30 };   // beyond heavy reach, inside thrust reach: only the thrust could be thrown, and it must not be
  assert.equal(decide(g, 1, fresh(1, { next: 'thrust' }), PROFILES.normal).intent.action, null, 'never into a standing guard');
  // In a fight: a player who guards for 1.5 s then opens for 1.5 s sees thrusts, all from 1.5 m or further.
  let d = arena(2.4), ai = initialAi(); const gaps: number[] = [];
  for (let i = 0; i < 4800; i++) {
    const gap = Math.hypot(d.fighters[0].body.x - d.fighters[1].body.x, d.fighters[0].body.z - d.fighters[1].body.z);
    const w = decide(d, 1, ai, PROFILES.normal); ai = w.ai; d = stepDuel(d, [{ ...idle(), guard: Math.floor(d.tick / 90) % 2 === 0 }, w.intent]);
    for (const e of d.events) if (e.type === 'AttackStarted' && e.actor === 1 && e.move === 'thrust') gaps.push(gap);
    d = { ...d, finish: null, fighters: [{ ...d.fighters[0], health: HP, stamina: 100, exhausted: false, posture: 0, phase: d.fighters[0].phase === 'dead' ? 'ready' : d.fighters[0].phase }, { ...d.fighters[1], health: HP, stamina: 100, posture: 0, phase: d.fighters[1].phase === 'dead' ? 'ready' : d.fighters[1].phase }] };
  }
  assert.ok(gaps.length >= 1, `thrusts are thrown: ${gaps.map(g => g.toFixed(2)).join(' ')}`);   // sanity only; the rules are pinned above
  // The stop-hit: with an attack due (cadence expired) and the opponent walking in from 2.2 m, the attack becomes the thrust and lands as a stop-hit.
  const walker = (): Intent => ({ ...idle(), move: { x: 0, z: -1, yaw: 0, run: false } });   // keeps walking onto the point
  let s = arena(2.2), sa: AiState = fresh(3, { wait: 0, next: null, habits: { ...initialAi().habits, attacks: 1 } }); const stops: string[] = [];
  for (let i = 0; i < 90; i++) { const w = decide(s, 1, sa, PROFILES.normal); sa = w.ai; s = stepDuel(s, [walker(), w.intent]); for (const e of s.events) { if (e.type === 'AttackStarted' && e.actor === 1) stops.push(e.move!); if (e.type === 'Hit' && e.actor === 1 && e.stop) stops.push('STOP'); } }
  assert.ok(stops[0] === 'thrust' && stops.includes('STOP'), `the walker is stop-hit: ${stops.join(' ')}`);
  const stopHit = s.events.find(e => e.type === 'Hit' && e.stop) ?? null; void stopHit;
});

test('perception runs on elapsed time: a heavy parked at its chamber is noticed and answered on the normal reaction clock', () => {
  // The player holds a heavy at the chamber (age 10) from 1.6 m. The animation clock stops; elapsed time does not, so the normal warden plans at 14 elapsed ticks.
  let d = arena(1.6), ai = initialAi(); d = stepDuel(d, [{ ...act('heavy'), held: true }, idle()]); let plannedAt: number | null = null;
  for (let i = 1; i <= 40 && plannedAt === null; i++) { const w = decide(d, 1, { ...ai, mode: 'circle', decision: 500, wait: 500 }, { ...PROFILES.normal, lapse: 0 }); ai = w.ai; if (ai.plan && ai.plan !== 'ignore') plannedAt = elapsed(d.fighters[0]); d = stepDuel(d, [{ ...idle(), held: true }, w.intent]); }
  assert.equal(d.fighters[0].age, MOVES.heavy_overhead.chamber!, 'still parked'); assert.equal(plannedAt, PROFILES.normal.reaction, `planned at elapsed ${plannedAt}`);
  // And it acts on the plan while the swing is still parked: a blocker raises its guard against a held heavy instead of waiting for the release.
  let e = arena(1.6), bi = initialAi(); e = stepDuel(e, [{ ...act('heavy'), held: true }, idle()]); let guardedAt: number | null = null;
  for (let i = 1; i <= 30 && guardedAt === null; i++) { const w = decide(e, 1, { ...bi, mode: 'circle', decision: 500, wait: 500 }, { ...PROFILES.normal, parry: 0, dodge: 0, lapse: 0 }); bi = w.ai; if (w.intent.guard) guardedAt = elapsed(e.fighters[0]); e = stepDuel(e, [{ ...idle(), held: true }, w.intent]); }
  assert.equal(e.fighters[0].age, MOVES.heavy_overhead.chamber!, 'still parked'); assert.ok(guardedAt !== null && guardedAt <= PROFILES.normal.reaction + 1, `guard up at elapsed ${guardedAt}, while parked`);
});

test('fairness pass: the warden uses its own tools against pressure — the guard counter after a block, the punish of a whiffed parry, a guard walk (never a slow opener, never a standing wait) into a read spammer, and feints at a parrier', () => {
  const state = (o: Partial<AiState>): AiState => ({ ...initialAi(5), mode: 'approach', decision: 500, wait: 500, ...o });
  const spam: Partial<Habits> = { ticks: 600, lights: 12, heavies: 0, thrusts: 0, attacks: 6, guard: 0, parries: 0, rolls: 0 };
  // Guard counter: a warden inside its counter window with the player in reach throws the heavy (heavy_counter is what the sim makes of a Heavy pressed in that window).
  const countering = arena(1.4); countering.fighters[1] = { ...countering.fighters[1], phase: 'guard', counterWindow: RULES.guardCounter - 2 };
  const counter = decide(countering, 1, state({}), PROFILES.normal);
  assert.equal(counter.intent.action, 'heavy', `guard counter thrown: ${JSON.stringify(counter.ai.scores)}`);
  // Whiffed parry: an exposed player is an opening, punished with the light even with no cadence pending.
  const exposed = arena(1.4); exposed.fighters[0] = { ...exposed.fighters[0], phase: 'ready', exposed: 6 };
  assert.equal(decide(exposed, 1, state({}), PROFILES.normal).intent.action, 'light', 'a parry that met nothing is punished');
  // Read spammer standing ready in cutting range: the warden guards and keeps walking in (no heavy opener, no standing wait, no stall).
  const pressed = arena(1.7);
  const walk = decide(pressed, 1, state({ next: 'heavy', wait: 0, habits: { ...initialAi().habits, ...spam } }), PROFILES.normal);
  assert.equal(walk.intent.guard, true, 'guards under read pressure'); assert.equal(walk.intent.action, null, 'and does not swing the heavy');
  assert.ok((walk.intent.move?.z ?? 0) > 0, `keeps closing in guard (the player stands at +z): ${JSON.stringify(walk.intent.move)}`);
  assert.equal(walk.ai.next, 'light', 'the planned heavy becomes a cut against a spammer');
  const calm = decide(pressed, 1, state({ next: 'heavy', wait: 0 }), PROFILES.normal);
  assert.equal(calm.intent.guard, false, 'no read, no pressure guard');
  // Out of the pressure band the spammer read changes nothing about the walk.
  const far = decide(arena(2.4), 1, state({ next: 'heavy', wait: 0, habits: { ...initialAi().habits, ...spam } }), PROFILES.normal);
  assert.equal(far.intent.guard, false); assert.ok((far.intent.move?.z ?? 0) > 0, 'approaches unguarded from range');
  // Anticipation: a read spammer's cut is planned at READ.anticipate, not the profile reaction — and only cuts (a heavy keeps the honest clock).
  const cutAt = (age: number, move: 'light_right' | 'heavy_overhead', habits: Partial<Habits> = spam) => { const d = arena(1.2); d.fighters[0] = { ...d.fighters[0], phase: 'attack', move, lastMove: move, age }; return decide(d, 1, state({ habits: { ...initialAi().habits, ...habits } }), PROFILES.normal).ai.plan; };
  assert.ok(cutAt(READ.anticipate, 'light_right'), 'a read spammer\'s cut is planned early'); assert.equal(cutAt(READ.anticipate, 'light_right', {}), null, 'an unread player\'s cut is not');
  assert.equal(cutAt(READ.anticipate, 'heavy_overhead'), null, 'the spammer\'s heavy is still noticed on the honest clock'); assert.ok(cutAt(PROFILES.normal.reaction, 'heavy_overhead'));
  // Feint: a swing flagged as a feint is abandoned into a guard press on its last feintable tick, exactly once.
  const mid = arena(1.2); mid.fighters[1] = { ...mid.fighters[1], phase: 'attack', move: 'light_right', lastMove: 'light_right', age: MOVES.light_right.feintUntil - 1 };
  const feinted = decide(mid, 1, state({ feint: true }), PROFILES.normal);
  assert.equal(feinted.intent.action, 'parry'); assert.equal(feinted.intent.guard, true); assert.equal(feinted.ai.feint, false, 'the flag is spent');
  const early = { ...mid, fighters: [mid.fighters[0], { ...mid.fighters[1], age: MOVES.light_right.feintUntil - 3 }] } as Duel;
  assert.equal(decide(early, 1, state({ feint: true }), PROFILES.normal).intent.action, null, 'not before the last feintable tick');
  // Feints and kicks are only ever aimed at a read parrier: over many throws at a parrier some swings are feints and kicks lead; at an unread player none are feints.
  const throwsAt = (habits: Partial<Habits>, gap: number) => [...Array(120).keys()].map(seed => decide(arena(gap), 1, { ...state({ next: 'light', wait: 0, seed: seed + 1, habits: { ...initialAi().habits, ...habits } }) }, PROFILES.normal));
  const parrier: Partial<Habits> = { ticks: 600, attacks: 4, parries: 3 };
  const cutsAtParrier = throwsAt(parrier, 1.4), cutsAtCalm = throwsAt({}, 1.4);   // outside kick reach: cuts, some feinted, most held as baits
  assert.ok(cutsAtParrier.filter(w => w.ai.feint).length >= 3, `feints at a parrier: ${cutsAtParrier.filter(w => w.ai.feint).length}`); assert.ok(!cutsAtCalm.some(w => w.ai.feint), 'no feint without the read');
  assert.ok(cutsAtParrier.filter(w => w.intent.held).length >= 40, `baited lights at a parrier: ${cutsAtParrier.filter(w => w.intent.held).length}`); assert.ok(!cutsAtCalm.some(w => w.intent.held), 'no bait without the read');
  const closeAtParrier = throwsAt(parrier, 1.05), closeAtCalm = throwsAt({}, 1.05);   // inside kick reach: the kick goes through a parry window
  assert.ok(closeAtParrier.filter(w => w.intent.action === 'kick').length >= 40, `kicks lead at a parrier: ${closeAtParrier.filter(w => w.intent.action === 'kick').length}`);
  assert.equal(closeAtCalm.filter(w => w.intent.action === 'kick').length, 0, 'no kick at an unguarded, unread player');
});

test('a kick is never guarded or parried: with its dodge share the warden rolls it (steps out without the stamina), otherwise it takes the poke', () => {
  const plans = (profile: AiProfile, stamina: number) => [...Array(200).keys()].map(seed => { const d = arena(1.1); d.fighters[0] = { ...d.fighters[0], phase: 'attack', move: 'kick', lastMove: 'kick', age: profile.reaction }; d.fighters[1] = { ...d.fighters[1], stamina }; return decide(d, 1, { ...initialAi(((seed + 1) * 2654435761) >>> 0), mode: 'approach', decision: 500, wait: 500 }, profile).ai.plan; });   // spread seeds: neighbours share their first draw
  assert.ok(PROFILES.easy.reaction >= MOVES.kick.windup, 'easy cannot notice a kick before it lands'); assert.ok(!plans(PROFILES.easy, 100).some(p => p), 'so it never plans against one');
  for (const level of ['normal', 'hard'] as const) {
    const rich = plans(PROFILES[level], 100), poor = plans(PROFILES[level], RULES.rollCost - 1);
    assert.ok(!rich.some(p => p === 'block' || p === 'parry') && !poor.some(p => p === 'block' || p === 'parry'), `${level} never guards or parries a kick`);
    const escapes = rich.filter(p => p === 'dodge').length / rich.length;
    assert.ok(Math.abs(escapes - PROFILES[level].dodge) < .08, `${level} rolls a kick with its dodge share: ${escapes} vs ${PROFILES[level].dodge}`); assert.ok(rich.some(p => p === 'ignore'), 'and takes the rest');
    assert.ok(!poor.some(p => p === 'dodge') && poor.some(p => p === 'evade'), `${level} steps out when it cannot roll`);
  }
});

test('habits are counted from what the player actually threw: a thrust is a thrust, not a cut — and no profile reacts faster than a human can', () => {
  // Three thrusts from thrust range, then a cut: the counts land in the right bins (ripostes, counters and kicks are never habits).
  let d = arena(1.9), ai = initialAi(2), thrown = 0;
  for (let i = 0; i < 600; i++) { const w = decide(d, 1, ai, PROFILES.easy); ai = w.ai; const p = d.fighters[0].phase === 'ready' && thrown < 3 && i % 90 === 0 ? (thrown++, act('thrust')) : idle(); d = stepDuel(d, [p, w.intent]); d = { ...d, finish: null, fighters: [{ ...d.fighters[0], health: HP, stamina: 100, exhausted: false, phase: d.fighters[0].phase === 'dead' ? 'ready' : d.fighters[0].phase }, { ...d.fighters[1], health: HP, phase: d.fighters[1].phase === 'dead' ? 'ready' : d.fighters[1].phase }] }; }
  assert.equal(ai.habits.thrusts, 3, `thrusts counted: ${JSON.stringify(ai.habits)}`); assert.equal(ai.habits.lights, 0, 'and not as lights');
  // Reaction floors: 10 ticks (167 ms) is about the fastest a human notices a tell; the honest clock never goes under it. Reads may anticipate, reactions may not.
  assert.ok(PROFILES.hard.reaction >= 10, `hard reacts in ${PROFILES.hard.reaction} ticks`); assert.ok(PROFILES.normal.reaction > PROFILES.hard.reaction && PROFILES.easy.reaction > PROFILES.normal.reaction);
  assert.ok(READ.anticipate < PROFILES.hard.reaction, 'anticipation is faster than any reaction, which is the point of a read');
});

test('the ring wall in the warden\'s footwork: a retreat that would put its back to the wall becomes a circle inward, and a player pinned on the wall is pressed straight', () => {
  // Warden on the ring's edge with the player inside: told to retreat (just hit), it must not walk into the wall.
  const edge = (): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: RADIUS - 1.5, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ x: 0, z: RADIUS - .15, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] });
  // Fighter 1 (the warden) sits 0.15 m inside the wall; its foe is inward, so it faces the centre with the wall at its back.
  const w = decide(edge(), 1, { ...initialAi(5), mode: 'retreat', retreatUntil: 500, decision: 500, wait: 500 }, PROFILES.normal);
  assert.equal(w.ai.mode, 'circle', 'no retreat into the wall');
  const outward = w.intent.move!.x * edge().fighters[1].body.x + w.intent.move!.z * edge().fighters[1].body.z;
  assert.ok(outward <= 1e-9, `does not push outward: ${JSON.stringify(w.intent.move)}`);
  // The mirror: the player has the wall at their back (warden inside); a warden that would otherwise circle presses straight in.
  const pinned = (): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: RADIUS - .15, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ x: 0, z: RADIUS - 1.5, heading: 0, distance: 0 }, 'ready')], finish: null, events: [] });
  const press = decide(pinned(), 1, { ...initialAi(5), mode: 'circle', decision: 500, wait: 500 }, PROFILES.normal);
  assert.equal(press.ai.mode, 'approach', 'a pinned player is pressed'); assert.ok(press.intent.move!.z > 0, 'straight at them');
  // Mid-ring nothing changes: a retreat is a retreat.
  const mid = decide(arena(1.2), 1, { ...initialAi(5), mode: 'retreat', retreatUntil: 500, decision: 500, wait: 500 }, PROFILES.normal);
  assert.equal(mid.ai.mode, 'retreat');
});

test('attrition and the stamina floor: a warden whose ceiling has been cut below its discipline floor still fights (the floor is a share of the ceiling), never circles for ever', () => {
  const worn = arena(1.2); worn.fighters[1] = { ...worn.fighters[1], maxStamina: 44, stamina: 44 };
  const state = { ...initialAi(5), mode: 'approach' as const, decision: 500, wait: 0, next: 'light' as const };
  const w = decide(worn, 1, state, PROFILES.normal);
  assert.ok(w.intent.action !== null || w.ai.mode === 'guard', `a full (if lowered) bar is not "low": ${w.intent.action} ${w.ai.mode} ${JSON.stringify(w.ai.scores)}`);
  const empty = arena(1.2); empty.fighters[1] = { ...empty.fighters[1], maxStamina: 44, stamina: 10 };
  assert.equal(decide(empty, 1, state, PROFILES.normal).intent.action, null, 'below the scaled floor it still holds back');
});

// ── Slice X: fight-identity knobs (for the goblin). Each is optional on AiProfile; absent, the warden is exactly what it was. ───────────────
const knobs = (over: Partial<AiProfile>): AiProfile => ({ ...PROFILES.normal, ...over });
const count = (events: Duel['events'], type: string, action?: string) => events.filter(e => e.type === type && e.actor === 1 && (!action || e.action === action)).length;

test('feint knob: a feinting fighter feints anyone (the read-parrier\'s sixth still applies on top); without the knob a passive player is never feinted', () => {
  const passive = () => idle();
  const plain = play(PROFILES.normal, 2400, passive), feinter = play(knobs({ feint: 1 }), 2400, passive);
  assert.equal(count(plain.events, 'ActionStarted', 'feint'), 0, 'today: no feints at a player who never parries');
  assert.ok(count(feinter.events, 'ActionStarted', 'feint') >= 6, `feint 1: every cut or heavy opener is a feint (${count(feinter.events, 'ActionStarted', 'feint')} feints)`);
  assert.ok(wardenAttacks(feinter.events).length >= count(feinter.events, 'ActionStarted', 'feint'), 'a feint is a swing that started');
});

test('guard knob 0: the fighter never stands in guard, never baits with one, never blocks and never guard-walks — it evades or steps back instead; the same seeds with the default guard do all of those', () => {
  const spammer = (d: Duel) => (d.fighters[0].phase === 'ready' && Math.hypot(d.fighters[0].body.x - d.fighters[1].body.x, d.fighters[0].body.z - d.fighters[1].body.z) <= 1.7 ? act('light') : idle());
  let guardTicksDefault = 0, guardTicksNone = 0, blocksDefault = 0, blocksNone = 0, evadesNone = 0;
  for (let s = 1; s <= 12; s++) {
    for (const [profile, tally] of [[PROFILES.normal, 'default'], [knobs({ guard: 0, parry: 0 }), 'none']] as const) {
      let d = arena(1.4), ai = initialAi(s * 7919);
      for (let i = 0; i < 900; i++) {
        const w = decide(d, 1, ai, profile); ai = w.ai; d = stepDuel(d, [spammer(d), w.intent]);
        if (tally === 'default') { if (d.fighters[1].phase === 'guard') guardTicksDefault++; if (d.events.some(e => e.type === 'Blocked' && e.actor === 1)) blocksDefault++; }
        else { if (d.fighters[1].phase === 'guard') guardTicksNone++; if (d.events.some(e => e.type === 'Blocked' && e.actor === 1)) blocksNone++; if (ai.plan === 'evade' || d.events.some(e => e.type === 'ActionStarted' && e.actor === 1 && (e.action === 'backstep' || e.action === 'roll'))) evadesNone++; assert.notEqual(ai.mode, 'guard', `seed ${s} tick ${i}: guard mode`); assert.notEqual(ai.plan, 'block', `seed ${s} tick ${i}: block plan`); }
        d = { ...d, finish: null, fighters: [{ ...d.fighters[0], health: HP, stamina: 100, exhausted: false, phase: d.fighters[0].phase === 'dead' ? 'ready' : d.fighters[0].phase }, { ...d.fighters[1], health: HP, phase: d.fighters[1].phase === 'dead' ? 'ready' : d.fighters[1].phase }] };
      }
    }
  }
  assert.ok(guardTicksDefault > 200 && blocksDefault > 5, `control: the default warden guards (${guardTicksDefault} ticks) and blocks (${blocksDefault}) a cut-spammer`);
  assert.equal(guardTicksNone, 0, 'guard 0: not one tick in guard'); assert.equal(blocksNone, 0, 'guard 0: never blocks');
  assert.ok(evadesNone > 20, `guard 0: it evades instead (${evadesNone})`);
});

test('disengage knob: after a landed blow the fighter hops back out of range on most of them; without the knob it never steps back after landing', () => {
  const standing = () => idle();
  for (const [profile, expectHops] of [[PROFILES.normal, false], [knobs({ disengage: 1 }), true]] as const) {
    let d = arena(1.3), ai = initialAi(4242), hits = 0, hops = 0, pending = 0;
    for (let i = 0; i < 3000; i++) {
      const w = decide(d, 1, ai, profile); ai = w.ai; d = stepDuel(d, [standing(d), w.intent]);
      if (d.events.some(e => e.type === 'Hit' && e.actor === 1)) { hits++; pending = 60; }
      if (pending > 0) { pending--; if (d.events.some(e => e.type === 'ActionStarted' && e.actor === 1 && e.action === 'backstep')) { hops++; pending = 0; } }
      d = { ...d, finish: null, fighters: [{ ...d.fighters[0], health: HP, stamina: 100, exhausted: false, phase: d.fighters[0].phase === 'dead' ? 'ready' : d.fighters[0].phase }, { ...d.fighters[1], health: HP, phase: d.fighters[1].phase === 'dead' ? 'ready' : d.fighters[1].phase }] };
    }
    assert.ok(hits >= 8, `it lands (${hits})`);
    if (expectHops) assert.ok(hops >= hits * .7, `disengage 1: a hop back within a second of most landed blows (${hops}/${hits})`);
    else assert.equal(hops, 0, `today: no hop back after landing (${hops}/${hits})`);
  }
});

test('circle knob: a circler drifts sideways while closing in; the default walks straight', () => {
  const state = { ...initialAi(5), mode: 'approach' as const, decision: 500, wait: 500, next: null };
  const move = (profile: AiProfile) => decide(arena(3), 1, state, profile).intent.move;
  const straight = move(PROFILES.normal), circling = move(knobs({ circle: 1 }));
  assert.ok(straight.z > 0 && Math.abs(straight.x) < 1e-9, `default: straight in ${JSON.stringify(straight)}`);
  assert.ok(circling.z > 0 && Math.abs(circling.x) > .2, `circle 1: sideways drift while closing ${JSON.stringify(circling)}`);
  assert.ok(Math.abs(Math.hypot(circling.x, circling.z) - Math.hypot(straight.x, straight.z)) < .3, 'the drift is added to the same closing speed, not a stop');
});

test('regen knob: a fighter built with regen 2 refills stamina twice as fast; the default is RULES.regen', () => {
  const spent = (regen: number) => { const f = createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready', 'longsword', 1, 0, RULES.health, undefined, regen); return { ...f, stamina: 20, rest: 0 }; };
  let d: Duel = { tick: 0, fighters: [spent(1), spent(2)], finish: null, events: [] };
  for (let i = 0; i < 30; i++) d = stepDuel(d, [idle(), idle()]);
  const gained = d.fighters.map(f => f.stamina - 20);
  assert.ok(Math.abs(gained[0] - 30 * RULES.regen) < 1e-6, `a man gains RULES.regen per tick: ${gained[0]}`);
  assert.ok(Math.abs(gained[1] - 60 * RULES.regen) < 1e-6, `regen 2 gains twice that: ${gained[1]}`);
  assert.equal(initialDuel().fighters[1].regen, 1, 'the Veteran regenerates as a man');
});
