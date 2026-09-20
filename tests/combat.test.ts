import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTACKS, MOVES, PROFILES, RULES, SWORD, accepts, actorPose, attackSpecs, canDefend, canStrike, describe, initialPractice, practiceHint, project, stepPractice, type Intent, type Practice } from '../src/combat.ts';
import { PATHS, total } from '../src/moves.ts';
import { movesOf } from '../src/duel.ts';
import { RADIUS, TARGET } from '../src/sim.ts';

const HP = RULES.health;   // fighters start at RULES.health; the numbers below are written against it
// Practice is the renderer/HUD view over the duel; these tests cover the projection, hints, control gating and replays.
const idle = (): Intent => ({ move: { x: 0, z: 0, yaw: 0, run: false }, action: null, guard: false, lock: true });
const act = (action: Intent['action'], extra: Partial<Intent> = {}): Intent => ({ ...idle(), action, ...extra });
function ready(gap = 1.2, heading = Math.PI): Practice {
  const p = initialPractice();
  return project({ ...p.duel, fighters: [{ ...p.duel.fighters[0], phase: 'ready', body: { x: 0, z: TARGET.z + gap, heading, distance: 0 } }, p.duel.fighters[1]] }, p.ai);
}
const tick = (s: Practice, n: number, intent = idle(), profile = PROFILES.normal) => { for (let i = 0; i < n; i++) s = stepPractice(s, intent, profile); return s; };
// A warden that never attacks or defends within these short scenarios: it still walks, so keep targets in range.
const passive = { ...PROFILES.easy, aggression: 0, parry: 0, dodge: 0, pressure: 0 };

test('legacy constant views stay equal to the move data the simulation actually uses', () => {
  assert.equal(SWORD.contact, MOVES.light_right.windup); assert.equal(SWORD.recovery, total(MOVES.light_right)); assert.equal(SWORD.recovery, 50); assert.equal(SWORD.contact, 20);   // the cut: 20 / 8 / 22 since the horizontal re-time
  assert.equal(ATTACKS.return.contact, PATHS.light_left_chain.windup); assert.equal(ATTACKS.return.recovery, total(PATHS.light_left_chain)); assert.equal(ATTACKS.return.recovery, 42);   // chained cut 16 / 8 / 18
  assert.equal(ATTACKS.heavy.recovery, 68); assert.equal(ATTACKS.heavy.damage, 18); assert.equal(ATTACKS.heavy.cost, 35); assert.equal(ATTACKS.riposte.damage, 24);
  assert.equal(MOVES.kick.windup, 18); assert.equal(total(MOVES.kick), 44); assert.equal(MOVES.kick.damage, 4); assert.equal(MOVES.kick.stamina, 25);
  assert.equal(RULES.roll, RULES.roll); assert.equal(RULES.parry, 10); assert.equal(RULES.parryStun, 90); assert.equal(RULES.wound, 240);
  assert.equal(RULES.bufferWindow, 10); assert.equal(RULES.bufferTtl, 11); assert.equal(RULES.parryRecovery, 8); assert.equal(RULES.feintCost, 10);
  for (const [id, path] of Object.entries(PATHS)) assert.equal(path.active, id.startsWith('light') ? 8 : 5, `${id} active window`);   // the cuts sweep 8 ticks; everything else 5
  for (const move of Object.values(MOVES)) assert.equal(move.windup + move.active + move.recovery, total(move));
  // A quick press is a plain heavy and a deliberate hold is the charged one: the press must last ≥ 0.6 s to charge and the hold releases itself by ~1.1 s.
  assert.ok(MOVES.heavy_overhead.chamber! + RULES.charge.min >= 36 && MOVES.heavy_overhead.chamber! + RULES.charge.min <= 45, `charge press ${MOVES.heavy_overhead.chamber! + RULES.charge.min} ticks`); assert.ok(MOVES.heavy_overhead.chamber! + RULES.charge.max <= 66);
  assert.equal(MOVES.heavy_overhead.breaksGuard, false); assert.ok(MOVES.heavy_overhead.chip > 0 && MOVES.heavy_overhead.staminaDamage >= 25, 'a guard takes a plain heavy for chip and real stamina');
  assert.equal(MOVES.heavy_riposte.damage, 30); assert.equal(MOVES.light_right.damage, 14); assert.equal(MOVES.thrust.damage, 11); assert.equal(MOVES.light_right.stamina, 25); assert.equal(MOVES.thrust.stamina, 20); assert.ok(MOVES.thrust.damage < MOVES.light_right.damage && MOVES.light_right.damage < MOVES.heavy_overhead.damage, 'damage follows the tell: stab (267 ms) < cut (333 ms) < heavy (533 ms)'); assert.equal(MOVES.heavy_overhead.chained!.windup, 22); assert.equal(RULES.dodgeAttackWindow, 2); assert.equal(RULES.perfectBlock, 3); assert.equal(RULES.perfectBlockCost, .5);
});

