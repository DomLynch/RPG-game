// The Pit's room (src/pit/room.ts): which pieces it shows, what it costs to draw, and that dispose frees everything it built and nothing
// it borrowed (docs/pit-design.md §5-6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PORTRAIT_KEYS } from '../src/legends.ts';
import { ROOM, buildRoom, rackIds, trophyIds } from '../src/pit/room.ts';
import { vaultEnds, vaultStrips } from '../src/pit/styles.ts';
import type { Stage } from '../src/pit/stage.ts';
import type { Loot, LootId, Provenance } from '../src/loot.ts';

const taken = (tier: number, day: string): Provenance => ({ opponent: 'goblin', attempt: 1, healthLeft: 0, recordId: null, day, tier });

test('trophies: owned pieces with a provenance, highest rank first then newest; the rack skips worn and trophy pieces', () => {
  const ids = ['goblin.Helmet', 'goblin.Body', 'goblin.Boots', 'goblin.Gloves', 'goblin.Arms'] as LootId[];
  const loot: Loot = {
    owned: ids, equipped: { head: 'goblin.Helmet' },
    taken: { 'goblin.Body': taken(2, '2026-09-20'), 'goblin.Boots': taken(5, '2026-09-10'), 'goblin.Gloves': taken(2, '2026-09-28'), 'goblin.Greaves': taken(9, '2026-09-29') },
  };
  assert.deepEqual(trophyIds(loot), ['goblin.Boots', 'goblin.Gloves', 'goblin.Body'], 'a taken piece no longer owned is never shown');
  assert.deepEqual(rackIds(loot, trophyIds(loot)), ['goblin.Arms']);
  assert.deepEqual(trophyIds({ owned: [], equipped: {} }), []);
});

function stage(): Stage & { graded: string[] } {
  const graded: string[] = [];
  return {
    graded, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), renderer: undefined as unknown as THREE.WebGLRenderer,
    setArenaVisible() {}, hero: { place() {} }, draw() {}, grade(_material, kind) { graded.push(kind); },
    pieces: async () => [], legendKeys: () => PORTRAIT_KEYS, loot: () => ({ owned: [], equipped: {} }),
  };
}

test('the room: one group in the scene, a handful of draws, the dressing\'s four lights, graded like the arena', async () => {
  const s = stage(), room = buildRoom(s);
  await room.ready;
  assert.deepEqual(s.scene.children, [room.group]);
  let draws = 0, lights = 0;
  room.group.traverse((o) => { if (o instanceof THREE.Mesh || o instanceof THREE.Points) draws++; if (o instanceof THREE.Light) lights++; });
  assert.ok(draws <= 20, `room draws ${draws} (one per material: the props of the mood-board dressing, plus the skull wall's niches and skulls, two instanced draws; the Pit ≤ 60 with pieces, docs/pit-design.md §6)`);
  assert.equal(lights, 4, 'the torch glow, the gate light, the key (shadows) and the fill (styles.ts, direction a)');
  assert.deepEqual(s.graded.sort(), ['sand', 'stone']);
  room.update(1.25);
  room.dispose();
});

test('dispose frees every geometry, material and texture the room built, and leaves the scene as it found it', async () => {
  const s = stage(), room = buildRoom(s);
  await room.ready;
  const built = new Set<{ dispose(): void }>();
  room.group.traverse((o) => {
    if (!(o instanceof THREE.Mesh || o instanceof THREE.Points)) return;
    built.add(o.geometry);
    const material = o.material as THREE.Material & { map?: THREE.Texture | null };
    built.add(material);
    if (material.map) built.add(material.map);
  });
  let freed = 0;
  for (const thing of built) { const free = thing.dispose.bind(thing); thing.dispose = () => { freed++; free(); }; }
  room.dispose();
  assert.equal(freed, built.size, `${freed} of ${built.size} freed`);
  assert.equal(s.scene.children.length, 0);
});

test('the vault: every strip runs wall to wall on the barrel, its ends on the arc (2026-09-30: a mirrored tilt left a sawtooth with the sky through the gaps)', () => {
  const W = 8, D = 6, top = 3.4, rise = 0.9, n = 10;
  for (const g of vaultStrips(W, D, top, rise, n, 2)) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), a = Math.acos(-x / (W / 2));   // where on the barrel this x sits
      assert.ok(Math.abs(y - (top + Math.sin(a) * rise)) < 0.02, `vertex ${i} at x ${x.toFixed(2)}: y ${y.toFixed(3)} off the arc ${(top + Math.sin(a) * rise).toFixed(3)}`);
      assert.ok(Math.abs(p.getZ(i)) <= D / 2 + 1e-6);
    }
  }
});

