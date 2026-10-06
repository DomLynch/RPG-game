import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { initialDuel, withSpecials, type CombatEvent, type Fighter } from '../src/duel.ts';
import { OPPONENTS } from '../src/moves.ts';
import { createNightfallFx } from '../src/nightfall-fx.ts';
import { createBossSpecial } from '../src/special-fx-boss.ts';
import { createSpecialFx } from '../src/special-fx.ts';
import { casterPair, casterEvent, createSpecialPresentation, disposeSpecialGroup } from '../src/special-presentation.ts';
import type { SpecialFx } from '../src/special-modes.ts';

const fighters = (): [Fighter, Fighter] => {
  const pair = withSpecials(initialDuel(OPPONENTS.nightborn, 'longsword', 'lunge'), 41, 'lunge').fighters;
  for (const f of pair) { f.specialName = 'hadesshadow'; f.special = 120; }
  return pair;
};
const start = (actor: 0 | 1, tick = 100): CombatEvent => ({ type: 'SpecialStarted', actor, tick, name: 'hadesshadow', move: 'skill_lunge' });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const bones = [new THREE.Vector3(-4, 2, 0), new THREE.Vector3(4, 2, 0)] as const;

test('actor adapters preserve source inputs and reorder caster, target and extras consistently', () => {
  const pair = fighters(), event = { ...start(0), target: 1 as const }, snapshot = structuredClone({ pair, event });
  assert.deepEqual(casterPair(pair, 0), [pair[1], pair[0]]);
  assert.deepEqual(casterEvent(event, 0), { ...event, actor: 1, target: 0 });
  assert.equal(casterPair(pair, 1), pair); assert.equal(casterEvent(event, 1), event);
  assert.deepEqual({ pair, event }, snapshot);
});

test('both actors at the same cast tick draw the real Hades effect at their own target', async () => {
  const scene = new THREE.Scene(), pair = fighters();
  const presentation = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera(), async (_id, group) => createSpecialFx(group, 'nightborn'));
  presentation.prepare(1, [start(0), start(1)], pair, 100, false); await flush();
  presentation.render(0, pair, 100, bones, bones, undefined, false);
  assert.equal(scene.children.length, 2);
  for (const side of [0, 1] as const) {
    const group = scene.getObjectByName(`special actor ${side}`)!;
    assert.equal(group.getObjectByName('special fx')!.visible, true);
    const cloud = group.getObjectByName('cloud 0')!;
    assert.ok(Math.abs(cloud.position.x - bones[1 - side].x) < 1, 'cloud surrounds this caster’s target');
  }
  presentation.clear(); assert.equal(scene.children.length, 0); assert.equal(presentation.exposure, 1);
});

test('accepted casts deduplicate by actor and cast tick; one fizzle leaves the other actor alive', async () => {
  const scene = new THREE.Scene(), pair = fighters(), batches: CombatEvent[][][] = [], clears: number[] = [];
  const presentation = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera(), async () => {
    const index = batches.length; batches.push([]); clears[index] = 0;
    return { render(_dt, events) { batches[index].push([...events]); }, clear() { clears[index]++; }, exposure: index === 0 ? 0.4 : 0.7 };
  });
  presentation.prepare(1, [start(0), start(1)], pair, 100, false); await flush();
  presentation.render(0, pair, 100, bones, bones, undefined, false);
  presentation.prepare(1, [start(0), start(1)], pair, 100, false);
  presentation.render(0, pair, 100, bones, bones, undefined, false);
  assert.deepEqual(batches.map(rows => rows.flat().filter(e => e.type === 'SpecialStarted').length), [1, 1]);
  presentation.prepare(1, [{ type: 'SpecialFizzled', actor: 0, tick: 101 }], pair, 101, false);
  presentation.render(0, pair, 101, bones, bones, undefined, false);
  assert.deepEqual(batches.map(rows => rows.flat().filter(e => e.type === 'SpecialFizzled').length), [1, 0]);
  assert.equal(presentation.exposure, 0.4);
  presentation.clear(); assert.deepEqual(clears, [1, 1]); assert.equal(presentation.exposure, 1);
});

