import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { RULES } from '../src/moves.ts';
import { advanceCast, isBloodTithe, LAND_AT, SPECIAL_RECOVER } from '../src/special-timing.ts';
import { SPECIAL_TESTS, specialParam } from '../src/special-look.ts';
import { createBloodTithe, TINTS, ARM_OUT } from '../src/special-tithe.ts';
import { actorPose, initialPractice, attackSpecs } from '../src/combat.ts';
import { SPECIAL_MODES, TITHE_CHAMBER } from '../src/special-modes.ts';
import { OPPONENTS } from '../src/moves.ts';

// Blood Tithe (special-tithe.ts): the Centurion's rank-10 special, presentation only, ?special=tithe. Dust lifts only in the last 0.6 s and is in the blade on the
// landing tick; the light turns red (a wash element); the strike bursts off the blade; everything clears. Never hides both fighters.
const fighters = (special = 0) => [{ special: 0 }, { special, skill: 'shove' }] as unknown as readonly [Fighter, Fighter];
const started = (tick: number, extra: object = {}) => ({ tick, type: 'SpecialStarted', actor: 1, move: 'skill_shove', ...extra }) as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_shove', damage: 30 }) as unknown as CombatEvent;

test('only the Centurion\'s Scutum Shove special on the opponent side casts; ?special=tithe is his page at level 46', () => {
  assert.ok(advanceCast(null, [started(10)], fighters(), 10, 'veteran', false, isBloodTithe));
  assert.equal(advanceCast(null, [started(10, { actor: 0 })], fighters(), 10, 'veteran', false, isBloodTithe), null);
  assert.equal(advanceCast(null, [started(10)], fighters(), 10, 'goblin', false, isBloodTithe), null, 'another warden draws nothing');
  assert.equal(advanceCast(null, [started(10)], fighters(), 10, 'veteran', true, isBloodTithe), null, 'yielding: no new cast');
  assert.equal(advanceCast(null, [started(10)], fighters(), 10, 'veteran', false), null, "without the tithe effect (Hades' Shadow's own call) the Centurion's special draws nothing");
  assert.equal(advanceCast(null, [], fighters(RULES.special.windup - 30), 500, 'veteran', false), null, 'nor does a back-dated pickup');
  assert.deepEqual(SPECIAL_TESTS.tithe, { opponent: 'veteran', level: 46, first: 180 });
  assert.equal(specialParam('?special=tithe'), 'tithe');
});

function stage(handAt?: THREE.Vector3) {
  const scene = new THREE.Scene(), sun = new THREE.DirectionalLight('#fff0d8', 3), hemi = new THREE.HemisphereLight('#c8d4ff', '#8a6a4a', 1);
  scene.add(sun, hemi); scene.background = new THREE.Color('#b8a58a'); scene.fog = new THREE.FogExp2('#b8a58a', 0.02); scene.environmentIntensity = 1;
  const gate = new THREE.MeshBasicMaterial({ name: 'gate-light', transparent: true, opacity: 0.55 }), sky = new THREE.MeshBasicMaterial({ name: 'sky', color: '#dfe6f0' });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), gate), new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sky));
  const fx = createBloodTithe(scene, 'veteran');
  const head = new THREE.Vector3(0, 1.62, -1.2), foe = new THREE.Vector3(0.1, 1.7, 1.2), hand = handAt ?? new THREE.Vector3(0.4, 1.1, 1.0);
  const heads = [head, foe] as const, hands = [null, hand] as const, root = scene.getObjectByName('blood tithe')!;
  const sprites = (name: string, n: number) => Array.from({ length: n }, (_, i) => scene.getObjectByName(`${name} ${i}`) as THREE.Sprite);
  const to = (from: number, t: number) => { for (let k = from; k <= t; k++) fx.render(1 / 60, [], fighters(), k, heads, false, hands); };
  return { scene, fx, heads, hands, root, sun, hemi, gate, sky, hand, head, foe, sprites, to, restore: () => {} };
}

