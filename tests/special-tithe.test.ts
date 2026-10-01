import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { RULES } from '../src/moves.ts';
import { advanceCast, isBloodTithe, LAND_AT, SPECIAL_RECOVER } from '../src/special-timing.ts';
import { SPECIAL_TESTS, specialParam } from '../src/special-look.ts';
import { createBloodTithe, TINTS, ARM_OUT } from '../src/special-tithe.ts';
import { actorPose, initialPractice, attackSpecs, TITHE_CHAMBER } from '../src/combat.ts';
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

function stage() {
  const scene = new THREE.Scene(), sun = new THREE.DirectionalLight('#fff0d8', 3), hemi = new THREE.HemisphereLight('#c8d4ff', '#8a6a4a', 1);
  scene.add(sun, hemi); scene.background = new THREE.Color('#b8a58a'); scene.fog = new THREE.FogExp2('#b8a58a', 0.02); scene.environmentIntensity = 1;
  const gate = new THREE.MeshBasicMaterial({ name: 'gate-light', transparent: true, opacity: 0.55 }), sky = new THREE.MeshBasicMaterial({ name: 'sky', color: '#dfe6f0' });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), gate), new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sky));
  const fx = createBloodTithe(scene, 'veteran');
  const head = new THREE.Vector3(0, 1.62, -1.2), foe = new THREE.Vector3(0.1, 1.7, 1.2), hand = new THREE.Vector3(0.4, 1.1, 1.0);
  const heads = [head, foe] as const, hands = [null, hand] as const, root = scene.getObjectByName('blood tithe')!;
  const sprites = (name: string, n: number) => Array.from({ length: n }, (_, i) => scene.getObjectByName(`${name} ${i}`) as THREE.Sprite);
  const to = (from: number, t: number) => { for (let k = from; k <= t; k++) fx.render(1 / 60, [], fighters(), k, heads, false, hands); };
  return { scene, fx, heads, hands, root, sun, hemi, gate, sky, hand, head, foe, sprites, to, restore: () => {} };
}

test('the dust lifts only in the last 0.6 s, from the whole arena, and is in the blade on the landing tick', () => {
  const s = stage(), random = Math.random; let draws = 0; Math.random = () => { draws++; return random(); };
  try {
    s.fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, s.heads, false, s.hands);
    s.to(101, 100 + LAND_AT - 37);
    assert.ok(s.root.visible);
    assert.equal(s.sprites('dust', 44).filter((d) => d.visible).length, 0, 'no dust before the last 0.6 s');
    s.to(100 + LAND_AT - 36, 100 + LAND_AT - 20);
    const mid = s.sprites('dust', 44).filter((d) => d.visible);
    assert.ok(mid.length > 20, `dust is lifting (${mid.length})`);
    const xs = mid.map((d) => d.position.x); assert.ok(Math.max(...xs) - Math.min(...xs) > 3, 'from all over the arena, not one spot');
    assert.ok(mid.every((d) => Math.hypot(d.position.x - s.head.x, d.position.z - s.head.z) > 0.3 || d.position.y > 0.3), 'kept off the fighters');
    assert.ok(mid.every((d) => ((d.material as THREE.SpriteMaterial).opacity) <= 0.5), 'thin: it never hides the fighters');
    s.to(100 + LAND_AT - 19, 100 + LAND_AT - 1);
    const near = s.sprites('dust', 44).filter((d) => d.visible);
    const blade = s.hand.clone(), pull = near.map((d) => d.position.distanceTo(blade));
    assert.ok(near.length === 0 || Math.max(...pull) < 1.2, `what is left is in the blade (${near.length} motes, farthest ${Math.max(0, ...pull).toFixed(2)} m)`);
    assert.ok(s.sprites('charge', 8).some((c) => c.visible && (c.material as THREE.SpriteMaterial).opacity > 0.4), 'the blade is full');
  } finally { Math.random = random; s.restore(); }
  assert.equal(draws, 0, "gore's seeded Math.random sequence is untouched");
});