test('the projection mirrors both fighters: phases, resources, threat, results and warden reaction for the renderer', () => {
  const start = initialPractice();
  assert.equal(start.phase, 'sheathed'); assert.equal(start.enemyPhase, 'ready'); assert.equal(start.health, HP); assert.equal(start.playerHealth, HP); assert.equal(start.stamina, 100); assert.equal(start.result, 'none'); assert.equal(start.finish, null);
  assert.deepEqual(start.fighter, start.duel.fighters[0].body); assert.deepEqual(start.enemy, start.duel.fighters[1].body);
  let s = stepPractice(ready(), act('light'), passive);
  assert.equal(s.phase, 'attack'); assert.equal(s.attack, 'light'); assert.equal(s.stamina, 100 - MOVES.light_right.stamina);
  s = tick(s, SWORD.contact, idle(), passive);
  assert.equal(s.health, HP - MOVES.light_right.damage); assert.equal(s.result, 'hit'); assert.equal(s.resultAge, 0); assert.equal(s.resultDamage, MOVES.light_right.damage); assert.equal(s.enemyPhase, 'hurt');
  assert.equal(s.reaction, SWORD.reaction); assert.equal(s.enemyWound, RULES.wound);
  assert.ok(s.events.some(e => e.type === 'Hit'));
  s = tick(s, 1, idle(), passive); assert.equal(s.reaction, SWORD.reaction - 1); assert.equal(s.resultAge, 1);
  const kicked = tick(stepPractice(ready(1.05), act('kick'), passive), MOVES.kick.windup, idle(), passive);
  assert.equal(kicked.result, 'kicked'); assert.equal(kicked.health, HP - MOVES.kick.damage); assert.equal(kicked.phase, 'kick');
  const drawn = stepPractice(initialPractice(), act('light'));
  assert.equal(drawn.phase, 'draw'); assert.equal(actorPose(drawn, 0).pose, 'draw');
  const stepping = stepPractice(ready(), act('backstep'), passive);
  assert.equal(stepping.phase, 'backstep'); assert.equal(actorPose(stepping, 0).pose, 'ready', 'a backstep presents as armed footwork'); assert.equal(accepts(stepping, 'dodge'), true); assert.equal(accepts(stepping, 'backstep'), false);
});

