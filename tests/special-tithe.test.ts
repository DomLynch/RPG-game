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
  assert.ok(advanceCast(null, [started(10)], fighters(), 10, 'veteran', false));
  assert.equal(advanceCast(null, [started(10, { actor: 0 })], fighters(), 10, 'veteran', false), null);
  assert.equal(advanceCast(null, [started(10)], fighters(), 10, 'goblin', false), null, 'another warden draws nothing');
  assert.equal(advanceCast(null, [started(10)], fighters(), 10, 'veteran', true), null, 'yielding: no new cast');
  assert.deepEqual(SPECIAL_TESTS.tithe, { opponent: 'veteran', level: 46, first: 180 });
  assert.equal(specialParam('?special=tithe'), 'tithe');
});

function stage() {
  const g = globalThis as { document?: unknown }, saved = g.document, wash = { style: {} as Record<string, string>, id: '' };
  g.document = { createElement: () => wash, body: { append() {} } };
  const scene = new THREE.Scene(), fx = createBloodTithe(scene, 'veteran');
  const head = new THREE.Vector3(0, 1.62, -1.2), foe = new THREE.Vector3(0.1, 1.7, 1.2), hand = new THREE.Vector3(0.4, 1.1, 1.0);
  const heads = [head, foe] as const, hands = [null, hand] as const, root = scene.getObjectByName('blood tithe')!;
  const sprites = (name: string, n: number) => Array.from({ length: n }, (_, i) => scene.getObjectByName(`${name} ${i}`) as THREE.Sprite);
  const to = (from: number, t: number) => { for (let k = from; k <= t; k++) fx.render(1 / 60, [], fighters(), k, heads, false, hands); };
  return { scene, fx, heads, hands, root, wash, hand, head, foe, sprites, to, restore: () => { g.document = saved; } };
}

test('the dust lifts only in the last 0.6 s, from the whole arena, and is in the blade on the landing tick', () => {
  const s = stage(), random = Math.random; let draws = 0; Math.random = () => { draws++; return random(); };
  try {
    s.fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, s.heads, false, s.hands);
    s.to(101, 100 + LAND_AT - 37);
    assert.ok(s.root.visible);
    assert.equal(s.sprites('dust', 72).filter((d) => d.visible).length, 0, 'no dust before the last 0.6 s');
    s.to(100 + LAND_AT - 36, 100 + LAND_AT - 20);
    const mid = s.sprites('dust', 72).filter((d) => d.visible);
    assert.ok(mid.length > 20, `dust is lifting (${mid.length})`);
    const xs = mid.map((d) => d.position.x); assert.ok(Math.max(...xs) - Math.min(...xs) > 3, 'from all over the arena, not one spot');
    assert.ok(mid.every((d) => Math.hypot(d.position.x - s.head.x, d.position.z - s.head.z) > 0.3 || d.position.y > 0.3), 'kept off the fighters');
    assert.ok(mid.every((d) => ((d.material as THREE.SpriteMaterial).opacity) <= 0.5), 'thin: it never hides the fighters');
    s.to(100 + LAND_AT - 19, 100 + LAND_AT - 1);
    const near = s.sprites('dust', 72).filter((d) => d.visible);
    const blade = s.hand.clone(), pull = near.map((d) => d.position.distanceTo(blade));
    assert.ok(near.length === 0 || Math.max(...pull) < 1.2, `what is left is in the blade (${near.length} motes, farthest ${Math.max(0, ...pull).toFixed(2)} m)`);
    assert.ok(s.sprites('charge', 7).some((c) => c.visible && (c.material as THREE.SpriteMaterial).opacity > 0.4), 'the blade is full');
  } finally { Math.random = random; s.restore(); }
  assert.equal(draws, 0, "gore's seeded Math.random sequence is untouched");
});

test('the light turns red: slow at first, surging over the last 0.6 s, held on the strike, gone after the clear', () => {
  const s = stage();
  try {
    s.fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, s.heads, false, s.hands);
    s.to(101, 100 + 50); const early = +s.wash.style.opacity;
    s.to(100 + 51, 100 + LAND_AT - 37); const before = +s.wash.style.opacity;
    s.to(100 + LAND_AT - 36, 100 + LAND_AT); const peak = +s.wash.style.opacity;
    assert.ok(early > 0 && early < 0.15 && before <= 0.25 && peak >= 0.6, `${early} -> ${before} -> ${peak}`);
    s.fx.render(1 / 60, [landed(100 + LAND_AT)], fighters(), 100 + LAND_AT, s.heads, false, s.hands);
    assert.ok(+s.wash.style.opacity >= 0.6, 'held on the strike');
    s.to(101 + LAND_AT, 100 + LAND_AT + SPECIAL_RECOVER + 40);
    assert.equal(+s.wash.style.opacity, 0, 'the light is back');
    assert.ok(!s.root.visible, 'everything is gone after the clear and the burst');
  } finally { s.restore(); }
});

test('the strike bursts off the blade in dark blood red, then the leftovers settle; no glow colour, no meshes', () => {
  const s = stage();
  try {
    s.fx.render(1 / 60, [started(100)], fighters(RULES.special.windup), 100, s.heads, false, s.hands);
    s.to(101, 100 + LAND_AT - 1);
    s.fx.render(1 / 60, [landed(100 + LAND_AT)], fighters(), 100 + LAND_AT, s.heads, false, s.hands);
    const burst = s.sprites('burst', 24);
    assert.ok(burst.every((b) => b.visible) && burst[0].position.distanceTo(s.hand) < 0.8, 'fires at the blade');
    s.to(101 + LAND_AT, 100 + LAND_AT + 12);
    const settling = s.sprites('dust', 72).filter((d) => d.visible);
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