test('the dust lifts only in the last 0.6 s, round the caster (v2.5), and is in the blade on the landing tick', () => {
  const s = stage(), random = Math.random; let draws = 0; Math.random = () => { draws++; return random(); };
  try {
    s.fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, s.heads, false, s.hands);
    s.to(101, 100 + LAND_AT - 37);
    assert.ok(s.root.visible);
    assert.equal(s.sprites('dust', 12).filter((d) => d.visible).length, 0, 'no dust before the last 0.6 s');
    s.to(100 + LAND_AT - 36, 100 + LAND_AT - 20);
    const mid = s.sprites('dust', 12).filter((d) => d.visible);
    assert.ok(mid.length > 5, `dust is lifting (${mid.length})`);
    const xs = mid.map((d) => d.position.x); assert.ok(Math.max(...xs) - Math.min(...xs) > 1.5, 'a spread of motes, not one spot'); assert.ok(mid.every((d) => Math.hypot(d.position.x - s.foe.x, d.position.z - s.foe.z) < 2.6), 'round the caster, not over the whole arena (v2.5, Strategy)');
    assert.ok(mid.every((d) => Math.hypot(d.position.x - s.head.x, d.position.z - s.head.z) > 0.3 || d.position.y > 0.3), 'kept off the fighters');
    assert.ok(mid.every((d) => ((d.material as THREE.SpriteMaterial).opacity) <= 0.5), 'thin: it never hides the fighters');
    s.to(100 + LAND_AT - 19, 100 + LAND_AT - 1);
    const near = s.sprites('dust', 12).filter((d) => d.visible);
    const blade = s.hand.clone(), pull = near.map((d) => d.position.distanceTo(blade));
    assert.ok(near.length === 0 || Math.max(...pull) < 1.2, `what is left is in the blade (${near.length} motes, farthest ${Math.max(0, ...pull).toFixed(2)} m)`);
    assert.ok(s.sprites('charge', 8).some((c) => c.visible && (c.material as THREE.SpriteMaterial).opacity > 0.4), 'the blade is full');
  } finally { Math.random = random; s.restore(); }
  assert.equal(draws, 0, "gore's seeded Math.random sequence is untouched");
});

test("the light turns red on the arena's OWN lights, fog and sky (no page overlay): slow at first, surging in the last 0.6 s, peaking on the strike, gone 0.4 s later, restored exactly", () => {
  const s = stage(), redness = (c: THREE.Color) => c.r / Math.max(c.g, c.b), base = { sun: s.sun.color.clone(), fog: (s.scene.fog as THREE.FogExp2).color.clone(), sky: s.sky.color.clone(), hemi: s.hemi.color.clone() };
  const sunRed0 = redness(s.sun.color);
  s.fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, s.heads, false, s.hands);
  s.to(101, 100 + 50); const early = redness(s.sun.color) / sunRed0;
  s.to(100 + 51, 100 + LAND_AT - 37); const before = redness(s.sun.color) / sunRed0;
  s.to(100 + LAND_AT - 36, 100 + LAND_AT); const peak = redness(s.sun.color) / sunRed0;
  assert.ok(early > 1 && early < 1.2 && before < 1.4 && peak > 1.15, `sun red ratio x${early.toFixed(2)} -> x${before.toFixed(2)} -> x${peak.toFixed(2)}`);
  assert.ok(redness((s.scene.fog as THREE.FogExp2).color) > redness(base.fog) * 1.1 && redness(s.sky.color) > redness(base.sky) * 1.1 && redness(s.hemi.color) > redness(base.hemi) * 1.1, 'fog, sky and hemisphere go red too');
  assert.ok(s.gate.opacity < 0.3 && s.scene.environmentIntensity < 0.9, 'the gate light shaft (the pale streak) fades out and the fill dims');
  s.fx.render(1 / 60, [landed(100 + LAND_AT)], fighters(), 100 + LAND_AT, s.heads, false, s.hands);
  assert.ok(redness(s.sun.color) / sunRed0 > 1.15, 'peak on the strike');
  s.to(101 + LAND_AT, 100 + LAND_AT + 24);   // v2.4 (Strategy): the red is a flash, not a grade: back to the plain arena 0.4 s after the strike
  assert.ok(s.sun.color.equals(base.sun) && s.gate.opacity === 0.55 && s.scene.environmentIntensity === 1, 'the arena light is plain again 0.4 s after the strike');
  s.to(101 + LAND_AT + 24, 100 + LAND_AT + SPECIAL_RECOVER + 40);
  assert.ok(s.sun.color.equals(base.sun) && (s.scene.fog as THREE.FogExp2).color.equals(base.fog) && s.sky.color.equals(base.sky) && s.hemi.color.equals(base.hemi), 'every colour is back exactly');
  assert.equal(s.gate.opacity, 0.55); assert.equal(s.scene.environmentIntensity, 1);
  assert.ok(!s.root.visible, 'everything is gone after the clear and the burst');
});