test('the lunettes: one at each end wall, filling from the wall top to the arc, and no higher', () => {
  const W = 8, D = 6, top = 3.4, rise = 0.9;
  const ends = vaultEnds(W, D, top, rise, 10, 2);
  assert.equal(ends.length, 2);
  for (const [g, z] of [[ends[0]!, -D / 2], [ends[1]!, D / 2]] as const) {
    g.computeBoundingBox(); const b = g.boundingBox!;
    assert.ok(Math.abs(b.min.x + W / 2) < 1e-6 && Math.abs(b.max.x - W / 2) < 1e-6, 'wall to wall');
    assert.ok(Math.abs(b.min.y - top) < 1e-6 && Math.abs(b.max.y - (top + rise)) < 1e-6, `from the wall top to the crown: ${b.min.y}..${b.max.y}`);
    assert.ok(Math.abs(b.min.z - z) < 1e-6 && Math.abs(b.max.z - z) < 1e-6, `flat on the end wall at z ${z}`);
  }
});

test('GPT\'s props (World\'s intake 36fd0010): the rack, table, sconces and bull skull are mounted from Stage.prop in the model\'s own frame; absent = nothing stands in', async () => {
  const asked: string[] = [];
  const bare = buildRoom({ ...stage(), prop: async (name) => { asked.push(name); return null; } });
  try {
    await bare.ready;
    assert.deepEqual([...new Set(asked)].sort(), ['bull-skull', 'rack', 'sconce', 'skull', 'table'], 'every prop is asked for');
    assert.equal(asked.filter((n) => n === 'sconce').length, 2, 'one sconce a side');
    for (const name of ['rack', 'table', 'sconce', 'bull-skull']) assert.equal(bare.group.getObjectByName(name), undefined, `${name}: no primitive stands in`);
  } finally { bare.dispose(); }
  // GPT's frames: the rack at its rear-centre mount facing +Z, 4.5 × 2.5 × 0.34 m; the table at its base centre, 0.74 m tall; the sconce at
  // the back of its plate, hanging 0.4 m below it, 0.22 m out.
  const model = (w: number, h: number, d: number, dy: number, dz: number) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, dy, dz), new THREE.MeshStandardMaterial());
  const models: Record<string, THREE.Mesh> = { rack: model(4.5, 2.5, 0.34, 0, 0.17), table: model(0.94, 0.74, 0.7, 0.37, 0), sconce: model(0.2, 0.44, 0.22, -0.18, 0.11), skull: model(0.2, 0.2, 0.2, 0, 0) };
  const room = buildRoom({ ...stage(), prop: async (name) => models[name] ?? null });
  try {
    await room.ready;
    room.group.updateMatrixWorld(true);
    const bounds = (name: string) => { const list: THREE.Box3[] = []; room.group.traverse((o) => { if (o.name === name) list.push(new THREE.Box3().setFromObject(o)); }); return list; };
    const [rack] = bounds('rack');
    assert.ok(rack, 'the rack is placed');
    assert.ok(Math.abs(rack.min.x + ROOM.width / 2) < 1e-6 && Math.abs(rack.max.x + ROOM.width / 2 - 0.34) < 1e-6, `the rack stands against the left wall, 0.34 m deep: ${rack.min.x}..${rack.max.x}`);
    assert.ok(Math.abs(rack.min.z + 2.25) < 1e-6 && Math.abs(rack.max.z - 2.25) < 1e-6 && Math.abs(rack.min.y) < 1e-6 && Math.abs(rack.max.y - 2.5) < 1e-6, `real scale, the wall's 4.5 m run, floor to 2.5 m: ${rack.min.toArray()}..${rack.max.toArray()}`);
    const [table] = bounds('table');
    assert.ok(Math.abs(table!.min.y) < 1e-6 && Math.abs(table!.max.y - 0.775) < 1e-6, `the table stands on the floor, its top at 0.775 m under the jug: ${table!.min.y}..${table!.max.y}`);
    assert.ok(table!.max.z - table!.min.z > table!.max.x - table!.min.x, 'its long side runs along the right wall');
    const sconces = bounds('sconce');
    assert.equal(sconces.length, 2);
    for (const s of sconces) {
      const onWall = Math.abs(s.min.x + ROOM.width / 2) < 1e-6 || Math.abs(s.max.x - ROOM.width / 2) < 1e-6;
      assert.ok(onWall && Math.abs(s.max.y - 1.9) < 1e-6 && Math.abs((s.min.z + s.max.z) / 2 + 2.4) < 1e-6, `plate on a side wall, its top at the flame (1.9 m), far end: ${s.min.toArray()}..${s.max.toArray()}`);
    }
  } finally { room.dispose(); }
});
