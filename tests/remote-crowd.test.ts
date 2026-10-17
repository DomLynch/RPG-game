// A crowd of other players: the nearest `remoteFullCount` are full figures, the rest CHEAP (no trail, no shadow cast, a pose update every `remoteCheapEvery` frames), all still drawn, and none adds a program.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, Group, Mesh, BufferGeometry, MeshBasicMaterial, PerspectiveCamera, Skeleton, SkinnedMesh } from 'three';
import { createRemoteHeroes, tagText } from '../origins/preview/remote-heroes.ts';
import { previewRule } from '../origins/preview/preview-rules.ts';

const FULL = previewRule('remoteFullCount'), EVERY = previewRule('remoteCheapEvery');
const material = new MeshBasicMaterial();   // one shared material, as the rig's: a cheap figure must keep it

function crowd(n: number) {
  const made: { anchor: Group; draws: Mesh[]; trail: Mesh; updates: number[] }[] = [];
  const spawn = () => {
    const anchor = new Group(), draws = [new Mesh(new BufferGeometry(), material), new Mesh(new BufferGeometry(), material)], trail = new Mesh(new BufferGeometry(), material);
    for (const d of draws) { d.castShadow = true; anchor.add(d); }
    trail.name = 'WeaponTrail'; trail.visible = true; anchor.add(trail);
    const updates: number[] = [];
    made.push({ anchor, draws, trail, updates });
    return { anchor, update: (_s: number, dt: number) => { updates.push(dt); } } as never;
  };
  const heroes = createRemoteHeroes({ scene: new Group(), spawn, groundAt: () => 0 });
  heroes.warm();
  heroes.push(Array.from({ length: n }, (_, i) => ({ id: i + 1, x: 2 + i, z: 0, heading: 0, anim: 0, flags: 0 })), 0);
  return { heroes, made };
}

test('17+ remotes: exactly remoteFullCount full figures, the rest cheap, all drawn, no new material', () => {
  const { heroes, made } = crowd(FULL + 5);
  heroes.update(1 / 60, 0, { x: 0, z: 0 });
  const shown = heroes.debug().shown;
  assert.equal(shown.length, FULL + 5, 'all drawn');
  assert.equal(shown.filter((s) => !s.cheap).length, FULL);
  assert.deepEqual(shown.filter((s) => !s.cheap).map((s) => s.id).sort((a, b) => a - b), Array.from({ length: FULL }, (_, i) => i + 1), 'the nearest are the full ones');
  for (const f of made.filter((m) => m.draws[0]!.castShadow === false || m.updates.length)) for (const d of f.draws) assert.equal(d.material, material);
  const cheap = shown.filter((s) => s.cheap).length; assert.equal(made.filter((m) => m.draws.every((d) => !d.castShadow) && !m.trail.visible).length, cheap, 'cheap: no shadow, no trail');
});

test('a cheap figure poses every Nth frame with the time it was owed; a full one every frame', () => {
  const { heroes, made } = crowd(FULL + 1);
  for (let f = 0; f < EVERY * 2; f++) heroes.update(0.01, 0, { x: 0, z: 0 });
  const cheapFig = made.find((m) => !m.draws[0]!.castShadow)!, fullFig = made.find((m) => m.draws[0]!.castShadow && m.updates.length)!;
  assert.equal(fullFig.updates.length, EVERY * 2);
  assert.equal(cheapFig.updates.length, 3, 'posed on arrival, then on every Nth frame');
  assert.ok(Math.abs(cheapFig.updates[2]! - 0.01 * EVERY) < 1e-9, 'it is owed the frames it skipped');
});

