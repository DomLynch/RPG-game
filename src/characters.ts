import { AnimationMixer, Group, Mesh, MeshStandardMaterial, type AnimationAction } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const CLIPS = ['Idle', 'Walk', 'Jog', 'Run'] as const;
// Match the gait to actual travel, including analog movement and collision stops.
export function gaitWeights(speed: number): number[] {
  speed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const knots = [0, 1.7, 3, 5.2];
  for (let i = 1; i < knots.length; i++) if (speed < knots[i]) {
    const t = (speed - knots[i - 1]) / (knots[i] - knots[i - 1]);
    return knots.map((_, k) => k === i ? t : k === i - 1 ? 1 - t : 0);
  }
  return [0, 0, 0, 1];
}

export async function loadWarriors(url: string) {
  const asset = await new GLTFLoader().loadAsync(url);
  const steel = asset.scene.getObjectByName('Steel');
  if (!(steel instanceof Mesh) || !(steel.material instanceof MeshStandardMaterial) || !steel.material.map || !steel.material.normalMap) throw new Error('Warrior textures did not load');
  const clips = CLIPS.map(name => {
    const clip = asset.animations.find(a => a.name === name);
    if (!clip?.tracks.length || !Number.isFinite(clip.duration) || clip.duration <= 0) throw new Error(`Warrior is missing ${name}`);
    return clip;
  });
  function create(opponent: boolean) {
    const root = clone(asset.scene), anchor = new Group(); anchor.add(root);
    root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = object.receiveShadow = true;
      // Only two small actors: avoid culling against a bind-pose box during motion.
      object.frustumCulled = false;
      if (object.material instanceof MeshStandardMaterial && object.material.name === 'Heraldry' && opponent) {
        object.material = object.material.clone(); object.material.color.set('#663c32');
      }
    });
    const mixer = new AnimationMixer(root);
    const actions: AnimationAction[] = clips.map(clip => mixer.clipAction(clip).play());
    actions.forEach((a, i) => a.setEffectiveWeight(i === 0 ? 1 : 0));
    if (opponent) actions[0].time = clips[0].duration * 0.4;
    mixer.update(0);
    let speed = 0;
    return {
      anchor,
      update(travelSpeed: number, dt: number) {
        const step = Math.max(0, Math.min(dt, 0.1));
        speed += (Math.max(0, travelSpeed) - speed) * (1 - Math.exp(-step * 14));
        if (speed < 0.015) speed = 0;
        const weights = gaitWeights(speed);
        actions.forEach((a, i) => a.setEffectiveWeight(weights[i]));
        mixer.update(step);
      }
    };
  }
  return { player: create(false), opponent: create(true) };
}
