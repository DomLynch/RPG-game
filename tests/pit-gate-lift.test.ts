// The Pit's gate opening (Dom's item 4, Lead 2026-09-30, PR A): GPT's gate.glb stands in the far wall as two nodes (the arch static, the bars
// one movable node); a tap on the lit gate raises the bars over five seconds on Audio's winch timeline (#1176), then the gate's own go().
// A second tap skips the wait; leaving stops it. Nothing primitive stands in for a gate that did not load.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GATE_OPEN_MS, GATE_OPEN_S, GATE_RISE, GATE_SEAT_S, gateLift } from '../src/pit/gate.ts';
import { ROOM, buildRoom } from '../src/pit/room.ts';
import { enter, disposeRoom } from '../src/pit/pit.ts';
import { loadPitGate } from '../src/pit-prop.ts';
import type { Stage } from '../src/pit/stage.ts';

test('the lift follows the winch: still until the first tick, up to speed by 1.1 s, steady under load, eased to a seat at 4.34 s, held to 5 s', () => {
  assert.equal(GATE_OPEN_MS, 5000);
  assert.equal(gateLift(0), 0);
  assert.equal(gateLift(0.05), 0, 'the first ratchet tick at 50 ms moves nothing yet');
  assert.equal(gateLift(GATE_SEAT_S), 1, 'seated at the knock');
  assert.equal(gateLift(GATE_OPEN_S), 1);
  assert.equal(gateLift(9), 1, 'and it stays up');
  assert.equal(gateLift(-1), 0);
  assert.equal(gateLift(NaN), 0);
  const samples = Array.from({ length: 501 }, (_, i) => gateLift(i / 100));
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i]! >= samples[i - 1]! - 1e-12, `monotonic at ${(i / 100).toFixed(2)} s`);
  // Speed (per 10 ms): zero, then a ramp, then one steady value from 1.1 s to 3.6 s, then a ramp down to zero at the seat.
  const speed = (t: number) => (gateLift(t + 0.005) - gateLift(t - 0.005)) / 0.01;
  const steady = speed(2);
  for (const t of [1.2, 1.6, 2.4, 3.0, 3.5]) assert.ok(Math.abs(speed(t) - steady) < 1e-6, `steady at ${t} s`);
  assert.ok(speed(0.6) > 0 && speed(0.6) < steady, 'still speeding up at 0.6 s');
  assert.ok(speed(4.0) > 0 && speed(4.0) < steady, 'easing at 4.0 s');
  assert.ok(Math.abs(speed(4.335)) < 0.05 * steady, 'nearly stopped as it seats');
  assert.ok(GATE_RISE > 2.2 && GATE_RISE < 2.6, 'the bars\' foot ends over a head and the rest goes up behind the lintel');
});

// GPT's gate in the test's terms: two boxes, the bars' node at the rest position the file gives it.
const nodes = () => {
  const material = new THREE.MeshStandardMaterial();
  const arch = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.69, 0.52).translate(0, 1.345, 0), material); arch.name = 'gate-arch';
  const bars = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.29, 0.14).translate(0, 1.145, 0), material); bars.name = 'gate-bars'; bars.position.set(0, 0.035, -0.028);
  return { arch, bars };
};
function stage(gateModel?: Stage['gateModel']): Stage {
  return {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(62, 0.46, 0.1, 50), renderer: undefined as unknown as THREE.WebGLRenderer,
    setArenaVisible() {}, hero: { place() {} }, draw() {}, grade() {}, pieces: async () => [], loot: () => ({ owned: [], equipped: {} }), gateModel,
  };
}

test('the room mounts the gate in the far wall: arch and bars, the bars at rest where the file puts them, no primitive bars', async () => {
  const s = stage(async () => nodes()), room = buildRoom(s);
  await room.ready;
  const holder = room.group.getObjectByName('gate')!;
  assert.ok(holder, 'the gate is in the room');
  assert.equal(holder.position.z, -ROOM.depth / 2, 'on the far wall\'s line');
  const bars = holder.getObjectByName('gate-bars')!, arch = holder.getObjectByName('gate-arch')!;
  assert.ok(bars && arch);
  assert.equal(bars.position.y, 0.035, 'at rest');
  // No iron bars of the room's own: the room's iron draw holds no gate-sized slab at the far wall (the 9 bars were 0.05 m boxes at z = −hd − 0.05).
  let nearWall = 0;
  room.group.traverse((o) => { if (o instanceof THREE.Mesh && o.parent === room.group && (o.material as THREE.MeshStandardMaterial).metalness > 0.5) { const p = o.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) if (Math.abs(p.getZ(i) + ROOM.depth / 2 + 0.05) < 1e-6 && Math.abs(p.getX(i)) < 1.0) nearWall++; } });
  assert.equal(nearWall, 0, 'the primitive bars are gone');
  room.dispose();
});