test('a remote outside the camera frustum, or past remoteAnimRange, makes no pose update (mixer and bones) but still moves its root; it is owed the time, capped', () => {
  const { heroes, made } = crowd(0);
  const camera = new PerspectiveCamera(50, 0.5, 0.1, 500); camera.position.set(0, 1, 10); camera.updateMatrixWorld();   // looks down -z from z = 10
  heroes.push([{ id: 1, x: 0, z: 0, heading: 0, anim: 0, flags: 0 }, { id: 2, x: 0, z: 50, heading: 0, anim: 0, flags: 0 }, { id: 3, x: 0, z: -(previewRule('remoteAnimRange') + 20), heading: 0, anim: 0, flags: 0 }], 0);
  for (let f = 0; f < 10; f++) heroes.update(0.1, 0, { x: 0, z: 10 }, camera);
  const [inView, behind, far] = made.slice(0, 3);   // slots are claimed in the nearest-first order: id 1 (10 m), id 2 (40 m, behind the camera), id 3 (far, ahead)
  assert.equal(inView!.updates.length, 10, 'in view: every frame');
  assert.equal(behind!.updates.length, 0, 'behind the camera: no mixer.update at all');
  assert.equal(far!.updates.length, 0, 'beyond the range: none');
  assert.deepEqual(heroes.debug().shown.map((s) => s.visible), [true, false, false], 'out of view or range: hidden (the render never enters them), still tracked and still moving');
  camera.position.set(0, 1, 60); camera.updateMatrixWorld();   // now id 2 (z = 50) is ahead of the camera
  heroes.update(0.1, 0, { x: 0, z: 10 }, camera);
  assert.equal(behind!.updates.length, 1, 'in view again: posed');
  assert.ok(Math.abs(behind!.updates[0]! - previewRule('remoteOwedCap')) < 1e-9, 'paid back the skipped time, capped at remoteOwedCap');
});

test('a frozen figure (cheap on a skip frame, or hidden) triggers no skeleton update (the bone-texture upload) and is cut from the scene walk; a hidden one is not traversed', () => {
  const real = Skeleton.prototype.update; let uploads = 0; Skeleton.prototype.update = function () { uploads++; };   // what the render calls for every drawn skin, and what ends in boneTexture.needsUpdate
  try {
    const spawn = () => {
      const anchor = new Group(), bone = new Bone(), mesh = new SkinnedMesh(new BufferGeometry(), material); anchor.add(bone, mesh); mesh.bind(new Skeleton([bone]));
      return { anchor, update: () => {} } as never;
    };
    const rig = () => {
      const scene = new Group(), heroes = createRemoteHeroes({ scene, spawn, groundAt: () => 0 }); heroes.warm();
      const render = (): number => { uploads = 0; scene.traverseVisible((o) => { if (o instanceof SkinnedMesh) o.skeleton.update(); }); return uploads; };   // the renderer's projectObject
      return { scene, heroes, render };
    };
    const a = rig();
    a.heroes.push(Array.from({ length: FULL + 1 }, (_, i) => ({ id: i + 1, x: 2 + i, z: 0, heading: 0, anim: 0, flags: 0 })), 0);
    const perFrame: number[] = [];
    for (let f = 0; f < EVERY * 2; f++) { a.heroes.update(0.01, 0, { x: 0, z: 0 }); perFrame.push(a.render()); }
    assert.deepEqual(perFrame.map((n) => n - FULL), perFrame.map((_, f) => (f === 0 || (f + 1) % EVERY === 0 ? 1 : 0)), 'the 16 full figures upload every frame; the cheap one only on its pose frames (the first, then every Nth): a skip frame uploads nothing for it');
    assert.equal(a.heroes.debug().shown.filter((s) => s.frozen).length, 1);
    assert.equal(a.scene.children.filter((g) => !g.matrixWorldAutoUpdate).length, 1, 'its group is out of the scene.updateMatrixWorld walk');
    // hidden: outside the frustum, so the render never reaches its skin
    const b = rig(), camera = new PerspectiveCamera(50, 0.5, 0.1, 500); camera.position.set(0, 1, 10); camera.updateMatrixWorld();
    b.heroes.push([{ id: 1, x: 0, z: 0, heading: 0, anim: 0, flags: 0 }, { id: 2, x: 0, z: 50, heading: 0, anim: 0, flags: 0 }], 0);
    b.heroes.update(0.01, 0, { x: 0, z: 10 }, camera);
    assert.equal(b.render(), 1, 'one drawn skin: the one in view; the one behind the camera is not traversed');
    assert.equal(b.heroes.debug().shown.filter((s) => s.visible).length, 1);
    assert.equal(b.scene.children.filter((g) => !g.matrixWorldAutoUpdate).length, 1, 'the hidden one is out of the matrix walk too');
  } finally { Skeleton.prototype.update = real; }
});

