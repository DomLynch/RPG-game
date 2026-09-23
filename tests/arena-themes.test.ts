import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ARENA_THEMES, ARENA_PICK, arenaFor } from '../src/arena-themes.ts';
import { buildArena } from '../src/arena.ts';
import { generateHeavyTextures } from '../src/assets/arena/texture-worker.ts';
import { luminance, sandAlbedo, sandNormal, skyPixels, stoneAlbedo, stoneNormal } from '../src/assets/arena/textures.ts';
import { LADDER } from '../src/ladder.ts';

// Arenas 2 and 3: a theme is colour and light only. The rotation follows the ladder band; the geometry never moves.
const SKIN_SAMPLE = 0.166;   // tests/arena.test.ts: the hero's skin albedo, which every floor must stay below

test('the ladder band picks the arena: rungs 1–3 Arena 1, 4–7 Arena 2, 8–10 Arena 3; an override wins; unknown is Arena 1', () => {
  LADDER.forEach((o, i) => {
    const rung = i + 1, want = ARENA_PICK[rung >= 8 ? 3 : rung >= 4 ? 2 : 1];
    assert.equal(arenaFor(o.id).id, want, `${o.id} (rung ${rung})`);
  });
  assert.equal(arenaFor('veteran').id, '1');
  assert.equal(arenaFor('veteran', '3b').id, '3b');
  assert.equal(arenaFor('veteran', 'nonsense').id, '1');
});

test('Arena 1 generates exactly the maps it did before the themes', () => {
  const skyU = 0.4, got = generateHeavyTextures(true, skyU, ARENA_THEMES['1'].textures);
  const want = { sand: sandAlbedo(512), sandNormal: sandNormal(256), stone: stoneAlbedo(256), stoneNormal: stoneNormal(256), sky: skyPixels(256, 128, skyU) };
  for (const key of Object.keys(want) as (keyof typeof want)[]) assert.deepEqual(got[key].data, want[key].data, key);
});

test('every arena\'s floor stays darker than the hero\'s skin, and each new arena reads differently from Arena 1', () => {
  const one = generateHeavyTextures(true, 0.4, ARENA_THEMES['1'].textures);
  // What the shader multiplies, as arena.test.ts measures it: texture × material colour × mean vertex tint (the last two are the same in every arena).
  const scene = new THREE.Scene(), { floor: mesh, dispose } = buildArena(scene), color = mesh.geometry.attributes.color, c = (mesh.material as THREE.MeshStandardMaterial).color;
  let tint = 0; for (let i = 0; i < color.count; i++) tint += 0.2126 * color.getX(i) + 0.7152 * color.getY(i) + 0.0722 * color.getZ(i);
  const shade = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) * tint / color.count; dispose();
  for (const theme of Object.values(ARENA_THEMES)) {
    const maps = generateHeavyTextures(true, 0.4, theme.textures), floor = luminance(maps.sand) * shade;
    assert.ok(floor < SKIN_SAMPLE, `${theme.id}: sand albedo ${floor.toFixed(3)} is not below the skin sample ${SKIN_SAMPLE}`);
    if (theme.id === '1') continue;
    const mean = (p: { data: Uint8Array }, c: number) => { let s = 0; for (let i = c; i < p.data.length; i += 4) s += p.data[i]; return s / (p.data.length / 4); };
    const distance = (a: typeof one.sand, b: typeof one.sand) => Math.hypot(...[0, 1, 2].map(c => mean(a, c) - mean(b, c)));
    assert.ok(distance(maps.sand, one.sand) > 12 && distance(maps.sky, one.sky) > 12, `${theme.id} is too close to Arena 1`);
  }
});

test('no theme moves the geometry: every arena builds the same meshes, vertex for vertex', () => {
  const shape = (key: keyof typeof ARENA_THEMES) => {
    const scene = new THREE.Scene(), arena = buildArena(scene, ARENA_THEMES[key]), out: string[] = [];
    arena.group.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Points) out.push(`${o.name}:${o.geometry.attributes.position.count}:${Array.from(o.geometry.attributes.position.array as Float32Array).reduce((a, b) => a + b, 0).toFixed(3)}`); });
    arena.dispose(); return out;
  };
  const one = shape('1');
  for (const key of Object.keys(ARENA_THEMES) as (keyof typeof ARENA_THEMES)[]) assert.deepEqual(shape(key), one, key);
});
