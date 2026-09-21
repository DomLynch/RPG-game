// Opponents are data (moves.ts OPPONENTS): weapon, body scale, health, poise and a profile per level. The Veteran is the warden as
// shipped — `initialDuel()` is still exactly him. The Pitborn is the first creature: relentless, poised, more health, honest openings.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, initialAi } from '../src/ai.ts';
import { bladeImpact } from '../src/blade.ts';
import { bladePaths, bladePathsByRig } from '../src/blade-paths.ts';
import { createFighter, guardOf, idleIntent, initialDuel, legal, movesOf, opponentFighter, stepDuel, type Duel, type Intent } from '../src/duel.ts';
import { MOVES, OPPONENTS, PROFILES, RULES, WEAPONS, type AiProfile, type Opponent } from '../src/moves.ts';
import { RADIUS, TARGET, type State } from '../src/sim.ts';
import { STRATEGIES, battery, side } from './strategies.ts';

const P = OPPONENTS.pitborn;
const idle = (): Intent => ({ ...idleIntent(), lock: true }), act = (action: Intent['action']): Intent => ({ ...idle(), action });
const ring = (o: Opponent, gap = 1.2): Duel => ({ tick: 0, fighters: [createFighter({ x: 0, z: TARGET.z + gap, heading: Math.PI, distance: 0 }, 'ready'), opponentFighter(o, { ...TARGET, heading: 0, distance: 0 })], finish: null, events: [] });
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
  assert.deepEqual(OPPONENTS.veteran.profiles.easy, PROFILES.easy); assert.deepEqual(OPPONENTS.veteran.profiles.normal, PROFILES.normal);   // his own table since the hard tune (owner, 2026-09-20)
  assert.deepEqual(OPPONENTS.veteran.profiles.hard, { ...PROFILES.hard, pressure: .7, discipline: 30 }, 'hard differs from the shared table in pressure and discipline only');
  assert.equal(WEAPONS.cleaver.placeholder, undefined); assert.notEqual(WEAPONS.cleaver.moves, MOVES); assert.notDeepEqual(bladePaths.cleaver, bladePaths.longsword, 'baked from the cleaver rig');
});

// The goblin (opponent 4, character lane): his data entry and the knife slot are in; his fight identity (feints, no guard, darting) waits on the
// AI knobs the combat lane owns (artifacts/goblin/REQUESTS.md), so this pins the seam only — no fairness battery is asserted for him yet.
test('the goblin is set up from his data: the knife (live, slice X), 0.78× scale, 120 health, poise 0, never parries; the hero is unchanged; and a fight against him finishes', () => {
  const G = OPPONENTS.goblin, [hero, goblin] = initialDuel(G).fighters;
  assert.deepEqual(hero, initialDuel().fighters[0]);
  assert.equal(goblin.weapon, 'knife'); assert.equal(goblin.scale, .78); assert.equal(goblin.health, 120); assert.equal(goblin.maxHealth, 120); assert.equal(goblin.poise, 0);
  assert.equal(WEAPONS.knife.placeholder, undefined); assert.notEqual(WEAPONS.knife.moves, MOVES); assert.notDeepEqual(bladePaths.knife, bladePaths.longsword, 'baked from his own rig');
  for (const level of ['easy', 'normal', 'hard'] as const) { const p = G.profiles[level]; assert.equal(p.parry, 0, `${level}: he never parries`); assert.ok(p.dodge >= .3 && p.reaction <= PROFILES[level].reaction, `${level}: dodges, reacts fast`); }
  // The capsule follows his height: a blade level at 1.40 m is a head hit on a man and passes over the goblin; at 1.13 m (1.45 × 0.78) it finds his head where a man takes it in the chest.
  bladePathsByRig.hero.probe = { flat: [[-.5, 1.4, 0, .5, 1.4, 0], [-.5, 1.4, 0, .5, 1.4, 0]], low: [[-.5, 1.13, 0, .5, 1.13, 0], [-.5, 1.13, 0, .5, 1.13, 0]] };
  const o: State = { x: 0, z: 0, heading: 0, distance: 0 };
  try { assert.equal(bladeImpact('hero', 'probe', 'flat', 0, 1, o, o, o, o, G.scale), null); assert.equal(bladeImpact('hero', 'probe', 'low', 0, 1, o, o, o, o, G.scale), 'head'); assert.equal(bladeImpact('hero', 'probe', 'low', 0, 1, o, o, o, o), 'torso'); }
  finally { delete bladePathsByRig.hero.probe; }
  const lengths: number[] = [];
  for (let s = 1; s <= 12; s++) {
    let d = ring(G, 1.6), a = initialAi(((s * 2654435761) >>> 0) ^ 0x9e3779b9), b = initialAi((s * 2654435761) >>> 0);
    for (let i = 0; i < 7200 && !d.finish; i++) { const x = decide(d, 0, a, PROFILES.normal), y = decide(d, 1, b, G.profiles.normal); a = x.ai; b = y.ai; d = stepDuel(d, [x.intent, y.intent]); }
    assert.ok(d.finish, `seed ${s} did not finish`); lengths.push(d.tick);
  }
  console.log(`goblin AI vs AI (12 seeds): median ${(lengths.sort((x, y) => x - y)[6] / 60).toFixed(1)} s, range ${(lengths[0] / 60).toFixed(1)}–${(lengths[11] / 60).toFixed(1)} s`);
});