test('the lift runs on the room\'s own clock from the tap, is reset by leaving, and a gate that did not load has nothing to lift', async () => {
  const s = stage(async () => nodes()), room = buildRoom(s);
  await room.ready;
  const bars = room.group.getObjectByName('gate-bars')!;
  room.update(10);
  assert.equal(room.gate.elapsed(), null);
  assert.equal(room.gate.open(), true);
  room.update(10);
  assert.equal(room.gate.elapsed(), 0, 'counted from the frame it opened in');
  for (const t of [1, 2.5, 4.34, 5, 7]) {
    room.update(10 + t);
    const up = gateLift(Math.min(t, GATE_OPEN_S));
    assert.ok(Math.abs(bars.position.y - (0.035 + GATE_RISE * up)) < 1e-9, `${t} s in: ${bars.position.y.toFixed(3)}`);
  }
  assert.equal(room.gate.open(), true, 'a second open while it is up is still true (the caller decides what a second tap means)');
  assert.equal(room.gate.elapsed(), 7, 'and it did not restart the clock');
  room.gate.reset();
  assert.equal(bars.position.y, 0.035);
  assert.equal(room.gate.elapsed(), null);
  room.gate.set(0.5);
  assert.ok(Math.abs(bars.position.y - (0.035 + GATE_RISE / 2)) < 1e-9, 'a still holds it part-way');
  room.dispose();
  for (const model of [undefined, async () => null, () => Promise.reject(new Error('404'))] as const) {
    const bare = buildRoom(stage(model as Stage['gateModel']));
    await bare.ready;
    assert.equal(bare.group.getObjectByName('gate'), undefined, 'no gate, and nothing stands in for it');
    assert.equal(bare.gate.open(), false, 'nothing to lift');
    bare.dispose();
  }
});

const element = () => ({ hidden: false, textContent: '', childElementCount: 0, setAttribute() {}, append() {}, replaceChildren() {}, addEventListener() {}, remove() {} });
const tapAt = (c: THREE.Camera, p: THREE.Vector3Tuple) => { const v = new THREE.Vector3(...p).project(c); return { x: v.x, y: v.y }; };

test('a tap on the gate raises it and the way out comes at 5 s; a second tap skips the wait; the winch stops with either, and leaving', async () => {
  (globalThis as { document?: unknown }).document = { createElement: element, body: element() };
  try {
    for (const scenario of ['runs out', 'second tap', 'leave']) {
      const log: string[] = [];
      let tap: { x: number; y: number } | null = null;
      const s = Object.assign(stage(async () => nodes()), {
        readMove: () => ({ x: 0, z: 0 }), readTap: () => { const t = tap; tap = null; return t; }, rackRows: () => [], trophyLine: () => '',
        gate: () => ({ label: 'Next', go() { log.push('go'); } }),
        gateSound: () => { log.push('winch'); return { stop() { log.push('stop'); } }; },
      });
      const pit = enter(s, 'win');
      await pit.ready;
      const frame = (dt = 1 / 60) => pit.frame(dt);
      frame();
      s.camera.updateMatrixWorld();
      const bars = () => s.scene.getObjectByName('gate-bars')!.position.y;
      assert.equal(bars(), 0.035);
      tap = tapAt(s.camera, [0, 1.3, -3]); frame();
      assert.deepEqual(log, ['winch'], `${scenario}: the tap starts the winch once`);
      for (let i = 0; i < 120; i++) frame(1 / 60);   // 2 s
      assert.ok(bars() > 0.035 + 0.3 * GATE_RISE && bars() < 0.035 + GATE_RISE, `${scenario}: part-way up at 2 s: ${bars().toFixed(2)}`);
      assert.deepEqual(log, ['winch'], `${scenario}: the way out has not come`);
      if (scenario === 'runs out') {
        for (let i = 0; i < 60 * 3.1; i++) frame(1 / 60);   // past 5 s
        assert.deepEqual(log, ['winch', 'go'], 'at 5 s the gate\'s own go(), once, and the winch is left to play out its tail');
        for (let i = 0; i < 60; i++) frame(1 / 60);
        assert.deepEqual(log, ['winch', 'go'], 'and only once');
      } else if (scenario === 'second tap') {
        s.camera.updateMatrixWorld(); tap = tapAt(s.camera, [0, 1.3, -3]); frame();
        assert.deepEqual(log, ['winch', 'stop', 'go'], 'a second tap stops the winch and goes on at once');
        tap = tapAt(s.camera, [0, 1.3, -3]); frame(); frame();
        assert.deepEqual(log, ['winch', 'stop', 'go'], 'a third does nothing more');
      } else {
        pit.leave();
        assert.deepEqual(log, ['winch', 'stop'], 'leaving stops the winch and never goes on');
        assert.equal(bars(), 0.035, 'and the bars are back down for the next visit');
      }
      pit.dispose();
    }
  } finally { delete (globalThis as { document?: unknown }).document; disposeRoom(); }
});

