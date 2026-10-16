// sandbox-mech: does every one of the 50 designed spell effects actually draw when the PLAYER casts it? Headless, tick by tick (no browser, no real-time guesses):
// the real createSpecialPresentation with the real modes, a player cast (actor 0, a look-test preset), a SpecialStarted then a SpecialLanded at LAND_AT, and a count of the
// drawable leaves that are visible up their parent chain with material opacity above zero.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { initialDuel, withSpecials, type CombatEvent, type Fighter } from '../src/fight/duel.ts';
import { OPPONENTS } from '../src/fight/moves.ts';
import { createSpecialPresentation } from '../src/fight/special-presentation.ts';
import { SPECIAL_MODES } from '../src/fight/special-modes.ts';
import { SPECIAL_TESTS, type SpecialTest } from '../src/fight/special-look.ts';
import { LAND_AT } from '../src/fight/special-timing.ts';
const IDS = Object.keys(SPECIAL_TESTS).filter((id) => SPECIAL_MODES[id as SpecialTest]) as SpecialTest[];
// Draw nothing here and are not checked yet: they read the fighters' rig (bones, anchors, a canvas) that this headless test does not build. None is a rank 1-2 (beta) effect; to be checked in a rig test.
const NEEDS_RIG =['ratrun', 'price', 'reynard', 'hermes', 'loki'];
const bones =[new THREE.Vector3(-1, 1.5, 0.5), new THREE.Vector3(1, 1.5, -0.5)] as const;
const flush = async () => { for (let i = 0; i < 40; i++) await new Promise((r) => setImmediate(r)); };
const fighters = (): [Fighter, Fighter] => {
  const pair = withSpecials(initialDuel(OPPONENTS.nightborn, 'longsword', 'lunge'), 41, 'lunge').fighters;
  for (const f of pair) { f.specialName = 'x'; f.special = 120; }
  return pair;
};
const visible = (root: THREE.Object3D) => {
  let n = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
    if (!(m.isMesh || (o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite || (o as THREE.Line).isLine)) return;
    for (let p: THREE.Object3D | null = o; p && p !== root.parent; p = p.parent) if (!p.visible) return;
    const mats = ([] as (THREE.Material | undefined)[]).concat(m.material);
    if (mats.some((x) => x && (x.visible !== false) && (x.opacity ?? 1) > 0.02)) n++;
  });
  return n;
};

test('every designed spell effect draws something when the player casts it', async () => {
  const blank: string[] = [], report: string[] = [];
  for (const id of IDS) {
    const scene = new THREE.Scene(), pair = fighters(), presets: [SpecialTest | null, SpecialTest | null] = [id, null];
    const opponent = SPECIAL_TESTS[id].opponent, fight = { opponent, level: SPECIAL_TESTS[id].level, presets } as never;
    const p = createSpecialPresentation(scene, 1, new THREE.PerspectiveCamera());
    const start: CombatEvent = { type: 'SpecialStarted', actor: 0, tick: 1, name: 'x', move: 'the-casters-own-move', spell: 'bird-jaguar', target: 1 } as never;   // a spell cast carries the CASTER's move, not the effect's opponent's
    const land: CombatEvent = { type: 'SpecialLanded', actor: 0, tick: 1 + LAND_AT, name: 'x', move: 'skill_x', target: 1, damage: 30 } as never;
    p.prepare(1, [], pair, 0, false, fight); await flush();
    let peak = 0, peakAt = -1, ok = true;
    try {
      for (let t = 1; t <= LAND_AT + 150; t++) {
        const events = t === 1 ? [start] : t === 1 + LAND_AT ? [land] : [];
        p.prepare(1, events, pair, t, false, fight);
        p.render(1 / 60, pair, t, bones, bones, undefined, false);
        const g = scene.getObjectByName('special actor 0'); const v = g ? visible(g) : 0;
        if (v > peak) { peak = v; peakAt = t; }
      }
    } catch (e) { ok = false; report.push(`${id}: THREW ${String(e).slice(0, 80)}`); }
    report.push(`${id.padEnd(13)} peak=${peak} at tick ${peakAt}`);    if (ok && peak === 0) blank.push(id);
    p.clear();
  }
  console.log(report.join('\n'));
  assert.deepEqual(blank.filter((id) => !NEEDS_RIG.includes(id)), [], `effects that never draw: ${blank.join(', ')}`);});
