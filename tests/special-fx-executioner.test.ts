import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import type { CombatEvent, Fighter } from '../src/duel.ts';
import { ARENA_THEMES } from '../src/arena-themes.ts';
import { crowdWave } from '../src/arena.ts';
import { SPECIAL_MODES } from '../src/special-modes.ts';
import { BOSS_KINDS, BUILD, bossLook, createExecutionerSpecial, isExecutionerCast, trailSchedule, waveLean, type BossKind } from '../src/special-fx-executioner.ts';
import { SPECIAL_TESTS, specialParam } from '../src/special-look.ts';
import { LAND_AT, isHadesShadow } from '../src/special-timing.ts';

// The Executioner's boss specials (special-fx-executioner.ts): preview-only art on Hades' seam, on his Reaping Blow.
const fighters = [{ special: 0 }, { special: 0, skill: 'reaping' }] as unknown as readonly [Fighter, Fighter];
const started = { tick: 1, type: 'SpecialStarted', actor: 1, move: 'skill_reaping' } as unknown as CombatEvent;
const landed = { tick: LAND_AT, type: 'SpecialLanded', actor: 1, target: 0, move: 'skill_reaping', damage: 30 } as unknown as CombatEvent;
const feet = [new THREE.Vector3(0, 0, 1.4), new THREE.Vector3(0, 0, -0.6)] as const;

test('?special=arawn|thanatos|reaper are the Executioner at ranks 8, 9, 10 (levels 36, 41, 46), and his Reaping Blow draws them', () => {
  for (const [name, level] of [['arawn', 36], ['thanatos', 41], ['reaper', 46]] as const) {
    assert.equal(specialParam(`?special=${name}`), name);
    assert.deepEqual(SPECIAL_TESTS[name], { opponent: 'executioner', level, first: 180 });
  }
  assert.ok(isExecutionerCast('executioner', 1, 'skill_reaping'));
  assert.ok(!isExecutionerCast('executioner', 0, 'skill_reaping') && !isExecutionerCast('executioner', 1, 'skill_lunge') && !isExecutionerCast('nightborn', 1, 'skill_lunge'));
  assert.ok(!isHadesShadow('executioner', 1, 'skill_reaping'), 'Hades\' cloud never draws on him');
  for (const name of BOSS_KINDS) assert.equal(SPECIAL_MODES[name]?.at, 'feet', `${name} has a registry entry`);
});

test('Baying Circle schedule: the last trail arrives on the landing tick, none sets off before the build-up, every cast differs', () => {
  for (const seed of [1, 40, 731]) {
    const s = trailSchedule(9, seed);
    assert.equal(Math.max(...s.map((t) => t.to)), 1);
    assert.equal(s.filter((t) => t.to === 1).length, 1, 'one last arrival');
    assert.ok(s.every((t) => t.from >= 0 && t.from < t.to && t.to <= 1));
    assert.deepEqual(s, trailSchedule(9, seed), 'a pure function of the seed');
  }
  assert.notDeepEqual(trailSchedule(9, 1), trailSchedule(9, 2));
  assert.equal(BUILD, 30, 'half a second of visible build-up');
});

test('Harvest Sweep crowd lean: a bump on the front, a weaker wake behind it, nothing ahead', () => {
  assert.ok(waveLean(0.5, 0.5) > waveLean(0.2, 0.5) && waveLean(0.2, 0.5) > 0, 'the front leans most, the wake a little');
  assert.ok(waveLean(0.9, 0.3) < 0.001, 'ahead of the front: still');
  assert.ok(waveLean(0.5, 0.5) < 0.3, 'a lean, not a fall');
});

for (const kind of BOSS_KINDS) {
  test(`${kind}: nothing in the early wind-up, drawn through the last half second, gone after the aftermath; pit and day both build`, () => {
    for (const arena of ['1', 'a'] as const) {
      const scene = new THREE.Scene(), fx = createExecutionerSpecial(scene, 'executioner', kind as BossKind, bossLook(kind, ARENA_THEMES[arena].exposure)), root = scene.getObjectByName('special fx')!;
      const drawn = () => { let m = 0; root.traverse((o) => { const mat = (o as THREE.Mesh).material as THREE.Material & { opacity?: number } | undefined; if (mat?.opacity && (o as THREE.Mesh).visible) m = Math.max(m, mat.opacity); }); return m; };
      const run = (from: number, to: number) => { for (let t = from; t <= to; t++) fx.render(1 / 60, t === 1 ? [started] : t === LAND_AT ? [landed] : [], fighters, t, feet, false); };
      run(0, LAND_AT - BUILD - 3);
      assert.equal(drawn(), 0, 'the early wind-up draws nothing');
      run(LAND_AT - BUILD - 2, LAND_AT - 1);
      assert.ok(drawn() > 0.1, 'the build-up is visible');
      run(LAND_AT, LAND_AT + 70);
      assert.equal(root.visible, false, 'and the cast ends');
    }
  });
}

test('the crowd lean is set by the Harvest Sweep alone, only while the sweep runs; the art ships in its own lazy chunk behind the registry', () => {
  crowdWave.lean = null;
  createExecutionerSpecial(new THREE.Scene(), 'executioner', 'arawn', bossLook('arawn', 1));
  assert.equal(crowdWave.lean as unknown, null, 'the other two never touch the crowd');
  createExecutionerSpecial(new THREE.Scene(), 'executioner', 'reaper', bossLook('reaper', 1));
  assert.equal(crowdWave.lean as unknown, null, 'idle: unregistered (the hook is only set while the sweep runs)');
  assert.match(readFileSync('src/special-modes.ts', 'utf8'), /import\('\.\/special-fx-executioner\.ts'\)/);
  assert.doesNotMatch(readFileSync('src/scene.ts', 'utf8'), /special-fx-executioner/, 'the scene names none of it');
});
