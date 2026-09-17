// Opponents are data (moves.ts OPPONENTS): weapon, body scale, health, poise and a profile per level. The Veteran is the warden as
// shipped — `initialDuel()` is still exactly him. The Pitborn is the first creature: relentless, poised, more health, honest openings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, initialAi } from '../src/ai.ts';
import { bladeImpact } from '../src/blade.ts';
import { bladePaths } from '../src/blade-paths.ts';
import { createFighter, idleIntent, initialDuel, movesOf, stepDuel, type Duel, type Intent } from '../src/duel.ts';
import { MOVES, OPPONENTS, PROFILES, RULES, WEAPONS, type Opponent } from '../src/moves.ts';
import { TARGET, type State } from '../src/sim.ts';
import { STRATEGIES, battery } from './battery.test.ts';

const P = OPPONENTS.pitborn;
const idle = (): Intent => ({ ...idleIntent(), lock: true }), act = (action: Intent['action']): Intent => ({ ...idle(), action });
const ring = (o: Opponent, gap = 1.2): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + gap, heading: Math.PI, distance: 0 }, 'ready'), createFighter({ ...TARGET, heading: 0, distance: 0 }, 'ready', o.weapon, o.scale, o.poise, o.health)], finish: null, events: [] });
// Step until the player's blow lands (or 200 ticks): the events of that tick and the duel after it.
function land(o: Opponent, player: Intent, opponent: (d: Duel) => Intent = idle) {
  let d = ring(o), first = true;
  for (let i = 0; i < 200; i++) { d = stepDuel(d, [first ? player : idle(), opponent(d)]); first = false; if (d.events.some(e => e.type === 'Hit' && e.actor === 0)) return d; }
  throw new Error('no hit landed');
}

test('initialDuel() is the Veteran — the trident (slice V) on a man\'s scale, health and poise, the shipped PROFILES; the hero the longsword — and the cleaver slot is the real cleaver (slice W), baked from its own rig', () => {
  assert.deepEqual(initialDuel(), initialDuel(OPPONENTS.veteran));
  const [hero, warden] = initialDuel().fighters;
  assert.equal(hero.weapon, 'longsword'); assert.equal(warden.weapon, 'trident');
  for (const f of [hero, warden]) { assert.equal(f.scale, 1); assert.equal(f.poise, 0); assert.equal(f.health, RULES.health); assert.equal(f.maxHealth, RULES.health); }
  assert.equal(OPPONENTS.veteran.profiles, PROFILES);
  assert.equal(WEAPONS.cleaver.placeholder, undefined); assert.notEqual(WEAPONS.cleaver.moves, MOVES); assert.notDeepEqual(bladePaths.cleaver, bladePaths.longsword, 'baked from the cleaver rig');
});

test('the Pitborn is set up from his data: the cleaver slot, 1.13× scale, 190 health and poise 16 on the warden side; the hero is unchanged', () => {
  const [hero, brute] = initialDuel(P).fighters;
  assert.deepEqual(hero, initialDuel().fighters[0]);
  assert.equal(brute.weapon, 'cleaver'); assert.equal(brute.scale, 1.13); assert.equal(brute.health, 190); assert.equal(brute.maxHealth, 190); assert.equal(brute.poise, 16);
  assert.ok(P.profiles.normal.aggression > PROFILES.normal.aggression && P.profiles.normal.parry < PROFILES.normal.parry && P.profiles.normal.reaction > PROFILES.normal.reaction, 'relentless, rarely parries, slower to notice');
});

test('poise: a plain cut never staggers or moves the Pitborn — it wounds him and builds his posture; a heavy staggers him; a counter-hit cut staggers him', () => {
  const cut = land(P, act('light'));
  const brute = cut.fighters[1], hit = cut.events.find(e => e.type === 'Hit' && e.actor === 0)!;
  assert.equal(hit.damage, MOVES.light_right.damage); assert.ok(hit.damage! < P.poise);
  assert.ok(!cut.events.some(e => e.type === 'Staggered' && e.actor === 1), 'no stagger'); assert.equal(brute.phase, 'ready');
  assert.deepEqual({ x: brute.body.x, z: brute.body.z }, { x: TARGET.x, z: TARGET.z }, 'no knockback');
  assert.equal(brute.health, P.health - MOVES.light_right.damage); assert.equal(brute.posture, MOVES.light_right.posture);
  // The same cut on the Veteran staggers him: poise is the only difference.
  const man = land(OPPONENTS.veteran, act('light')).fighters[1];
  assert.equal(man.phase, 'hurt'); assert.ok(man.body.z !== TARGET.z, 'knocked back');
  const heavy = land(P, act('heavy'));
  assert.ok(heavy.events.some(e => e.type === 'Staggered' && e.actor === 1), 'a heavy staggers'); assert.equal(heavy.fighters[1].phase, 'hurt');
  // Counter-hit: the brute is mid-heavy (windup 32) when the cut (contact 20) lands.
  const counter = land(P, act('light'), d => (d.tick === 0 ? act('heavy') : idle()));
  const c = counter.events.find(e => e.type === 'Hit' && e.actor === 0)!;
  assert.equal(c.counter, true); assert.ok(counter.events.some(e => e.type === 'Staggered' && e.actor === 1), 'a counter-hit staggers through poise');
});