test('the page\'s enter records feed the tag (name, "Guest", or none: a null name is no tag), and an expired id is forgotten so a reused id never wears the old name', () => {
  assert.deepEqual([{ name: 'Crixus', guest: false }, { name: null, guest: true }, { name: null, guest: false }, { name: '  ', guest: false }, undefined].map(tagText), ['Crixus', 'Guest', null, null, null]);
  const asked: number[] = [], forgotten: number[] = [], spawn = () => ({ anchor: new Group(), update: () => {} }) as never;   // (a drawn tag needs a canvas: the browser rows check the sprite itself)
  const heroes = createRemoteHeroes({ scene: new Group(), spawn, groundAt: () => 0, who: (id) => { asked.push(id); return { name: null, guest: false }; }, forget: (id) => { forgotten.push(id); } });
  heroes.warm(); heroes.push([1, 2].map((id) => ({ id, x: id, z: 0, heading: 0, anim: 0, flags: 0 })), 0);
  heroes.update(1 / 60, 0, { x: 0, z: 0 });
  assert.deepEqual(asked.sort(), [1, 2], 'asked for each drawn id');
  heroes.update(1 / 60, 2000, { x: 0, z: 0 });   // past remoteExpire with no packet: both gone
  assert.deepEqual(forgotten.sort(), [1, 2]); assert.equal(heroes.debug().shown.length, 0);
});

test('adaptive: a frame time that stays high drops the full count from remoteFullCount to remoteAdaptFullCount, and a clean window brings it back', () => {
  const n = FULL + 5, list = Array.from({ length: n }, (_, i) => ({ id: i + 1, x: 2 + i, z: 0, heading: 0, anim: 0, flags: 0 })), { heroes } = crowd(n);
  let now = 0;
  const frames = (seconds: number, ms: number) => { for (const end = now + seconds * 1000; now < end; now += ms) { heroes.push(list, now); heroes.update(ms / 1000, now, { x: 0, z: 0 }); } };
  const fulls = () => heroes.debug().shown.filter((s) => !s.cheap).length;
  frames(5, 16.7); assert.equal(fulls(), FULL, 'at 60 fps: the ruled full count');
  frames(5, 45); assert.equal(heroes.debug().adaptive.low, true); assert.equal(fulls(), previewRule('remoteAdaptFullCount'), 'slow frames: the smaller full count');
  frames(7, 16.7); assert.equal(fulls(), FULL, 'a clean window: back to the ruled count');
});

test('the ground height is read again only after a figure has moved remoteGroundStep, and the figure stands on the last read (T4 profile: reliefAt per figure per frame)', () => {
  const step = previewRule('remoteGroundStep'); let reads = 0;
  const spawn = () => ({ anchor: new Group(), update: () => {} }) as never;
  const heroes = createRemoteHeroes({ scene: new Group(), spawn, groundAt: (x) => { reads++; return x; } }); heroes.warm();
  const frames = 100, dx = step / 5;   // 5 frames per step: a walk of frames x dx metres
  for (let f = 0; f < frames; f++) { heroes.push([{ id: 1, x: 10 + f * dx, z: 0, heading: 0, anim: 0, flags: 0 }], f * 16); heroes.update(1 / 60, f * 16, { x: 0, z: 0 }); }
  const walked = (frames - 1) * dx;
  assert.ok(reads <= Math.ceil(walked / step) + 2, `a walk of ${walked.toFixed(1)} m reads about once per ${step} m, not once per frame (${reads} reads in ${frames} frames)`);
  assert.ok(reads >= Math.floor(walked / step), 'and not so seldom that the figure floats');
  const y = heroes.debug().shown[0]!.x; assert.ok(Math.abs(y - (10 + (frames - 1) * dx)) < 2 * step, 'it is drawn where the track puts it');
  const idle = createRemoteHeroes({ scene: new Group(), spawn, groundAt: () => { reads++; return 0; } }); idle.warm(); reads = 0;
  for (let f = 0; f < 60; f++) { idle.push([{ id: 2, x: 5, z: 5, heading: 0, anim: 0, flags: 0 }], f * 16); idle.update(1 / 60, f * 16, { x: 0, z: 0 }); }
  assert.equal(reads, 1, 'a standing figure reads the ground once');
});

test('a figure that comes back near gets its shadow back as it was', () => {
  const { heroes, made } = crowd(FULL + 1);
  heroes.update(1 / 60, 0, { x: 0, z: 0 });
  assert.ok(made.some((m) => !m.draws[0]!.castShadow), 'one is cheap');
  heroes.update(1 / 60, 0, { x: 2 + FULL, z: 0 });   // the hero walks to the far end: the once-far figure is now the nearest
  assert.equal(made.filter((m) => m.draws[0]!.castShadow === false).length, 1, 'still exactly one cheap');
  assert.ok(made.every((m) => m.draws[0]!.castShadow || !m.draws[1]!.castShadow), 'a restored figure casts on every draw');
});