// ── The goblin's fight (slice X): feints, no guard, hit and run, a dart into whiffs — and the knife's numbers as the weapons lane shipped them.
const G = OPPONENTS.goblin;
// Swings at every tell, feint or not: what the goblin's feints are for.
const swinger = (d: Duel): Intent => { const w = d.fighters[1]; return d.fighters[0].phase === 'ready' && w.phase === 'attack' && w.age <= 2 && gap(d) <= 1.7 ? act('light') : idle(); };
// The patient answer: never swings first; steps out of a swing, cuts into the whiff, heavies him when he is spent (the whiff punisher, reading the goblin's own timings).
// Since the lorarii (RULES.wall.loiter, 2026-09-21) the patient man also walks off the wall: his backsteps drift him there over a long
// fight, and standing in the band without attacking is what gets a man whipped (seeds 7 and 10 lost him the fight to the lash).
const offTheWall = (d: Duel): Intent | null => { const b = d.fighters[0].body, r = Math.hypot(b.x, b.z); return r >= RADIUS - RULES.wall.loiter.band ? { ...idle(), move: { x: -b.x / r, z: -b.z / r, yaw: 0, run: false } } : null; };
const patient = (d: Duel): Intent => { const w = d.fighters[1], p = d.fighters[0]; if (p.phase !== 'ready') return idle();
  if (w.phase === 'attack' && w.age <= 4 && !w.landed && w.move !== 'kick') return act('backstep');
  if (w.phase === 'attack' && w.move && !w.landed && w.age >= movesOf(w)[w.move].windup + movesOf(w)[w.move].active && gap(d) <= 1.7) return act('light');
  if (w.exhausted && gap(d) <= 1.7) return act('heavy'); return offTheWall(d) ?? idle(); };

test('the goblin is set up as the brief asks: knobs on every level (feints, guard 0, disengage, circle, step, interrupt, kick, dash), regen 1.5 and pace 1.2, the knife live', () => {
  for (const level of ['easy', 'normal', 'hard'] as const) { const p = G.profiles[level]; assert.equal(p.guard, 0, `${level}: never guards`); assert.equal(p.parry, 0); for (const k of ['feint', 'disengage', 'circle', 'step', 'interrupt', 'kick', 'dash'] as const) assert.ok((p[k] ?? 0) > 0, `${level}: ${k}`); }
  assert.equal(G.regen, 1.5); assert.equal(G.speed, 1.2); assert.equal(G.weapon, 'knife'); assert.equal(WEAPONS.knife.placeholder, undefined);
  const [, him] = initialDuel(G).fighters; assert.equal(him.regen, 1.5); assert.equal(him.speed, 1.2);
});

