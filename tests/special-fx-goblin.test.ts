import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { RULES } from '../src/moves.ts';
import { ARENA_THEMES } from '../src/arena-themes.ts';
import { LAND_AT, FALL_AT, advanceCast } from '../src/special-timing.ts';
import { SPECIAL_TESTS, specialParam } from '../src/special-look.ts';
import { SPECIAL_MODES } from '../src/special-modes.ts';
import { createGoblinSpecial, isGoblinCast, type GoblinSpecial } from '../src/special-fx-goblin.ts';

// The Goblin's boss specials, grey-box (special-fx-goblin.ts): ranks 8, 9, 10 on the same seam and the same 120-tick timeline as the Nightborn's.
const fighters = (special = 0) => [{ special: 0 }, { special }] as unknown as readonly [Fighter, Fighter];
const started = (tick: number) => ({ tick, type: 'SpecialStarted', actor: 1, move: 'skill_pommel' }) as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_pommel', damage: 45 }) as unknown as CombatEvent;
const fizzled = (tick: number) => ({ tick, type: 'SpecialFizzled', actor: 1 }) as unknown as CombatEvent;
const anchors = { caster: new THREE.Vector3(0, 0, 2.4), feet: new THREE.Vector3(0.1, 0, 0), head: new THREE.Vector3(0.1, 1.6, 0) };
const day = ARENA_THEMES['1'].exposure;
// The rig: an actor group the sim positions (at the caster's spot), with his presentation anchor inside it, as characters.ts builds it.
const make = (kind: GoblinSpecial) => {
  const scene = new THREE.Scene(), rig = new THREE.Group(), anchor = new THREE.Group(); rig.position.copy(anchors.caster); rig.add(anchor); scene.add(rig);
  return { scene, anchor, fx: createGoblinSpecial(scene, kind, day), root: scene.getObjectByName(`goblin special ${kind}`)! };
};
type Made = ReturnType<typeof make>;
const run = ({ fx, anchor }: Made, from: number, to: number, events: Record<number, CombatEvent> = {}) => {
  for (let t = from; t <= to; t++) fx.render(1 / 60, events[t] ? [events[t]] : [], fighters(0), t, [anchors.feet, anchors.caster], false, anchor, anchors.head);
  return { hide: !anchor.visible, offset: anchor.position.clone() };   // the rig is unrotated, so the anchor's local shift is the world shift
};
const shown = (root: THREE.Object3D) => { let n = 0; root.traverse((o) => { if ((o instanceof THREE.Sprite || o instanceof THREE.Mesh) && o.visible) n++; }); return n; };

test('?special=reynard|hermes|loki are the Goblin at ranks 8, 9, 10 (levels 36, 41, 46), each ONE entry in the mode registry, and the timeline is the one 120', () => {
  assert.deepEqual([SPECIAL_TESTS.reynard, SPECIAL_TESTS.hermes, SPECIAL_TESTS.loki], [{ opponent: 'goblin', level: 36, first: 180 }, { opponent: 'goblin', level: 41, first: 180 }, { opponent: 'goblin', level: 46, first: 180 }]);
  for (const name of ['reynard', 'hermes', 'loki'] as const) {
    assert.equal(specialParam(`?special=${name.toUpperCase()}`), name); assert.equal(SPECIAL_TESTS[name].level, ({ reynard: 8, hermes: 9, loki: 10 }[name] - 1) * 5 + 1);
    const mode = SPECIAL_MODES[name]!; assert.ok(mode && mode.at === 'feet' && mode.hideTrail === true && mode.lift < 0, name);
    const extra = mode.extra!({ player: { boneWorld: () => anchors.head, anchor: new THREE.Group() }, opponent: { boneWorld: () => null, anchor: new THREE.Group() } });
    assert.equal(extra.length, 2, "the rig anchor, then the target's head");
  }
  assert.equal(LAND_AT, RULES.special.windup - 1);
});