test('no page overlay: the module never touches the document, so the HUD and buttons stay as they are', () => {
  assert.ok(!/document\.|getElementById|\.body\b/.test(readFileSync('src/special-tithe.ts', 'utf8').replace(/\/\/.*$/gm, '')), 'no DOM access');
});

// Lead's rule for caster-moving effects (2026-10-01): write ABSOLUTELY each frame. In a hit-stop the rig runs mixer.update(0), which does not rewrite upperarm_r when the pose is unchanged
// (measured against three's AnimationMixer), so a relative yaw stacked frame on frame. These render the effect repeatedly with NO mixer tick between.
test('the arm yaw does not stack across frames the mixer did not rewrite (hit-stop), is re-based on a new mixer pose, and the bone is handed back when the cast ends', () => {
  const s = stage(), anchor = new THREE.Object3D(), upper = new THREE.Object3D(); upper.name = 'upperarm_r'; anchor.add(upper);
  const angle = () => 2 * Math.acos(Math.min(1, Math.abs(upper.quaternion.w))), draw = (age: number, quiet = false) => s.fx.render(1 / 60, !quiet && age === 0 ? [started(100)] : [], fighters(RULES.special.windup), 100 + age, s.heads, false, s.hands, [null, anchor]);
  upper.quaternion.identity(); draw(0); const once = angle();
  for (let k = 0; k < 6; k++) draw(0, true);   // six frozen frames: the same tick, the mixer never touches the bone
  assert.ok(Math.abs(once - ARM_OUT) < 0.02, `the yaw is applied once (${once.toFixed(3)} rad)`);
  assert.ok(Math.abs(angle() - once) < 1e-9, `six more renders with no mixer tick leave it at ${angle().toFixed(4)} rad, not stacked`);
  for (let age = 1; age <= 20; age++) draw(age);   // the clock moves on but the mixer still writes nothing: still not stacked
  assert.ok(Math.abs(angle() - ARM_OUT) < 0.02, `20 ticks later without a mixer write: ${angle().toFixed(4)} rad`);
  upper.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.3); draw(21);   // the mixer wrote a new pose: the yaw rides on top of THAT, once
  const rebased = angle(); draw(21, true);
  assert.ok(Math.abs(angle() - rebased) < 1e-9, 'a frozen frame after the new pose does not stack either');
  s.fx.clear();   // the cast is over: the bone goes back to what the mixer left
  assert.ok(Math.abs(angle() - 0.3) < 1e-9, `the bone is handed back as the mixer left it (${angle().toFixed(4)} rad)`);
});