for (const reason of ['fizzle', 'epoch', 'rewind', 'clear'] as const) test(`a pending load cannot revive after ${reason}`, async () => {
  const scene = new THREE.Scene(), pair = fighters(), resolve: Array<(fx: SpecialFx) => void> = []; let cleared = 0, rendered = 0;
  pair[0].specialShare = undefined;
  const presentation = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera(), () => new Promise(r => resolve.push(r)));
  presentation.prepare(1, [start(1)], pair, 100, false);
  if (reason === 'fizzle') presentation.prepare(1, [{ type: 'SpecialFizzled', actor: 1, tick: 101 }], pair, 101, false);
  if (reason === 'epoch') presentation.prepare(2, [], pair, 100, false);
  if (reason === 'rewind') presentation.prepare(1, [], pair, 20, false);
  if (reason === 'clear') presentation.clear();
  resolve[0]({ render() { rendered++; }, clear() { cleared++; }, exposure: 0.1 }); await flush();
  presentation.render(0, pair, 101, bones, bones, undefined, false);
  assert.equal(rendered, 0); assert.equal(cleared, 1); assert.equal(presentation.exposure, 1);
  presentation.clear();
});

for (const actor of [0, 1] as const) test(`real Knight anchor motion and target gait follow actor ${actor} and clear`, async () => {
  const scene = new THREE.Scene(), pair = fighters();
  pair[1 - actor].specialShare = undefined; pair[actor].specialName = 'wrath'; pair[actor].skill = 'ironrush';
  const presentation = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera(), async (_id, group) => createBossSpecial(group, 'knight', 'haze', 1));
  const anchors = [new THREE.Object3D(), new THREE.Object3D()];
  const warriors = { player: { anchor: anchors[0], boneWorld: () => bones[0].clone() }, opponent: { anchor: anchors[1], boneWorld: () => bones[1].clone() } };
  presentation.prepare(1, [{ ...start(actor), name: 'wrath', move: 'skill_ironrush' }], pair, 100, false); await flush();
  presentation.render(0, pair, 200, bones, bones, warriors, false);
  assert.notEqual(anchors[actor].position.x, 0); assert.equal(anchors[1 - actor].position.x, 0);
  presentation.clear(); assert.equal(anchors[actor].position.x, 0);
  pair[actor].specialName = 'foretoldstep'; pair[actor].special = 20;
  presentation.prepare(2, [], pair, 100, false);
  assert.deepEqual(presentation.gait((1 - actor) as 0 | 1, pair, -0.3, 'attack'), { travel: 1.6, pose: 'ready' });
  assert.deepEqual(presentation.gait(actor, pair, -0.3, 'attack'), { travel: -0.3, pose: 'attack' });
  presentation.clear();
});

test('real Nyx dims the outer scene background and restores it on epoch change', async () => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#777777'); const original = scene.background.clone(), camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 3, 8);
  const pair = fighters(); pair[0].specialShare = undefined; pair[1].specialName = 'nyxnightfall';
  const presentation = createSpecialPresentation(scene, 1, camera, async (_id, group) => createNightfallFx(group, camera, 'nightborn'));
  presentation.prepare(1, [{ ...start(1), name: 'nyxnightfall' }], pair, 100, false); await flush();
  presentation.render(0, pair, 210, bones, bones, undefined, false);
  assert.ok(presentation.exposure < 1); assert.ok(scene.background.r < original.r);
  presentation.prepare(2, [], pair, 0, false);
  assert.equal(presentation.exposure, 1); assert.ok(scene.background.equals(original)); presentation.clear();
});

test('approved unnamed class routing uses supplied fight metadata and never assigns a player class', async () => {
  const scene = new THREE.Scene(), pair = fighters(), loaded: string[] = [];
  for (const f of pair) f.specialName = undefined;
  const presentation = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera(), async (id) => { loaded.push(id); return { render() {}, clear() {} }; });
  presentation.prepare(1, [{ ...start(1), name: undefined }], pair, 100, false, { opponent: 'nightborn', level: 16 }); await flush();
  assert.deepEqual(loaded, ['cuts']); assert.equal(presentation.mode(0), undefined);
  presentation.prepare(2, [], pair, 0, false, { opponent: 'nightborn', level: 15 }); await flush();
  assert.deepEqual(loaded, ['cuts', 'lunge'], 'approved A resolves when a preview fighter has specialShare');
  presentation.prepare(3, [], pair, 0, false, { opponent: 'goblin', level: 16 }); await flush();
  assert.deepEqual(loaded, ['cuts', 'lunge', 'ratrun']); assert.equal(presentation.mode(0), undefined, 'Rat Run never assigns a player class');
  presentation.prepare(4, [], pair, 0, false, { opponent: 'pitborn', level: 15 }); await flush();
  assert.deepEqual(loaded, ['cuts', 'lunge', 'ratrun', 'cleaverset']);
  presentation.prepare(5, [], pair, 0, false, { opponent: 'pitborn', level: 36 });
  assert.equal(scene.children.length, 0, 'unnamed class identity never falls through to a boss'); presentation.clear();
});


