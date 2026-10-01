import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { RULES } from '../src/moves.ts';
import { SPECIAL_RECOVER, SPECIAL_TESTS, specialParam } from '../src/special-look.ts';
import { SPECIAL_MODES } from '../src/special-modes.ts';
import { BOSS_TAIL, CAST_MARGIN, DISSOLVE_TICKS, LAND_AT, advanceCast, bossClock, type Cast } from '../src/special-timing.ts';
import { BOSS_KINDS, BOSS_OPPONENT, DUST, GRIT, STRIDE, createBossFx, fillBoss, isBossCast, makeField, makeGeo, setGeo } from '../src/special-fx-boss.ts';

// The Dwarf's and the Shieldmaiden's boss specials, ranks 8-10 (special-fx-boss.ts; preview only, `?special=dwarf8..shield10`): which page draws what, a pure
// timeline off the cast clock, the hard timeout, no Math.random, sprites only, one registry entry each.
const fighters = (special = 0) => [{ special: 0 }, { special, skill: 'shove' }] as unknown as readonly [Fighter, Fighter];
const started = (tick: number, actor = 1) => ({ tick, type: 'SpecialStarted', actor, move: 'skill_shove' }) as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_shove', damage: 30 }) as unknown as CombatEvent;
const fizzled = (tick: number) => ({ tick, type: 'SpecialFizzled', actor: 1 }) as unknown as CombatEvent;
const heads = [new THREE.Vector3(0.2, 1.62, -1.1), new THREE.Vector3(0, 1.7, 1)] as const;
const geometry = () => { const g = makeGeo(); setGeo(g, new THREE.Vector3(0.1, 1.7, 1.4), new THREE.Vector3(-0.2, 1.62, -1.1)); return g; };
const peak = (buf: Float32Array) => { let m = 0; for (let o = 6; o < buf.length; o += STRIDE) m = Math.max(m, buf[o]); return m; };
const lit = (buf: Float32Array) => { let n = 0; for (let o = 6; o < buf.length; o += STRIDE) if (buf[o] > 0.004) n++; return n; };

test('the six pages name their opponent at level 5*(rank-1)+1 with the same 3 s first cast, and each has one registry entry', () => {
  const want = { dwarf8: ['dwarf', 36], dwarf9: ['dwarf', 41], dwarf10: ['dwarf', 46], shield8: ['shieldmaiden', 36], shield9: ['shieldmaiden', 41], shield10: ['shieldmaiden', 46] } as const;
  assert.deepEqual([...BOSS_KINDS].sort(), Object.keys(want).sort());
  for (const [name, [opponent, level]] of Object.entries(want)) {
    assert.equal(specialParam(`?special=${name}`), name);
    assert.equal(specialParam(`?debug&special=${name.toUpperCase()}`), name);
    assert.deepEqual(SPECIAL_TESTS[name as keyof typeof SPECIAL_TESTS], { opponent, level, first: 180 });
    assert.equal(BOSS_OPPONENT[name as keyof typeof want], opponent);
    const mode = SPECIAL_MODES[name as keyof typeof want]!;
    assert.ok(mode && mode.at === 'head' && !mode.held, `${name} has its one registry entry (heads, no pose)`);
  }
  for (const search of ['?special=dwarf', '?special=dwarf11', '?special=shield', '?special=shieldmaiden8']) assert.ok(!['dwarf', 'dwarf11', 'shieldmaiden8'].includes(specialParam(search) ?? ''), search);
  assert.ok(!SPECIAL_MODES.hades, "Hades' cloud is still the default: no entry");
});