test('the visible build-up is the last ~0.4 s only: nothing draws through the first 1.6 s of the wind-up', () => {
  for (const kind of ['reynard', 'hermes', 'loki'] as const) {
    const m = make(kind), { root } = m;
    assert.equal(run(m, -1, -1).hide, false); assert.equal(shown(root), 0, `${kind}: nothing before a cast`);
    run(m, 0, FALL_AT - 1, { 0: started(0) }); assert.equal(shown(root), 0, `${kind}: the wind-up is the sim's alone`);
    let peak = 0; for (let t = FALL_AT; t <= LAND_AT; t++) { run(m, t, t); peak = Math.max(peak, shown(root)); } assert.ok(peak > 0, `${kind}: the build-up draws`);
    run(m, LAND_AT + 1, LAND_AT + 200, { [LAND_AT + 1]: landed(LAND_AT + 1) }); assert.equal(shown(root), 0, `${kind}: gone after the aftermath`);
  }
});

test('a fizzle (the caster fell) draws nothing and moves nothing, for all three', () => {
  for (const kind of ['reynard', 'hermes', 'loki'] as const) {
    const m = make(kind), { root } = m; run(m, 0, FALL_AT - 2, { 0: started(0) });
    const after = run(m, FALL_AT - 1, FALL_AT + 10, { [FALL_AT - 1]: fizzled(FALL_AT - 1) });
    assert.equal(shown(root), 0, kind); assert.deepEqual([after.hide, after.offset.length()], [false, 0], kind);
  }
});

test('Dirty Fistful: sand from his hand to the FACE, hanging there after the blow, and it never moves or hides him', () => {
  const m = make('reynard'), { root } = m, sprites: THREE.Sprite[] = []; root.traverse((o) => { if (o instanceof THREE.Sprite) sprites.push(o); });
  run(m, 0, FALL_AT - 1, { 0: started(0) });
  const mid = run(m, FALL_AT + 12, FALL_AT + 12); assert.deepEqual([mid.hide, mid.offset.length()], [false, 0]);
  const near = (v: THREE.Vector3, to: THREE.Vector3) => v.distanceTo(to);
  run(m, FALL_AT + 13, LAND_AT, {}); const hung = run(m, LAND_AT + 1, LAND_AT + 12, { [LAND_AT + 1]: landed(LAND_AT + 1) });
  assert.deepEqual([hung.hide, hung.offset.length()], [false, 0]);
  const live = sprites.filter((s) => s.visible); assert.ok(live.length > 10, 'a fan of puffs');
  assert.ok(live.every((s) => near(s.position, anchors.head) < 0.9), 'all of it at the target\'s face once it lands');
  assert.ok(live.every((s) => (s.material as THREE.SpriteMaterial).opacity <= 0.86), 'semi-transparent: both fighters stay readable through it');
});

test('Gone: dust at his feet, he is hidden for the rest of the build-up, behind the target at the blow, and slides back after', () => {
  const m = make('hermes'); run(m, 0, FALL_AT - 1, { 0: started(0) });
  assert.equal(run(m, FALL_AT, FALL_AT + 1).hide, false, 'he is still seen as the dust rises');
  const gone = run(m, FALL_AT + 6, FALL_AT + 6); assert.equal(gone.hide, true, 'hidden through the middle of the build-up');
  const at = run(m, LAND_AT, LAND_AT); assert.equal(at.hide, true);
  const behind = anchors.caster.clone().add(at.offset!);
  assert.ok(behind.z < anchors.feet.z, `he lands on the far side of the target (${behind.z.toFixed(2)} < ${anchors.feet.z})`);
  assert.ok(Math.hypot(behind.x - anchors.feet.x, behind.z - anchors.feet.z) < 1, 'within a blade of him');
  const after = run(m, LAND_AT + 1, LAND_AT + 8, { [LAND_AT + 1]: landed(LAND_AT + 1) }); assert.equal(after.hide, false, 'shown again at the blow');
  assert.ok(after.offset!.length() > 1, 'still behind him just after it');
  assert.equal((run(m, LAND_AT + 9, LAND_AT + 60).offset?.length() ?? 0) < 0.01, true, 'back on the sim position by the end of the aftermath');
});

