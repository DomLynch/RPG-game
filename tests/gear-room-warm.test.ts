// The gear sheet's warm-up (src/core/gear-room.ts warmGearRoom, Web 2026-10-17): it dresses the stage's scene in the fitting room's look (backdrop, no fog, key and rim) while the compile runs and one frame
// is drawn, then hands the scene back EXACTLY as found, also when the compile throws, so the walk never sees the studio and the sheet adds its own look on top of a clean scene.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { clearToBackdrop, warmGearRoom, type GearStage } from '../src/core/gear-room.ts';

(globalThis as { document?: unknown }).document = { createElement: () => ({ getContext: () => null }) };   // no 2D canvas: the room falls back to its flat colour backdrop

const stageOf = (log: string[]): GearStage => {
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x123456, 1, 9); scene.background = new THREE.Color(0xabcdef); scene.add(new THREE.HemisphereLight());
  return { scene, camera: new THREE.PerspectiveCamera(), setArenaVisible: () => log.push('arena'), hero: { place: () => log.push('place') }, draw: () => log.push(`draw lights=${scene.children.filter((c) => (c as THREE.DirectionalLight).isDirectionalLight).length} fog=${scene.fog}`) };
};

test('the warm-up draws the mannequin under the studio, once, after the compile, and leaves the scene as it was', async () => {
  const log: string[] = [], stage = stageOf(log), fog = stage.scene.fog, background = stage.scene.background, children = stage.scene.children.length;
  await warmGearRoom(stage, async (scene) => { log.push(`compile lights=${scene.children.filter((c) => (c as THREE.DirectionalLight).isDirectionalLight).length}`); });
  assert.deepEqual(log, ['place', 'compile lights=2', 'draw lights=2 fog=null']);
  assert.equal(stage.scene.fog, fog); assert.equal(stage.scene.background, background); assert.equal(stage.scene.children.length, children);
});

test('the empty stage clears to the room backdrop and puts the renderer\'s own clear colour back', () => {
  const calls: string[] = [], own = new THREE.Color(0xd9c9a3);
  const renderer = { getClearColor: (c: THREE.Color) => c.copy(own), getClearAlpha: () => 0.5, setClearColor: (c: THREE.Color, a: number) => calls.push(`${c.getHexString()}@${a}`), clear: () => calls.push('clear') } as unknown as THREE.WebGLRenderer;
  clearToBackdrop(renderer);
  assert.deepEqual(calls, ['0d0b09@1', 'clear', 'd9c9a3@0.5']);
});

test('a compile that throws still hands the scene back', async () => {
  const log: string[] = [], stage = stageOf(log), fog = stage.scene.fog, background = stage.scene.background, children = stage.scene.children.length;
  await assert.rejects(warmGearRoom(stage, async () => { throw new Error('compile failed'); }), /compile failed/);
  assert.equal(stage.scene.fog, fog); assert.equal(stage.scene.background, background); assert.equal(stage.scene.children.length, children);
  assert.ok(!log.some((l) => l.startsWith('draw')), 'nothing is drawn after a failed compile');
});