test('the strike bursts off the blade in dark blood red, then the leftovers settle; no glow colour, no meshes', () => {
  const s = stage();
  try {
    s.fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, s.heads, false, s.hands);
    s.to(101, 100 + LAND_AT - 1);
    s.fx.render(1 / 60, [landed(100 + LAND_AT)], fighters(), 100 + LAND_AT, s.heads, false, s.hands);
    const burst = s.sprites('burst', 36);
    assert.ok(burst.every((b) => b.visible) && burst[0].position.distanceTo(s.hand) < 0.8, 'fires at the blade');
    // v2.4/v2.5 (Strategy, 2026-10-01): the attacker stays readable (the cloud over his body is a veil: <= 0.5 opacity summed), and the spray is a narrow cone from the blade's tip to the hero:
    // nothing behind or beside the caster, about 1.5 m across at the hero, no puff above 0.3 opacity, gone before the ground reads red.
    const op = (b: THREE.Sprite) => (b.material as THREE.SpriteMaterial).opacity, origin = burst[0].position.clone(), aim = new THREE.Vector3(s.head.x, 0, s.head.z);
    const axis = new THREE.Vector3(aim.x - origin.x, 0, aim.z - origin.z), len = axis.length(); axis.normalize();
    const veil = () => burst.filter((b) => b.visible && Math.hypot(b.position.x - s.foe.x, b.position.z - s.foe.z) < 0.6).reduce((t, b) => t + op(b), 0);
    let worst = 0, widest = 0, peakOp = 0, shown = 0, reach = 0;
    for (let k = 101 + LAND_AT; k <= 100 + LAND_AT + 24; k++) {
      s.fx.render(1 / 60, [], fighters(), k, s.heads, false, s.hands); worst = Math.max(worst, veil());
      for (const b of burst) {
        peakOp = Math.max(peakOp, op(b)); if (!b.visible || op(b) < 0.01) continue; shown++;
        const rel = new THREE.Vector3(b.position.x - origin.x, 0, b.position.z - origin.z), along = rel.dot(axis), perp = Math.abs(rel.x * axis.z - rel.z * axis.x);
        assert.ok(along > -0.05 && along < len + 0.05, `a puff stays between the blade tip and the hero (${along.toFixed(2)} of ${len.toFixed(2)})`);
        widest = Math.max(widest, perp * 2);
        if (op(b) > 0.05) reach = Math.max(reach, along / len);
      }
    }
    assert.ok(reach > 0.8, `the spray visibly travels from the blade tip to the hero (reaches ${(reach * 100).toFixed(0)} % of the way while visible)`);
    assert.ok(shown > 20, 'the spray is visible'); assert.ok(peakOp <= 0.3 + 1e-9, 'no puff is opaque');
    assert.ok(widest <= 0.9, `a narrow cone: centres within ${widest.toFixed(2)} m across (a puff adds its own radius: about 1.5 m at the hero)`);
    assert.ok(worst <= 0.5, `the cloud over the attacker's body sums to <= 0.5 opacity (${worst.toFixed(2)})`);
    assert.ok(s.sprites('dust', 12).every((d) => !d.visible), 'no ground dust is left 0.4 s after the strike: the sand reads plain');
    s.to(101 + LAND_AT + 24, 100 + LAND_AT + 40);
    assert.ok(burst.every((b) => !b.visible), 'the thin spray itself is gone within 0.65 s');
  } finally { s.restore(); }
  for (const c of TINTS) { const { r, g, b } = new THREE.Color(c); assert.ok(r > g * 2 && r > b * 2 && r < 0.4, `${c}: dark blood red, not neon`); }
  let meshes = 0; s.root.traverse((o) => { if (o instanceof THREE.Mesh) meshes++; });
  assert.equal(meshes, 0, 'sprites only: no props');
});