test('fight identity — read the feint: the goblin passes the fairness battery at normal and hard; the patient whiff punisher is the best honest answer and beats the player who swings at every tell; he never holds a guard and never blocks; every strategy gets touched [slow]', () => {
  // Floors: at 100 hp the patient answer won 8/24 at normal; the owner raised him to 120 hp (2026-09-17: rung 3 should be harder than the Pitborn, and it
  // is — the hero brain now loses 15/24 to him, 8/24 before) and against 120 hp the patient script's slow damage runs out the two-minute clock instead:
  // it still never loses to him and still beats the swinger, and that is what is pinned.
  for (const [level, cap, floor] of [['normal', .5, 2], ['hard', .35, 1]] as const) {
    let guardRun = 0, maxGuardRun = 0, blocks = 0;
    const watched = (strategy: (d: Duel) => Intent) => (d: Duel) => { const g = d.fighters[1]; if (g.phase === 'guard') { guardRun++; maxGuardRun = Math.max(maxGuardRun, guardRun); } else guardRun = 0; if (d.events.some(e => e.type === 'Blocked' && e.actor === 1)) blocks++; return strategy(d); };
    const scripts = Object.fromEntries(Object.entries({ ...STRATEGIES, 'swings at every feint': swinger, 'patient (whiff punisher)': patient }).map(([n, f]) => [n, watched(f)]));
    const rows = battery(level, 24, 7200, G, scripts);
    const table = Object.entries(rows).map(([n, r]) => `${n}: ${r.wins}W ${r.losses}L ${r.stalls}S untouched ${r.untouched} taken ${r.taken} landed ${r.landed}`).join('\n  ');
    for (const [name, r] of Object.entries(rows)) {
      if (name !== 'perfect parry') assert.ok(r.wins / 24 <= cap, `${level} · ${name} wins ${r.wins}/24 (cap ${cap * 100} %)\n  ${table}`);
      assert.ok(r.untouched <= (name === 'perfect parry' ? 8 : 2), `${level} · ${name} untouched in ${r.untouched}/24 fights\n  ${table}`);
    }
    // The patience-vs-eagerness comparison is read over 48 seeds: with 21–22 of 24 fights running out the clock, its two win counts sit at
    // 2–3 and a single chaotic seed decided it (the lorarii, 2026-09-21: one lash on the goblin turned a 3-vs-2 into a 2-vs-2 at 24 seeds;
    // at 48 it reads 3-vs-2 with and 4-vs-2 without the rule).
    const wide = battery(level, 48, 7200, G, { 'patient (whiff punisher)': patient, 'swings at every feint': swinger });
    const answer = wide['patient (whiff punisher)'], eager = wide['swings at every feint'];
    assert.ok(answer.wins >= floor && answer.losses === 0, `${level} · the patient answer wins ${answer.wins}/48 and loses ${answer.losses}\n  ${table}`);
    assert.ok(eager.wins < answer.wins, `${level} · swinging at every feint (${eager.wins}/48) is not punished against patience (${answer.wins}/48)\n  ${table}`);
    for (const name of ['light spam', 'heavy only', 'kick only', 'turtle and punish', 'thrust from range']) assert.ok(rows[name].wins < Math.max(rows['patient (whiff punisher)'].wins, 1), `${level} · ${name} wins ${rows[name].wins} ≥ the answer's ${rows['patient (whiff punisher)'].wins}\n  ${table}`);
    // No guard in his game: the only guard phase he ever shows is a feint's parry press (RULES.parry ticks), and nothing is ever blocked by him.
    assert.ok(maxGuardRun <= RULES.parry, `${level} · a guard held ${maxGuardRun} ticks`); assert.equal(blocks, 0, `${level} · he blocked ${blocks} times`);
    console.log(`goblin battery ${level}\n  ${table}\n  longest guard phase ${maxGuardRun} ticks (a feint's parry press), blocks ${blocks}`);
  }
});

test('AI vs AI at normal: the Veteran\'s brain in the hero body against the goblin finishes every fight, median 25–45 s', () => {
  const lengths: number[] = [];
  for (let s = 1; s <= 24; s++) {
    let d = ring(G, 1.6), hero = initialAi(((s * 2654435761) >>> 0) ^ 0x9e3779b9), him = initialAi((s * 2654435761) >>> 0);
    for (let i = 0; i < 7200 && !d.finish; i++) { const a = decide(d, 0, hero, PROFILES.normal), b = decide(d, 1, him, G.profiles.normal); hero = a.ai; him = b.ai; d = stepDuel(d, [a.intent, b.intent]); }
    assert.ok(d.finish, `seed ${s} did not finish`); lengths.push(d.tick);
  }
  const median = lengths.sort((a, b) => a - b)[12] / 60;
  assert.ok(median >= 25 && median <= 45, `median ${median.toFixed(1)} s (${lengths.map(t => (t / 60).toFixed(0)).join(' ')})`);
  console.log(`goblin AI vs AI: median ${median.toFixed(1)} s, range ${(lengths[0] / 60).toFixed(1)}–${(lengths[23] / 60).toFixed(1)} s`);
});

