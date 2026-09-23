import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ARENA_THEMES, ARENA_PICK, arenaFor } from '../src/arena-themes.ts';
import { buildArena, CAMERA_CLAMP, PLAY_RADIUS } from '../src/arena.ts';
import { CROWD_DYES } from '../src/assets/arena/crowd.ts';
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
  assert.deepEqual(ARENA_THEMES['1'].dyes, CROWD_DYES, 'Arena 1 dresses its crowd in crowd.ts\'s own dyes');
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
    // Readability (Strategy's bar): a theme changes the ground's material and hue, never its separation from the fighters.
    const base = luminance(one.sand) * shade;
    assert.ok(Math.abs(floor / base - 1) < 0.15, `${theme.id}: floor luminance ${floor.toFixed(3)} is more than 15 % from Arena 1's ${base.toFixed(3)}`);
    if (theme.id === '1') continue;
    // A different wall, not a recoloured one: the masonry's luminance pattern barely correlates with Arena 1's.
    const lum = (p: { data: Uint8Array }) => Float64Array.from({ length: p.data.length / 4 }, (_, i) => 0.3 * p.data[i * 4] + 0.59 * p.data[i * 4 + 1] + 0.11 * p.data[i * 4 + 2]);
    const a = lum(maps.stone), b = lum(one.stone), ma = a.reduce((x, y) => x + y) / a.length, mb = b.reduce((x, y) => x + y) / b.length;
    let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
    assert.ok(sab / Math.sqrt(saa * sbb) < 0.5, `${theme.id}: the wall is Arena 1's masonry recoloured (r = ${(sab / Math.sqrt(saa * sbb)).toFixed(2)})`);
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

test('every arena keeps the play circle and the camera clamp clear, crowd and wall-top cloth included', () => {
  for (const key of Object.keys(ARENA_THEMES) as (keyof typeof ARENA_THEMES)[]) {
    const scene = new THREE.Scene(), arena = buildArena(scene, ARENA_THEMES[key]); scene.updateMatrixWorld(true);
    const v = new THREE.Vector3(), im = new THREE.Matrix4();
    arena.group.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      const p = o.geometry.attributes.position, n = o instanceof THREE.InstancedMesh ? o.count : 1;
      for (let k = 0; k < n; k++) {
        if (o instanceof THREE.InstancedMesh) o.getMatrixAt(k, im); else im.identity();
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(im).applyMatrix4(o.matrixWorld); const r = Math.hypot(v.x, v.z);
          if (r < PLAY_RADIUS) assert.ok(v.y <= 0.06, `${key}: ${o.name} stands inside the play circle`);
          if (r < CAMERA_CLAMP) assert.ok(v.y <= 0.5 || v.y > 6, `${key}: ${o.name} reaches inside the camera clamp (${r.toFixed(2)} m, ${v.y.toFixed(2)} m)`);
        }
      }
    });
    arena.dispose();
  }
});

