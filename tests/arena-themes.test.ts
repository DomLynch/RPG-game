import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ARENA_THEMES, ARENA_PICK, arenaBand, arenaFor } from '../src/arena-themes.ts';
import { buildArena, CAMERA_CLAMP, PLAY_RADIUS } from '../src/arena.ts';
import { resetPhoneTierForTests } from '../src/quality.ts';
import { CROWD_DYES } from '../src/assets/arena/crowd.ts';
import { generateHeavyTextures } from '../src/assets/arena/texture-worker.ts';
import { luminance, sandAlbedo, sandNormal, skyPixels, stoneAlbedo, stoneNormal } from '../src/assets/arena/textures.ts';
import { LADDER } from '../src/ladder.ts';

// Arenas 2 and 3: a theme is colour and light only. The rotation follows the ladder band; the geometry never moves.
const SKIN_SAMPLE = 0.166;   // tests/arena.test.ts: the hero's skin albedo, which every floor must stay below

test('the ladder band picks the arena: two rungs each, 1 → A → B → C → D, all five arenas on the ladder; an override wins; unknown is Arena 1', () => {
  assert.equal(LADDER.length, 10, 'ten rungs: five bands of two');
  assert.deepEqual(LADDER.map((_, i) => arenaBand(i + 1)), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.deepEqual(Object.values(ARENA_PICK), ['1', 'a', 'b', 'c', 'd'], 'every built arena is picked exactly once');
  LADDER.forEach((o, i) => {
    const rung = i + 1, want = ARENA_PICK[arenaBand(rung)];
    assert.equal(arenaFor(o.id).id, want, `${o.id} (rung ${rung})`);
  });
  assert.equal(arenaFor('goblin').id, 'a'); assert.equal(arenaFor('shieldmaiden').id, 'd');
  assert.equal(arenaFor('veteran').id, '1');
  assert.equal(arenaFor('veteran', 'd').id, 'd');
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
    // Every themed floor multiplies through the world-space patch mask (arena.ts): its mean effect is part of the floor's albedo.
    const maps = generateHeavyTextures(true, 0.4, theme.textures), patch = maps.patch;
    let mask = 1; if (patch) { mask = 0; const d = patch.data; for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] / 255; mask += 1 - a + a * (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 127.5; } mask /= d.length / 4; }
    const floor = luminance(maps.sand) * shade * mask;
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

test('no theme moves the geometry: every arena builds the same meshes, vertex for vertex (weather and light shafts are not geometry)', () => {
  const shape = (key: keyof typeof ARENA_THEMES) => {
    const scene = new THREE.Scene(), arena = buildArena(scene, ARENA_THEMES[key]), out: string[] = [];
    arena.group.traverse(o => { if ((o instanceof THREE.Mesh || o instanceof THREE.Points) && o.name !== 'motes' && o.name !== 'rain' && o.name !== 'light-shafts') out.push(`${o.name}:${o.geometry.attributes.position.count}:${Array.from(o.geometry.attributes.position.array as Float32Array).reduce((a, b) => a + b, 0).toFixed(3)}`); });
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
      if (!(o instanceof THREE.Mesh) || o.name === 'light-shafts' || o.name === 'rain') return;   // rain: streaks falling through the frame, no depth write, like the cloud it replaced   // additive light, no depth write: a fighter walks through it lit, never hidden (arena.ts)
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

test('what the solid-geometry rules skip is really not solid: light shafts are additive light, the weather is a Points cloud', () => {
  for (const key of Object.keys(ARENA_THEMES) as (keyof typeof ARENA_THEMES)[]) {
    const scene = new THREE.Scene(), arena = buildArena(scene, ARENA_THEMES[key]), shafts = arena.group.getObjectByName('light-shafts');
    assert.equal(!!shafts, !!ARENA_THEMES[key].shafts, `${key}: light shafts only where the theme asks for them`);
    if (shafts) {
      const m = (shafts as THREE.Mesh).material as THREE.MeshBasicMaterial;
      assert.ok(m.blending === THREE.AdditiveBlending && !m.depthWrite && !shafts.castShadow, `${key}: the shafts must be additive, depth-write off and shadowless`);
    }
    const weather = arena.group.getObjectByName(ARENA_THEMES[key].weather?.kind === 'rain' ? 'rain' : 'motes');
    assert.ok(weather && !weather.castShadow, `${key}: the weather is one shadowless draw`);
    if (ARENA_THEMES[key].weather?.kind === 'rain') {
      // Rain is thin quads falling in the vertex shader (Dom's iPhone 15): no Points cloud, no per-frame buffer rewrite, and the quad's
      // area is a fraction of the 0.5 m sprite square it replaced.
      const rain = weather as THREE.Mesh, m = rain.material as THREE.MeshBasicMaterial, position = rain.geometry.attributes.position as THREE.BufferAttribute;
      assert.ok(rain instanceof THREE.Mesh && !arena.group.getObjectByName('motes'), `${key}: rain replaces the Points cloud`);
      assert.ok(m.transparent && !m.depthWrite && !rain.frustumCulled, `${key}: rain blends, writes no depth, and is never culled whole`);
      assert.equal(position.count, ARENA_THEMES[key].weather!.count * 4, `${key}: four corners per drop`);
      const before = Float32Array.from(position.array as Float32Array);
      arena.update(1 / 60, []); arena.update(1 / 60, []);
      assert.deepEqual(Float32Array.from(position.array as Float32Array), before, `${key}: the drops fall on the GPU; the buffer is never rewritten`);
      assert.equal(position.version, 0, `${key}: and never re-uploaded`);
    } else assert.ok(weather instanceof THREE.Points, `${key}: the weather is one Points cloud`);
    arena.dispose();
  }
});


test('the phone tier draws 500 rain streaks, the full tier every one the theme asks for; nothing else about the rain changes', () => {
  const key = (Object.keys(ARENA_THEMES) as (keyof typeof ARENA_THEMES)[]).find((k) => ARENA_THEMES[k].weather?.kind === 'rain')!;
  const g = globalThis as { location?: { search: string } };
  const build = () => { resetPhoneTierForTests(); const rain = buildArena(new THREE.Scene(), ARENA_THEMES[key]).group.getObjectByName('rain') as THREE.Mesh; return { count: (rain.geometry.attributes.position as THREE.BufferAttribute).count / 4, material: rain.material as THREE.MeshBasicMaterial, culled: rain.frustumCulled }; };
  try {
    g.location = { search: '?gfx=phone' }; const phone = build();
    g.location = { search: '?gfx=full' }; const full = build();
    assert.equal(full.count, ARENA_THEMES[key].weather!.count);
    assert.equal(phone.count, 500, `${key}: a third of the rain on the phone tier`);
    assert.equal(phone.material.side, full.material.side, 'the streak sides are untouched'); assert.equal(phone.culled, full.culled);
  } finally { delete g.location; resetPhoneTierForTests(); }
});