test('real class Points and LineSegments release each owned resource once', async () => {
  const { createClassSpecial } = await import('../src/special-fx-class.ts');
  const group = new THREE.Scene(); createClassSpecial(group, 'knight', 'drag', 1);
  const grit = group.getObjectByName('class grit') as THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  assert.ok(grit?.isPoints); assert.ok(grit.material.map);
  const counts = [0, 0, 0, 0, 0];
  for (const [i, resource] of [grit.geometry, grit.material, grit.material.map].entries()) resource!.addEventListener('dispose', () => counts[i]++);
  // Shared resources must be released once even when several draw objects reference them.
  group.add(new THREE.Points(grit.geometry, grit.material));
  const line = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial()); group.add(line);
  line.geometry.addEventListener('dispose', () => counts[3]++); line.material.addEventListener('dispose', () => counts[4]++);
  disposeSpecialGroup(group); assert.deepEqual(counts, [1, 1, 1, 1, 1]); assert.equal(group.children.length, 0);
});

for (const actor of [0, 1] as const) test(`real Foretold ghost preserves borrowed fighter assets and draws again after reset, actor ${actor}`, async () => {
  const scene = new THREE.Scene(), pair = fighters(); pair[1 - actor].specialShare = undefined; pair[actor].specialName = 'foretoldstep'; pair[actor].skill = 'witchfire';
  const geometry = new THREE.BoxGeometry(), texture = new THREE.Texture(), material = new THREE.MeshStandardMaterial({ map: texture });
  const counts = [0, 0, 0]; geometry.addEventListener('dispose', () => counts[0]++); texture.addEventListener('dispose', () => counts[1]++); material.addEventListener('dispose', () => counts[2]++);
  const anchors = [new THREE.Group(), new THREE.Group()]; anchors[1 - actor].add(new THREE.Mesh(geometry, material));
  const warriors = { player: { anchor: anchors[0], boneWorld: () => bones[0].clone() }, opponent: { anchor: anchors[1], boneWorld: () => bones[1].clone() } };
  const presentation = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera(), async (_id, group) => createBossSpecial(group, 'witch', 'echo', 1));
  for (const epoch of [1, 2]) {
    presentation.prepare(epoch, [{ ...start(actor), name: 'foretoldstep', move: 'skill_witchfire' }], pair, 100, false); await flush();
    presentation.render(0, pair, 205, bones, bones, warriors, false);
    const ghost = scene.getObjectByName('ghost'); assert.ok(ghost, 'real frozen fighter clone draws');
    const mesh = ghost.children[0] as THREE.Mesh; assert.equal(mesh.geometry, geometry); assert.equal((mesh.material as THREE.MeshStandardMaterial).map, texture);
    let ownDisposed = 0; (mesh.material as THREE.Material).addEventListener('dispose', () => ownDisposed++);
    presentation.clear(); assert.deepEqual(counts, [0, 0, 0]); assert.equal(ownDisposed, 1); assert.equal(scene.getObjectByName('ghost'), undefined);
  }
});

for (const actor of [0, 1] as const) test(`Set held pose applies only to its named caster, actor ${actor}`, () => {
  const scene = new THREE.Scene(), pair = fighters(), pose = { pose: 'ready', progress: 0, attack: 'thrust', contact: 0 } as const;
  const presentation = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera(), async () => ({ render() {}, clear() {} }));
  pair[actor].specialName = 'redwind'; pair[1 - actor].specialName = undefined;
  pair[actor].special = 0; pair[1 - actor].special = 20;
  presentation.prepare(1, [], pair, 100, false);
  assert.deepEqual(presentation.held(pose, (1 - actor) as 0 | 1, pair)?.pose, pose, 'idle Set does not claim unnamed other fighter cast');
  pair[actor].special = 20; pair[1 - actor].special = 0;
  assert.equal((presentation.held(pose, actor, pair)?.pose as { attack?: string })?.attack, 'thrust');
  assert.deepEqual(presentation.held(pose, (1 - actor) as 0 | 1, pair)?.pose, pose); presentation.clear();
});

