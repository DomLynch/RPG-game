import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Match } from '../src/match.ts';
import { OPPONENTS, RULES } from '../src/moves.ts';
import { idleIntent, stepDuel, type Duel, type CombatEvent } from '../src/duel.ts';
import { loadProfile } from '../src/profile.ts';
import { loadTrial } from '../src/trial.ts';
import { loadScorecard } from '../src/scorecard.ts';
import { classSpecialFor } from '../src/class-special-identity.ts';
import { SPECIAL_MODES } from '../src/special-modes.ts';
import { type SpecialTest } from '../src/special-look.ts';
import { specialCueFor } from '../src/sparring-special-runtime.ts';
import { sparringSpecialOptions } from '../src/sparring-specials.ts';
import { disposeSpecialGroup } from '../src/special-presentation.ts';

const cases = [
  { id: 'earthfold' as SpecialTest, opponent: 'pitborn' as const, root: 'earth fold' },
  { id: 'ironsettle' as SpecialTest, opponent: 'dwarf' as const, root: 'iron settle' },
  { id: 'gatherededge' as SpecialTest, opponent: 'shieldmaiden' as const, root: 'gathered edge' },
];
const skill = () => ({ ...idleIntent(), action: 'skill' as const });
function match(opponent: typeof cases[number]['opponent'], level = 1) {
  const writes: string[] = [], storage = { getItem: () => null, setItem: (key: string) => { writes.push(key); } };
  const m = new Match(OPPONENTS[opponent], 'test', { storage, profile: loadProfile(storage, () => 'test').profile, trial: loadTrial(storage), scorecard: loadScorecard(storage) }, 731, 'estoc', null, level);
  return { m, writes };
}
function accepted(c: typeof cases[number]) {
  const { m } = match(c.opponent); m.startSparring({ weapon: 'estoc', skill: null, difficulty: 'dummy' }, null, { player: c.id, opponent: null });
  // Factory fixture: controlled ready state only. Events are emitted by the real sim.
  const d = m.practice.duel;
  const ready: Duel = { ...d, fighters: d.fighters.map((f, i) => ({ ...f, phase: 'ready', skillCooldown: 0, body: { ...f.body, x: 0, z: i, heading: i ? Math.PI : 0 } })) as Duel['fighters'] };
  return stepDuel(ready, [skill(), idleIntent()]);
}
const normalized = (d: Duel) => ({ fighters: [d.fighters[1], d.fighters[0]] as const, events: d.events.map(e => ({ ...e, actor: (1 - e.actor) as 0 | 1, ...(e.target === undefined ? {} : { target: (1 - e.target) as 0 | 1 }) })) as CombatEvent[] });