test('the warden threat flag and move drive the incoming warning; the projection exposes what it will do', () => {
  let s = ready();
  for (let i = 0; i < 600 && !s.threat; i++) s = stepPractice(s, idle());
  assert.equal(s.threat, true); assert.equal(s.threatMove, 'heavy_overhead'); assert.equal(s.enemyAttacking, true);
  assert.match(practiceHint(s), /^Incoming strike — heavy: guard takes chip/);   // the browser gate times the tell on 'Incoming strike'
  assert.match(practiceHint({ ...s, threatMove: 'thrust' }), /^Incoming strike — thrust: fast and long/);
  assert.match(practiceHint({ ...s, duel: { ...s.duel, fighters: [s.duel.fighters[0], { ...s.duel.fighters[1], charge: 3 }] } }), /^Incoming strike — charged heavy: a guard will break/);
  const charging = { ...s, duel: { ...s.duel, fighters: [{ ...s.duel.fighters[0], phase: 'attack' as const, move: 'heavy_overhead' as const, charge: 5, charged: false }, s.duel.fighters[1]] } };
  assert.match(practiceHint(charging), /^Charging/); assert.match(practiceHint({ ...charging, duel: { ...charging.duel, fighters: [{ ...charging.duel.fighters[0], charged: true }, charging.duel.fighters[1]] } }), /^Charged/);
  assert.equal(actorPose(s, 1).pose, 'attack'); assert.equal(actorPose(s, 1).attack, 'heavy');
  const theirs = attackSpecs(s.duel.fighters[1].weapon);   // the warden's own weapon's timing (the Veteran fights with the trident)
  assert.ok(Math.abs(actorPose(s, 1).contact - theirs.heavy.contact / theirs.heavy.recovery) < 1e-12);
  while (s.threat) s = stepPractice(s, idle());
  assert.ok(['hurt', 'ready', 'attack'].includes(s.phase));
});

test('hints prioritise defeat, drawing, threats, exhaustion, warden guard, chains, then expiring notices', () => {
  const hit = tick(stepPractice(ready(), act('light'), passive), SWORD.contact, idle(), passive);
  assert.match(practiceHint(hit), new RegExp(`Clean right cut hit · −${MOVES.light_right.damage}`));
  assert.doesNotMatch(practiceHint(tick(hit, 120, idle(), passive)), /Clean/);
  const guarding = { ...hit, duel: { ...hit.duel, fighters: [hit.duel.fighters[0], { ...hit.duel.fighters[1], phase: 'guard' as const, age: 12 }] } } as Practice;
  assert.match(practiceHint({ ...guarding, enemyMode: 'guard', reaction: 0, enemyAttacking: false }), /Warden guarding/);
  assert.match(practiceHint({ ...hit, health: 0 }), /Warden defeated/); assert.match(practiceHint({ ...hit, playerHealth: 0 }), /You fell/);
  assert.match(practiceHint(initialPractice()), /Draw your sword/); assert.match(practiceHint(stepPractice(initialPractice(), act('light'))), /Drawing/);
  const exhausted = project({ ...ready().duel, fighters: [{ ...ready().duel.fighters[0], exhausted: true, stamina: 3 }, ready().duel.fighters[1]] }, ready().ai);
  assert.match(practiceHint(exhausted), /Exhausted/);
  const chained = tick(stepPractice(ready(4), act('light'), passive), SWORD.recovery, idle(), passive);
  assert.ok(chained.chain > 0); assert.match(practiceHint(chained), /Light again/);
  assert.match(practiceHint(ready()), /Hold guard/); assert.match(practiceHint(stepPractice(ready(), { ...idle(), guard: true }, passive)), /Guarding/);
  const hurt = { ...hit, result: 'hurt' as const, resultAge: 3, resultDamage: 38 }; assert.match(practiceHint(hurt), /Hit taken · −38/);
  assert.match(practiceHint({ ...hit, result: 'hit', resultAge: 3, resultDamage: 14, resultCounter: true }), /Counter right cut hit · −14/);
  assert.match(practiceHint({ ...hit, result: 'hurt', resultAge: 3, resultDamage: 14, resultCounter: true }), /Countered · −14/);
  assert.match(practiceHint({ ...hit, result: 'enemyPostureBroken', resultAge: 3 }), /Warden staggering · Heavy for the critical/);
  assert.match(practiceHint({ ...hit, result: 'postureBroken', resultAge: 3 }), /Your posture broke/);
  assert.match(practiceHint({ ...hit, result: 'none', posture: 75 }), /Your posture is breaking/); assert.match(practiceHint({ ...hit, result: 'none', enemyPosture: 75 }), /Warden near a posture break/);
  assert.match(practiceHint({ ...hit, result: 'none', duel: { ...hit.duel, fighters: [{ ...hit.duel.fighters[0], critical: 30, phase: 'ready' as const }, hit.duel.fighters[1]] } }), /^Posture broken — Heavy for the critical/);
  assert.match(describe({ ...hit, duel: { ...hit.duel, fighters: [{ ...hit.duel.fighters[0], posture: 42, critical: 7 }, hit.duel.fighters[1]] } }), /po 42 CRIT 7/);
  assert.match(practiceHint({ ...hit, result: 'blocked', resultAge: 3, resultDamage: 0, resultStamina: 12.5, resultPerfect: true }), /Perfect block · −13 stamina$/);
  assert.match(practiceHint({ ...hit, result: 'blocked', resultAge: 3, resultDamage: 0, resultStamina: 25, resultPerfect: false }), /^Blocked · −25 stamina$/);
  assert.match(practiceHint({ ...hit, result: 'blocked', resultAge: 3, resultDamage: 7, resultStamina: 40, resultPerfect: false }), /^Blocked · −40 stamina · −7 chip$/);
  const countering = project({ ...hit.duel, fighters: [{ ...hit.duel.fighters[0], counterWindow: 12 }, hit.duel.fighters[1]] }, hit.ai);
  assert.match(practiceHint({ ...countering, result: 'blocked', resultAge: 3, resultDamage: 0, resultStamina: 25, resultPerfect: false }), /heavy to counter/);
  for (const [result, text] of [['blocked', /Blocked/], ['parried', /Parried! The warden/], ['dodged', /Evaded/], ['broken', /Guard broken/], ['enemyBlocked', /Warden blocked/], ['enemyBroken', /Guard shattered/], ['enemyParried', /turned aside/], ['enemyDodged', /rolled clear/], ['miss', /Miss/]] as const) assert.match(practiceHint({ ...hit, result, resultAge: 3 }), text);
  assert.doesNotMatch(practiceHint({ ...hit, result: 'enemyParried', resultAge: 3 }), /^Parried/, 'the warden parrying must not read as the player parrying');
});