test('Three Liars: two translucent afterimages for under 0.4 s, gone before the blow, and ONLY the real one lunges and lands', () => {
  const m = make('loki'), { root } = m, ghosts: THREE.Mesh[] = []; root.traverse((o) => { if (o instanceof THREE.Mesh && o.geometry instanceof THREE.CapsuleGeometry) ghosts.push(o); });
  assert.equal(ghosts.length, 2);
  run(m, 0, FALL_AT - 1, { 0: started(0) }); assert.ok(ghosts.every((g) => !g.visible), 'none through the wind-up');
  let first = -1, last = -1;
  for (let t = FALL_AT; t <= LAND_AT; t++) { run(m, t, t); if (ghosts.every((g) => g.visible)) { if (first < 0) first = t; last = t; } }
  assert.ok(first >= 0 && (last - first + 1) / 60 < 0.4, `shown ${(last - first + 1)} ticks, under 0.4 s`);
  assert.ok(ghosts.every((g) => (g.material as THREE.MeshBasicMaterial).opacity <= 0.37), 'translucent: never as solid as the real one');
  assert.ok(ghosts.every((g) => !g.visible), 'gone on the landing tick, so the real one is the only one left');
  const lunge = run(m, LAND_AT, LAND_AT); assert.equal(lunge.hide, false, 'the real one is never hidden');
  const dir = anchors.feet.clone().sub(anchors.caster).setY(0).normalize(); assert.ok(lunge.offset!.dot(dir) > 1, 'he closed in along the line to the target');
  const holds = run(m, LAND_AT + 1, LAND_AT + 6, { [LAND_AT + 1]: landed(LAND_AT + 1) }); assert.ok(holds.offset!.length() > 1, 'he holds the blow');
  assert.equal((run(m, LAND_AT + 7, LAND_AT + 60).offset?.length() ?? 0) < 0.01, true, 'and returns to the sim position');
});

test("his casts count only for this effect: advanceCast's default test (Hades') opens no Goblin cast; his own test opens only the opponent's side", () => {
  const ev = (opponent: 'goblin' | 'nightborn', actor: number) => [{ ...started(5), actor, move: opponent === 'nightborn' ? 'skill_lunge' : 'skill_pommel' } as unknown as CombatEvent];
  assert.equal(advanceCast(null, ev('goblin', 1), fighters(0), 5, 'goblin', false), null, 'the default test: a Goblin cast opens nothing');
  assert.ok(advanceCast(null, ev('goblin', 1), fighters(0), 5, 'goblin', false, isGoblinCast)); assert.equal(advanceCast(null, ev('goblin', 0), fighters(0), 5, 'goblin', false, isGoblinCast), null, "the hero's special draws nothing here");
  assert.equal(advanceCast(null, [], fighters(5), 5, 'goblin', false), null, 'a wind-up begun before the effect loaded needs his test too'); assert.ok(advanceCast(null, [], fighters(5), 5, 'goblin', false, isGoblinCast));
  assert.ok(advanceCast(null, ev('nightborn', 1), fighters(0), 5, 'nightborn', false), "Hades' own cast is unchanged");
});

test("no Math.random, no lights, no glow: unlit grey dust only; the registry loads the Goblin's chunk lazily", () => {
  const code = readFileSync(new URL('../src/special-fx-goblin.ts', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/Math\.random/.test(code) && !/\bLight\b/.test(code), 'seeded and unlit');
  for (const kind of ['reynard', 'hermes', 'loki'] as const) { const { root } = make(kind); root.traverse((o) => { assert.ok(!(o instanceof THREE.Light)); if (o instanceof THREE.Mesh) assert.ok(o.material instanceof THREE.MeshBasicMaterial && !o.castShadow); }); }
  const modes = readFileSync(new URL('../src/special-modes.ts', import.meta.url), 'utf8');
  assert.ok(/import\('\.\/special-fx-goblin\.ts'\)/.test(modes), 'a lazy chunk');
});