test('the boss modules ship lazily: reached only through the registry, nothing imports them statically', () => {
  assert.match(readFileSync('src/special-modes.ts', 'utf8'), /import\('\.\/special-fx-boss\.ts'\)/);
  assert.ok(!readdirSync('src').some((f) => f.endsWith('.ts') && f !== 'special-modes.ts' && /from\s+['"]\.\/special-fx-boss\.ts['"]/.test(readFileSync(`src/${f}`, 'utf8').replace(/^import type .*$/gm, ''))), 'nothing imports it statically');
  assert.ok(!/special-fx-boss/.test(readFileSync('src/scene.ts', 'utf8')), 'the scene names no boss module');
});

test("a boss cast is only the page's own opponent on the opponent side; the default timeline still tracks nobody else", () => {
  for (const kind of BOSS_KINDS) {
    const opponent = BOSS_OPPONENT[kind], is = isBossCast(kind), other = opponent === 'dwarf' ? 'shieldmaiden' : 'dwarf';
    assert.equal(advanceCast(null, [started(100)], fighters(), 100, opponent, false, is)?.start, 100, kind);
    assert.equal(advanceCast(null, [started(100, 0)], fighters(), 100, opponent, false, is), null, "the player's special has no art");
    assert.equal(advanceCast(null, [started(100)], fighters(), 100, other, false, is), null, 'not on the other boss');
    assert.equal(advanceCast(null, [started(100)], fighters(), 100, opponent, true, is), null, 'a finisher playing starts nothing');
    assert.equal(advanceCast(null, [started(100)], fighters(), 100, opponent, false), null, 'the default (Hades) test never tracks them');
  }
  const picked = advanceCast(null, [], fighters(RULES.special.windup - 30), 500, 'shieldmaiden', false, isBossCast('shield9'));
  assert.equal(picked?.start, 470, 'a wind-up already running when the effect loads is picked up');
});

test('the boss clock: rel is ticks to the landing, a fizzle freezes it and dissolves, a cast with no end times out', () => {
  const cast: Cast = { actor: 1, start: 1000, landed: null, fizzled: null };
  assert.deepEqual(bossClock(cast, 1000), { rel: -LAND_AT, fade: 1, struck: false, done: false });
  assert.equal(bossClock(cast, 1000 + LAND_AT).rel, 0);
  const hit = { ...cast, landed: 1000 + LAND_AT };
  assert.deepEqual([bossClock(hit, 1000 + LAND_AT).struck, bossClock(hit, 1000 + LAND_AT + BOSS_TAIL - 1).done, bossClock(hit, 1000 + LAND_AT + BOSS_TAIL).done], [true, false, true]);
  const fizz = bossClock({ ...cast, fizzled: 1060 }, 1070);
  assert.deepEqual([fizz.rel, fizz.struck, fizz.fade < 1 && fizz.fade > 0], [1060 - 1000 - LAND_AT, false, true], 'frozen where it hung');
  assert.equal(bossClock({ ...cast, fizzled: 1060 }, 1060 + DISSOLVE_TICKS).done, true);
  assert.equal(bossClock(cast, 1000 + LAND_AT + SPECIAL_RECOVER + CAST_MARGIN).done, true, 'the hard timeout');
});

test('every boss move is a pure timeline: the same inputs give the same particles; nothing in the first 1.5 s, a build-up, a payoff, gone after the recover', () => {
  const g = geometry();
  for (const kind of BOSS_KINDS) {
    const a = makeField(), b = makeField();
    for (let rel = -LAND_AT; rel <= BOSS_TAIL + 10; rel += 3) {
      fillBoss(kind, a, rel, g); b.dust.fill(9); b.grit.fill(9); fillBoss(kind, b, rel, g);
      assert.deepEqual([...a.dust], [...b.dust], `${kind} dust at ${rel}`); assert.deepEqual([...a.grit], [...b.grit], `${kind} grit at ${rel}`);
      for (const buf of [a.dust, a.grit]) for (let o = 0; o < buf.length; o++) assert.ok(Number.isFinite(buf[o]), `${kind} ${rel} finite`);
    }
    fillBoss(kind, a, -LAND_AT, g); assert.equal(lit(a.dust) + lit(a.grit), 0, `${kind}: nothing in the first 1.5 s of the wind-up`);
    fillBoss(kind, a, -12, g); assert.ok(lit(a.dust) + lit(a.grit) > 6, `${kind}: the build-up is drawn`);
    fillBoss(kind, a, 2, g); assert.ok(lit(a.dust) + lit(a.grit) > 6, `${kind}: the payoff is drawn`);
    fillBoss(kind, a, BOSS_TAIL, g); assert.ok(peak(a.dust) < 0.05 && peak(a.grit) < 0.05, `${kind}: gone when the tail ends (${peak(a.dust).toFixed(2)})`);
    fillBoss(kind, a, 2, g, 0.5); const half = peak(a.dust); fillBoss(kind, b, 2, g, 1); assert.ok(Math.abs(half - peak(b.dust) / 2) < 1e-6 || peak(b.dust) === 0, 'the fizzle fade scales opacity');
  }
  assert.ok(DUST === 72 && GRIT === 48, 'pools stay modest');
});

test('cover is the wrong lever: dust never passes 0.7 (The Ring 0.4) so both fighters stay readable; Three Blows is dark iron grit, three strikes, the third at the target', () => {
  const g = geometry(), f = makeField();
  for (const kind of BOSS_KINDS) { for (let rel = -LAND_AT; rel <= 50; rel++) { fillBoss(kind, f, rel, g); assert.ok(peak(f.dust) <= (kind === 'shield9' ? 0.4001 : 0.7001), `${kind} dust ceiling at ${rel} (${peak(f.dust).toFixed(2)})`); } }
  const gritNear = (rel: number, x: number, z: number, r: number) => { fillBoss('dwarf9', f, rel, g); let n = 0; for (let i = 0; i < GRIT; i++) { const o = i * STRIDE; if (f.grit[o + 6] > 0.004 && Math.hypot(f.grit[o] - x, f.grit[o + 2] - z) < r) n++; } return n; };
  assert.ok(gritNear(-20, g.cx + g.dx * 0.8, g.cz + g.dz * 0.8, 1.2) > 0 && gritNear(-20, g.tx, g.tz, 0.9) === 0, "blow one: grit at the dwarf's feet-front, none at the target yet");
  assert.ok(gritNear(1, g.tx, g.tz, 1.5) >= 10, "the third blow, on the landing tick, throws its grit at the TARGET's feet");
  fillBoss('dwarf9', f, 6, g); const third = lit(f.grit); fillBoss('dwarf9', f, -22, g); assert.ok(third > lit(f.grit), 'the third is bigger');
  const src = readFileSync('src/special-fx-boss.ts', 'utf8');
  assert.doesNotMatch(src, /AdditiveBlending|emissive/i, 'no glow');
});

test('the boss module never calls Math.random and builds only sprites (no props, no meshes)', () => {
  assert.doesNotMatch(readFileSync('src/special-fx-boss.ts', 'utf8').replace(/\/\/.*$/gm, ''), /Math\.random/);
  const scene = new THREE.Scene(), fx = createBossFx(scene, 'dwarf', 'dwarf10'), root = scene.getObjectByName('boss special fx')!;
  const random = Math.random; let draws = 0; Math.random = () => { draws++; return random(); };
  try {
    fx.render(1 / 60, [started(0)], fighters(RULES.special.windup), 0, heads, false);
    for (let t = 1; t <= LAND_AT + BOSS_TAIL; t++) fx.render(1 / 60, t === LAND_AT ? [landed(t)] : [], fighters(), t, heads, false);
  } finally { Math.random = random; }
  assert.equal(draws, 0);
  let meshes = 0, sprites = 0; root.traverse((o) => { if (o instanceof THREE.Mesh) meshes++; if (o instanceof THREE.Sprite) sprites++; });
  assert.deepEqual([meshes, sprites], [0, 2 * DUST + GRIT]);
});

test("the effect waits for the sim's own landing, a fizzle and the cast timeout clear it, clear() restores everything, and nothing leaks across a fight", () => {
  const sprites = (root: THREE.Object3D) => { const all: THREE.Sprite[] = []; root.traverse((o) => { if (o instanceof THREE.Sprite) all.push(o); }); return all; };
  const make = () => { const scene = new THREE.Scene(), fx = createBossFx(scene, 'dwarf', 'dwarf8'); return { fx, root: scene.getObjectByName('boss special fx')! }; };
  const run = (fx: ReturnType<typeof createBossFx>, from: number, to: number, events: Record<number, CombatEvent> = {}) => { for (let t = from; t <= to; t++) fx.render(1 / 60, events[t] ? [events[t]] : [], fighters(), t, heads, false); };
  { const { fx, root } = make(); run(fx, 0, 0, { 0: started(0) }); run(fx, 1, LAND_AT - 12); assert.ok(root.visible, 'the build-up draws');
    run(fx, LAND_AT - 11, LAND_AT + 6); const before = sprites(root).filter((s) => s.visible).length;   // no SpecialLanded yet: the ring (the payoff) holds back
    run(fx, LAND_AT + 7, LAND_AT + 7, { [LAND_AT + 7]: landed(LAND_AT) }); assert.ok(sprites(root).filter((s) => s.visible).length > before, 'the payoff appears when the event does');
    run(fx, LAND_AT + 8, LAND_AT + SPECIAL_RECOVER + 2); assert.ok(root.visible, 'the payoff outlasts the shared 45-tick recover'); run(fx, LAND_AT + SPECIAL_RECOVER + 3, LAND_AT + BOSS_TAIL + 2); assert.ok(!root.visible, 'and it clears when the boss tail ends'); }
  { const { fx, root } = make(); run(fx, 0, 0, { 0: started(0) }); run(fx, 1, 100, { 100: fizzled(100) }); assert.ok(root.visible, 'the build-up hangs where the caster fell'); run(fx, 101, 100 + DISSOLVE_TICKS + 1); assert.ok(!root.visible, 'a fizzle dissolves it out'); }
  { const { fx, root } = make(); run(fx, 0, 0, { 0: started(0) }); run(fx, 1, LAND_AT + SPECIAL_RECOVER + CAST_MARGIN + 1); assert.ok(!root.visible, 'the cast timeout clears a cast with no end event'); }
  { const { fx, root } = make(); run(fx, 0, 0, { 0: started(0) }); run(fx, 1, LAND_AT, { [LAND_AT]: landed(LAND_AT) }); assert.ok(root.visible);
    fx.clear(); assert.ok(!root.visible && sprites(root).every((s) => !s.visible), 'clear() restores everything');
    fx.render(1 / 60, [], fighters(), 500, heads, false); assert.ok(!root.visible, 'nothing leaks into the next fight'); }
  { const { fx, root } = make(); fx.render(1 / 60, [started(0)], fighters(RULES.special.windup), 0, [null, heads[1]], false); assert.ok(!root.visible, 'a missing rig draws nothing'); }
  { const { fx, root } = make(); fx.render(1 / 60, [started(0, 0)], fighters(), 0, heads, false); assert.ok(!root.visible, "the player's special draws nothing"); }
});

// What each move must show at phone size (Strategy's read of the sheets): a payoff of at least 6 frames at 5 fps (~72 ticks), three stepping blows with the third in front of
// the player, a ring on the floor round the pair, a shock ring and rim sand for Rim Shake.
const visibleTicks = (kind: Parameters<typeof fillBoss>[0], g = geometry()) => { const f = makeField(); let n = 0; for (let rel = 0; rel <= BOSS_TAIL; rel++) { fillBoss(kind, f, rel, g); if (peak(f.dust) > 0.1 || peak(f.grit) > 0.1) n++; } return n; };
test('The Word and Bared Face keep a visible payoff for at least 6 frames at 5 fps (72 ticks), and every move is gone when the tail ends', () => {
  for (const kind of ['dwarf8', 'shield8'] as const) assert.ok(visibleTicks(kind) >= 72, `${kind} visible for ${visibleTicks(kind)} ticks after the landing`);
  assert.ok(BOSS_TAIL > SPECIAL_RECOVER, 'presentation outlasts the shared recover; the sim is untouched');
});

test('Three Blows steps in: each blow lands nearer the player, the third in front of him between him and the camera, with dark bigger grit', () => {
  const g = geometry(), f = makeField(), centre = (lo: number, hi: number) => { let x = 0, z = 0, n = 0; for (let i = lo; i < hi; i++) { const o = i * STRIDE; if (f.grit[o + 6] > 0.004) { x += f.grit[o]; z += f.grit[o + 2]; n++; } } return { n, along: n ? ((x / n - g.cx) * g.dx + (z / n - g.cz) * g.dz) : NaN }; };
  fillBoss('dwarf9', f, -26 + 1, g); const one = centre(0, 12);
  fillBoss('dwarf9', f, -13 + 1, g); const two = centre(12, 26);
  fillBoss('dwarf9', f, 1, g); const three = centre(26, 48);
  assert.ok(one.n && two.n && three.n);
  assert.ok(one.along < two.along && two.along < three.along, `the strike point advances toward the player (${one.along.toFixed(2)} ${two.along.toFixed(2)} ${three.along.toFixed(2)} m)`);
  assert.ok(three.along > g.dist, `the third lands past the player on the camera side (${three.along.toFixed(2)} m along the line, he stands at ${g.dist.toFixed(2)})`);
  const src = readFileSync('src/special-fx-boss.ts', 'utf8');
  assert.match(src, /IRON = lerp3\(\['#1c1b1a'/, 'darker iron grit');
});

test('The Ring is a thin dark line on the floor all the way round the pair (the dust above it low), never a wall', () => {
  const g = geometry(), f = makeField(); fillBoss('shield9', f, -4, g);
  const mx = (g.cx + g.tx) / 2, mz = (g.cz + g.tz) / 2; let line = 0, front = 0, tallest = 0;
  for (let i = 0; i < 72; i++) { const o = i * STRIDE; if (f.dust[o + 6] < 0.004) continue; tallest = Math.max(tallest, f.dust[o + 1]); if (i < 40) { line++; if ((f.dust[o] - mx) * g.dx + (f.dust[o + 2] - mz) * g.dz > 1) front++; } }
  assert.ok(line >= 30, `the line is drawn round (${line} of 40)`);
  assert.ok(front >= 3, 'part of it runs in front of the pair, on the camera side');
  assert.ok(tallest < 0.8, `low: nothing taller than ${tallest.toFixed(2)} m, so neither fighter is hidden`);
});

test('Rim Shake has no falling sheets: shock rings from his feet through the build, sand jumping at the rim, one stamp at the landing', () => {
  const g = geometry(), f = makeField(), ringAt = (rel: number, lo: number, hi: number) => { fillBoss('dwarf10', f, rel, g); let n = 0; for (let i = lo; i < hi; i++) { const o = i * STRIDE; if (f.dust[o + 6] > 0.004 && Math.hypot(f.dust[o] - g.cx, f.dust[o + 2] - g.cz) < 5.5) n++; } return n; };
  assert.ok(ringAt(-30, 0, 12) > 4, 'the first stamp throws a ring at the dwarf');
  assert.equal(ringAt(-30, 36, 52), 0, 'the big ring waits for the landing');
  assert.ok(ringAt(10, 36, 52) > 8, 'the landing stamp runs a ring out from him');
  fillBoss('dwarf10', f, -12, g); let rim = 0; for (let i = 60; i < 72; i++) { const o = i * STRIDE; if (f.dust[o + 6] > 0.004 && Math.hypot(f.dust[o], f.dust[o + 2]) > 8) rim++; }
  assert.ok(rim > 2, 'sand jumps around the rim');
  assert.doesNotMatch(readFileSync('src/special-fx-boss.ts', 'utf8'), /falling sheets? \(|drift = 1 - 0.18/, 'the faint falling sheets are gone');
});