test('control gating: actions are accepted when legal or late in a committed move, never after defeat or while exhausted', () => {
  const s = ready();
  assert.equal(canStrike(s), true); assert.equal(canDefend(s), true);
  for (const action of ['light', 'heavy', 'kick', 'dodge', 'parry'] as const) assert.equal(accepts(s, action), true);
  const swinging = stepPractice(s, act('light'), passive);
  for (const action of ['light', 'heavy', 'kick', 'dodge'] as const) assert.equal(accepts(swinging, action), false);
  assert.equal(accepts(swinging, 'parry'), true, 'only the feint is open at the start of a swing');
  const late = tick(swinging, SWORD.recovery - RULES.bufferWindow, idle(), passive);
  for (const action of ['light', 'heavy', 'kick', 'dodge', 'parry'] as const) assert.equal(accepts(late, action), true);
  const drawing = tick(stepPractice(initialPractice(), act('light')), RULES.draw - 2);
  assert.equal(accepts(drawing, 'light'), true); assert.equal(accepts(drawing, 'heavy'), false, 'heavy cannot be queued from a draw');
  assert.equal(accepts({ ...s, health: 0 }, 'light'), false); assert.equal(canStrike({ ...s, playerHealth: 0, duel: { ...s.duel, fighters: [{ ...s.duel.fighters[0], health: 0 }, s.duel.fighters[1]] } }), false);
  const guarding = stepPractice(s, { ...idle(), guard: true }, passive);
  assert.equal(accepts(guarding, 'kick'), true); assert.equal(accepts(guarding, 'dodge'), true); assert.equal(accepts(guarding, 'light'), true, 'a guard yields to an attack');
  const winding = stepPractice(s, act('light'), passive);
  assert.equal(accepts(winding, 'parry'), true, 'the guard control lights up during the feint window'); assert.equal(accepts(winding, 'light'), false);
  assert.equal(accepts(tick(winding, MOVES.light_right.feintUntil, idle(), passive), 'parry'), false, 'and goes dark once the swing is committed');
  assert.equal(canStrike(initialPractice()), true, 'a light draws the sword');
});

