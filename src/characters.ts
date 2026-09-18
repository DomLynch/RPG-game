import { swingProgress } from './blade.ts';
export { swingProgress } from './blade.ts';
import { attackSpecs, type Attack, type Practice } from './combat.ts';
import type { WeaponId } from './moves.ts';
import { AnimationMixer, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BufferGeometry, BufferAttribute, DoubleSide, Vector3, LoopOnce, type AnimationAction, type AnimationClip } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const COMBAT_CLIPS = ['Armed', 'Attack', 'Hit', 'Death', 'Draw', 'Roll', 'Guard', 'Return', 'Heavy', 'Riposte', 'ArmedWalk', 'StrafeLeft', 'StrafeRight', 'Kick', 'BlockImpact', 'Parry', 'Deflected'] as const;
export const CLIPS = ['Idle', 'Walk', 'Jog', 'Run'] as const;
// Finisher clips are additive (owner-authorized 2026-09-17): the 21 contract clips above stay frozen, Death_* variants append after them.
export const FINISHER_CLIPS = ['Death_SplitCrown'] as const;
// The renderer plays roles, never clip positions. The sword's roles are its clip names (the shipped warrior.glb set) plus Thrust: the
// sword thrusts with its Riposte clip. Each weapon maps roles to its own clips; an unlisted role plays the clip of its own name (the
// body clips are shared, and a two-handed weapon's fighter starts armed, so Draw never plays for him).
export type Role = (typeof CLIPS)[number] | (typeof COMBAT_CLIPS)[number] | (typeof FINISHER_CLIPS)[number] | 'Thrust';
export const ROLES: readonly Role[] = [...CLIPS, ...COMBAT_CLIPS, ...FINISHER_CLIPS, 'Thrust'];
export const WEAPON_CLIPS: Record<WeaponId, Partial<Record<Role, string>>> = {
  longsword: { Thrust: 'Riposte' },
  cleaver: { Thrust: 'Riposte' },   // the Pitborn's, on the sword clip family until the weapons lane lands its own
  knife: { Thrust: 'Riposte' },   // the goblin's, on the sword clip family until the weapons lane lands its own
  estoc: { Thrust: 'Riposte' },   // the Nightborn's, likewise
  // One sweep clip cuts both ways (the sim's path is the same either side); no parry clip: a shaft has no blade to turn, so a parry shows the block.
  trident: { Armed: 'Trident_Idle', ArmedWalk: 'Trident_Walk', StrafeLeft: 'Trident_StrafeLeft', StrafeRight: 'Trident_StrafeRight', Attack: 'Trident_Sweep', Return: 'Trident_Sweep', Heavy: 'Trident_High', Thrust: 'Trident_Thrust', Riposte: 'Trident_ThrustChain', Guard: 'Trident_Guard', BlockImpact: 'Trident_BlockImpact', Parry: 'Trident_BlockImpact', Deflected: 'Trident_Deflected', Hit: 'Trident_Hit', Death: 'Trident_Death' },
};
export const clipFor = (weapon: WeaponId, role: Role): string => WEAPON_CLIPS[weapon][role] ?? role;
const ONE_SHOT: readonly Role[] = ['Attack', 'Hit', 'Death', 'Draw', 'Roll', 'Guard', 'Return', 'Heavy', 'Riposte', 'Thrust', 'Kick', 'BlockImpact', 'Parry', 'Deflected', 'Death_SplitCrown'];
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
export async function loadWarriors(url: string, opponentUrl = url, weapons: [WeaponId, WeaponId] = ['longsword', 'longsword']) {
  const [hero, enemy] = await Promise.all([loadFighter(url), opponentUrl === url ? undefined : loadFighter(opponentUrl)]);
  return buildWarriors(hero, enemy, weapons);
}
// The clip each role plays for this weapon. Two roles on one clip (the trident's sweep) get their own copies: the mixer keys actions by clip.
function fighterClips(asset: FighterAsset, weapon: WeaponId): Record<Role, AnimationClip> {
  const clips = {} as Record<Role, AnimationClip>, used = new Set<AnimationClip>();
  for (const role of ROLES) {
    const name = clipFor(weapon, role), clip = asset.animations.find(a => a.name === name);
    if (!clip?.tracks.length || !Number.isFinite(clip.duration) || clip.duration <= 0) throw new Error(`Warrior is missing ${name}`);
    clips[role] = used.has(clip) ? clip.clone() : clip; used.add(clip);
  }
  return clips;
}
// Two actors from parsed assets (textures already checked by the loader; tests build from the parsed rig alone): the
// player from `asset`, the opponent from `opponentAsset` when given, else a recoloured clone of the same asset. `weapons` names
// what each carries (the simulation's word, duel.ts): it picks the clips, the swing's contact key and the striking part the trail follows.
export function buildWarriors(asset: FighterAsset, opponentAsset?: FighterAsset, weapons: [WeaponId, WeaponId] = ['longsword', 'longsword']) {
  const hero = { asset, weapon: weapons[0], clips: fighterClips(asset, weapons[0]) }, enemy = opponentAsset ? { asset: opponentAsset, weapon: weapons[1], clips: fighterClips(opponentAsset, weapons[1]) } : undefined;
  if (!enemy && weapons[1] !== weapons[0]) throw new Error('A shared rig carries one weapon');
  function create(opponent: boolean) {
    const { asset, clips, weapon } = opponent && enemy ? enemy : hero, specs = attackSpecs(weapon);
    const root = clone(asset.scene), anchor = new Group(); anchor.add(root);
    // A re-proportioned fighter's walk cycle covers less ground than a man's (build-warrior.mjs writes `stride`, root scale × leg scale, on
    // the rig node): his locomotion clips play faster by that so the feet keep planting at the simulation's travel speed. A man's is 1.
    let stride = 1; asset.scene.traverse(o => { if (typeof o.userData.stride === 'number' && o.userData.stride > 0) stride = o.userData.stride; });
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
    const actions = {} as Record<Role, AnimationAction>;
    for (const role of ROLES) { actions[role] = mixer.clipAction(clips[role]).play(); actions[role].setEffectiveWeight(role === 'Idle' ? 1 : 0); }
    // The weapon on the rig: a WeaponDrawn node (a two-handed weapon, always in hand: no sheathed/drawn swap) or the sword's two nodes.
    // The trail follows the striking part: the node's own contact segment (extras.contact, metres along its Y) or the sword's blade.
    const weaponNode = root.getObjectByName('WeaponDrawn'), sheathed = root.getObjectByName('SwordSheathed'), drawn = root.getObjectByName('SwordDrawn');
    if (!weaponNode && !(sheathed && drawn)) throw new Error('Warrior weapon attachments are missing');
    const blade = weaponNode ?? drawn!, contactSegment = weaponNode?.userData.contact as { from: number; to: number } | undefined, segment = contactSegment ? [contactSegment.from, contactSegment.to] : [.24, .85];
    for (const role of ONE_SHOT) { const action = actions[role]; action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.paused = true; }
    if (opponent) actions.Idle.time = clips.Idle.duration * 0.4;
    mixer.update(0);
    const ribbon = new BufferGeometry(), ribbonVertices = new Float32Array(6 * 6 * 3);
    ribbon.setAttribute('position', new BufferAttribute(ribbonVertices, 3));
    const trail = new Mesh(ribbon, new MeshBasicMaterial({ color: '#e8dfc8', transparent: true, opacity: .12, side: DoubleSide, depthWrite: false }));
    trail.frustumCulled = false; trail.visible = false; anchor.add(trail);
    const samples: Vector3[][] = [];
    let speed = 0;
    return {
      anchor,
      // The clip carrying most of the pose right now and the node the weapon hangs from (the debug probe's word for what the rig is doing): `role:clip@node`.
      playing(): string { let best: Role = 'Idle'; for (const role of ROLES) if (actions[role].getEffectiveWeight() > actions[best].getEffectiveWeight()) best = role; return `${best}:${clips[best].name}@${blade.name}`; },
      update(travelSpeed: number, dt: number, pose: 'sheathed' | 'draw' | 'ready' | 'attack' | 'hit' | 'death' | 'splitCrown' | 'roll' | 'guard' | 'kick' | 'block' | 'parry' | 'deflected' = 'sheathed', progress = 0, attack: Attack = 'light', contact = .35, lateral = 0, recoil = 0) {
        // dt 0 evaluates the pose for the current tick without advancing anything (the frame loop's hit-stop): clip times still follow `progress`,
        // weights and gait hold, the mixer applies at zero, and no trail sample is taken.
        const step = Math.max(0, Math.min(dt, 0.1));
        speed += (Math.abs(travelSpeed) - speed) * (1 - Math.exp(-step * 14));
        if (speed < 0.015) speed = 0;
        for (const role of ['Walk', 'Jog', 'Run'] as const) actions[role].setEffectiveTimeScale(travelSpeed < 0 ? -1 : 1);
        const gait = gaitWeights(speed), weights: Partial<Record<Role, number>> = { Idle: gait[0], Walk: gait[1], Jog: gait[2], Run: gait[3] };
        if (pose !== 'sheathed' && speed < 4.2) { const movement = 1-gait[0], side = Math.min(1,Math.abs(lateral)); weights.Walk = weights.Jog = weights.Run = 0; weights.ArmedWalk = movement*(1-side); weights[lateral < 0 ? 'StrafeLeft' : 'StrafeRight'] = movement*side; }
        actions.ArmedWalk.setEffectiveTimeScale((travelSpeed < 0 ? -1 : 1)*Math.max(.25,speed/(1.7*stride)));
        for (const role of ['StrafeLeft', 'StrafeRight'] as const) actions[role].setEffectiveTimeScale(Math.max(.25,speed/(.75*stride)));
        const combatRole: Role | null = pose === 'block' ? 'BlockImpact' : pose === 'parry' ? 'Parry' : pose === 'deflected' ? 'Deflected' : pose === 'kick' ? 'Kick' : pose === 'attack' ? attack === 'return' ? 'Return' : attack === 'heavy' ? 'Heavy' : attack === 'riposte' ? 'Riposte' : attack === 'thrust' ? 'Thrust' : 'Attack' : pose === 'hit' ? 'Hit' : pose === 'death' ? 'Death' : pose === 'splitCrown' ? 'Death_SplitCrown' : pose === 'draw' ? 'Draw' : pose === 'roll' ? 'Roll' : pose === 'guard' ? 'Guard' : null;
        const armed = pose !== 'sheathed';
        if (armed) { weights.Armed = weights.Idle; weights.Idle = 0; }
        const dead = pose === 'death' || pose === 'splitCrown';
        for (const role of ROLES) {
          const a = actions[role];
          const fade = combatRole === null ? 0 : ['draw','guard','block','parry','deflected'].includes(pose) ? 1 : Math.min(1, progress * 12, dead ? 1 : (1 - progress) * 10);
          const target = (weights[role] || 0) * (1 - fade) + Number(role === combatRole) * fade;
          const activeBlade = pose === 'attack' && progress >= contact-1/specs[attack].recovery && progress <= contact+4/specs[attack].recovery;
          a.setEffectiveWeight(activeBlade ? Number(role === combatRole) : a.getEffectiveWeight() + (target - a.getEffectiveWeight()) * (1 - Math.exp(-step * 24)));
          if (role === combatRole) a.time = Math.min(.999999, Math.max(0, pose === 'attack' ? swingProgress(progress, contact, specs[attack].source) : progress)) * clips[role].duration;
        }
        if (!weaponNode) { drawn!.visible = armed && (pose !== 'draw' || progress >= .29); sheathed!.visible = !drawn!.visible; }
        mixer.update(step);
        root.rotation.z = pose === 'hit' ? Math.sin(Math.PI*Math.min(1,progress))*(attack === 'return' ? -.12 : .12) : recoil*.06;
        root.position.z = -Math.abs(recoil)*.045;
        trail.visible = pose === 'attack' && progress > contact * .7 && progress < contact + .18;
        if (trail.visible && step > 0) {
          anchor.updateWorldMatrix(true, true);
          samples.unshift(segment.map(y => anchor.worldToLocal(blade.localToWorld(new Vector3(0, y, 0)))));
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