test("the light turns red on the arena's OWN lights, fog and sky (no page overlay): slow at first, surging in the last 0.6 s, held on the strike, restored exactly", () => {
  const s = stage(), redness = (c: THREE.Color) => c.r / Math.max(c.g, c.b), base = { sun: s.sun.color.clone(), fog: (s.scene.fog as THREE.FogExp2).color.clone(), sky: s.sky.color.clone(), hemi: s.hemi.color.clone() };
  const sunRed0 = redness(s.sun.color);
  s.fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, s.heads, false, s.hands);
  s.to(101, 100 + 50); const early = redness(s.sun.color) / sunRed0;
  s.to(100 + 51, 100 + LAND_AT - 37); const before = redness(s.sun.color) / sunRed0;
  s.to(100 + LAND_AT - 36, 100 + LAND_AT); const peak = redness(s.sun.color) / sunRed0;
  assert.ok(early > 1 && early < 1.2 && before < 1.4 && peak > 1.8, `sun red ratio x${early.toFixed(2)} -> x${before.toFixed(2)} -> x${peak.toFixed(2)}`);
  assert.ok(redness((s.scene.fog as THREE.FogExp2).color) > redness(base.fog) * 1.4 && redness(s.sky.color) > redness(base.sky) * 1.4 && redness(s.hemi.color) > redness(base.hemi) * 1.4, 'fog, sky and hemisphere go red too');
  assert.ok(s.gate.opacity < 0.2 && s.scene.environmentIntensity < 0.8, 'the gate light shaft (the pale streak) fades out and the fill dims');
  s.fx.render(1 / 60, [landed(100 + LAND_AT)], fighters(), 100 + LAND_AT, s.heads, false, s.hands);
  assert.ok(redness(s.sun.color) / sunRed0 > 1.8, 'held on the strike');
  s.to(101 + LAND_AT, 100 + LAND_AT + SPECIAL_RECOVER + 40);
  assert.ok(s.sun.color.equals(base.sun) && (s.scene.fog as THREE.FogExp2).color.equals(base.fog) && s.sky.color.equals(base.sky) && s.hemi.color.equals(base.hemi), 'every colour is back exactly');
  assert.equal(s.gate.opacity, 0.55); assert.equal(s.scene.environmentIntensity, 1);
  assert.ok(!s.root.visible, 'everything is gone after the clear and the burst');
});

test('no page overlay: the module never touches the document, so the HUD and buttons stay as they are', () => {
  assert.ok(!/document\.|getElementById|\.body\b/.test(readFileSync('src/special-tithe.ts', 'utf8').replace(/\/\/.*$/gm, '')), 'no DOM access');
});

test('the strike bursts off the blade in dark blood red, then the leftovers settle; no glow colour, no meshes', () => {
  const s = stage();
  try {
    s.fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, s.heads, false, s.hands);
    s.to(101, 100 + LAND_AT - 1);
    s.fx.render(1 / 60, [landed(100 + LAND_AT)], fighters(), 100 + LAND_AT, s.heads, false, s.hands);
    const burst = s.sprites('burst', 36);
    assert.ok(burst.every((b) => b.visible) && burst[0].position.distanceTo(s.hand) < 0.8, 'fires at the blade');
    s.to(101 + LAND_AT, 100 + LAND_AT + 12);
    const wide = s.sprites('burst', 36).filter((b) => b.visible && (b.material as THREE.SpriteMaterial).opacity > 0.25);
    assert.ok(wide.length > 20 && Math.max(...wide.map((b) => b.scale.x)) > 0.65 && Math.max(...wide.map((b) => b.position.distanceTo(s.hand))) > 0.6, 'the burst is big and spreads wide enough to read at the 375 camera (v2)');
    s.to(101 + LAND_AT + 12, 100 + LAND_AT + 22);
    const settling = s.sprites('dust', 44).filter((d) => d.visible);
    assert.ok(settling.length > 5 && settling.every((d) => d.position.y < 0.7), `what the blade did not take settles low (${settling.length})`);
  } finally { s.restore(); }
  for (const c of TINTS) { const { r, g, b } = new THREE.Color(c); assert.ok(r > g * 2 && r > b * 2 && r < 0.4, `${c}: dark blood red, not neon`); }
  let meshes = 0; s.root.traverse((o) => { if (o instanceof THREE.Mesh) meshes++; });
  assert.equal(meshes, 0, 'sprites only: no props');
});