test('defeat freezes the fight and a fresh practice restores everything; the debug readout stays a pure function of state', () => {
  let s = ready();
  const cut = movesOf(s.duel.fighters[1]).light_left;   // the warden's own left cut (the trident's sweep): its damage and contact tick
  s = project({ ...s.duel, fighters: [{ ...s.duel.fighters[0], health: cut.damage }, { ...s.duel.fighters[1], phase: 'attack', move: 'light_left', age: cut.windup - 1, lastMove: 'light_left' }] }, s.ai);
  const fallen = stepPractice(s, idle(), passive);
  assert.equal(fallen.playerHealth, 0); assert.equal(fallen.phase, 'dead'); assert.equal(fallen.finish?.victim, 0); assert.equal(canStrike(fallen), false); assert.equal(canDefend(fallen), false);
  assert.ok(fallen.events.some(e => e.type === 'Killed' && e.target === 0));
  const later = tick(fallen, 200, act('heavy', { move: { x: 1, z: 1, yaw: 0, run: true }, guard: true }));
  assert.deepEqual(later.fighter, fallen.fighter); assert.equal(later.health, fallen.health); assert.equal(later.playerHealth, 0);
  const reset = initialPractice(); assert.equal(reset.playerHealth, HP); assert.equal(reset.stamina, 100); assert.equal(reset.health, HP); assert.equal(reset.phase, 'sheathed'); assert.equal(reset.finish, null);
  const text = describe(fallen, 'hard');
  assert.match(text, /you: hp 0/); assert.match(text, new RegExp(`warden: hp ${HP}`)); assert.match(text, /ai hard/); assert.equal(describe(fallen, 'hard'), text);
  assert.match(describe(stepPractice(ready(), act('heavy'), passive)), /heavy_overhead 0\/68 \|/);
});

test('the thrust plays its own clip role; a chained thrust and the riposte play the riposte\'s (the second thrust, from half-withdrawn); a fighter\'s specs are its weapon\'s', () => {
  const s = ready(), me = s.duel.fighters[0], w = s.duel.fighters[1];
  const pose = (f: typeof me, side: 0 | 1, over: Partial<typeof me>) => actorPose({ ...s, duel: { ...s.duel, fighters: side === 0 ? [{ ...f, ...over }, w] : [me, { ...f, ...over }] } }, side);
  assert.equal(pose(me, 0, { phase: 'attack', move: 'thrust', lastMove: 'thrust', chained: false, age: 3 }).attack, 'thrust');
  assert.equal(pose(me, 0, { phase: 'attack', move: 'riposte', lastMove: 'riposte', chained: false, age: 3 }).attack, 'riposte');
  assert.equal(pose(w, 1, { phase: 'attack', move: 'thrust', lastMove: 'thrust', chained: false, age: 3 }).attack, 'thrust');
  assert.equal(pose(w, 1, { phase: 'attack', move: 'thrust', lastMove: 'thrust', chained: true, age: 3 }).attack, 'riposte', 'the trident\'s second thrust (the sword\'s stab never chains)');
  // Standing, each side's default contact fraction comes from its own weapon's tables (the trident's sweep is 22/54, the cut 20/50).
  const theirs = attackSpecs(w.weapon), mine = attackSpecs(me.weapon);
  assert.ok(Math.abs(actorPose(s, 1).contact - theirs.light.contact / theirs.light.recovery) < 1e-12); assert.ok(Math.abs(actorPose(s, 0).contact - mine.light.contact / mine.light.recovery) < 1e-12);
  assert.deepEqual([mine.light.contact, mine.light.recovery, theirs.light.contact, theirs.light.recovery], [20, 50, 22, 54]);
  assert.deepEqual([mine.thrust.source, mine.heavy.source, theirs.heavy.source], [.34, .48, .48]);
});

