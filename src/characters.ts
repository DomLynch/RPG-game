import { spectralAppearance } from './spectral.ts';
import { swingProgress } from './blade.ts';
export { swingProgress } from './blade.ts';
import { attackSpecs, type Attack, type Practice } from './combat.ts';
import type { Direction, WeaponId } from './moves.ts';
import { movesOf, type Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { AnimationMixer, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, Object3D, SkinnedMesh, BufferGeometry, BufferAttribute, DoubleSide, Vector3, Quaternion, Matrix3, Matrix4, Box3, LoopOnce, type AnimationAction, type AnimationClip, type BufferAttribute as BufferAttributeType, Skeleton } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { budgetTextures, FIGHTER_TEXTURE_CAP, phoneTier } from './quality.ts';
import { splitSkull } from './skull.ts';
import { openWaist } from './opened.ts';

export const COMBAT_CLIPS = ['Armed', 'Attack', 'Hit', 'Death', 'Draw', 'Roll', 'Guard', 'Return', 'Heavy', 'Riposte', 'ArmedWalk', 'StrafeLeft', 'StrafeRight', 'Kick', 'BlockImpact', 'Parry', 'Deflected'] as const;
export const CLIPS = ['Idle', 'Walk', 'Jog', 'Run'] as const;
// Finisher clips are additive (owner-authorized 2026-09-17): the 21 contract clips above stay frozen, Death_* variants append after them.
export const FINISHER_CLIPS = ['Death_SplitCrown', 'Death_RunThrough', 'Fin_RunThrough', 'Death_QuietOne'] as const;
// Clips only the player's rig (warrior.glb) carries: the SKILL casts (docs/briefs/skill-witch-arm.md). Opponents never cast, so
// their rigs are the hero's clip set without these.
export const PLAYER_ONLY_CLIPS: readonly string[] = ['Skill_WitchArm'];
// The renderer plays roles, never clip positions. The sword's roles are its clip names (the shipped warrior.glb set) plus Thrust: the
// sword thrusts with its Riposte clip. Each weapon maps roles to its own clips; an unlisted role plays the clip of its own name (the
// body clips are shared, and a two-handed weapon's fighter starts armed, so Draw never plays for him).
export type Role = (typeof CLIPS)[number] | (typeof COMBAT_CLIPS)[number] | (typeof FINISHER_CLIPS)[number] | 'Thrust';
export const ROLES: readonly Role[] = [...CLIPS, ...COMBAT_CLIPS, ...FINISHER_CLIPS, 'Thrust'];
export const WEAPON_CLIPS: Record<WeaponId, Partial<Record<Role, string>>> = {
  maul: { Idle: 'Maul_Idle', Walk: 'Maul_Walk', Jog: 'Maul_Walk', Run: 'Maul_Walk', Armed: 'Maul_Idle', ArmedWalk: 'Maul_Walk', StrafeLeft: 'Maul_StrafeLeft', StrafeRight: 'Maul_StrafeRight', Attack: 'Maul_Slash', Return: 'Maul_Slash', Heavy: 'Maul_Heavy', Thrust: 'Maul_Thrust', Riposte: 'Maul_Thrust', Guard: 'Maul_Guard', BlockImpact: 'Maul_Guard', Parry: 'Maul_Guard', Deflected: 'Maul_Hit', Hit: 'Maul_Hit', Death: 'Maul_Death' },   // Kick and Roll fall back to the shared clips (the warhammer's convention): the hero rig's Maul_* family (2026-09-23) has neither, and the held Minotaur carries plain Kick/Roll too
  reaper: { Idle: 'Reaper_Idle', Walk: 'Reaper_Walk', Jog: 'Reaper_Walk', Run: 'Reaper_Walk', Armed: 'Reaper_Idle', ArmedWalk: 'Reaper_Walk', StrafeLeft: 'Reaper_StrafeLeft', StrafeRight: 'Reaper_StrafeRight', Attack: 'Reaper_Slash', Return: 'Reaper_Slash', Heavy: 'Reaper_Heavy', Thrust: 'Reaper_Thrust', Riposte: 'Reaper_Thrust', Guard: 'Reaper_Guard', BlockImpact: 'Reaper_Guard', Parry: 'Reaper_Guard', Deflected: 'Reaper_Hit', Hit: 'Reaper_Hit', Death: 'Reaper_Death', Kick: 'Reaper_Kick', Roll: 'Reaper_Roll' },
  longsword: { Thrust: 'Riposte' },
  cleaver: { Thrust: 'Riposte' },   // the Pitborn's, on the sword clip family until the weapons lane lands its own
  knife: { Thrust: 'Riposte' },   // the goblin's, on the sword clip family until the weapons lane lands its own
  estoc: { Thrust: 'Riposte' },   // the Nightborn's, likewise
  gladius: { Thrust: 'Riposte' },   // the Centurion's: the sword family, zero clips (Strategy, 2026-09-23)
  scythe: { Idle: 'Scythe_Idle', Walk: 'Scythe_Walk', Jog: 'Scythe_Walk', Run: 'Scythe_Walk', Armed: 'Scythe_Idle', ArmedWalk: 'Scythe_Walk', StrafeLeft: 'Scythe_StrafeLeft', StrafeRight: 'Scythe_StrafeRight', Attack: 'Scythe_Reap', Return: 'Scythe_Reap', Heavy: 'Scythe_High', Thrust: 'Scythe_Thrust', Riposte: 'Scythe_Chain', Guard: 'Scythe_Guard', BlockImpact: 'Scythe_BlockImpact', Parry: 'Scythe_BlockImpact', Deflected: 'Scythe_Deflected', Hit: 'Scythe_Hit', Death: 'Scythe_Death' },   // the Executioner's, LIVE 2026-09-18 (the weapons lane's 13-clip family); one reap clip cuts both ways, and a shaft has no blade to turn, so a parry shows the block. The gait roles too — an unlisted role falls back to the SWORD's clip of that name, and the warden's pre-fight stand/walk read as a one-handed sword hold with the scythe mounted (owner review 2026-09-19: "arms behind his back"); a two-handed weapon has no jog/run of its own, the walk carries all gaits
  // One sweep clip cuts both ways (the sim's path is the same either side); no parry clip: a shaft has no blade to turn, so a parry shows the block.
  // The Dwarf's warhammer (weapons lane shelf, 2026-09-20): the maul's role map on the humanoid Warhammer_* family; Kick and Roll fall
  // back to the sword family's (both hands leave the haft there, as the char lane's grip check allows).
  warhammer: { Idle: 'Warhammer_Idle', Walk: 'Warhammer_Walk', Jog: 'Warhammer_Walk', Run: 'Warhammer_Walk', Armed: 'Warhammer_Idle', ArmedWalk: 'Warhammer_Walk', StrafeLeft: 'Warhammer_StrafeLeft', StrafeRight: 'Warhammer_StrafeRight', Attack: 'Warhammer_Slash', Return: 'Warhammer_Slash', Heavy: 'Warhammer_Heavy', Thrust: 'Warhammer_Thrust', Riposte: 'Warhammer_Thrust', Guard: 'Warhammer_Guard', BlockImpact: 'Warhammer_BlockImpact', Parry: 'Warhammer_Guard', Deflected: 'Warhammer_Deflected', Hit: 'Warhammer_Hit', Death: 'Warhammer_Death' },
  trident: { Idle: 'Trident_Idle', Walk: 'Trident_Walk', Jog: 'Trident_Walk', Run: 'Trident_Walk', Armed: 'Trident_Idle', ArmedWalk: 'Trident_Walk', StrafeLeft: 'Trident_StrafeLeft', StrafeRight: 'Trident_StrafeRight', Attack: 'Trident_Sweep', Return: 'Trident_Sweep', Heavy: 'Trident_High', Thrust: 'Trident_Thrust', Riposte: 'Trident_ThrustChain', Guard: 'Trident_Guard', BlockImpact: 'Trident_BlockImpact', Parry: 'Trident_BlockImpact', Deflected: 'Trident_Deflected', Hit: 'Trident_Hit', Death: 'Trident_Death' },   // the gait roles as on the scythe: unlisted falls back to the sword family, wrong for a two-handed pole
};
export const clipFor = (weapon: WeaponId, role: Role): string => WEAPON_CLIPS[weapon][role] ?? role;
// Every weapon starts sheathed (#741). The one-hand weapons play the hero's hip `Draw` on the draw beat; the pole families have no
// draw of their own yet and a hip mime with a pole reads wrong, so they hold their armed idle and raise straight to ready (Strategy,
// 2026-09-25). Authored `<Family>_Draw` clips are the follow-up PR.
export const NO_HIP_DRAW: readonly WeaponId[] = ['trident', 'scythe', 'warhammer', 'maul'];
export const drawRole = (weapon: WeaponId): Role | null => NO_HIP_DRAW.includes(weapon) ? null : 'Draw';
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

// Every Deflected clip opens on the attack's contact pose — identical to a blocked blow — and is thrown widest by its .35 key (build-warrior.mjs,
// build-weapon.mjs). Starting there puts the lost line on the impact frame; the clip's tail still recovers to the rest grip.
export const DEFLECT_FROM = .35;
// Presentation follows confirmed contact; a new action or defeat immediately takes precedence.
export function defenceReaction(s: Practice, opponent=false): {pose:'block'|'parry'|'deflected';progress:number} | undefined {
  if (!s.health || !s.playerHealth) return;
  // A broken guard is flung open (the Deflected pose, whatever phase the stagger left him in) instead of reading as a plain hit (SCOPE 7, pick C).
  if (s.result === (opponent ? 'enemyBroken' : 'broken') && s.resultAge < 36) return { pose: 'deflected', progress: s.resultAge / 36 };
  if(opponent ? !s.reaction && s.enemyMode!=='guard' : s.phase!=='ready' && s.phase!=='guard') return;
  const pose=opponent ? s.result==='enemyBlocked' ? 'block' : s.result==='parried' ? 'deflected' : undefined : s.result==='blocked' ? 'block' : s.result==='parried' ? 'parry' : undefined;
  const duration=pose==='deflected' ? 36 : pose==='parry' ? 18 : 12;
  if(pose && s.resultAge<duration) return {pose,progress:s.resultAge/duration};
}

type FighterAsset = { scene: Group; animations: AnimationClip[] };
// One fighter GLB: the same rig, clip names and sword attachments as every other (blade paths are baked once).
// A dropped connection is not a broken rig. Safari reports a failed fetch as `TypeError: Load failed` (Chrome: `Failed to fetch`),
// and a 5 MB fighter on a phone drops now and then (Sentry FRANKENDOM-6: nine sessions in five days, every release). Such a
// failure is retried with a short back-off before the game gives up on the art; a rig that parses but is wrong is not retried.
export const transientLoadError = (error: unknown): boolean => error instanceof TypeError || /Load failed|Failed to fetch|NetworkError|network error|ERR_(NETWORK|CONNECTION|INTERNET)/i.test(String((error as { message?: string })?.message ?? error));
export async function retryTransient<T>(attempt: () => Promise<T>, attempts = 3, delayMs = 800, sleep: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms))): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await attempt(); }
    catch (error) { if (i >= attempts || !transientLoadError(error)) throw error; await sleep(delayMs * i); }
  }
}
async function loadFighter(url: string) {
  const asset = await retryTransient(() => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url));
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
// `equipUrl`: the player's weapon's equip file (none for the longsword, which warrior.glb carries). A file that fails to load or fit is
// reported and the player's rig falls back to the longsword, so a weapon never costs the fight its art; `playerWeapon` says which the
// rig carries, and the entry point fights with that one (drawn = simulated).
export async function loadWarriors(url: string, opponentUrl = url, weapons: [WeaponId, WeaponId] = ['longsword', 'longsword'], equipUrl?: string, equipFailed: (error: unknown) => void = () => {}) {
  const [hero, enemy, part] = await Promise.all([
    loadFighter(url),
    opponentUrl === url ? undefined : loadFighter(opponentUrl),
    equipUrl ? loadEquip(equipUrl).catch((error: unknown) => (error instanceof Error ? error : Error(String(error)))) : undefined,
  ]);
  return armWarriors(hero, enemy, weapons, part, equipFailed);
}
// The warriors with the player's weapon in hand. `part`: none for the longsword, the equip file, or the Error its load threw. A failed
// load or a file that does not fit is reported and the rig carries the longsword instead; `playerWeapon` names the one it carries.
export function armWarriors(hero: FighterAsset, enemy: FighterAsset | undefined, weapons: [WeaponId, WeaponId], part?: FighterAsset | Error, equipFailed: (error: unknown) => void = () => {}) {
  if (part && !(part instanceof Error)) try { return { ...buildWarriors(equipWeapon(hero, part), enemy, weapons), playerWeapon: weapons[0] }; } catch (error) { part = error instanceof Error ? error : Error(String(error)); }
  if (part) equipFailed(part);
  const playerWeapon: WeaponId = part ? 'longsword' : weapons[0];
  return { ...buildWarriors(hero, enemy, [playerWeapon, weapons[1]]), playerWeapon };
}
// A player weapon's equip file (scripts/build-player-weapon.mjs, the #309 contract): its WeaponDrawn part, placed under hand_r exactly as
// the hero build places it, and the weapon's own clip family when it has one. Nothing of the body.
async function loadEquip(url: string): Promise<FighterAsset> {
  const asset = await retryTransient(() => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url));
  if (phoneTier()) budgetTextures(asset.scene, FIGHTER_TEXTURE_CAP);
  return asset;
}
// The hero rig with the equip file's weapon in place of the sword pair (a WeaponDrawn is always in hand: no sheath), and the file's clips
// played over warrior.glb's same-named ones. A copy: the loaded rig stays whole for the longsword fallback.
export function equipWeapon(hero: FighterAsset, part: FighterAsset): FighterAsset {
  const scene = clone(hero.scene) as Group, hand = scene.getObjectByName('hand_r'), weapon = part.scene.getObjectByName('WeaponDrawn');
  if (!hand || !weapon) throw new Error('Equip file has no WeaponDrawn, or the rig no hand_r');
  for (const name of ['SwordSheathed', 'SwordDrawn']) scene.getObjectByName(name)?.removeFromParent();
  hand.add(weapon.clone());
  const own = new Set(part.animations.map(clip => clip.name));
  return { scene, animations: [...part.animations, ...hero.animations.filter(clip => !own.has(clip.name))] };
}
// Loot (brief 5): the pieces of loot.glb, skinned to the hero rig with warrior.glb's bind (build-warrior.mjs WARRIOR_LOOT). Fetched on its own,
// after the rigs, never as part of a fight's load; the player's actor wears the pieces (`wear`) once both are in. Each draw's userData names
// its opponent, slot and layer; its id is `<opponent>.<slot>` (src/loot.ts).
export async function loadLoot(url: string): Promise<SkinnedMesh[]> {
  const asset = await retryTransient(() => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url));
  if (phoneTier()) budgetTextures(asset.scene, FIGHTER_TEXTURE_CAP);
  return lootPiecesOf(asset.scene);
}
// The pieces of a parsed loot.glb, each carrying every id it answers to. One function so the game and its tests read the file the same
// way — the last time this traversal was written twice, a shared draw resolved in one and not the other.
//
// Shared draws (brief 14): a piece the whole roster wears is exported ONCE, named `~<id>`, and the file's own map says which
// `<opponent>.<slot>` resolve to it. Read the map off whichever node carries it — three's GLTFExporter puts a root Object3D's userData
// on that object's NODE, not on the glTF scene. A draw with no entry answers to its own name exactly as before, so an old-style file
// and a new one both load and the loader never has to land in the same PR as the asset.
export function lootPiecesOf(scene: Object3D): SkinnedMesh[] {
  const pieces: SkinnedMesh[] = [];
  let map: Record<string, string> = {};
  scene.traverse(object => {
    if (object instanceof SkinnedMesh && typeof object.userData.slot === 'string') pieces.push(object);
    const carried = object.userData?.pieces as Record<string, string> | undefined; if (carried) map = { ...map, ...carried };
  });
  if (!pieces.length) throw new Error('loot.glb carries no pieces');
  for (const piece of pieces) {
    const own = `${piece.userData.opponent}.${piece.userData.slot}`;
    const shared = Object.entries(map).filter(([, target]) => target === own).map(([ref]) => ref);
    piece.userData.ids = shared.length ? shared : [own];
  }
  return pieces;
}
export const lootId = (piece: SkinnedMesh): string => `${piece.userData.opponent}.${piece.userData.slot}`;
// Strategy's ruling C (#705, 2026-09-25): a worn piece keeps the finish it had on the opponent it came from, on every wearer. `wear` swaps a
// piece's mapless palette material for the wearer's same-named mapped one only where the SOURCE opponent's rig maps that name too, so the
// hero resolves a Knight piece exactly as the Knight does (his rig has no mapped Steel: the carrier's own Steel, ungraded).
// Nothing is graded: not the hero's pieces, not an opponent's kit. Each rig's mapped loot-palette names; tests/grade-materials.test.ts reads them from the GLBs.
export const SOURCE_MAPPED: Partial<Record<OpponentId, readonly string[]>> = {
  dwarf: ['Steel', 'Leather'], executioner: ['Leather'], goblin: ['Steel', 'Leather', 'Heraldry', 'Gambeson', 'Wrap'], knight: ['Leather'],
  nightborn: ['Steel', 'Leather', 'Heraldry', 'Gambeson', 'Wrap'], pitborn: ['Steel', 'Leather', 'Heraldry', 'Gambeson', 'Wrap'], plaguedoctor: [],
  shieldmaiden: ['Steel', 'Leather', 'Heraldry', 'Gambeson', 'Wrap'], veteran: ['Bronze'], witch: [],
};
// Every id a piece answers to: one for an ordinary draw, several for a shared one.
export const lootIds = (piece: SkinnedMesh): string[] => (piece.userData.ids as string[] | undefined) ?? [lootId(piece)];
export const lootWorn = (piece: SkinnedMesh, worn: readonly string[]): boolean => lootIds(piece).some(id => worn.includes(id));
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
// Per side: torso yaw (spine_01.y), sword-arm pitch (upperarm_r.x) and chest pitch (spine_02.x), radians, added to the Guard clip's frame.
export const GUARD_TILT: Record<Direction, { yaw: number; arm: number; spine: number }> = {
  thrust: { yaw: 0, arm: 0, spine: 0 }, left: { yaw: .45, arm: 0, spine: 0 }, right: { yaw: -.45, arm: 0, spine: 0 },
  overhead: { yaw: 0, arm: -.5, spine: -.25 }, low: { yaw: 0, arm: .5, spine: .25 },
};
// Charged-heavy lean (Strategy 2026-09-24, mockup B "Lean-out"): from the chase camera the player's own body covers the middle of the
// opponent, so a held heavy read as a plain one. While the swing is parked at its chamber the whole upper body leans out to the side, clear
// of the player's silhouette, the weapon arm lifting the head of the weapon skyward. Added after the mixer like the guard tilt (radians:
// spine_01 yaw and side-bend, spine_02 side-bend, upperarm_r lift), eased in over the hold and out through the swing. Presentation only.
export type ChargeLean = { yaw: number; side: number; chest: number; arm: number; lift?: number };   // lift: upperarm_r pitch, negative raises the arm
const NO_LEAN: ChargeLean = { yaw: 0, side: 0, chest: 0, arm: 0 };
// One entry per active opponent, fitted on the roster sheet (held heavy at 375x812, the player guarding). Tall rigs share the Witch's lean;
// the Dwarf sits under the player's shoulder, so he bends further and twists the other way to bring the hammer head up clear. The Goblin is
// too short for any lean to clear the player (LEAN_LOW hid his knife behind the left shoulder, Strategy 2026-09-24): he leans the other way
// and throws the knife arm straight up, so the hooked blade stands above the player's right shoulder.
const LEAN_OUT: ChargeLean = { yaw: .25, side: .55, chest: .25, arm: .55 }, LEAN_LOW: ChargeLean = { yaw: -.5, side: .9, chest: .35, arm: .3 };
const LEAN_HIGH: ChargeLean = { yaw: .4, side: -.7, chest: -.3, arm: 1, lift: -1.6 };
export const CHARGE_LEAN: Partial<Record<OpponentId, ChargeLean>> = {
  veteran: LEAN_OUT, pitborn: LEAN_OUT, nightborn: LEAN_OUT, executioner: LEAN_OUT, plaguedoctor: LEAN_OUT, knight: LEAN_OUT, witch: LEAN_OUT,
  shieldmaiden: LEAN_OUT, dwarf: LEAN_LOW, goblin: LEAN_HIGH,
};
// A charging swing parked at its chamber (duel.ts rewinds age to the chamber while held); false from the tick it is released.
export function holdingCharge(f: Pick<Fighter, 'phase' | 'move' | 'charge' | 'age' | 'weapon'>): boolean {
  if (f.phase !== 'attack' || !f.move || f.charge <= 0) return false;
  const move = movesOf(f)[f.move];
  return move.charges && move.chamber !== null && f.age <= move.chamber;
}
// A shield's face is a single-sided disc (loot.glb `~kit.Shield.Leather`: every normal and triangle faces bind +Z), so from behind (most
// angles on the arm) it was culled and only the rim torus drew, a hoop (owner's iPhone, 2026-09-23 15:21). Shield draws render both sides,
// on their own copy of the material they were given, so the rig's own Leather/brass on his body stays front-sided.
const twoSided = new WeakMap<MeshStandardMaterial, MeshStandardMaterial>();
function bothSides(material: MeshStandardMaterial): MeshStandardMaterial {
  let copy = twoSided.get(material);
  if (!copy) {
    copy = material.clone(); copy.side = DoubleSide;
    // clone() copies userData (so a lighting pass's "already patched" mark) but not the shader hooks it installed: carry them over, whatever they are.
    copy.onBeforeCompile = material.onBeforeCompile; copy.customProgramCacheKey = material.customProgramCacheKey;
    twoSided.set(material, copy);
  }
  return copy;
}
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
    const worn: SkinnedMesh[] = [], covered = new Map<Mesh, boolean>();   // loot pieces on this rig, and the rig's own draws they hide (with their visibility before)
    const spectral = spectralAppearance(root);
    let spectralLife = 1;
    const mixer = new AnimationMixer(root);
    const actions = {} as Record<Role, AnimationAction>;
    for (const role of ROLES) { actions[role] = mixer.clipAction(clips[role]).play(); actions[role].setEffectiveWeight(role === 'Idle' ? 1 : 0); }
    // The weapon on the rig: a WeaponDrawn node (a two-handed weapon, always in hand: no sheathed/drawn swap) or the sword's two nodes.
    // The trail follows the striking part: the node's own contact segment (extras.contact, metres along its Y) or the sword's blade.
    const weaponNode = root.getObjectByName('WeaponDrawn'), sheathed = root.getObjectByName('SwordSheathed'), drawn = root.getObjectByName('SwordDrawn');
    if (!weaponNode && !(sheathed && drawn)) throw new Error('Warrior weapon attachments are missing');
    const blade = (weaponNode?.userData.contactNode ? root.getObjectByName(weaponNode.userData.contactNode) : weaponNode) ?? drawn!, contactSegment = blade?.userData.contact as { from: number; to: number } | undefined, segment = contactSegment ? [contactSegment.from, contactSegment.to] : [.24, .85];
    for (const role of ONE_SHOT) { const action = actions[role]; action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.paused = true; }
    if (opponent) actions.Idle.time = clips.Idle.duration * 0.4;
    mixer.update(0);
    const ribbon = new BufferGeometry(), ribbonVertices = new Float32Array(6 * 6 * 3);
    ribbon.setAttribute('position', new BufferAttribute(ribbonVertices, 3));
    const trail = new Mesh(ribbon, new MeshBasicMaterial({ color: '#e8dfc8', transparent: true, opacity: .12, side: DoubleSide, depthWrite: false }));
    trail.name = 'WeaponTrail'; trail.frustumCulled = false; trail.visible = false; anchor.add(trail);   // named: the Witch-fire hides it (witchfire.ts)
    const samples: Vector3[][] = [];
    const contactByClip = weaponNode?.userData.contactByClip as Record<string, { from: number; to: number }> | undefined;
    const upperArm = root.getObjectByName('upperarm_r');
    let aimedRotation: Quaternion | undefined;
    const offHand = ['upperarm_l', 'lowerarm_l', 'hand_l'].map(n => root.getObjectByName(n)), swordHand = root.getObjectByName('hand_r');
    let aimedOffHand: [Quaternion, Quaternion] | undefined;
    // Guard side (owner 2026-09-20, five sides): the one Guard clip is the straight guard; a side tilts it after the mixer writes the
    // frame — the torso turns to that side, the sword arm lifts or drops. Measured on the warrior rig from the Guard pose (blade tip
    // relative to the pelvis, the fighter's right = −x): left +.14 m across, right −.23 m, overhead +.35 m up, low −.37 m down. Code-
    // tilted for the beta; the weapons lane replaces it with authored guard clips family by family. Blended so a slide never snaps.
    const spine1 = root.getObjectByName('spine_01'), spine2 = root.getObjectByName('spine_02');
    const tilt = { yaw: 0, arm: 0, spine: 0 }, tilted = [spine1, spine2, upperArm].filter((b): b is NonNullable<typeof b> => !!b), untilted = tilted.map(b => b.quaternion.clone());
    let leaning = 0, leanDrive = 0;   // the charged-heavy lean's weight, 0..1, and the ease that drives it
    let tiltApplied = false;   // the mixer rewrites a bone only when its clip value changes (a held guard's does not), so the tilt is undone by hand before every update
    let speed = 0;
    let severed = false;   // decapitation is once per kill; unsever() resets on rematch
    let crown: ReturnType<typeof splitSkull> | undefined;
    return {
      anchor,
      // Wear these loot pieces (loadLoot) and nothing else: each is bound to this rig's skeleton beside his own body draw, so it follows every
      // clip; a `replace` piece hides his own draws in that slot (a helmet hides hair too); an `over` piece sits on top of them. A piece's
      // mapless palette material is swapped for his material of the same name (Steel, Leather, Heraldry, Gambeson) where the piece's source rig
      // maps that name too (SOURCE_MAPPED, ruling C); the rest keep their own.
      // One bad piece never undresses the rest: each is dressed on its own, and a piece that throws is skipped (its slot stays his own),
      // warned and handed to `failed` with its id; only a rig with no body to hang anything on throws.
      // Nothing is graded (Strategy's ruling C, #705): a piece looks the same at every rung, on every wearer, and his own draws are never touched.
      wear(pieces: readonly SkinnedMesh[], failed: (id: string, error: unknown) => void = () => {}) {
        for (const piece of worn) piece.removeFromParent(); worn.length = 0;
        for (const [draw, visible] of covered) draw.visible = visible; covered.clear();
        let body: SkinnedMesh | undefined; const materials = new Map<string, MeshStandardMaterial>();
        root.traverse(object => {
          if (!(object instanceof Mesh)) return;
          // A creature-pipeline body (Veteran, Dwarf, Executioner) is one untagged `CreatureBody` draw on the same skeleton; its Body slot names empty nodes.
          if (object instanceof SkinnedMesh && (object.userData.slot === 'Body' || object.name === 'CreatureBody') && !body) body = object;
          if (object.material instanceof MeshStandardMaterial && object.material.name && object.material.map) materials.set(object.material.name, object.material);
        });
        if (!body) throw new Error('The rig has no Body draw to hang loot on');
        // The rig's bones with the PIECE's own inverse binds (#606): every loot.glb draw is authored on the hero's bind pose, so on a
        // re-proportioned body it must follow his joints — with the rig's own inverse binds the Dwarf's gloves hung above his head. On the
        // hero they are identical, so he keeps his own skeleton; elsewhere one retargeted skeleton per source skin.
        const retargeted = new Map<Skeleton, Skeleton>(), rig = body.skeleton;
        const skeletonFor = (source: Skeleton): Skeleton => {
          let skeleton = retargeted.get(source);
          if (!skeleton) retargeted.set(source, (skeleton = source.boneInverses.length === rig.boneInverses.length && source.boneInverses.every((m, i) => m.equals(rig.boneInverses[i])) ? rig : new Skeleton(rig.bones, source.boneInverses)));
          return skeleton;
        };
        for (const piece of pieces) {
          try {
            const own = piece.material instanceof MeshStandardMaterial && SOURCE_MAPPED[piece.userData.opponent as OpponentId]?.includes(piece.material.name) ? materials.get(piece.material.name) ?? piece.material : piece.material;
            const material = piece.userData.slot === 'Shield' && own instanceof MeshStandardMaterial ? bothSides(own) : own;
            const copy = new SkinnedMesh(piece.geometry, material);
            copy.name = piece.name; copy.userData = { ...piece.userData }; copy.castShadow = copy.receiveShadow = true; copy.frustumCulled = false;
            copy.bind(piece.skeleton ? skeletonFor(piece.skeleton) : body.skeleton, body.bindMatrix);
            body.parent!.add(copy); worn.push(copy);
          } catch (error) {
            const id = lootId(piece); console.warn(`loot: ${id} (${piece.name}) could not be worn and was skipped`, error); failed(id, error);
          }
        }
        const slots = new Set(worn.filter(p => p.userData.layer === 'replace').map(p => String(p.userData.slot)));
        if (slots.has('Helmet')) slots.add('Hair');
        root.traverse(object => { if (object instanceof Mesh && !worn.includes(object as SkinnedMesh) && slots.has(String(object.userData.slot))) { covered.set(object, object.visible); object.visible = false; } });
      },
      worn: (): readonly SkinnedMesh[] => worn,
      covered: (): readonly Mesh[] => [...covered.keys()],   // his own draws a `replace` piece hides (the debug probe asserts they stay hidden)
      // The clip carrying most of the pose right now and the node the weapon hangs from (the debug probe's word for what the rig is doing): `role:clip@node`.
      playing(): string { if (opened?.group.visible) return `Opened:WaistCut@${blade.name}`; let best: Role = 'Idle'; for (const role of ROLES) if (actions[role].getEffectiveWeight() > actions[best].getEffectiveWeight()) best = role; return `${best}:${clips[best].name}@${blade.name}`; },
      update(travelSpeed: number, dt: number, pose: 'sheathed' | 'draw' | 'ready' | 'attack' | 'hit' | 'death' | 'splitCrown' | 'decapitation' | 'runThrough' | 'runThroughHold' | 'quietOne' | 'opened' | 'roll' | 'guard' | 'kick' | 'block' | 'parry' | 'deflected' = 'sheathed', progress = 0, attack: Attack = 'light', contact = .35, lateral = 0, recoil = 0, guardSide: Direction | null = null, lean: ChargeLean | null = null, holding = false) {
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
        const combatRole: Role | null = pose === 'block' ? 'BlockImpact' : pose === 'parry' ? 'Parry' : pose === 'deflected' ? 'Deflected' : pose === 'kick' ? 'Kick' : pose === 'attack' ? attack === 'return' ? 'Return' : attack === 'heavy' ? 'Heavy' : attack === 'riposte' ? 'Riposte' : attack === 'thrust' ? 'Thrust' : 'Attack' : pose === 'hit' ? 'Hit' : pose === 'death' ? 'Death' : pose === 'splitCrown' || pose === 'decapitation' || pose === 'opened' ? 'Death_SplitCrown' : pose === 'runThrough' ? 'Death_RunThrough' : pose === 'quietOne' ? 'Death_QuietOne' : pose === 'runThroughHold' ? 'Fin_RunThrough' : pose === 'draw' ? drawRole(weapon) : pose === 'roll' ? 'Roll' : pose === 'guard' ? 'Guard' : null;
        const armed = pose !== 'sheathed';
        if (armed) { weights.Armed = weights.Idle; weights.Idle = 0; }
        const dead = pose === 'death' || pose === 'splitCrown' || pose === 'decapitation' || pose === 'runThrough' || pose === 'quietOne' || pose === 'opened';
        for (const role of ROLES) {
          const a = actions[role];
          const fade = pose === 'opened' ? Math.min(1,progress/.04) : combatRole === null ? 0 : ['draw','guard','block','parry','deflected','runThroughHold'].includes(pose) ? 1 : Math.min(1, progress * 12, dead ? 1 : (1 - progress) * 10);
          const target = (weights[role] || 0) * (1 - fade) + Number(role === combatRole) * fade;
          const activeBlade = pose === 'attack' && progress >= contact-1/specs[attack].recovery && progress <= contact+4/specs[attack].recovery;
          // A parried attacker is thrown off line on the impact tick itself (Strategy 2026-09-24: the parry's tell is the attacker, not a spark):
          // the weight snaps like a live blade does — the parry's hit-stop runs at dt 0, where an eased weight would hold the attack pose.
          a.setEffectiveWeight(pose === 'opened' ? target : activeBlade || pose === 'deflected' ? Number(role === combatRole) : a.getEffectiveWeight() + (target - a.getEffectiveWeight()) * (1 - Math.exp(-step * 24)));
          if (role === combatRole) a.time = Math.min(.999999, Math.max(0, pose === 'attack' ? swingProgress(progress, contact, specs[attack].source) : pose === 'deflected' ? DEFLECT_FROM + progress * (1 - DEFLECT_FROM) : progress)) * clips[role].duration;
        }
        if (!weaponNode) { drawn!.visible = armed && (pose !== 'draw' || progress >= .29); sheathed!.visible = !drawn!.visible; }
        anchor.position.set(0, 0, 0); // only the presentation anchor steps into a Run Through
        if (aimedRotation && upperArm) upperArm.quaternion.copy(aimedRotation);
        aimedRotation = undefined;
        if (aimedOffHand) { offHand[0]!.quaternion.copy(aimedOffHand[0]); offHand[1]!.quaternion.copy(aimedOffHand[1]); aimedOffHand = undefined; }
        if (tiltApplied) { tilted.forEach((b, i) => b.quaternion.copy(untilted[i])); tiltApplied = false; }
        mixer.update(step);
        const guarding = guardSide && (pose === 'guard' || pose === 'block' || pose === 'parry') ? GUARD_TILT[guardSide] : GUARD_TILT.thrust, ease = 1 - Math.exp(-step * 16);
        for (const k of ['yaw', 'arm', 'spine'] as const) tilt[k] += (guarding[k] - tilt[k]) * ease;
        // Two cascaded eases: the lean starts and stops at zero speed, so neither the hold nor the release pops.
        const follow = 1 - Math.exp(-step * 18);
        leanDrive += (Number(!!lean && holding) - leanDrive) * follow; leaning += (leanDrive - leaning) * follow;
        if (leaning < 1e-3 && leanDrive < 1e-3) leaning = leanDrive = 0;
        const l = lean ?? NO_LEAN;
        if (tilt.yaw || tilt.spine || tilt.arm || leaning) {
          tilted.forEach((b, i) => untilted[i].copy(b.quaternion)); tiltApplied = true;
          if (spine1) { spine1.rotation.y += tilt.yaw + leaning * l.yaw; spine1.rotation.z += leaning * l.side; }
          if (spine2) { spine2.rotation.x += tilt.spine; spine2.rotation.z += leaning * l.chest; }
          if (upperArm) { upperArm.rotation.x += tilt.arm + leaning * (l.lift ?? 0); upperArm.rotation.y += leaning * l.arm; }
        }
        spectralLife = spectral?.(step, dead, progress, pose === 'opened') ?? 1;
        root.rotation.z = pose === 'hit' ? Math.sin(Math.PI*Math.min(1,progress))*(attack === 'return' ? -.12 : .12) : recoil*.06;
        root.position.z = -Math.abs(recoil)*.045;
        // The enlarged Wraith lowers its attacking arm toward the original strike height.
        // Blend through wind-up/recovery; keep its body, grip and simulation untouched.
        if (spectral && weapon !== 'reaper' && upperArm?.parent && pose === 'attack') {
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
      // The opened-waist bake snapshots what he wears; a re-dress at a new tier (a rematch after a rank-up) bakes it again, between fights.
      rebakeOpened() { if (!opened) return; opened.dispose(); opened = undefined; this.prepareOpened(); },
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
        // The hold is two-handed (owner 2026-09-21): the clip closes the off-hand on the hilt, but the aim above turns only the sword
        // arm, so the fist was left hanging in the air by the face. Re-solve the left arm onto the grip a hand's width behind the
        // sword hand, keeping the clip's own elbow bend (two-bone reach; no bone or weapon stretches).
        const [upperL, lowerL, handL] = offHand;
        if (!upperL?.parent || !lowerL || !handL || !swordHand) return;
        const s = upperL.getWorldPosition(new Vector3()), e = lowerL.getWorldPosition(new Vector3()), h = handL.getWorldPosition(new Vector3());
        const pommelward = blade.localToWorld(new Vector3(0, -1, 0)).sub(blade.localToWorld(new Vector3())).normalize();
        const goal = swordHand.getWorldPosition(new Vector3()).addScaledVector(pommelward, .07);
        const a2 = s.distanceTo(e), b2 = e.distanceTo(h), dir = goal.clone().sub(s);
        const d = Math.max(.03, Math.min(dir.length(), a2 + b2 - .001)); dir.normalize();
        const along = (a2*a2 - b2*b2 + d*d) / (2*d), bend = e.clone().sub(s);
        bend.addScaledVector(dir, -bend.dot(dir)); if (bend.lengthSq() < 1e-6) return; bend.normalize();
        const elbow = s.clone().addScaledVector(dir, along).addScaledVector(bend, Math.sqrt(Math.max(0, a2*a2 - along*along)));
        aimedOffHand = [upperL.quaternion.clone(), lowerL.quaternion.clone()];
        for (const [bone, child, dest] of [[upperL, lowerL, elbow], [lowerL, handL, goal]] as const) {
          root.updateWorldMatrix(true, true);
          const origin = bone.getWorldPosition(new Vector3());
          const delta = new Quaternion().setFromUnitVectors(child.getWorldPosition(new Vector3()).sub(origin).normalize(), dest.clone().sub(origin).normalize());
          bone.quaternion.copy(bone.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(new Quaternion().slerp(delta, amount)).multiply(bone.getWorldQuaternion(new Quaternion())));
        }
        root.updateWorldMatrix(true, true);
      },
      // The world position of a named bone right now (the scene takes the victim's chest with it).
      boneWorld(name: string): Vector3 | null { const bone = root.getObjectByName(name); if (!bone) return null; root.updateWorldMatrix(true, true); return bone.getWorldPosition(new Vector3()); }
    };
  }
  return { player: create(false), opponent: create(true) };
}
