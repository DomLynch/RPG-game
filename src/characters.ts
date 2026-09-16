import { swingProgress } from './blade.ts';
export { swingProgress } from './blade.ts';
import { ATTACKS, type Attack, type Practice } from './combat.ts';
import { AnimationMixer, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BufferGeometry, BufferAttribute, DoubleSide, Vector3, LoopOnce, type AnimationAction, type AnimationClip } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const COMBAT_CLIPS = ['Armed', 'Attack', 'Hit', 'Death', 'Draw', 'Roll', 'Guard', 'Return', 'Heavy', 'Riposte', 'ArmedWalk', 'StrafeLeft', 'StrafeRight', 'Kick', 'BlockImpact', 'Parry', 'Deflected'] as const;
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

// Presentation follows confirmed contact; a new action or defeat immediately takes precedence.
export function defenceReaction(s: Practice, opponent=false): {pose:'block'|'parry'|'deflected';progress:number} | undefined {
  if (!s.health || !s.playerHealth) return;
  if(opponent ? !s.reaction && s.enemyMode!=='guard' : s.phase!=='ready' && s.phase!=='guard') return;
  const pose=opponent ? s.result==='enemyBlocked' ? 'block' : s.result==='parried' ? 'deflected' : undefined : s.result==='blocked' ? 'block' : s.result==='parried' ? 'parry' : undefined;
  const duration=pose==='deflected' ? 36 : pose==='parry' ? 18 : 12;
  if(pose && s.resultAge<duration) return {pose,progress:s.resultAge/duration};
}