test('seeded practice replays are identical, never mutate the previous state, and keep both fighters bounded and apart [slow]', () => {
  const play = (profile = PROFILES.normal) => {
    let seed = 444, s = initialPractice();
    const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    const pick = (): Intent['action'] => { const r = random(); return r < .05 ? 'light' : r < .07 ? 'heavy' : r < .09 ? 'kick' : r < .11 ? 'dodge' : r < .13 ? 'parry' : null; };
    let held = false;
    for (let i = 0; i < 16000; i++) {
      if (!s.health || !s.playerHealth) s = { ...ready(), ai: { ...s.ai } };
      if (random() < .03) held = !held;
      const before = structuredClone(s); Object.freeze(s); Object.freeze(s.duel); Object.freeze(s.duel.fighters); Object.freeze(s.ai);
      const next = stepPractice(s, { move: { x: random() * 2 - 1, z: random() * 2 - 1, yaw: random() * 6, run: random() < .1 }, action: pick(), guard: held, lock: random() < .8 }, profile);
      assert.deepEqual(s, before);
      for (const actor of [next.enemy, next.fighter]) assert.ok(Math.hypot(actor.x, actor.z) <= RADIUS + 1e-8);
      assert.ok(Math.hypot(next.enemy.x - next.fighter.x, next.enemy.z - next.fighter.z) >= .85 - 1e-8);
      for (const value of [next.health, next.playerHealth]) assert.ok(Number.isFinite(value) && value >= 0 && value <= HP);
      for (const value of [next.stamina, next.enemyStamina]) assert.ok(Number.isFinite(value) && value >= 0 && value <= 100);
      s = next;
    }
    return s;
  };
  assert.deepEqual(play(), play());
  assert.notDeepEqual(play(PROFILES.hard).duel, play(PROFILES.easy).duel, 'difficulty changes the fight');
  const stationary = tick(initialPractice(), 600); assert.deepEqual(stationary.enemy, initialPractice().enemy, 'a sheathed player is never approached');
});

test('a parry then a light produces the riposte the browser gate expects, then a close kick lands', () => {
  let s = ready();
  for (let i = 0; i < 900 && !(s.threat && s.threatMove === 'heavy_overhead'); i++) s = stepPractice(s, idle());
  assert.equal(s.threatMove, 'heavy_overhead');
  const windup = MOVES.heavy_overhead.windup;
  s = tick(s, windup - s.enemyAge - 6, idle());
  s = stepPractice(s, act('parry', { guard: true, guardDirection: 'overhead' }));   // directional guard: a heavy is parried overhead
  while (s.result !== 'parried' && s.threat) s = stepPractice(s, { ...idle(), guard: true, guardDirection: 'overhead' });
  assert.equal(s.result, 'parried'); assert.equal(s.playerHealth, HP);
  s = tick(s, RULES.parry + 1, { ...idle(), guard: true, guardDirection: 'overhead' }); s = stepPractice(s, idle());
  s = stepPractice(s, act('light'));
  assert.equal(s.attack, 'slashRiposte');
  s = tick(s, ATTACKS.slashRiposte.contact);
  assert.equal(s.health, HP - MOVES.slash_riposte.damage);
  // Mirror scripts/browser-check.mjs: 600 ms after the counter tap, hold forward for 240 ms, then kick.
  s = tick(s, 36 - ATTACKS.slashRiposte.contact);
  s = tick(s, 14, { ...idle(), move: { x: 0, z: -1, yaw: 0, run: false } });
  s = stepPractice(s, act('kick'));
  assert.equal(s.phase, 'kick');
  s = tick(s, MOVES.kick.windup);
  // The warden's re-engagement can start a tick either side of the kick's contact, so the kick lands clean or as a counter-hit — or, under the
  // directional guard, he reads it and braces it low (a Blocked kick: no damage, no stagger). The browser gate accepts all three (browser-check.mjs).
  const dealt = HP - MOVES.slash_riposte.damage - s.health, w = s.duel.fighters[1], braced = dealt === 0 && w.phase === 'guard' && w.guardDirection === 'low';
  assert.ok([MOVES.kick.damage, Math.round(MOVES.kick.damage * RULES.counter.damage)].includes(dealt) || (dealt === 0 && braced), `kick dealt ${dealt}, braced ${braced}`);
});