test('special-tithe ships in its own lazy chunk: nothing imports it statically', () => {
  const statics = readdirSync('src').filter((f) => f.endsWith('.ts') && /from\s+['"]\.\/special-tithe\.ts['"]/.test(readFileSync(`src/${f}`, 'utf8')));
  assert.deepEqual(statics, []);
  assert.match(readFileSync('src/special-modes.ts', 'utf8'), /import\('\.\/special-tithe\.ts'\)/);
});

// Preview-only: Blood Tithe is the registry's `tithe` entry, reached only by `?special=tithe` (special-look.ts SPECIAL_TESTS, the Centurion at level 46); scene.ts names no special (specials.test.ts).
test("Blood Tithe is the registry's tithe entry: a lazy chunk, only on ?special=tithe for the Centurion", () => {
  assert.deepEqual(SPECIAL_TESTS.tithe, { opponent: 'veteran', level: 46, first: 180 });
  assert.match(String(SPECIAL_MODES.tithe!.load), /import\('\.\/special-tithe\.ts'\)/);
  assert.equal(specialParam('?special=tithe'), 'tithe');
});

// v2 (d): the game's own pale weapon trail drew a streak above the sword in the wind-up; the cast hides the caster's trail (characters.ts names it WeaponTrail).
test("the caster's pale WeaponTrail is hidden for the cast, the target's is not touched", () => {
  const s = stage(), anchor = (visible: boolean) => { const a = new THREE.Object3D(), tr = new THREE.Mesh(); tr.name = 'WeaponTrail'; tr.visible = visible; a.add(tr); return [a, tr] as const; };
  const [casterAnchor, casterTrail] = anchor(true), [targetAnchor, targetTrail] = anchor(true);
  s.fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, s.heads, false, s.hands, [targetAnchor, casterAnchor]);
  assert.equal(casterTrail.visible, false, "the caster's trail is hidden");
  assert.equal(targetTrail.visible, true, "the target's own trail is left alone");
});

// v2.1/v2.2 (Dom: "arms still behind"): the placeholder special motion is the heavy's overhead raise (the gladius cocked back behind the head); the thrust clip held short of
// contact still tucks the blade against his chest. His Blood Tithe (the registry's `held`, special-modes.ts) rides the thrust clip held AT contact (the sword arm extended)
// through the gather, chambers briefly, then drives home on the strike tick; Combat's own special pose (the heavy raise) is left to every other special.
test("the Centurion's special holds the thrust's contact pose through the gather, chambers just before the strike, drives to contact on it; combat.ts keeps the heavy raise", () => {
  const stage = (special: number) => {
    const s = initialPractice(731, OPPONENTS.veteran, 'longsword', null, { level: 46, aiSkill: 'shove' });
    s.duel = { ...s.duel, fighters: [s.duel.fighters[0], { ...s.duel.fighters[1], special, skillCooldown: RULES.special.cooldown }] } as typeof s.duel;
    return { raw: actorPose(s, 1), held: SPECIAL_MODES.tithe!.held!(actorPose(s, 1), 1, s.duel.fighters).pose };
  };
  const W = RULES.special.windup, c = attackSpecs(OPPONENTS.veteran.weapon).thrust.contact / attackSpecs(OPPONENTS.veteran.weapon).thrust.recovery;
  const early = stage(W - 12).held, mid = stage(Math.round(W * 0.4)).held, chamber = stage(Math.round(W * 0.12)).held, landing = stage(1).held;
  for (const p of [early, mid, chamber, landing]) assert.equal(p.attack, 'thrust', 'the forward clip, not the heavy raise');
  assert.ok(Math.abs(early.progress - c) < 1e-9 && Math.abs(mid.progress - c) < 1e-9, 'the contact pose (arm extended) through the whole gather');
  assert.ok(chamber.progress < c * 0.9 && chamber.progress > c * TITHE_CHAMBER * 0.95, 'a short chamber just before the strike');
  assert.ok(landing.progress > c * 0.97 && landing.progress <= c + 1e-9, 'driven back to full contact on the strike tick');
  assert.equal(stage(W - 12).raw.attack, 'heavy', "combat.ts is untouched: every other special keeps the heavy raise");
});

// v2.2: the extended arm is swung ~29 deg out to the caster's right so the blade reads as a line pointing at the foe, and straightens over the last ticks so the thrust goes at him.
test('the sword arm is yawed out through the gather and straight again on the strike tick', () => {
  const s = stage(), anchor = new THREE.Object3D(), upper = new THREE.Object3D(); upper.name = 'upperarm_r'; anchor.add(upper);
  const angle = () => 2 * Math.acos(Math.min(1, Math.abs(upper.quaternion.w))), run = (age: number) => { upper.quaternion.identity(); s.fx.render(1 / 60, age === 0 ? [started(100)] : [], fighters(RULES.special.windup), 100 + age, s.heads, false, s.hands, [null, anchor]); return angle(); };
  const early = run(0); const mid = run(50), nearEnd = run(LAND_AT - 8), onStrike = run(LAND_AT);
  assert.ok(Math.abs(early - ARM_OUT) < 0.02 && Math.abs(mid - ARM_OUT) < 0.02, `yawed ${(ARM_OUT * 57.3).toFixed(0)} deg out through the gather (${early.toFixed(2)}, ${mid.toFixed(2)} rad)`);
  assert.ok(nearEnd < ARM_OUT * 0.8 && nearEnd > 0, 'easing back over the last ticks');
  assert.ok(onStrike < 0.02, `straight on the strike tick (${onStrike.toFixed(3)} rad)`);
  run(0); const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(upper.quaternion);
  assert.ok(dir.x > 0.3, `outward is his right (+x when he faces -z): ${dir.x.toFixed(2)}`);
});

// Audio (Dom approved the Centurion cues; audio/special.ts from #1216): the Blood Tithe crowd swell rises from silence and PEAKS 2.0 s into the cue, so it starts with the
// wind-up and the strike (tick LAND_AT of the 120-tick windup) lands on the peak. Wired on SpecialStarted, cut on SpecialFizzled, silent if the buffer has not loaded.
import { createFeedback } from '../src/feedback.ts';
test('the swell cue starts with the wind-up, 2.0 s before the strike, and the wiring is only on ?special=tithe', () => {
  const CUE_PEAK = 2.0;   // seconds into tithe.m4a (Audio's note on #1216)
  assert.ok(Math.abs(LAND_AT / 60 - CUE_PEAK) <= 1 / 60, `the strike lands ${(LAND_AT / 60).toFixed(3)} s after SpecialStarted, within a tick of the cue's peak`);
  const main = readFileSync('src/main.ts', 'utf8');
  assert.match(main, /specialTest === 'tithe'\) for \(const e of practice\.events\)[\s\S]{0,400}SpecialStarted[\s\S]{0,80}skill_shove'\) feedback\.special\('tithe'\);[\s\S]{0,120}SpecialFizzled[\s\S]{0,60}feedback\.cutSpecial\(\)/);
  assert.match(main, /if \(specialTest === 'tithe'\) feedback\.want\('tithe'\)/);
});

test('feedback.special: silent until the cue has loaded, then plays at once at gain 1 into the game bus; cutSpecial fades it out', async () => {
  const param = () => ({ value: 0, setValueAtTime() {}, cancelScheduledValues() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const started: number[] = [], stopped: number[] = [];
  const node = (): Record<string, unknown> => new Proxy({ connect() { return this; }, disconnect() {}, start(t: number) { started.push(t); }, stop(t: number) { stopped.push(t); }, onended: null }, { get: (o, k) => (k in o ? (o as Record<string | symbol, unknown>)[k] : param()), set: (o, k, v) => { (o as Record<string | symbol, unknown>)[k] = v; return true; } });
  const decoded = { duration: 3.0, length: 144000, numberOfChannels: 1, sampleRate: 48000, getChannelData: () => new Float32Array(1) };
  const context = new Proxy({ state: 'running', currentTime: 5, sampleRate: 48000, destination: node(), decodeAudioData: async () => decoded, createBuffer: (_c: number, length: number) => ({ duration: length / 48000, getChannelData: () => new Float32Array(length) }), resume: async () => {} }, { get: (o, k) => (k in o ? (o as never)[k] : typeof k === 'string' && k.startsWith('create') ? node : undefined) }) as unknown as BaseAudioContext;
  const realFetch = globalThis.fetch; globalThis.fetch = (async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as unknown as typeof fetch;
  try {
    const feedback = createFeedback({ context, now: () => 5, sprite: null });
    feedback.unlock(); feedback.want('tithe');
    assert.equal(feedback.special('tithe'), null, 'not loaded yet: the move plays in silence');
    await new Promise((resolve) => setTimeout(resolve, 20));
    const before = started.length, heard = feedback.special('tithe');
    assert.ok(heard && (heard as { duration?: number }).duration === 3.0, 'plays the 3.0 s swell');
    assert.equal(started.length, before + 1); assert.equal(started.at(-1), 5, 'starts now (delay 0): peak 2.0 s later = the strike');
    feedback.cutSpecial();
    assert.ok(stopped.length >= 1, 'cut on a fizzle: it fades out on the gate player');
    assert.equal(createFeedback({ context, now: () => 5, sprite: null }).special('tithe'), null, 'a fresh feedback that never unlocked or wanted it stays silent');
  } finally { globalThis.fetch = realFetch; }
});

// v2.3 (Strategy's 5 fps read): the strike came out hard sideways and the burst sat on his torso. The blade's real tip (the sword node's local Y, `contact.to` metres) is the
// burst origin, and on the strike the sword arm is aimed so the blade points at the hero.
test('on the strike the blade is aimed at the hero, and the burst fires from the blade\'s real tip', () => {
  const s = stage(), anchor = new THREE.Object3D(), upper = new THREE.Object3D(), sword = new THREE.Object3D();
  upper.name = 'upperarm_r'; sword.name = 'SwordDrawn'; sword.userData.contact = { from: 0.1, to: 0.7 };
  upper.position.copy(s.hand); sword.rotation.x = -Math.PI / 2; upper.rotation.y = -0.9;   // the arm pivots at the hand here, so only the blade direction changes;   // the blade (local Y -> world -z, toward the hero) starts yawed ~1 rad off the line to him; the gather's own outward yaw changes it before the strike corrects it
  anchor.add(upper); upper.add(sword); anchor.updateMatrixWorld(true);
  const toHero = new THREE.Vector3().subVectors(s.head, s.hand).setY(0).normalize();
  const bladeDir = () => { sword.updateWorldMatrix(true, false); const tip = new THREE.Vector3(0, 1, 0).applyMatrix4(sword.matrixWorld), base = new THREE.Vector3(0, 0, 0).applyMatrix4(sword.matrixWorld); return tip.sub(base).setY(0).normalize(); };
  assert.ok(bladeDir().angleTo(toHero) > 0.8, 'it starts off to the side');
  s.fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, s.heads, false, s.hands, [null, anchor]);
  s.fx.render(1 / 60, [landed(100 + LAND_AT)], fighters(), 100 + LAND_AT, s.heads, false, s.hands, [null, anchor]);
  assert.ok(bladeDir().angleTo(toHero) < 0.2, `aimed at the hero on the strike (${bladeDir().angleTo(toHero).toFixed(2)} rad off)`);
  const tip = new THREE.Vector3(0, 0.7, 0).applyMatrix4(sword.matrixWorld), burst0 = s.scene.getObjectByName('burst 0') as THREE.Sprite;
  assert.ok(burst0.visible && burst0.position.distanceTo(tip) < 0.5, `the burst starts at the blade's tip (${burst0.position.distanceTo(tip).toFixed(2)} m)`);
});

// v2.8: the veil pin binds. With the usual fixture the blade tip is ~0.76 m out from the caster's head and the puffs travel away, so a veil sum there is ~0 whatever the opacity.
// Here the hand is on the caster's own head position, so the spray STARTS over him: what sits within 0.9 m of his head (his shoulders and chest), summed over the burst, must stay a veil.
test("the spray over the attacker's own body stays a veil: summed opacity within 0.9 m of his head is <= 0.5 on every tick", () => {
  const probe = new THREE.Vector3(0.1, 1.7, 1.2), s = stage(probe.clone());
  s.fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, s.heads, false, s.hands);
  s.to(101, 100 + LAND_AT - 1);
  s.fx.render(1 / 60, [landed(100 + LAND_AT)], fighters(), 100 + LAND_AT, s.heads, false, s.hands);
  const burst = s.sprites('burst', 36), near = () => burst.filter((b) => b.visible && b.position.distanceTo(s.foe) < 0.9).reduce((t, b) => t + (b.material as THREE.SpriteMaterial).opacity, 0);
  let worst = 0, sawNear = 0;
  for (let k = 101 + LAND_AT; k <= 100 + LAND_AT + 30; k++) { s.fx.render(1 / 60, [], fighters(), k, s.heads, false, s.hands); const v = near(); worst = Math.max(worst, v); if (burst.some((b) => b.visible && b.position.distanceTo(s.foe) < 0.9)) sawNear++; }
  assert.ok(sawNear > 2, `the fixture really puts puffs over the attacker (${sawNear} ticks)`);
  assert.ok(worst > 0 && worst <= 0.5, `summed opacity over the attacker peaks at ${worst.toFixed(3)} (<= 0.5)`);
});

test('what the blade did not take settles low and is gone within 0.4 s of the strike', () => {
  const s = stage();
  s.fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, s.heads, false, s.hands);
  s.to(101, 100 + LAND_AT - 1);
  s.fx.render(1 / 60, [landed(100 + LAND_AT)], fighters(), 100 + LAND_AT, s.heads, false, s.hands);
  s.to(101 + LAND_AT, 100 + LAND_AT + 8);
  const settling = s.sprites('dust', 12).filter((d) => d.visible);
  assert.ok(settling.length > 2 && settling.every((d) => d.position.y < 0.7), `settles low (${settling.length})`);
  assert.ok(settling.every((d) => Math.hypot(d.position.x - s.foe.x, d.position.z - s.foe.z) < 2.5), 'only round the caster, not over the whole arena');
});

// v2.7 (Strategy): the gather is a thin stream of small motes into the blade tip, each at most 0.4 m, 12 in all, on every tick of the cast.
test('the gather is 12 small motes, none above 0.4 m or 0.22 opacity, on any tick', () => {
  const s = stage(), dust = s.sprites('dust', 12); let biggest = 0, loudest = 0, lit = 0;
  assert.equal(s.scene.getObjectByName('dust 12'), undefined, 'twelve motes, no more');
  s.fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, s.heads, false, s.hands);
  for (let k = 101; k <= 100 + LAND_AT + 30; k++) {
    s.fx.render(1 / 60, k === 100 + LAND_AT ? [landed(k)] : [], fighters(), k, s.heads, false, s.hands);
    for (const d of dust) { if (!d.visible) continue; lit++; biggest = Math.max(biggest, d.scale.x); loudest = Math.max(loudest, (d.material as THREE.SpriteMaterial).opacity); }
  }
  assert.ok(lit > 50, 'the motes are drawn');
  assert.ok(biggest <= 0.4 + 1e-9, `no mote is above 0.4 m (${biggest.toFixed(3)})`);
  assert.ok(loudest <= 0.22 + 1e-9, `no mote is above 0.22 opacity (${loudest.toFixed(3)})`);
});