for (const c of cases) {
  test(`${c.id} is class B only, independently selectable without a pose or cue substitution`, () => {
    for (const level of [36, 46]) assert.equal(classSpecialFor(c.opponent, level), null);
    for (const level of [16, 35]) assert.equal(classSpecialFor(c.opponent, level), c.id);
    assert.deepEqual(sparringSpecialOptions(c.opponent)[1].ids, [c.id]);
    assert.equal(specialCueFor(c.id), undefined); assert.equal(SPECIAL_MODES[c.id]?.held, undefined); assert.equal(SPECIAL_MODES[c.id]?.travel, undefined);
  });
  for (const [player, foe] of [[true, false], [false, true], [true, true]] as const) test(`${c.id} genuine Match manual/AI player=${player} foe=${foe}`, () => {
    const { m, writes } = match(c.opponent), before = writes.length;
    m.startSparring({ weapon: 'estoc', skill: null, difficulty: player && !foe ? 'dummy' : 1 }, null, { player: player ? c.id : null, opponent: foe ? c.id : null });
    const nativeKit = m.practice.duel.fighters.map(f => f.weapon);
    m.step(() => ({ ...idleIntent(), action: 'light' }));
    for (let t = 0; t < 200; t++) m.step(() => { const [a, b] = m.practice.duel.fighters; return { ...idleIntent(), guard: true, move: { x: 0, z: Math.hypot(a.body.x - b.body.x, a.body.z - b.body.z) > 2 ? -1 : 0, yaw: 0, run: false } }; });
    assert.ok(!m.fightLog.some(e => e.type === 'SpecialStarted' && e.actor === 0), 'player only casts from manual intent');
    if (player) for (let t = 0; t < 180 && !m.fightLog.some(e => e.type === 'SpecialStarted' && e.actor === 0) && !m.practice.finish; t++) m.step(() => {
      const [a, b] = m.practice.duel.fighters, gap = Math.hypot(a.body.x - b.body.x, a.body.z - b.body.z);
      return gap <= 2.75 ? skill() : { ...idleIntent(), guard: true, move: { x: 0, z: gap > 2 ? -1 : 0, yaw: 0, run: false } };
    });
    for (let t = 0; t < 170 && !m.practice.finish; t++) m.step(() => ({ ...idleIntent(), guard: true }));
    for (const actor of [0, 1] as const) {
      const start = m.fightLog.find(e => e.type === 'SpecialStarted' && e.actor === actor), land = m.fightLog.find(e => e.type === 'SpecialLanded' && e.actor === actor);
      assert.equal(!!start, actor === 0 ? player : foe); const cut = m.fightLog.find(e => e.type === 'SpecialInterrupted' && e.actor === actor); assert.equal(!!land, !!start && !(player && foe && cut)); assert.equal(!!cut, !!start && player && foe && !land, 'two casts: the first strike cuts the other (interruptible casts); one cast alone is never cut');
      if (start && land) { assert.equal(land.tick - start.tick, RULES.special.windup - 1); assert.equal(land.target, 1 - actor); assert.equal(land.damage, Math.round(0.2 * m.practice.duel.fighters[1 - actor].maxHealth)); }
    }
    assert.deepEqual(m.practice.duel.fighters.map(f => f.weapon), nativeKit); assert.equal(m.recorder, null); assert.equal(writes.length, before);
    m.rematch(); assert.deepEqual(m.specialIdentity.presets, [player ? c.id : null, foe ? c.id : null]);
  });
  for (const exposure of [1, 2]) test(`${c.id} actual factory holds, lands once, yields and disposes in exposure ${exposure}`, async () => {
    const mode = SPECIAL_MODES[c.id]; assert.ok(mode, 'approved class identity has its real lazy factory');
    const scene = new THREE.Scene(), fx = await mode.load(scene, c.opponent, exposure, new THREE.PerspectiveCamera());
    const feet = [new THREE.Vector3(0, 0, 1), new THREE.Vector3()] as const;
    let duel = accepted(c);
    const draw = (dt = 0, yielding = false) => { const n = normalized(duel); fx.render(dt, n.events, n.fighters, duel.tick, feet, yielding); };
    draw();
    for (let t = 1; t < 90; t++) { duel = stepDuel(duel, [idleIntent(), idleIntent()]); draw(); }
    const root = scene.getObjectByName(c.root)!; assert.ok(root?.visible); assert.equal(root.position.distanceTo(feet[1]), 0, 'caster-local anchor');
    const state = () => { const out: number[][] = []; root.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) out.push([...o.position.toArray(), ...o.scale.toArray(), o.rotation.y, (o.material as THREE.Material).opacity]); }); return out; };
    const held = state(); draw(5); assert.deepEqual(state(), held, 'wall time never advances a frozen sim tick');
    while (!duel.events.some(e => e.type === 'SpecialLanded')) { duel = stepDuel(duel, [idleIntent(), idleIntent()]); draw(); }
    const landed = state();
    for (let t = 0; t < 14; t++) { duel = stepDuel(duel, [idleIntent(), idleIntent()]); draw(); }
    assert.notDeepEqual(state(), landed, 'accepted landing drives the authored payoff');
    if (c.id === 'earthfold') { assert.ok(root.children[0].position.z > root.children[1].position.z + 0.3, 'one bank collapses forward'); }
    if (c.id === 'ironsettle') assert.ok(state().every((v, i) => v[1] < landed[i][1]), 'the raised iron grains settle once');
    if (c.id === 'gatherededge') assert.ok(state().some((v, i) => Math.abs(v[0] - landed[i][0]) > 0.5), 'the gathered seam crosses the stance');
    draw(0, true); assert.equal(root.visible, false); fx.clear();
    const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
    scene.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) { if (o instanceof THREE.Mesh) resources.add(o.geometry); const mat = o.material as THREE.MeshBasicMaterial | THREE.SpriteMaterial; resources.add(mat); if (mat.map) resources.add(mat.map); } });
    let disposals = 0; for (const resource of resources) resource.addEventListener('dispose', () => disposals++);
    disposeSpecialGroup(scene); assert.equal(disposals, resources.size, 'each owned resource disposed once');
  });
}