type FighterAsset = { scene: Group; animations: AnimationClip[] };
// One fighter GLB: the same rig, clip names and sword attachments as every other (blade paths are baked once).
async function loadFighter(url: string) {
  const asset = await new GLTFLoader().loadAsync(url);
  const steel = asset.scene.getObjectByName('Steel');
  if (!(steel instanceof Mesh) || !(steel.material instanceof MeshStandardMaterial) || !steel.material.map || !steel.material.normalMap) throw new Error('Warrior textures did not load');
  return asset;
}
// The opponent is his own man (opponentUrl) when one is given; with a single GLB both fighters share the geometry and
// the opponent's Heraldry is recoloured so they are not twins.
export async function loadWarriors(url: string, opponentUrl = url) {
  const [hero, enemy] = await Promise.all([loadFighter(url), opponentUrl === url ? undefined : loadFighter(opponentUrl)]);
  return buildWarriors(hero, enemy);
}
function fighterClips(asset: FighterAsset) {
  return [...CLIPS, ...COMBAT_CLIPS].map(name => {
    const clip = asset.animations.find(a => a.name === name);
    if (!clip?.tracks.length || !Number.isFinite(clip.duration) || clip.duration <= 0) throw new Error(`Warrior is missing ${name}`);
    return clip;
  });
}
// Two actors from parsed assets (textures already checked by the loader; tests build from the parsed rig alone): the
// player from `asset`, the opponent from `opponentAsset` when given, else a recoloured clone of the same asset.
export function buildWarriors(asset: FighterAsset, opponentAsset?: FighterAsset) {
  const hero = { asset, clips: fighterClips(asset) }, enemy = opponentAsset ? { asset: opponentAsset, clips: fighterClips(opponentAsset) } : undefined;
  function create(opponent: boolean) {
    const { asset, clips } = opponent && enemy ? enemy : hero;
    const root = clone(asset.scene), anchor = new Group(); anchor.add(root);
    root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = object.receiveShadow = true;
      // Only two small actors: avoid culling against a bind-pose box during motion.
      object.frustumCulled = false;
      if (object.material instanceof MeshStandardMaterial && object.material.name === 'Heraldry' && opponent && !enemy) {
        object.material = object.material.clone(); object.material.color.set('#663c32');
      }
    });
    const mixer = new AnimationMixer(root);
    const actions: AnimationAction[] = clips.map(clip => mixer.clipAction(clip).play());
    actions.forEach((a, i) => a.setEffectiveWeight(i === 0 ? 1 : 0));
    const sheathed = root.getObjectByName('SwordSheathed')!, drawn = root.getObjectByName('SwordDrawn')!;
    if (!sheathed || !drawn) throw new Error('Warrior sword attachments are missing');
    [...actions.slice(5,14),...actions.slice(17)].forEach(action => { action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.paused = true; });
    if (opponent) actions[0].time = clips[0].duration * 0.4;
    mixer.update(0);
    const ribbon = new BufferGeometry(), ribbonVertices = new Float32Array(6 * 6 * 3);
    ribbon.setAttribute('position', new BufferAttribute(ribbonVertices, 3));
    const trail = new Mesh(ribbon, new MeshBasicMaterial({ color: '#e8dfc8', transparent: true, opacity: .12, side: DoubleSide, depthWrite: false }));
    trail.frustumCulled = false; trail.visible = false; anchor.add(trail);
    const samples: Vector3[][] = [];
    let speed = 0;
    return {
      anchor,
      update(travelSpeed: number, dt: number, pose: 'sheathed' | 'draw' | 'ready' | 'attack' | 'hit' | 'death' | 'roll' | 'guard' | 'kick' | 'block' | 'parry' | 'deflected' = 'sheathed', progress = 0, attack: Attack = 'light', contact = .35, lateral = 0, recoil = 0) {
        // dt 0 evaluates the pose for the current tick without advancing anything (the frame loop's hit-stop): clip times still follow `progress`,
        // weights and gait hold, the mixer applies at zero, and no trail sample is taken.
        const step = Math.max(0, Math.min(dt, 0.1));
        speed += (Math.abs(travelSpeed) - speed) * (1 - Math.exp(-step * 14));
        if (speed < 0.015) speed = 0;
        actions.slice(1, 4).forEach(action => action.setEffectiveTimeScale(travelSpeed < 0 ? -1 : 1));
        const weights = gaitWeights(speed);
        if (pose !== 'sheathed' && speed < 4.2) { const movement = 1-weights[0], side = Math.min(1,Math.abs(lateral)); weights.fill(0,1); weights[14] = movement*(1-side); weights[lateral < 0 ? 15 : 16] = movement*side; }
        actions[14].setEffectiveTimeScale((travelSpeed < 0 ? -1 : 1)*Math.max(.25,speed/1.7));
        for (const i of [15,16]) actions[i].setEffectiveTimeScale(Math.max(.25,speed/ .75));
        const combatIndex = pose === 'block' ? 18 : pose === 'parry' ? 19 : pose === 'deflected' ? 20 : pose === 'kick' ? 17 : pose === 'attack' ? attack === 'return' ? 11 : attack === 'heavy' ? 12 : attack === 'riposte' ? 13 : 5 : pose === 'hit' ? 6 : pose === 'death' ? 7 : pose === 'draw' ? 8 : pose === 'roll' ? 9 : pose === 'guard' ? 10 : -1;
        const armed = pose !== 'sheathed';
        if (armed) { weights[4] = weights[0]; weights[0] = 0; }
        actions.forEach((a, i) => {
          const fade = combatIndex < 0 ? 0 : ['draw','guard','block','parry','deflected'].includes(pose) ? 1 : Math.min(1, progress * 12, pose === 'death' ? 1 : (1 - progress) * 10);
          const target = (weights[i] || 0) * (1 - fade) + Number(i === combatIndex) * fade;
          const activeBlade = pose === 'attack' && progress >= contact-1/ATTACKS[attack].recovery && progress <= contact+4/ATTACKS[attack].recovery;
          a.setEffectiveWeight(activeBlade ? Number(i === combatIndex) : a.getEffectiveWeight() + (target - a.getEffectiveWeight()) * (1 - Math.exp(-step * 24)));
          if (i === combatIndex) a.time = Math.min(.999999, Math.max(0, pose === 'attack' ? swingProgress(progress, contact, attack === 'heavy' ? .48 : .34) : progress)) * clips[i].duration;
        });
        drawn.visible = armed && (pose !== 'draw' || progress >= .29); sheathed.visible = !drawn.visible;
        mixer.update(step);
        root.rotation.z = pose === 'hit' ? Math.sin(Math.PI*Math.min(1,progress))*(attack === 'return' ? -.12 : .12) : recoil*.06;
        root.position.z = -Math.abs(recoil)*.045;
        trail.visible = pose === 'attack' && progress > contact * .7 && progress < contact + .18;
        if (trail.visible && step > 0) {
          anchor.updateWorldMatrix(true, true);
          samples.unshift([.24, .85].map(y => anchor.worldToLocal(drawn.localToWorld(new Vector3(0, y, 0)))));
          if (samples.length > 7) samples.pop();
          let offset = 0;
          for (let i = 1; i < samples.length; i++) for (const point of [samples[i-1][0],samples[i-1][1],samples[i][0],samples[i][0],samples[i-1][1],samples[i][1]]) { point.toArray(ribbonVertices, offset); offset += 3; }
          ribbon.setDrawRange(0, offset / 3); ribbon.attributes.position.needsUpdate = true;
        } else if (!trail.visible) samples.length = 0;
      }
    };
  }
  return { player: create(false), opponent: create(true) };
}