test('the hit capsule grows with the man: a horizontal blade at 1.40 m is a head hit on a man and a torso hit on the 1.13× brute; at 1.90 m it misses the man and finds the brute\'s head', () => {
  bladePaths.probe = { flat: [[-.5, 1.4, 0, .5, 1.4, 0], [-.5, 1.4, 0, .5, 1.4, 0]], high: [[-.5, 1.9, 0, .5, 1.9, 0], [-.5, 1.9, 0, .5, 1.9, 0]] };
  const o: State = { x: 0, z: 0, heading: 0, distance: 0 };
  try {
    assert.equal(bladeImpact('probe', 'flat', 0, 1, o, o, o, o), 'head'); assert.equal(bladeImpact('probe', 'flat', 0, 1, o, o, o, o, P.scale), 'torso');
    assert.equal(bladeImpact('probe', 'high', 0, 1, o, o, o, o), null); assert.equal(bladeImpact('probe', 'high', 0, 1, o, o, o, o, P.scale), 'head');
  } finally { delete bladePaths.probe; }
});

// The off-line punisher the brief prescribes: step back the moment he swings, cut him while he recovers from the whiff, heavy him when he is spent.
const gap = (d: Duel) => Math.hypot(d.fighters[0].body.x - d.fighters[1].body.x, d.fighters[0].body.z - d.fighters[1].body.z);
const whiffPunisher = (d: Duel): Intent => {
  const w = d.fighters[1], p = d.fighters[0];
  if (p.phase !== 'ready') return idle();
  if (w.phase === 'attack' && w.age <= 4 && !w.landed && w.move !== 'kick') return act('backstep');
  if (w.phase === 'attack' && w.move && !w.landed && w.age >= movesOf(w)[w.move].windup + movesOf(w)[w.move].active && gap(d) <= 1.7) return act('light');   // the warden's OWN weapon's timings (the cleaver's chop is live longer than the sword's cut)
  if (w.exhausted && gap(d) <= 1.7) return act('heavy');
  return idle();
};

test('fight identity — don\'t turtle: the Pitborn passes the fairness battery at normal and hard, breaks a held guard inside 6 s, and the off-line whiff punisher is the best honest answer to him', () => {
  for (const [level, cap] of [['normal', .5], ['hard', .35]] as const) {
    const rows = battery(level, 24, 7200, P, { ...STRATEGIES, 'whiff punisher': whiffPunisher });
    const table = Object.entries(rows).map(([n, r]) => `${n}: ${r.wins}W ${r.losses}L ${r.stalls}S untouched ${r.untouched} taken ${r.taken} landed ${r.landed}`).join('\n  ');
    for (const [name, r] of Object.entries(rows)) {
      if (name !== 'perfect parry') assert.ok(r.wins / 24 <= cap, `${level} · ${name} wins ${r.wins}/24 (cap ${cap * 100} %)\n  ${table}`);
      assert.ok(r.untouched <= (name === 'perfect parry' ? 8 : 2), `${level} · ${name} untouched in ${r.untouched}/24 fights\n  ${table}`);
    }
    // A guard held from the bell is broken (kick or charged heavy) in every fight, usually by his first heavy (~1.2 s) and inside 6 s in all
    // but a stubborn seed or two (his first charge was blocked and he had to come again): the punish for staying in block is not optional.
    const turtle = rows['turtle and punish'], breaks = [...turtle.firstBreak].sort((a, b) => a - b);
    assert.equal(breaks.length, 24, `${level} · the turtle's guard survived a whole fight\n  ${table}`);
    assert.ok(breaks[12] <= 180 && breaks.filter(t => t <= 360).length >= 22 && breaks[23] <= 480, `${level} · first guard breaks (ticks): ${breaks.join(' ')}\n  ${table}`);
    // Stepping off-line and punishing the whiff is the intended answer: it wins real fights and more of them than every other honest script
    // (the perfect-information parry is mastery, not a strategy). Regen at 40/s means no script literally empties his bar — the whiff is the weakness.
    const punisher = rows['whiff punisher'];
    assert.ok(punisher.wins >= 4, `${level} · the whiff punisher wins only ${punisher.wins}/24\n  ${table}`);
    for (const [name, r] of Object.entries(rows)) if (name !== 'whiff punisher' && name !== 'perfect parry') assert.ok(punisher.wins > r.wins, `${level} · ${name} wins ${r.wins} ≥ punisher ${punisher.wins}\n  ${table}`);
    console.log(`pitborn battery ${level}\n  ${table}\n  first guard break: median ${breaks[12]} ticks, slowest ${breaks[23]}`);
  }
});

test('AI vs AI at normal: the Veteran\'s brain in the hero body against the Pitborn finishes every fight, median 25–45 s', () => {
  const lengths: number[] = [];
  for (let s = 1; s <= 24; s++) {
    let d = ring(P, 1.6), hero = initialAi(((s * 2654435761) >>> 0) ^ 0x9e3779b9), brute = initialAi((s * 2654435761) >>> 0);
    for (let i = 0; i < 7200 && !d.finish; i++) { const a = decide(d, 0, hero, PROFILES.normal), b = decide(d, 1, brute, P.profiles.normal); hero = a.ai; brute = b.ai; d = stepDuel(d, [a.intent, b.intent]); }
    assert.ok(d.finish, `seed ${s} did not finish`); lengths.push(d.tick);
  }
  const median = lengths.sort((a, b) => a - b)[12] / 60;
  assert.ok(median >= 25 && median <= 45, `median ${median.toFixed(1)} s (${lengths.map(t => (t / 60).toFixed(0)).join(' ')})`);
  console.log(`pitborn AI vs AI: median ${median.toFixed(1)} s, range ${(lengths[0] / 60).toFixed(1)}–${(lengths[23] / 60).toFixed(1)} s`);
});