test('a tap on the gate with no bars to lift goes straight on (the model did not load); a tap elsewhere opens nothing', async () => {
  (globalThis as { document?: unknown }).document = { createElement: element, body: element() };
  try {
    const log: string[] = [];
    let tap: { x: number; y: number } | null = null;
    const s = Object.assign(stage(async () => null), {
      readMove: () => ({ x: 0, z: 0 }), readTap: () => { const t = tap; tap = null; return t; }, rackRows: () => [], trophyLine: () => '',
      gate: () => ({ label: 'Next', go() { log.push('go'); } }), gateSound: () => { log.push('winch'); },
    });
    const pit = enter(s, 'win');
    await pit.ready;
    pit.frame(1 / 60); s.camera.updateMatrixWorld();
    tap = tapAt(s.camera, [0, 0.05, 0.5]); pit.frame(1 / 60);
    assert.deepEqual(log, [], 'a tap on the floor opens nothing');
    tap = tapAt(s.camera, [0, 1.3, -3]); pit.frame(1 / 60);
    assert.deepEqual(log, ['go'], 'no bars: on through, no winch');
    pit.dispose();
  } finally { delete (globalThis as { document?: unknown }).document; disposeRoom(); }
});

test('the gate loader keeps both nodes and the bars\' rest position, retries a bare decode, and reports a file without them', async () => {
  const good = () => { const { arch, bars } = nodes(); const m = arch.material as THREE.MeshStandardMaterial; m.map = m.normalMap = m.roughnessMap = new THREE.Texture(); const scene = new THREE.Group(); scene.add(arch, bars); return { scene }; };
  const loaded = await loadPitGate('gate.glb', async () => good(), () => assert.fail('no report'));
  assert.ok(loaded && loaded.arch.name === 'gate-arch' && loaded.bars.name === 'gate-bars');
  assert.deepEqual(loaded.bars.position.toArray(), [0, 0.035, -0.028], 'the node\'s translation is the bars\' rest pose');
  assert.equal(loaded.arch.material, loaded.bars.material, 'one shared material');
  const reports: unknown[] = []; let tries = 0;
  const flaky = await loadPitGate('gate.glb', async () => { tries++; return tries === 1 ? { scene: new THREE.Group().add(nodes().arch, nodes().bars) } : good(); }, (e) => reports.push(e), async () => undefined);
  assert.ok(flaky && tries === 2 && reports.length === 0, 'a decode that dropped its maps is tried again');
  const lonely = await loadPitGate('gate.glb', async () => ({ scene: new THREE.Group().add(nodes().arch) }), (e) => reports.push(e), async () => undefined);
  assert.equal(lonely, null);
  assert.ok(reports.length >= 1, 'a file without both nodes is reported');
});

test('main.ts and scene.ts: the gate\'s seams are wired (the model once per page; the look flag\'s lift), and src/pit loads no file itself', () => {
  const scene = fs.readFileSync(new URL('../src/scene.ts', import.meta.url), 'utf8'), main = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(scene, /gateModel: \(\) => \(pitGate \?\?= loadPitGate\('pit\/props\/gate\.glb'/);
  assert.match(main, /lift=\(\[\\d\.\]\+\)[\s\S]*?openPit\(view\.pitStage\(pitLoot\), 'win', pitLook, \(\) => true, 0, lift\)/);
  for (const file of fs.readdirSync(new URL('../src/pit/', import.meta.url))) assert.doesNotMatch(fs.readFileSync(new URL(`../src/pit/${file}`, import.meta.url), 'utf8'), /GLTFLoader|\.glb'/, `${file} loads no model itself`);
});
