import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { RULES } from '../src/moves.ts';
import { advanceCast, LAND_AT, SPECIAL_RECOVER } from '../src/special-timing.ts';
import { SPECIAL_TESTS, specialParam } from '../src/special-look.ts';
import { createBloodTithe, TINTS } from '../src/special-tithe.ts';

// Blood Tithe (special-tithe.ts): the Centurion's rank-10 special, presentation only, ?special=tithe. Dust lifts only in the last 0.6 s and is in the blade on the
// landing tick; the light turns red (a wash element); the strike bursts off the blade; everything clears. Never hides both fighters.
const fighters = (special = 0) => [{ special: 0 }, { special, skill: 'shove' }] as unknown as readonly [Fighter, Fighter];
const started = (tick: number, extra: object = {}) => ({ tick, type: 'SpecialStarted', actor: 1, move: 'skill_shove', ...extra }) as unknown as CombatEvent;
const landed = (tick: number) => ({ tick, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_shove', damage: 30 }) as unknown as CombatEvent;

test('only the Centurion\'s Scutum Shove special on the opponent side casts; ?special=tithe is his page at level 46', () => {
  assert.ok(advanceCast(null, [started(10)], fighters(), 10, 'veteran', false, true));
  assert.equal(advanceCast(null, [started(10, { actor: 0 })], fighters(), 10, 'veteran', false, true), null);
  assert.equal(advanceCast(null, [started(10)], fighters(), 10, 'goblin', false, true), null, 'another warden draws nothing');
  assert.equal(advanceCast(null, [started(10)], fighters(), 10, 'veteran', true, true), null, 'yielding: no new cast');
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