for (const actors of [[0], [1], [0, 1], [1, 0]] as const) test(`real default Tithe loader transforms outer arena for actors ${actors}`, async () => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#b8a58a'); scene.fog = new THREE.FogExp2('#b8a58a', .02); scene.environmentIntensity = 1;
  const sun = new THREE.DirectionalLight('#fff0d8'), hemi = new THREE.HemisphereLight('#c8d4ff', '#8a6a4a'); scene.add(sun, hemi);
  const sky = new THREE.MeshBasicMaterial({ name: 'sky', color: '#dfe6f0' }), gate = new THREE.MeshBasicMaterial({ name: 'gate-light', opacity: .55 });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(), sky), new THREE.Mesh(new THREE.PlaneGeometry(), gate));
  const colours = [sun.color, hemi.color, hemi.groundColor, sky.color, scene.fog.color, scene.background], base = colours.map(c => c.clone());
  const pair = fighters(); for (const f of pair) { f.specialName = 'tithe'; f.skill = 'shove'; }
  const presentation = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera());
  presentation.prepare(1, actors.map(actor => ({ ...start(actor), name: 'tithe', move: 'skill_shove' })), pair, 100, false);
  // Await the real registry's lazy import, rather than replacing production plumbing.
  await import('../src/special-tithe.ts'); await new Promise(resolve => setImmediate(resolve));
  presentation.render(0, pair, 100, bones, bones, undefined, false);
  presentation.prepare(1, [], pair, 205, false); presentation.render(0, pair, 205, bones, bones, undefined, false);
  for (const [i, c] of colours.entries()) assert.ok(c.g < base[i].g, `outer arena colour ${i} reddens`);
  assert.ok(gate.opacity < .55); assert.ok(scene.environmentIntensity < 1);
  if (actors.length === 2) {
    presentation.prepare(1, [{ type: 'SpecialFizzled', actor: actors[0], tick: 206 }], pair, 206, false);
    presentation.render(0, pair, 206, bones, bones, undefined, false);
    assert.ok(sun.color.g < base[0].g, 'the other caster retains the arena transform');
  }
  presentation.clear(); colours.forEach((c, i) => assert.deepEqual(c, base[i])); assert.equal(gate.opacity, .55); assert.equal(scene.environmentIntensity, 1);
});


