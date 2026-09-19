import { spectralAppearance } from './spectral.ts';
import { swingProgress } from './blade.ts';
export { swingProgress } from './blade.ts';
import { attackSpecs, type Attack, type Practice } from './combat.ts';
import type { WeaponId } from './moves.ts';
import { AnimationMixer, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, SkinnedMesh, BufferGeometry, BufferAttribute, DoubleSide, Vector3, Quaternion, Matrix3, Matrix4, Box3, LoopOnce, type AnimationAction, type AnimationClip, type BufferAttribute as BufferAttributeType } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { budgetTextures, FIGHTER_TEXTURE_CAP, phoneTier } from './quality.ts';
import { splitSkull } from './skull.ts';
import { openWaist } from './opened.ts';

export const COMBAT_CLIPS = ['Armed', 'Attack', 'Hit', 'Death', 'Draw', 'Roll', 'Guard', 'Return', 'Heavy', 'Riposte', 'ArmedWalk', 'StrafeLeft', 'StrafeRight', 'Kick', 'BlockImpact', 'Parry', 'Deflected'] as const;
export const CLIPS = ['Idle', 'Walk', 'Jog', 'Run'] as const;
// Finisher clips are additive (owner-authorized 2026-09-17): the 21 contract clips above stay frozen, Death_* variants append after them.
export const FINISHER_CLIPS = ['Death_SplitCrown', 'Death_RunThrough', 'Fin_RunThrough', 'Death_QuietOne'] as const;
// The renderer plays roles, never clip positions. The sword's roles are its clip names (the shipped warrior.glb set) plus Thrust: the
// sword thrusts with its Riposte clip. Each weapon maps roles to its own clips; an unlisted role plays the clip of its own name (the
// body clips are shared, and a two-handed weapon's fighter starts armed, so Draw never plays for him).
export type Role = (typeof CLIPS)[number] | (typeof COMBAT_CLIPS)[number] | (typeof FINISHER_CLIPS)[number] | 'Thrust';
export const ROLES: readonly Role[] = [...CLIPS, ...COMBAT_CLIPS, ...FINISHER_CLIPS, 'Thrust'];
export const WEAPON_CLIPS: Record<WeaponId, Partial<Record<Role, string>>> = {
  maul: { Idle: 'Maul_Idle', Walk: 'Maul_Walk', Jog: 'Maul_Walk', Run: 'Maul_Walk', Armed: 'Maul_Idle', ArmedWalk: 'Maul_Walk', StrafeLeft: 'Maul_StrafeLeft', StrafeRight: 'Maul_StrafeRight', Attack: 'Maul_Slash', Return: 'Maul_Slash', Heavy: 'Maul_Heavy', Thrust: 'Maul_Thrust', Riposte: 'Maul_Thrust', Guard: 'Maul_Guard', BlockImpact: 'Maul_Guard', Parry: 'Maul_Guard', Deflected: 'Maul_Hit', Hit: 'Maul_Hit', Death: 'Maul_Death', Kick: 'Maul_Kick', Roll: 'Maul_Roll' },
  claws: { Idle: 'Claw_Idle', Walk: 'Claw_Walk', Jog: 'Claw_Walk', Run: 'Claw_Walk', Armed: 'Claw_Idle', ArmedWalk: 'Claw_Walk', StrafeLeft: 'Claw_StrafeLeft', StrafeRight: 'Claw_StrafeRight', Attack: 'Claw_Slash', Return: 'Claw_Slash', Heavy: 'Claw_Heavy', Thrust: 'Claw_Thrust', Riposte: 'Claw_Thrust', Guard: 'Claw_Guard', BlockImpact: 'Claw_Guard', Parry: 'Claw_Guard', Deflected: 'Claw_Hit', Hit: 'Claw_Hit', Death: 'Claw_Death', Kick: 'Claw_Kick', Roll: 'Claw_Roll' },
  longsword: { Thrust: 'Riposte' },
  cleaver: { Thrust: 'Riposte' },   // the Pitborn's, on the sword clip family until the weapons lane lands its own
  knife: { Thrust: 'Riposte' },   // the goblin's, on the sword clip family until the weapons lane lands its own
  estoc: { Thrust: 'Riposte' },   // the Nightborn's, likewise
  scythe: { Idle: 'Scythe_Idle', Walk: 'Scythe_Walk', Jog: 'Scythe_Walk', Run: 'Scythe_Walk', Armed: 'Scythe_Idle', ArmedWalk: 'Scythe_Walk', StrafeLeft: 'Scythe_StrafeLeft', StrafeRight: 'Scythe_StrafeRight', Attack: 'Scythe_Reap', Return: 'Scythe_Reap', Heavy: 'Scythe_High', Thrust: 'Scythe_Thrust', Riposte: 'Scythe_Chain', Guard: 'Scythe_Guard', BlockImpact: 'Scythe_BlockImpact', Parry: 'Scythe_BlockImpact', Deflected: 'Scythe_Deflected', Hit: 'Scythe_Hit', Death: 'Scythe_Death' },   // the Executioner's, LIVE 2026-09-18 (the weapons lane's 13-clip family); one reap clip cuts both ways, and a shaft has no blade to turn, so a parry shows the block. The gait roles too — an unlisted role falls back to the SWORD's clip of that name, and the warden's pre-fight stand/walk read as a one-handed sword hold with the scythe mounted (owner review 2026-09-19: "arms behind his back"); a two-handed weapon has no jog/run of its own, the walk carries all gaits
  // One sweep clip cuts both ways (the sim's path is the same either side); no parry clip: a shaft has no blade to turn, so a parry shows the block.
  trident: { Idle: 'Trident_Idle', Walk: 'Trident_Walk', Jog: 'Trident_Walk', Run: 'Trident_Walk', Armed: 'Trident_Idle', ArmedWalk: 'Trident_Walk', StrafeLeft: 'Trident_StrafeLeft', StrafeRight: 'Trident_StrafeRight', Attack: 'Trident_Sweep', Return: 'Trident_Sweep', Heavy: 'Trident_High', Thrust: 'Trident_Thrust', Riposte: 'Trident_ThrustChain', Guard: 'Trident_Guard', BlockImpact: 'Trident_BlockImpact', Parry: 'Trident_BlockImpact', Deflected: 'Trident_Deflected', Hit: 'Trident_Hit', Death: 'Trident_Death' },   // the gait roles as on the scythe: unlisted falls back to the sword family, wrong for a two-handed pole
};
export const clipFor = (weapon: WeaponId, role: Role): string => WEAPON_CLIPS[weapon][role] ?? role;
const ONE_SHOT: readonly Role[] = ['Attack', 'Hit', 'Death', 'Draw', 'Roll', 'Guard', 'Return', 'Heavy', 'Riposte', 'Thrust', 'Kick', 'BlockImpact', 'Parry', 'Deflected', 'Death_SplitCrown', 'Death_RunThrough', 'Fin_RunThrough', 'Death_QuietOne'];
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
  const creature = asset.scene.getObjectByName('CreatureBody');
  const steel = asset.scene.getObjectByName('Steel');
  const textured = creature
    ? creature instanceof SkinnedMesh && creature.material instanceof MeshStandardMaterial && creature.material.map && creature.material.roughnessMap
    : steel instanceof Mesh && steel.material instanceof MeshStandardMaterial && steel.material.map && steel.material.normalMap;
  if (!textured) throw new Error('Warrior textures did not load');
  // The owner's iPhone defect (2026-09-18): under GPU memory pressure iOS silently drops uploaded fighter
  // textures — black mannequins. On phones we cap the skins at 1K before the first upload (the 2K Gambeson
  // atlas is the offender); desktop keeps the full set. three.js uploads lazily, so this runs pre-render.
  if (phoneTier()) {
    const { textures, resized } = budgetTextures(asset.scene, FIGHTER_TEXTURE_CAP);
    console.info(`phone tier: ${resized}/${textures} fighter textures capped at ${FIGHTER_TEXTURE_CAP}px (the iPhone black-fighters defect)`);
  }
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
    let opened: ReturnType<typeof openWaist> | undefined;
    const spectral = spectralAppearance(root);
    let spectralLife = 1;
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
    const contactByClip = weaponNode?.userData.contactByClip as Record<string, { from: number; to: number }> | undefined;
    const upperArm = root.getObjectByName('upperarm_r');
    let aimedRotation: Quaternion | undefined;
    let speed = 0;
    let severed = false;   // decapitation is once per kill; unsever() resets on rematch
    let crown: ReturnType<typeof splitSkull> | undefined;
    return {
      anchor,
      // The clip carrying most of the pose right now and the node the weapon hangs from (the debug probe's word for what the rig is doing): `role:clip@node`.
      playing(): string { if (opened?.group.visible) return `Opened:WaistCut@${blade.name}`; let best: Role = 'Idle'; for (const role of ROLES) if (actions[role].getEffectiveWeight() > actions[best].getEffectiveWeight()) best = role; return `${best}:${clips[best].name}@${blade.name}`; },
      update(travelSpeed: number, dt: number, pose: 'sheathed' | 'draw' | 'ready' | 'attack' | 'hit' | 'death' | 'splitCrown' | 'decapitation' | 'runThrough' | 'runThroughHold' | 'quietOne' | 'opened' | 'roll' | 'guard' | 'kick' | 'block' | 'parry' | 'deflected' = 'sheathed', progress = 0, attack: Attack = 'light', contact = .35, lateral = 0, recoil = 0) {
        // dt 0 evaluates the pose for the current tick without advancing anything (the frame loop's hit-stop): clip times still follow `progress`,
        // weights and gait hold, the mixer applies at zero, and no trail sample is taken.
        if (pose !== 'opened' && opened) { opened.group.visible = false; root.visible = true; }
        const step = Math.max(0, Math.min(dt, 0.1));
        speed += (Math.abs(travelSpeed) - speed) * (1 - Math.exp(-step * 14));
        if (speed < 0.015) speed = 0;
        for (const role of ['Walk', 'Jog', 'Run'] as const) actions[role].setEffectiveTimeScale(travelSpeed < 0 ? -1 : 1);
        const gait = gaitWeights(speed), weights: Partial<Record<Role, number>> = { Idle: gait[0], Walk: gait[1], Jog: gait[2], Run: gait[3] };
        if (pose !== 'sheathed' && speed < 4.2) { const movement = 1-gait[0], side = Math.min(1,Math.abs(lateral)); weights.Walk = weights.Jog = weights.Run = 0; weights.ArmedWalk = movement*(1-side); weights[lateral < 0 ? 'StrafeLeft' : 'StrafeRight'] = movement*side; }
        actions.ArmedWalk.setEffectiveTimeScale((travelSpeed < 0 ? -1 : 1)*Math.max(.25,speed/(1.7*stride)));
        for (const role of ['StrafeLeft', 'StrafeRight'] as const) actions[role].setEffectiveTimeScale(Math.max(.25,speed/(.75*stride)));
        const combatRole: Role | null = pose === 'block' ? 'BlockImpact' : pose === 'parry' ? 'Parry' : pose === 'deflected' ? 'Deflected' : pose === 'kick' ? 'Kick' : pose === 'attack' ? attack === 'return' ? 'Return' : attack === 'heavy' ? 'Heavy' : attack === 'riposte' ? 'Riposte' : attack === 'thrust' ? 'Thrust' : 'Attack' : pose === 'hit' ? 'Hit' : pose === 'death' ? 'Death' : pose === 'splitCrown' || pose === 'decapitation' || pose === 'opened' ? 'Death_SplitCrown' : pose === 'runThrough' ? 'Death_RunThrough' : pose === 'quietOne' ? 'Death_QuietOne' : pose === 'runThroughHold' ? 'Fin_RunThrough' : pose === 'draw' ? 'Draw' : pose === 'roll' ? 'Roll' : pose === 'guard' ? 'Guard' : null;
        const armed = pose !== 'sheathed';
        if (armed) { weights.Armed = weights.Idle; weights.Idle = 0; }
        const dead = pose === 'death' || pose === 'splitCrown' || pose === 'decapitation' || pose === 'runThrough' || pose === 'quietOne' || pose === 'opened';
        for (const role of ROLES) {
          const a = actions[role];
          const fade = pose === 'opened' ? Math.min(1,progress/.04) : combatRole === null ? 0 : ['draw','guard','block','parry','deflected','runThroughHold'].includes(pose) ? 1 : Math.min(1, progress * 12, dead ? 1 : (1 - progress) * 10);
          const target = (weights[role] || 0) * (1 - fade) + Number(role === combatRole) * fade;
          const activeBlade = pose === 'attack' && progress >= contact-1/specs[attack].recovery && progress <= contact+4/specs[attack].recovery;
          a.setEffectiveWeight(pose === 'opened' ? target : activeBlade ? Number(role === combatRole) : a.getEffectiveWeight() + (target - a.getEffectiveWeight()) * (1 - Math.exp(-step * 24)));
          if (role === combatRole) a.time = Math.min(.999999, Math.max(0, pose === 'attack' ? swingProgress(progress, contact, specs[attack].source) : progress)) * clips[role].duration;
        }
        if (!weaponNode) { drawn!.visible = armed && (pose !== 'draw' || progress >= .29); sheathed!.visible = !drawn!.visible; }
        anchor.position.set(0, 0, 0); // only the presentation anchor steps into a Run Through
        if (aimedRotation && upperArm) upperArm.quaternion.copy(aimedRotation);
        aimedRotation = undefined;
        mixer.update(step);
        spectralLife = spectral?.(step, dead, progress, pose === 'opened') ?? 1;
        root.rotation.z = pose === 'hit' ? Math.sin(Math.PI*Math.min(1,progress))*(attack === 'return' ? -.12 : .12) : recoil*.06;
        root.position.z = -Math.abs(recoil)*.045;
        // The enlarged Wraith lowers its attacking arm toward the original strike height.
        // Blend through wind-up/recovery; keep its body, grip and simulation untouched.
        if (spectral && weapon !== 'claws' && upperArm?.parent && pose === 'attack') {
          root.updateWorldMatrix(true, true);
          const middle = blade.localToWorld(new Vector3(0, (segment[0] + segment[1]) / 2, 0));
          const target = root.worldToLocal(middle.clone()); target.y /= root.scale.y;
          root.localToWorld(target);
          const parent = upperArm.parent;
          const from = parent.worldToLocal(middle).sub(upperArm.position).normalize();
          const to = parent.worldToLocal(target).sub(upperArm.position).normalize();
          const amount = Math.max(0, Math.min(1, progress * 8, (1 - progress) * 6));
          aimedRotation = upperArm.quaternion.clone();
          upperArm.quaternion.premultiply(new Quaternion().slerp(new Quaternion().setFromUnitVectors(from, to), amount));
          root.updateWorldMatrix(true, true);
        }
        trail.visible = pose === 'attack' && progress > contact * .7 && progress < contact + .18;
        if (trail.visible && step > 0) {
          anchor.updateWorldMatrix(true, true);
          const override = combatRole && contactByClip?.[clips[combatRole].name], strike = override ? [override.from, override.to] : segment;
          samples.unshift(strike.map(y => anchor.worldToLocal(blade.localToWorld(new Vector3(0, y, 0)))));
          if (samples.length > 7) samples.pop();
          let offset = 0;
          for (let i = 1; i < samples.length; i++) for (const point of [samples[i-1][0],samples[i-1][1],samples[i][0],samples[i][0],samples[i-1][1],samples[i][1]]) { point.toArray(ribbonVertices, offset); offset += 3; }
          ribbon.setDrawRange(0, offset / 3); ribbon.attributes.position.needsUpdate = true;
        } else if (!trail.visible) samples.length = 0;
      },
      // Decapitation (owner 2026-09-18): bake the fighter's OWN head — face, hair, whatever helm he wears — out of the skinned
      // draws into a static prop at its current pose, and collapse the rig's Head bone so the corpse reads headless. Runs once
      // per kill; the caller re-parents the returned group to the world and owns the ballistics (and disposes it on rematch).
      sever() {
        if (severed) return null;
        const bone = root.getObjectByName('Head');
        if (!bone) return null;
        severed = true;
        root.updateWorldMatrix(true, true);
        root.updateMatrixWorld(true); // refresh SkinnedMesh bind inverses after actor movement before baking world vertices
        const group = new Group();
        root.traverse(object => {
          if (!(object instanceof SkinnedMesh)) return;
          const headIndex = object.skeleton.bones.findIndex(b => b.name === 'Head');
          const geometry = object.geometry, position = geometry.getAttribute('position'), skinIndex = geometry.getAttribute('skinIndex'), skinWeight = geometry.getAttribute('skinWeight');
          if (headIndex < 0 || !position || !skinIndex || !skinWeight) return;
          object.skeleton.update();   // bake from THIS frame's pose, not last render's
          const boneMatrices = object.skeleton.boneMatrices;
          if (!boneMatrices) return;
          const index = geometry.getIndex();
          const sources = Object.entries(geometry.attributes).filter(([name]) => name !== 'skinIndex' && name !== 'skinWeight') as [string, BufferAttributeType][];
          const remap = new Map<number, number>(), baked: Record<string, number[]> = {}, kept: number[] = [];
          const v = new Vector3(), n = new Vector3(), nb = new Vector3(), nt = new Vector3(), m4 = new Matrix4(), nm = new Matrix3();
          const vertex = (i: number): number => {
            let at = remap.get(i);
            if (at !== undefined) return at;
            at = remap.size; remap.set(i, at);
            for (const [name, attr] of sources) {
              const dst = baked[name] ??= [];
              if (name === 'position') {
                object.applyBoneTransform(i, v.fromBufferAttribute(attr, i)); object.localToWorld(v);
                dst.push(v.x, v.y, v.z);
              } else if (name === 'normal') {
                n.set(0, 0, 0); nb.fromBufferAttribute(attr, i);
                for (let k = 0; k < 4; k++) {   // the vertex shader's influence mix, with per-influence normal matrices (non-uniform bone scales)
                  const w = skinWeight.getComponent(i, k);
                  if (w) { m4.fromArray(boneMatrices, skinIndex.getComponent(i, k) * 16).multiply(object.bindMatrix); n.addScaledVector(nt.copy(nb).applyMatrix3(nm.getNormalMatrix(m4)), w); }
                }
                n.normalize().transformDirection(object.bindMatrixInverse).transformDirection(object.matrixWorld);
                dst.push(n.x, n.y, n.z);
              } else for (let c = 0; c < attr.itemSize; c++) dst.push(attr.getComponent(i, c));
            }
            return at;
          };
          const triangles = (index ? index.count : position.count) / 3;
          for (let t = 0; t < triangles; t++) {
            let weight = 0;
            for (let k = 0; k < 3; k++) { const i = index ? index.getX(t * 3 + k) : t * 3 + k; for (let j = 0; j < 4; j++) if (skinIndex.getComponent(i, j) === headIndex) weight += skinWeight.getComponent(i, j); }
            if (weight / 3 < .5) continue;   // keep triangles the Head bone dominates: skull, scalp, helm — not the neck blend
            for (let k = 0; k < 3; k++) kept.push(vertex(index ? index.getX(t * 3 + k) : t * 3 + k));
          }
          if (!kept.length) return;
          const head = new BufferGeometry();
          for (const [name, attr] of sources) head.setAttribute(name, new BufferAttribute(new Float32Array(baked[name]), attr.itemSize));
          head.setIndex(kept);
          const prop = new Mesh(head, object.material);
          prop.castShadow = true; prop.frustumCulled = false;
          group.add(prop);
        });
        const box = new Box3().setFromObject(group), size = box.getSize(new Vector3()), center = box.getCenter(new Vector3());
        for (const prop of group.children) if (prop instanceof Mesh) prop.geometry.translate(-center.x, -center.y, -center.z);
        group.position.copy(center);
        bone.scale.setScalar(.0001);   // no clip tracks bone scale, so the collapse holds; the neck-blend smear hides under the sever burst
        return { group, radius: Math.max(.07, Math.min(.24, Math.max(size.x, size.z) * .38)) };
      },
      // A fresh match (rematch): the rig grows its head back; the caller has already disposed the world-parented prop.
      unsever() {
        opened?.dispose(); opened = undefined; root.visible = true;
        crown?.dispose(); crown = undefined;
        if (!severed) return;
        severed = false;
        root.getObjectByName('Head')?.scale.setScalar(1);
      },
      // Bake during loading/reset, keeping the one-time mesh work outside the killing frame.
      prepareOpened() {
        if (opened) return;
        const saved = ROLES.map(role => ({role, time:actions[role].time, weight:actions[role].getEffectiveWeight()}));
        const shown = [blade.visible,sheathed?.visible], position = root.position.clone(), rotation = root.quaternion.clone();
        for (const role of ROLES) actions[role].setEffectiveWeight(Number(role === 'Death_SplitCrown'));
        actions.Death_SplitCrown.time = clips.Death_SplitCrown.duration * .045;
        mixer.update(0); root.visible = true; root.position.set(0,0,0); root.quaternion.identity();
        blade.visible = true; if (sheathed) sheathed.visible = false;
        opened = openWaist(root, anchor); opened.group.visible = false;
        for (const state of saved) { actions[state.role].time = state.time; actions[state.role].setEffectiveWeight(state.weight); }
        mixer.update(0); root.position.copy(position); root.quaternion.copy(rotation);
        blade.visible = shown[0]!; if (sheathed) sheathed.visible = shown[1]!;
      },
      // Both the intact rig and the cached pieces follow the same presentation clock; modes can change mid-finish.
      openWaist(progress: number, mode: 'red' | 'dark' | 'off') {
        if (progress < .045) return;
        if (!opened && mode !== 'off') this.prepareOpened();
        if (!opened) return;
        if (mode !== 'off' && !opened.group.parent) anchor.add(opened.group);
        opened.group.visible = mode !== 'off'; root.visible = mode === 'off';
        opened.update(progress, mode === 'dark', spectralLife);
      },
      // Skull-only split, owner 2026-09-19. Reuse the proven head bake; keep the halves attached through the collapse.
      splitCrown(progress: number, mode: 'red' | 'dark' | 'off') {
        const bone = root.getObjectByName('Head');
        if (!bone || progress < .045) return;
        if (!crown && mode !== 'off') {
          root.updateWorldMatrix(true, true);
          root.updateMatrixWorld(true);   // SkinnedMesh refreshes bindMatrixInverse here, including before the first render
          const inverse = bone.matrixWorld.clone().invert(), head = this.sever();
          if (!head) return;
          const transform = inverse.multiply(new Matrix4().makeTranslation(head.group.position.x, head.group.position.y, head.group.position.z));
          for (const part of head.group.children) if (part instanceof Mesh) part.geometry.applyMatrix4(transform);
          head.group.position.set(0, 0, 0);
          crown = splitSkull(head.group);
          head.group.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); });
          bone.parent!.add(crown.group);
        }
        if (!crown) return;
        crown.group.position.copy(bone.position); crown.group.quaternion.copy(bone.quaternion);
        crown.group.visible = mode !== 'off'; bone.scale.setScalar(mode === 'off' ? 1 : .0001);
        const t = Math.min(1, (progress - .045) / .12);
        crown.open(t*t*(3 - 2*t), mode === 'dark');
      },
      // Apply after both rigs and their scene transforms update. Put the MIDDLE of the blade through the chest,
      // not the shoulder→tip ray. A grounded presentation step supplies reach without stretching bones or the weapon.
      aimBladeAt(target: Vector3, amount = 1) {
        const upper = upperArm;
        if (!upper?.parent || amount <= 0) return;
        root.updateWorldMatrix(true, true);
        const parent = upper.parent, shoulder = upper.getWorldPosition(new Vector3());
        const embedded = blade.localToWorld(new Vector3(0, (segment[0] + segment[1]) / 2, 0));
        const from = parent.worldToLocal(embedded).sub(upper.position);
        let to = parent.worldToLocal(target.clone()).sub(upper.position);
        const forward = target.clone().sub(shoulder).setY(0).normalize();
        const axis = parent.worldToLocal(shoulder.clone().add(forward)).sub(upper.position);
        // Solve |to - step * axis| = |from| in the shoulder's parent frame (rig bones have nonuniform scales).
        const a = axis.lengthSq(), b = to.dot(axis), discriminant = b*b - a*(to.lengthSq() - from.lengthSq());
        if (a < 1e-8 || discriminant < 0) return;
        const step = (b - Math.sqrt(discriminant)) / a;
        const position = anchor.getWorldPosition(new Vector3()).addScaledVector(forward, step * amount);
        anchor.position.copy(anchor.parent ? anchor.parent.worldToLocal(position) : position);
        root.updateWorldMatrix(true, true);
        to = parent.worldToLocal(target.clone()).sub(upper.position);
        const turn = new Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
        aimedRotation = upper.quaternion.clone();
        upper.quaternion.premultiply(new Quaternion().slerp(turn, amount));
        root.updateWorldMatrix(true, true);
      },
      // The world position of a named bone right now (the scene takes the victim's chest with it).
      boneWorld(name: string): Vector3 | null { const bone = root.getObjectByName(name); if (!bone) return null; root.updateWorldMatrix(true, true); return bone.getWorldPosition(new Vector3()); }
    };
  }
  return { player: create(false), opponent: create(true) };
}