test('the Pitborn is set up from his data: the cleaver slot, 1.13× scale, 190 health and poise 16 on the warden side; the hero is unchanged', () => {
  const [hero, brute] = initialDuel(P).fighters;
  assert.deepEqual(hero, initialDuel().fighters[0]);
  assert.equal(brute.weapon, 'cleaver'); assert.equal(brute.scale, 1.13); assert.equal(brute.health, 190); assert.equal(brute.maxHealth, 190); assert.equal(brute.poise, 16);
  assert.ok(P.profiles.normal.aggression > PROFILES.normal.aggression && P.profiles.normal.parry < PROFILES.normal.parry && P.profiles.normal.reaction >= PROFILES.normal.reaction && P.profiles.normal.lapse <= PROFILES.normal.lapse, 'relentless, rarely parries; notices like a man and answers what he sees (the 2026-09-20 tune: he was the softest rung, walking onto every stab)');
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
  bladePathsByRig.hero.probe = { flat: [[-.5, 1.4, 0, .5, 1.4, 0], [-.5, 1.4, 0, .5, 1.4, 0]], high: [[-.5, 1.9, 0, .5, 1.9, 0], [-.5, 1.9, 0, .5, 1.9, 0]] };
  const o: State = { x: 0, z: 0, heading: 0, distance: 0 };
  try {
    assert.equal(bladeImpact('hero', 'probe', 'flat', 0, 1, o, o, o, o), 'head'); assert.equal(bladeImpact('hero', 'probe', 'flat', 0, 1, o, o, o, o, P.scale), 'torso');
    assert.equal(bladeImpact('hero', 'probe', 'high', 0, 1, o, o, o, o), null); assert.equal(bladeImpact('hero', 'probe', 'high', 0, 1, o, o, o, o, P.scale), 'head');
  } finally { delete bladePathsByRig.hero.probe; }
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

test('fight identity — don\'t turtle: the Pitborn passes the fairness battery at normal and hard, breaks a held guard inside 6 s, and the off-line whiff punisher is the best honest answer to him [slow]', () => {
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
  const lengths: number[] = []; let heroWins = 0;
  for (let s = 1; s <= 24; s++) {
    let d = ring(P, 1.6), hero = initialAi(((s * 2654435761) >>> 0) ^ 0x9e3779b9), brute = initialAi((s * 2654435761) >>> 0);
    for (let i = 0; i < 7200 && !d.finish; i++) { const a = decide(d, 0, hero, PROFILES.normal), b = decide(d, 1, brute, P.profiles.normal); hero = a.ai; brute = b.ai; d = stepDuel(d, [a.intent, b.intent]); }
    assert.ok(d.finish, `seed ${s} did not finish`); lengths.push(d.tick); if (d.finish!.victim === 1) heroWins++;
  }
  const median = lengths.sort((a, b) => a - b)[12] / 60;
  assert.ok(median >= 25 && median <= 45, `median ${median.toFixed(1)} s (${lengths.map(t => (t / 60).toFixed(0)).join(' ')})`);
  // The 2026-09-20 tune (reaction 18 → 14, lapse .3 → .1): rung 2 is no longer the softest fight — the hero's brain won 17/24 before, 13/24 after, the Veteran's own 13.
  assert.ok(heroWins <= 15, `the hero brain wins ${heroWins}/24 — the Pitborn is the pushover again`);
  console.log(`pitborn AI vs AI: hero wins ${heroWins}/24, median ${median.toFixed(1)} s, range ${(lengths[0] / 60).toFixed(1)}–${(lengths[23] / 60).toFixed(1)} s`);
});

// ── The Nightborn (opponent 5): the parry is his game, and the parry is how he is beaten — feint it, bait it, or charge past it.
const N = OPPONENTS.nightborn;
const isLight = (f: Duel['fighters'][number]) => f.move === 'light_left' || f.move === 'light_right';
// Feint and punish: open with a cut; the moment his blade comes up while the cut can still be feinted, feint and HOLD the guard (a released
// tap would bare the player's own guard); when he is exposed, release and hit him. Out of his swings with a backstep, as the whiff punisher.
export const feintAndPunish = (d: Duel): Intent => {
  const p = d.fighters[0], w = d.fighters[1], up = p.phase === 'ready' && !p.exposed;
  const t = w.phase === 'attack' && w.move ? movesOf(w)[w.move] : null, threat = t !== null && !w.landed && w.age < t.windup + t.active && w.move !== 'kick', recovering = t !== null && w.age >= t.windup + t.active;
  if (w.exposed > 0 && up && gap(d) <= 1.7) return act('light');   // the punish: a cut lands well inside the exposure (a heavy would too, but the feint and the held guard leave no stamina for one)
  if (w.exposed > 0 && p.phase === 'guard') return idle();
  if (threat && w.age <= 4 && up) return act('backstep');   // out of his swings while there is time, as the whiff punisher
  if (threat && (up || p.phase === 'guard')) return { ...idle(), guard: true, guardDirection: side(d) };   // too late to step: take it on the guard (the side read) — restraint
  if (p.phase === 'attack' && isLight(p) && p.age < movesOf(p)[p.move!].feintUntil && w.phase === 'guard' && w.parrying) return { ...act('parry'), guardDirection: side(d) };
  if (p.phase === 'guard' && w.phase === 'guard' && w.parrying) return { ...idle(), guard: true, guardDirection: side(d) };
  if (up && gap(d) <= 1.7 && (w.phase === 'ready' || w.phase === 'hurt' || recovering) && !w.exposed) return act('light');   // open (or punish a whiff's recovery) with the cut his parry wants
  return idle();
};
// Charge past the parry: chamber a heavy and hold it until his parry has come and gone, then release into what is left.
export const chargePast = (d: Duel): Intent => {
  const p = d.fighters[0], w = d.fighters[1];
  if (p.phase === 'attack' && p.move === 'heavy_overhead' && !p.landed) return { ...idle(), held: !(p.charged && (w.phase !== 'guard' || !w.parrying)) };
  if (p.phase === 'ready' && !p.exposed && gap(d) <= 1.8) return { ...act('heavy'), held: true };
  return idle();
};

test('the Nightborn is set up from his data: the live estoc, a man\'s health, no poise, and a guard that commits — a 16-tick parry window and a 30-tick recovery on top of the weapon\'s profile', () => {
  const d = initialDuel(N), w = d.fighters[1];
  assert.equal(w.weapon, 'estoc'); assert.equal(WEAPONS.estoc.placeholder, undefined); assert.notDeepEqual(WEAPONS.estoc.moves, MOVES);
  assert.equal(w.scale, N.scale); assert.equal(w.maxHealth, RULES.health); assert.equal(w.poise, 0);
  assert.deepEqual(guardOf(w), { costScale: 1, arc: RULES.guardArc, window: 16, recovery: 40, commits: true, stopsHeavy: false, heavyBreaks: false });
  assert.deepEqual(guardOf(d.fighters[0]), { costScale: 1, arc: RULES.guardArc, window: RULES.parry, recovery: RULES.parryRecovery, commits: false, stopsHeavy: false, heavyBreaks: false }, 'the hero\'s guard is untouched');
  assert.deepEqual(guardOf(initialDuel().fighters[1]).commits, false, 'the Veteran\'s parry still yields to any action');
});

test('the committing parry, tick by tick: his blade comes up inside the feint window of a 20-tick cut, a feint leaves it parrying nothing, no cut comes out of it, and when the window closes he is exposed for 40 ticks with no swing in him — the punish lands clean (a lapse or a block on a given cut is his call; over six seeds the chain must close in most)', () => {
  const feintUntil = MOVES.light_right.feintUntil; let chains = 0; const presses: number[] = [];
  for (let seed = 1; seed <= 6; seed++) {
    let d = ring(N, 1.2), ai = initialAi(seed), pressed = -1, exposedAt = -1, punished = -1;
    for (let i = 0; i < 900 && punished < 0 && !d.finish; i++) {
      const w = decide(d, 1, ai, N.profiles.normal); ai = w.ai;
      d = stepDuel(d, [feintAndPunish(d), w.intent]);
      const him = d.fighters[1], me = d.fighters[0];
      if (him.phase === 'guard' && him.parrying && him.age === 0 && me.phase === 'attack' && isLight(me)) { pressed = me.age; presses.push(me.age); exposedAt = -1; }   // a fresh press at one of my cuts
      if (pressed >= 0 && him.phase === 'guard' && him.parrying && !him.punish) { assert.equal(legal(him, 'light'), false, `tick ${d.tick}: no cut out of a committed parry`); assert.equal(legal(him, 'kick'), false, 'no kick out of it either'); }   // a parry that connected opens its punish window — the riposte is his
      if (pressed >= 0 && exposedAt < 0 && him.exposed > 0 && him.age === 0) { exposedAt = d.tick; assert.equal(him.exposed, 40); assert.equal(legal(him, 'light'), false, 'no swing while exposed'); assert.equal(legal(him, 'parry'), false, 'no parry while exposed'); }
      if (exposedAt >= 0 && him.exposed > 0 && d.events.some(e => e.type === 'Hit' && e.actor === 0 && e.target === 1)) { punished = d.tick; assert.ok(punished - exposedAt <= 40, `the punish landed ${punished - exposedAt} ticks into a 40-tick exposure`); }
    }
    if (punished > 0) chains++;
  }
  assert.ok(presses.length >= 6, `only ${presses.length} presses at cuts over six seeds`);
  for (const t of presses) assert.ok(t <= feintUntil - 1, `his parry came up at cut tick ${t}: past the feint window (${feintUntil})`);
  assert.ok(chains >= 4, `feint → whiff → exposed → punished closed in ${chains}/6 seeds`);
  console.log(`nightborn: parry presses at cut ticks ${presses.join(' ')} (feint window closes at ${feintUntil}); the chain closed in ${chains}/6 seeds`);
});

test('fight identity — don\'t spam, bait him: the Nightborn passes the fairness battery at normal and hard; the feint-and-punish is the best honest answer at normal and no plain script beats him; a cut-spammer is parried, and a habitual bait or charge stops working once read [slow]', () => {
  for (const [level, cap, floor] of [['normal', .5, 3], ['hard', .35, 1]] as const) {
    const rows = battery(level, 24, 7200, N, { ...STRATEGIES, 'feint and punish': feintAndPunish, 'charge past the parry': chargePast });
    const table = Object.entries(rows).map(([n, r]) => `${n}: ${r.wins}W ${r.losses}L ${r.stalls}S untouched ${r.untouched} taken ${r.taken} landed ${r.landed}`).join('\n  ');
    for (const [name, r] of Object.entries(rows)) {
      if (name !== 'perfect parry') assert.ok(r.wins / 24 <= cap, `${level} · ${name} wins ${r.wins}/24 (cap ${cap * 100} %)\n  ${table}`);
      assert.ok(r.untouched <= (name === 'perfect parry' ? 8 : 2), `${level} · ${name} untouched in ${r.untouched}/24 fights\n  ${table}`);
    }
    const answer = rows['feint and punish'];
    assert.ok(answer.wins >= floor, `${level} · the feint-and-punish wins only ${answer.wins}/24\n  ${table}`);
    for (const name of ['light spam', 'heavy only', 'thrust from range', 'kick only', 'turtle and punish']) assert.ok(rows[name].wins === 0 || rows[name].wins < answer.wins, `${level} · ${name} wins ${rows[name].wins} ≥ the answer's ${answer.wins}\n  ${table}`);
    // The habits are read: a script that parks every swing (held lights, a charge every time) gets its first exchanges and then nothing — under the cap, never a farm.
    for (const name of ['held lights', 'charged heavy only', 'charge past the parry']) assert.ok(rows[name].wins / 24 <= cap, `${level} · ${name} is a farm: ${rows[name].wins}/24\n  ${table}`);
    console.log(`nightborn battery ${level}\n  ${table}`);
  }
});

test('AI vs AI at normal: the Veteran\'s brain in the hero body against the Nightborn finishes every fight, median 18–40 s, and wins some of them — he is beatable by a baiter, not by outlasting', () => {
  const lengths: number[] = []; let heroWins = 0, exhausted = 0;
  for (let s = 1; s <= 24; s++) {
    let d = ring(N, 1.6), hero = initialAi(((s * 2654435761) >>> 0) ^ 0x9e3779b9), him = initialAi((s * 2654435761) >>> 0);
    for (let i = 0; i < 7200 && !d.finish; i++) { const a = decide(d, 0, hero, PROFILES.normal), b = decide(d, 1, him, N.profiles.normal as AiProfile); hero = a.ai; him = b.ai; d = stepDuel(d, [a.intent, b.intent]); if (d.fighters[1].exhausted) exhausted++; }
    assert.ok(d.finish, `seed ${s} did not finish`); lengths.push(d.tick); if (d.finish!.victim === 1) heroWins++;
  }
  const median = lengths.sort((a, b) => a - b)[12] / 60;
  assert.ok(median >= 18 && median <= 40, `median ${median.toFixed(1)} s (${lengths.map(t => (t / 60).toFixed(0)).join(' ')})`);
  assert.ok(heroWins >= 3, `the hero won ${heroWins}/24`);
  assert.ok(exhausted <= 24 * 10, `the Nightborn was exhausted on ${exhausted} ticks over 24 fights — he is beaten by wit, not stamina`);
  console.log(`nightborn AI vs AI: median ${median.toFixed(1)} s, range ${(lengths[0] / 60).toFixed(1)}–${(lengths[23] / 60).toFixed(1)} s, hero wins ${heroWins}/24`);
});

// ── The Executioner (opponent 5, 2026-09-18 by the roster lane; gated 2026-09-20 by the combat lane): the man's brain (PROFILES) in a 1.36×
// brute with 160 hp, poise 12 and the scythe — huge reach, a shaft guard. No bespoke answer is prescribed for him; the standard rules are the gate.
const E = OPPONENTS.executioner;
test('the Executioner is set up from his data: the live scythe, 1.36× scale, 160 health, poise 12, the shared PROFILES; the hero is unchanged', () => {
  const [hero, him] = initialDuel(E).fighters;
  assert.deepEqual(hero, initialDuel().fighters[0]);
  assert.equal(him.weapon, 'scythe'); assert.equal(WEAPONS.scythe.placeholder, undefined); assert.equal(him.scale, 1.36); assert.equal(him.health, 160); assert.equal(him.maxHealth, 160); assert.equal(him.poise, 12);
  assert.equal(E.profiles, PROFILES);
});

test('fight identity — reach: the Executioner passes the fairness battery at normal and hard (no cheese over the caps, every strategy touched), an honest script can beat him, and a man parked inside his point is not left alone [slow]', () => {
  const parked = (at: number) => (d: Duel): Intent => ({ ...idle(), move: { x: 0, z: gap(d) > at + .05 ? -1 : gap(d) < at - .05 ? 1 : 0, yaw: 0, run: false } });   // stands at a chosen distance and never swings
  for (const [level, cap] of [['normal', .5], ['hard', .35]] as const) {
    const rows = battery(level, 24, 7200, E, { ...STRATEGIES, 'whiff punisher': whiffPunisher, 'parked at 1.2 m': parked(1.2), 'parked at 1.6 m': parked(1.6) });
    const table = Object.entries(rows).map(([n, r]) => `${n}: ${r.wins}W ${r.losses}L ${r.stalls}S untouched ${r.untouched} taken ${r.taken} landed ${r.landed}`).join('\n  ');
    for (const [name, r] of Object.entries(rows)) {
      if (name !== 'perfect parry') assert.ok(r.wins / 24 <= cap, `${level} · ${name} wins ${r.wins}/24 (cap ${cap * 100} %)\n  ${table}`);
      assert.ok(r.untouched <= (name === 'perfect parry' ? 8 : 2), `${level} · ${name} untouched in ${r.untouched}/24 fights\n  ${table}`);
    }
    // No bespoke answer was designed for him; what is pinned is that an honest script beats him at all at normal (the charged heavy through his shaft guard does — the whiff punisher does not: the scythe walks through a backstep).
    const honest = Object.entries(rows).filter(([n]) => n !== 'perfect parry' && !n.startsWith('parked')).map(([, r]) => r.wins);
    if (level === 'normal') assert.ok(Math.max(...honest) >= 3, `${level} · no honest script wins 3 of 24 against him\n  ${table}`);
    for (const name of ['parked at 1.2 m', 'parked at 1.6 m']) assert.equal(rows[name].wins + rows[name].untouched, 0, `${level} · ${name}: a man who stands still inside his reach is killed, never left alone\n  ${table}`);
    console.log(`executioner battery ${level}\n  ${table}`);
  }
});

test('AI vs AI at normal: the Veteran\'s brain in the hero body against the Executioner finishes every fight, median 18–45 s', () => {
  const lengths: number[] = [];
  for (let s = 1; s <= 24; s++) {
    let d = ring(E, 1.6), hero = initialAi(((s * 2654435761) >>> 0) ^ 0x9e3779b9), him = initialAi((s * 2654435761) >>> 0);
    for (let i = 0; i < 7200 && !d.finish; i++) { const a = decide(d, 0, hero, PROFILES.normal), b = decide(d, 1, him, E.profiles.normal); hero = a.ai; him = b.ai; d = stepDuel(d, [a.intent, b.intent]); }
    assert.ok(d.finish, `seed ${s} did not finish`); lengths.push(d.tick);
  }
  const median = lengths.sort((a, b) => a - b)[12] / 60;
  assert.ok(median >= 18 && median <= 45, `median ${median.toFixed(1)} s (${lengths.map(t => (t / 60).toFixed(0)).join(' ')})`);
  console.log(`executioner AI vs AI: median ${median.toFixed(1)} s, range ${(lengths[0] / 60).toFixed(1)}–${(lengths[23] / 60).toFixed(1)} s`);
});

// ---- the Dwarf: the warhammer (Combat slice, owner 2026-09-20: "less dangerous and balanced with the other weapons") ----
const DW = OPPONENTS.dwarf;

test('the Dwarf is set up from his data: the live warhammer (own blunt table, shaft guard), .78× scale, 170 health, poise 12, his own profiles; the hero is unchanged', () => {
  const [hero, him] = initialDuel(DW).fighters;
  assert.deepEqual(hero, initialDuel().fighters[0]);
  assert.equal(him.weapon, 'warhammer'); assert.equal(WEAPONS.warhammer.placeholder, undefined); assert.notEqual(WEAPONS.warhammer.moves, MOVES); assert.notEqual(WEAPONS.warhammer.moves, WEAPONS.maul.moves);
  assert.equal(him.scale, .78); assert.equal(him.health, 170); assert.equal(him.poise, 12);
  assert.deepEqual(him.guardProfile, { costScale: 1.15, heavyBreaks: true }, 'a shaft guard like the trident: a heavy breaks it');
  const w = WEAPONS.warhammer.moves;
  assert.equal(w.light_right.damage, w.light_left.damage, 'a hammer head has no backhand edge: symmetrical swings');
  assert.equal(w.light_right.chip, 0); assert.equal(w.heavy_overhead.poise, 0, 'the overhead can be cut into: the maul\'s hyper-armour was the wall');
  for (const id of ['slash_riposte', 'riposte', 'heavy_riposte', 'heavy_counter', 'critical'] as const) assert.ok(w[id].damage < WEAPONS.cleaver.moves[id].damage && w[id].damage <= MOVES[id].damage, `${id}: a blunt punish under the cleaver's and the sword's`);
  assert.notEqual(DW.profiles, PROFILES); assert.ok(DW.profiles.normal.pressure >= .4 && DW.profiles.normal.parry <= .2, 'a chopper\'s mix, not the Veteran\'s heavy-first opener');
});

test('fight identity — inside: the Dwarf passes the fairness battery at normal and hard (no cheese over the caps, every strategy touched) and an honest script can beat him [slow]', () => {
  for (const [level, cap] of [['normal', .5], ['hard', .35]] as const) {
    const rows = battery(level, 24, 7200, DW, { ...STRATEGIES, 'whiff punisher': whiffPunisher });
    const table = Object.entries(rows).map(([n, r]) => `${n}: ${r.wins}W ${r.losses}L ${r.stalls}S untouched ${r.untouched} taken ${r.taken} landed ${r.landed}`).join('\n  ');
    for (const [name, r] of Object.entries(rows)) {
      if (name !== 'perfect parry') assert.ok(r.wins / 24 <= cap, `${level} · ${name} wins ${r.wins}/24 (cap ${cap * 100} %)\n  ${table}`);
      assert.ok(r.untouched <= (name === 'perfect parry' ? 8 : 2), `${level} · ${name} untouched in ${r.untouched}/24 fights\n  ${table}`);
    }
    console.log(`dwarf battery ${level}\n  ${table}`);
  }
});

test('the Dwarf sits in the rung-6 band: the Veteran\'s brain in the hero body wins 8–15 of 24 at normal and at least 2 at hard (the maul placeholder was 2 and 1), every fight finishing, median 20–45 s', () => {
  for (const [level, lo, hi] of [['normal', 8, 15], ['hard', 2, 12]] as const) {
    let wins = 0; const lengths: number[] = [];
    for (let s = 1; s <= 24; s++) {
      let d = ring(DW, 1.6), hero = initialAi(((s * 2654435761) >>> 0) ^ 0x9e3779b9), him = initialAi((s * 2654435761) >>> 0);
      for (let i = 0; i < 7200 && !d.finish; i++) { const a = decide(d, 0, hero, PROFILES.normal), b = decide(d, 1, him, DW.profiles[level]); hero = a.ai; him = b.ai; d = stepDuel(d, [a.intent, b.intent]); }
      assert.ok(d.finish, `${level} seed ${s} did not finish`); lengths.push(d.tick); if (d.finish!.victim === 1) wins++;
    }
    const median = lengths.sort((a, b) => a - b)[12] / 60;
    assert.ok(wins >= lo && wins <= hi, `${level} · hero wins ${wins}/24, band ${lo}–${hi}`);
    assert.ok(median >= 20 && median <= 45, `${level} · median ${median.toFixed(1)} s`);
    console.log(`dwarf ${level}: hero wins ${wins}/24, median ${median.toFixed(1)} s`);
  }
});
