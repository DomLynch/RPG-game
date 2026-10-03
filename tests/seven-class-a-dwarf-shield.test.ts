import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as factories from '../src/special-fx-dwarf-shield.ts';
import { idleIntent, stepDuel, type Duel, type CombatEvent, type Fighter } from '../src/duel.ts';
import { Match } from '../src/match.ts';
import { OPPONENTS } from '../src/moves.ts';
import { loadProfile } from '../src/profile.ts';
import { loadTrial } from '../src/trial.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { LAND_AT, SPECIAL_RECOVER, CAST_MARGIN } from '../src/special-timing.ts';
import { disposeSpecialGroup } from '../src/special-presentation.ts';

const cases = [
  { factory: 'createGroundSet', opponent: 'dwarf', move: 'skill_stomp', root: 'ground set' },
  { factory: 'createCutMark', opponent: 'shieldmaiden', move: 'skill_hewer', root: 'cut mark' },
] as const;
type Fx = { render(dt: number, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, feet: readonly [THREE.Vector3 | null, THREE.Vector3 | null], yielding: boolean): void; clear(): void };
const fighters = [{ special: 0 }, { special: 0 }] as unknown as readonly [Fighter, Fighter];
const feet = [new THREE.Vector3(7, 0.1, -3), new THREE.Vector3(5, 0.1, -3)] as const;
const event = (c: typeof cases[number], type: 'SpecialStarted' | 'SpecialLanded' | 'SpecialFizzled', tick: number, actor = 1) => ({ type, tick, actor, move: c.move }) as CombatEvent;
const parts = (root: THREE.Object3D) => root.children as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[];
const snapshot = (root: THREE.Object3D) => parts(root).map(p => [p.visible, ...p.position.toArray(), ...p.scale.toArray(), p.material.opacity]);
function setup(c: typeof cases[number], exposure = 1) {
  const create = (factories as unknown as Record<string, unknown>)[c.factory];
  assert.equal(typeof create, 'function', `${c.factory} exists`);
  const scene = new THREE.Scene();
  const fx = (create as (s: THREE.Scene, id: typeof c.opponent, e: number) => Fx)(scene, c.opponent, exposure);
  const root = scene.getObjectByName(c.root)!;
  assert.ok(root);
  const render = (tick: number, events: CombatEvent[] = [], yielding = false, anchors: readonly [THREE.Vector3 | null, THREE.Vector3 | null] = feet) => fx.render(1 / 60, events, fighters, tick, anchors, yielding);
  return { scene, fx, root, render };
}

test('Ground Set camera-facing NIGHT patches sit in front of foot shadow; DAY and reverse-facing placements stay local', () => {
  const forward = [new THREE.Vector3(5, 0.1, -1), new THREE.Vector3(5, 0.1, -3)] as const;
  const reverse = [forward[1], forward[0]] as const;
  for (const [exposure, anchors, inFront] of [[2, forward, true], [1, forward, false], [2, reverse, false]] as const) {
    const { root, render } = setup(cases[0], exposure);
    render(100, [event(cases[0], 'SpecialStarted', 100)], false, anchors);
    render(180, [], false, anchors);
    const z = parts(root).map(p => p.position.z);
    if (inFront) assert.ok(Math.min(...z) > 0.05 && Math.max(...z) < 0.8, 'small static patches clear the camera-facing foot shadow');
    else assert.ok(Math.min(...z) < -0.2 && Math.max(...z) < 0.3, 'accepted DAY/player patches retain their stance placement');
    const positions = parts(root).map(p => p.position.toArray());
    render(100 + LAND_AT, [event(cases[0], 'SpecialLanded', 100 + LAND_AT)], false, anchors);
    render(100 + LAND_AT + 14, [], false, anchors);
    assert.deepEqual(parts(root).map(p => p.position.toArray()), positions, 'placement is stationary through payoff, never a step/stomp');
  }
});

test('Ground Set same active NIGHT cast crosses a side-on facing without a placement jump', () => {
  const { root, render } = setup(cases[0], 2);
  const caster = new THREE.Vector3(5, 0.1, -3);
  const front = [new THREE.Vector3(7, 0.1, -2.999), caster] as const;
  const back = [new THREE.Vector3(7, 0.1, -3.001), caster] as const;
  render(100, [event(cases[0], 'SpecialStarted', 100)], false, front);
  render(180, [], false, front);
  const positions = parts(root).map(p => p.position.clone());
  const resources = parts(root).map(p => [p.geometry, p.material, p.material.map]);
  render(180, [], false, back);
  assert.ok(root.visible);
  parts(root).forEach((p, i) => assert.ok(p.position.distanceTo(positions[i]) < 0.005, 'tiny facing change must not cause a 35cm jump'));
  assert.deepEqual(parts(root).map(p => [p.geometry, p.material, p.material.map]), resources);
});

