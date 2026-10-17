// The merged remote figure's loader (origins/preview/far-figure.ts): the LODs ship no clips, so the hero's own AnimationClips are set on both; a failed load is null (the page keeps the hero rig).
import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationClip, Group } from 'three';
import { loadFigureAssets, makeFigures } from '../origins/preview/far-figure.ts';

const urls = { near: 'near.glb', far: 'far.glb' };
const asset = () => ({ scene: new Group(), animations: [] as AnimationClip[] });

test('both LODs are parsed from their own urls, and the hero\'s clips are set on both (shared, not copied)', async () => {
  const asked: string[] = [], made = { 'near.glb': asset(), 'far.glb': asset() };
  const assets = await loadFigureAssets(urls, async (url) => { asked.push(url); return made[url as keyof typeof made] as never; });
  assert.deepEqual(asked.sort(), ['far.glb', 'near.glb']);
  assert.ok(assets);
  const clips = [new AnimationClip('walk', 1, []), new AnimationClip('idle', 1, [])];
  makeFigures(assets, clips);
  assert.equal(assets.near.animations, clips); assert.equal(assets.far.animations, clips);
});

test('either LOD failing to load gives null and a warning, never a half figure', async () => {
  const real = console.warn; let warned = 0; console.warn = () => { warned++; };
  try {
    assert.equal(await loadFigureAssets(urls, async (url) => { if (url === 'far.glb') throw new Error('404'); return asset() as never; }), null);
    assert.equal(warned, 1);
  } finally { console.warn = real; }
});