test('manager Tithe matches authored solo arena transform and composes with real Nyx', async () => {
  const { createBloodTithe } = await import('../src/special-tithe.ts');
  const arena = () => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#b8a58a'); scene.fog = new THREE.FogExp2('#b8a58a', .02); scene.environmentIntensity = .8;
    scene.add(new THREE.DirectionalLight('#fff0d8'), new THREE.HemisphereLight('#c8d4ff', '#8a6a4a'));
    const sky = new THREE.MeshBasicMaterial({ name: 'sky', color: '#dfe6f0' }), gate = new THREE.MeshBasicMaterial({ name: 'gate-light', opacity: .55 });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(), sky), new THREE.Mesh(new THREE.PlaneGeometry(), gate)); return scene;
  };
  const capture = (scene: THREE.Scene) => ({ background: (scene.background as THREE.Color).toArray(), fog: scene.fog!.color.toArray(), environment: scene.environmentIntensity,
    sun: (scene.children[0] as THREE.Light).color.toArray(), hemi: (scene.children[1] as THREE.HemisphereLight).color.toArray(), ground: (scene.children[1] as THREE.HemisphereLight).groundColor.toArray(),
    sky: ((scene.children[2] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.toArray(), gate: ((scene.children[3] as THREE.Mesh).material as THREE.Material).opacity });
  const solo = arena(), managed = arena(), pair = fighters(), camera = new THREE.PerspectiveCamera(); camera.position.set(0, 3, 8);
  pair[0].specialShare = undefined; pair[1].specialName = 'tithe'; pair[1].skill = 'shove';
  const event: CombatEvent = { ...start(1), name: 'tithe', move: 'skill_shove' }, fx = createBloodTithe(solo, 'veteran');
  const presentation = createSpecialPresentation(managed, 1, camera); presentation.prepare(1, [event], pair, 100, false); await new Promise(resolve => setImmediate(resolve));
  for (const tick of [100, 150, 190, 205, 218]) {
    fx.render(0, tick === 100 ? [event] : [], pair, tick, bones, false);
    presentation.render(0, pair, tick, bones, bones, undefined, false); assert.deepEqual(capture(managed), capture(solo), `solo lighting parity at ${tick}`);
  }
  fx.clear(); presentation.clear(); const base = capture(managed);
  pair[0].specialShare = .15; pair[0].specialName = 'nyxnightfall'; pair[0].skill = 'lunge';
  presentation.prepare(2, [{ ...start(0), name: 'nyxnightfall' }, event], pair, 100, false);
  await import('../src/nightfall-fx.ts'); await new Promise(resolve => setImmediate(resolve));
  presentation.render(0, pair, 100, bones, bones, undefined, false);
  presentation.render(0, pair, 205, bones, bones, undefined, false);
  assert.ok(presentation.exposure < 1); assert.ok(capture(managed).sun[1] < base.sun[1]);
  assert.ok(capture(managed).background[1] < base.background[1] * presentation.exposure, 'Nyx dim multiplies the Tithe arena colour');
  presentation.render(0, pair, 205, bones, bones, undefined, false);
  const frame = capture(managed); presentation.render(0, pair, 205, bones, bones, undefined, false); assert.deepEqual(capture(managed), frame, 'frozen draws do not compound transformations');
  presentation.clear(); assert.deepEqual(capture(managed), base);
});

test('a repeat cast of the same special creates nothing new: the effect is built once per fight, only its cast state is reset', async () => {
  const scene = new THREE.Scene(), pair = fighters(), built: string[] = [], cleared: number[] = [];
  const fight = { opponent: 'nightborn' as const, level: 46 };
  const land = (actor: 0 | 1, tick: number): CombatEvent => ({ type: 'SpecialLanded', actor, tick, name: 'hadesshadow' } as CombatEvent);
  const presentation = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera(), async (id, group) => {
    built.push(id); const mark = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); group.add(mark);
    return { render() {}, clear() { cleared.push(built.length); } };
  });
  presentation.prepare(1, [], pair, 1, false, fight); await flush();
  const atFightStart = built.length, children = scene.children.length, groups = [...scene.children];
  presentation.prepare(1, [start(1, 100)], pair, 100, false, fight); await flush();
  presentation.prepare(1, [land(1, 220)], pair, 220, false, fight); await flush();
  assert.equal(built.length, atFightStart, 'the first cast builds nothing: it was built at the fight start');
  for (const second of [900, 1700]) {
    presentation.prepare(1, [start(1, second)], pair, second, false, fight); await flush();
    presentation.prepare(1, [land(1, second + 120)], pair, second + 120, false, fight); await flush();
  }
  assert.equal(built.length, atFightStart, 'a second and a third cast build nothing new');
  assert.equal(scene.children.length, children, 'and the arena gained no group');
  assert.deepEqual(scene.children, groups, 'the same groups stay in the scene (none disposed and replaced)');
  assert.ok(cleared.length >= 2, 'each repeat resets the effect\'s cast state');
  presentation.clear();
});

test('a load that failed is tried again on the next cast', async () => {
  const scene = new THREE.Scene(), pair = fighters(), built: string[] = [];
  const fight = { opponent: 'nightborn' as const, level: 46 };
  let fail = true;
  const presentation = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera(), async (id) => { built.push(id); if (fail) { fail = false; throw Error('load failed'); } return { render() {}, clear() {} }; });
  presentation.prepare(1, [], pair, 1, false, fight); await flush(); await flush();
  const first = built.length;
  presentation.prepare(1, [start(0, 100)], pair, 100, false, fight); await flush();   // side 0's first load was the one that failed
  assert.ok(built.length > first, 'the failed load is tried again on the next cast');
  presentation.clear();
});