for (const c of cases) {
  test(`${c.root}: real sim accepted clock for either caster feeds the normalized factory without state writes`, () => {
    for (const actor of [0, 1] as const) {
      const storage = { getItem: () => null, setItem: () => { throw new Error('presentation wrote storage'); } };
      const m = new Match(OPPONENTS[c.opponent], 'test', { storage, profile: loadProfile(storage, () => 'test').profile, trial: loadTrial(storage), scorecard: loadScorecard(storage) }, 731, 'estoc', null, 1);
      // Existing B selection supplies the SAME class skill/common clock; new A routes belong to Combat.
      const id = c.opponent === 'dwarf' ? 'ironsettle' : 'gatherededge';
      m.startSparring({ weapon: 'estoc', skill: null, difficulty: 1 }, null, { player: id, opponent: id });
      const d = m.practice.duel;
      let sim: Duel = { ...d, fighters: d.fighters.map((f, i) => ({ ...f, phase: 'ready', skillCooldown: 0, body: { ...f.body, x: 0, z: i, heading: i ? Math.PI : 0 } })) as Duel['fighters'] };
      const { fx, root } = setup(c);
      const anchors = actor === 1 ? feet : [feet[1], feet[0]] as const;
      let start: CombatEvent | undefined, land: CombatEvent | undefined;
      for (let t = 0; t < LAND_AT + SPECIAL_RECOVER + 3; t++) {
        const intents = [idleIntent(), idleIntent()] as const;
        sim = stepDuel(sim, actor === 0 ? [{ ...intents[0], action: t === 0 ? 'skill' : null }, intents[1]] : [intents[0], { ...intents[1], action: t === 0 ? 'skill' : null }]);
        start ??= sim.events.find(e => e.type === 'SpecialStarted' && e.actor === actor);
        land ??= sim.events.find(e => e.type === 'SpecialLanded' && e.actor === actor);
        const input = JSON.stringify(sim);
        const fs = actor === 1 ? sim.fighters : [sim.fighters[1], sim.fighters[0]] as const;
        const es = actor === 1 ? sim.events : sim.events.map(e => ({ ...e, actor: (1 - e.actor) as 0 | 1, ...(e.target === undefined ? {} : { target: (1 - e.target) as 0 | 1 }) })) as CombatEvent[];
        fx.render(1 / 60, es, fs, sim.tick, anchors, false);
        assert.equal(JSON.stringify(sim), input);
        if (t === 60) { assert.ok(root.visible); assert.deepEqual(root.position.toArray(), anchors[1].toArray()); }
      }
      assert.ok(start && land); assert.equal(land.tick - start.tick, LAND_AT);
      assert.equal(root.visible, false);
    }
  });

  test(`${c.root}: canonical actor, rotated non-origin anchor, frozen pool and compact DAY/NIGHT bounds`, () => {
    for (const exposure of [1, 2]) {
      const { fx, root, render } = setup(c, exposure);
      render(100, [event(c, 'SpecialStarted', 100, 0)]);
      assert.equal(root.visible, false, 'manager must normalize the caster to actor 1');
      const start = event(c, 'SpecialStarted', 100);
      render(100, [start]); render(180);
      assert.ok(root.visible);
      assert.deepEqual(root.position.toArray(), feet[1].toArray());
      assert.equal(root.rotation.y, Math.PI / 2);
      const before = snapshot(root), resources = parts(root).map(p => [p.geometry, p.material, p.material.map]);
      for (let i = 0; i < 20; i++) render(180, [start]);
      assert.deepEqual(snapshot(root), before, 'a repeated event/frame must not restart or animate');
      assert.deepEqual(parts(root).map(p => [p.geometry, p.material, p.material.map]), resources);
      for (const p of parts(root)) {
        assert.ok([...p.position.toArray(), ...p.scale.toArray(), p.material.opacity].every(Number.isFinite));
        assert.ok(p.position.y >= 0 && p.position.y < 0.08, 'ground plane, no high plume');
        assert.ok(Math.abs(p.position.x) + p.scale.x / 2 < 1.1 && Math.abs(p.position.z) + p.scale.z / 2 < 1.1);
        assert.equal(p.material.depthWrite, false); assert.equal(p.material.depthTest, true);
        const map = p.material.map as THREE.DataTexture, data = map.image.data as Uint8Array, n = map.image.width;
        for (let j = 0; j < n; j++) {
          assert.equal(data[j * 4 + 3], 0); assert.equal(data[((n - 1) * n + j) * 4 + 3], 0);
          assert.equal(data[(j * n) * 4 + 3], 0); assert.equal(data[(j * n + n - 1) * 4 + 3], 0);
        }
      }
      fx.clear(); assert.equal(root.visible, false);
      render(180, [start]); assert.equal(root.visible, false, 'clear cannot replay the frozen start');
      render(300, [event(c, 'SpecialStarted', 300)]); render(310); assert.ok(root.visible, 'a new accepted cast rearms');
      render(311, [], true); assert.equal(root.visible, false);
      render(312); assert.equal(root.visible, false);
      render(313, [event(c, 'SpecialStarted', 313)], false, [null, feet[1]]); assert.equal(root.visible, false);
    }
  });

  test(`${c.root}: one accepted landing payoff; fizzle freezes and dissolves without payoff; timeout clears`, () => {
    const { root, render } = setup(c);
    render(100, [event(c, 'SpecialStarted', 100)]); render(100 + LAND_AT);
    const waiting = snapshot(root);
    render(100 + LAND_AT + 20); assert.deepEqual(snapshot(root), waiting, 'no inferred landing');
    const land = event(c, 'SpecialLanded', 100 + LAND_AT + 20);
    render(land.tick, [land]); const atLand = snapshot(root);
    render(land.tick + 10); assert.notDeepEqual(snapshot(root), atLand);
    if (c.opponent === 'dwarf') {
      assert.deepEqual(parts(root).map(p => p.position.toArray()), atLand.map(p => p.slice(1, 4)), 'weight stays stationary');
    } else {
      assert.ok(parts(root)[0].position.x < Number(atLand[0][1]) - 0.1, 'one low sidecut');
    }
    render(land.tick + SPECIAL_RECOVER); assert.equal(root.visible, false);
    render(500, [event(c, 'SpecialStarted', 500)]); render(540, [event(c, 'SpecialFizzled', 540)]);
    const stopped = parts(root).map(p => p.position.toArray()), opacity = parts(root)[0].material.opacity;
    render(550); assert.deepEqual(parts(root).map(p => p.position.toArray()), stopped);
    assert.ok(parts(root)[0].material.opacity < opacity);
    render(540 + SPECIAL_RECOVER); assert.equal(root.visible, false);
    render(700, [event(c, 'SpecialStarted', 700)]);
    render(700 + LAND_AT + SPECIAL_RECOVER + CAST_MARGIN); assert.equal(root.visible, false);
  });

  test(`${c.root}: peer resources stay private and manager disposal releases each resource once`, () => {
    const a = setup(c), b = setup(c);
    const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
    for (const p of parts(a.root)) { resources.add(p.geometry); resources.add(p.material); resources.add(p.material.map!); }
    for (const p of parts(b.root)) { assert.ok(!resources.has(p.geometry)); assert.ok(!resources.has(p.material)); assert.ok(!resources.has(p.material.map!)); }
    const disposed = new Map<object, number>();
    for (const r of resources) r.addEventListener('dispose', () => disposed.set(r, (disposed.get(r) ?? 0) + 1));
    disposeSpecialGroup(a.scene);
    assert.equal(a.root.parent, null);
    assert.equal(disposed.size, resources.size);
    assert.ok([...disposed.values()].every(n => n === 1));
    b.render(10, [event(c, 'SpecialStarted', 10)]); b.render(80); assert.ok(b.root.visible);
    // Epoch reset: a fresh event object on the rewound clock is a distinct accepted cast.
    b.fx.clear(); b.render(10, [event(c, 'SpecialStarted', 10)]); b.render(20); assert.ok(b.root.visible);
  });

  test(`${c.root}: late load picks up windup once; clear and yield cannot restore stale fighter counters`, () => {
    const { fx, root } = setup(c);
    const active = [{ special: 0 }, { special: LAND_AT - 39, skill: c.opponent === 'dwarf' ? 'stomp' : 'hewer' }] as unknown as readonly [Fighter, Fighter];
    fx.render(1 / 60, [], active, 140, feet, false); assert.ok(root.visible);
    fx.clear(); fx.render(1 / 60, [], active, 140, feet, false); assert.equal(root.visible, false);
    fx.render(1 / 60, [event(c, 'SpecialStarted', 150)], active, 150, feet, true);
    fx.render(1 / 60, [event(c, 'SpecialStarted', 150)], active, 150, feet, false); assert.equal(root.visible, false);
    fx.render(1 / 60, [event(c, 'SpecialStarted', 200)], active, 210, feet, false); assert.ok(root.visible);
    fx.render(1 / 60, [], active, 200 + LAND_AT + SPECIAL_RECOVER + CAST_MARGIN, feet, false);
    fx.render(1 / 60, [], active, 201 + LAND_AT + SPECIAL_RECOVER + CAST_MARGIN, feet, false); assert.equal(root.visible, false);
  });

  test(`${c.root}: finisher yielding clears both active gather and landed recovery immediately`, () => {
    for (const landed of [false, true]) {
      const { root, render } = setup(c), start = event(c, 'SpecialStarted', 100);
      render(100, [start]); render(180);
      if (landed) { render(100 + LAND_AT, [event(c, 'SpecialLanded', 100 + LAND_AT)]); render(100 + LAND_AT + 10); }
      assert.ok(root.visible);
      const tick = landed ? 100 + LAND_AT + 11 : 181;
      render(tick, [], true);
      assert.equal(root.visible, false);
      assert.ok(parts(root).every(p => !p.visible && p.material.opacity === 0));
      render(tick + 1, [start]); assert.equal(root.visible, false, 'return from finisher cannot replay the old cast');
      render(400, [event(c, 'SpecialStarted', 400)]); render(410); assert.ok(root.visible);
    }
  });
}