test('special-tithe ships in its own lazy chunk: nothing imports it statically', () => {
  const statics = readdirSync('src').filter((f) => f.endsWith('.ts') && /from\s+['"]\.\/special-tithe\.ts['"]/.test(readFileSync(`src/${f}`, 'utf8')));
  assert.deepEqual(statics, []);
  assert.match(readFileSync('src/scene.ts', 'utf8'), /import\('\.\/special-tithe\.ts'\)/);
});

// Preview-only: the scene loads Blood Tithe only for the veteran on ?special=tithe; every other veteran fight with a special share loads special-fx, which draws nothing for him.
test('the scene picks Blood Tithe only on ?special=tithe for the veteran; otherwise special-fx', () => {
  const scene = readFileSync('src/scene.ts', 'utf8'), pick = /void \((opponentId === 'veteran' && specialParam\([^)]*\) === 'tithe') \? import\('\.\/special-tithe\.ts'\)[^:]*: import\('\.\/special-fx\.ts'\)/.exec(scene);
  assert.ok(pick, 'the choice is gated by the query flag and falls back to special-fx');
  assert.equal(specialParam('?special=tithe'), 'tithe');
  assert.equal(specialParam('?opponent=veteran'), null, 'a plain veteran fight has no flag');
  assert.equal(specialParam('?special=hades'), 'hades');
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
// contact still tucks the blade against his chest. His Blood Tithe rides the thrust clip held AT contact (the sword arm extended) through the gather, chambers briefly, then
// drives home on the strike tick; the Nightborn keeps the heavy raise.
test("the Centurion's special holds the thrust's contact pose through the gather, chambers just before the strike, drives to contact on it; the Nightborn keeps the heavy raise", () => {
  const stage = (opponent: 'veteran' | 'nightborn', aiSkill: 'shove' | 'lunge', special: number) => {
    const s = initialPractice(731, OPPONENTS[opponent], 'longsword', null, { level: 46, aiSkill });
    s.duel = { ...s.duel, fighters: [s.duel.fighters[0], { ...s.duel.fighters[1], special, skillCooldown: RULES.special.cooldown }] } as typeof s.duel;
    return actorPose(s, 1);
  };
  const W = RULES.special.windup, c = attackSpecs(OPPONENTS.veteran.weapon).thrust.contact / attackSpecs(OPPONENTS.veteran.weapon).thrust.recovery;
  const early = stage('veteran', 'shove', W - 12), mid = stage('veteran', 'shove', Math.round(W * 0.4)), chamber = stage('veteran', 'shove', Math.round(W * 0.12)), landing = stage('veteran', 'shove', 1);
  for (const p of [early, mid, chamber, landing]) assert.equal(p.attack, 'thrust', 'the forward clip, not the heavy raise');
  assert.ok(Math.abs(early.progress - c) < 1e-9 && Math.abs(mid.progress - c) < 1e-9, 'the contact pose (arm extended) through the whole gather');
  assert.ok(chamber.progress < c * 0.9 && chamber.progress > c * TITHE_CHAMBER * 0.95, 'a short chamber just before the strike');
  assert.ok(landing.progress > c * 0.97 && landing.progress <= c + 1e-9, 'driven back to full contact on the strike tick');
  assert.equal(stage('nightborn', 'lunge', W - 12).attack, 'heavy', "Hades' Shadow's caster keeps his approved motion");
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
