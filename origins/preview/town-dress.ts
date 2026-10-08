// Townspeople (Town plan rows A1 / A8): ONE body, a choice of worn pieces, a tint. The body is the warrior world body (public/world/warrior.glb: Idle, Walk, the 65-bone
// rig); the pieces are the garment nodes of public/world/town/clothes.glb (`Cloth_<piece>`, scripts/character/town_clothes.py), skinned onto the BODY's own bones by
// bone name, so they play the body's clips with no new rig; the clothes file also carries the one clip the body lacks, `Talk`. Presentation only: the sim never sees it.
// Donor: the EQEmu / 2004Scape equipment-appearance idea (an NPC is a body model plus worn pieces and colours, not a model per role).
import { Bone, Color, Material, Mesh, Skeleton, SkinnedMesh, type AnimationClip, type MeshStandardMaterial, type Object3D } from 'three';

export const CLOTH_PIECES = ['robe', 'tunic', 'sleeves', 'belt', 'cap', 'apron', 'hat', 'hood'] as const;
export type ClothPiece = (typeof CLOTH_PIECES)[number];
export type Outfit = { readonly pieces: readonly ClothPiece[]; readonly tint: number };

/** The banker (Backend's row `character:banker-exchange`, `roles: ['banker']`): robe, sleeves, belt and cap, in a deep green wash. */
export const BANKER_OUTFIT: Outfit = { pieces: ['robe', 'sleeves', 'belt', 'cap'], tint: 0x6b7f5e };
/** Dunmore the Provisioner (`character:provisioner-exchange`): a working tunic, an apron, a belt and a wide-brimmed hat, in a warm brown wash. */
export const PROVISIONER_OUTFIT: Outfit = { pieces: ['tunic', 'apron', 'belt', 'hat'], tint: 0x8a6f4a };
/** Brisa of the Last Lamp (`character:innkeeper-exchange`): a tunic with sleeves, an apron and a belt, bareheaded, in a wine-red wash. */
export const INNKEEPER_OUTFIT: Outfit = { pieces: ['tunic', 'sleeves', 'apron', 'belt'], tint: 0x7a5c6a };
/** The outlaw camp's trader (Dom's PvP design, one per zone; the NPC row and its id are Backend's, so this is not in NAMED_OUTFITS yet): a working tunic, sleeves, a belt and a hood, in a dust-grey wash. */
export const OUTLAW_TRADER_OUTFIT: Outfit = { pieces: ['tunic', 'sleeves', 'belt', 'hood'], tint: 0x6a7a74 };
/** The named townspeople's outfits by NPC row id (Backend, #1828); everyone else gets `outfitFor(rowId)`. */
export const NAMED_OUTFITS: Readonly<Record<string, Outfit>> = {
  'character:banker-exchange': BANKER_OUTFIT, 'character:provisioner-exchange': PROVISIONER_OUTFIT, 'character:innkeeper-exchange': INNKEEPER_OUTFIT,
};

const TINTS = [0x8a6f4a, 0x6b7f5e, 0x7a5c6a, 0x5f6f86, 0x9a8a6a, 0x7d6a58, 0x6a7a74, 0x8c6a52] as const;
const HEADGEAR = [undefined, 'cap', 'hat', 'hood'] as const;

/** A townsperson's outfit from a stable seed (their NPC row id), FNV-1a so it is the same every visit: a robe OR a tunic (an apron over a tunic half the time), sleeves and a belt
 *  on a coin flip each, and one of no headgear / cap / hat / hood; a tint from the pool. Pieces that are alternatives (robe | tunic, one headgear) never come together. */
export function outfitFor(seed: string): Outfit {
  let h = 2166136261; for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const bit = (n: number) => ((h >>> n) & 1) === 1, tunic = bit(3), head = HEADGEAR[(h >>> 7) & 3];
  const pieces: ClothPiece[] = [tunic ? 'tunic' : 'robe'];
  if (bit(4)) pieces.push('sleeves');
  if (bit(5)) pieces.push('belt');
  if (tunic && bit(6)) pieces.push('apron');
  if (head) pieces.push(head);
  return { pieces, tint: TINTS[h % TINTS.length]! };
}

const tinted = new WeakMap<Material, Map<number, MeshStandardMaterial>>();
const materialFor = (source: MeshStandardMaterial, tint: number): MeshStandardMaterial => {
  let byTint = tinted.get(source); if (!byTint) tinted.set(source, (byTint = new Map()));
  let m = byTint.get(tint); if (!m) { m = source.clone(); m.color = new Color(tint); byTint.set(tint, m); }   // the near-neutral atlas is multiplied by the tint
  return m;
};

/** Wear `outfit` on `body` (a loaded or cloned body scene) from `clothes` (the loaded clothes scene). Returns the garment meshes added. Throws on a piece the file lacks or a bone the body lacks. */
export function wearClothes(body: Object3D, clothes: Object3D, outfit: Outfit): SkinnedMesh[] {
  const bones = new Map<string, Bone>(); body.traverse((o) => { if ((o as Bone).isBone) bones.set(o.name, o as Bone); });
  const out: SkinnedMesh[] = [];
  for (const piece of outfit.pieces) {
    const src = clothes.getObjectByName(`Cloth_${piece}`) as SkinnedMesh | undefined;
    if (!src?.isSkinnedMesh) throw new Error(`clothes: no skinned piece Cloth_${piece}`);
    const mine = src.skeleton.bones.map((b) => bones.get(b.name) ?? (() => { throw new Error(`clothes: the body has no bone ${b.name}`); })());
    const worn = new SkinnedMesh(src.geometry, materialFor(src.material as MeshStandardMaterial, outfit.tint));
    worn.name = src.name; worn.castShadow = false; worn.frustumCulled = false;   // the body's mixer moves the bones; a bind-pose bound would cull a gesture
    body.add(worn); worn.bind(new Skeleton(mine, src.skeleton.boneInverses), src.bindMatrix);
    out.push(worn);
  }
  return out;
}

/** The Talk clip the clothes file carries (three.js binds it by node name, so it plays on the body's own bones). */
export const talkClip = (clips: readonly AnimationClip[]): AnimationClip | undefined => clips.find((c) => c.name === 'Talk');

/** For tests and the preview: how many triangles the worn garments add. */
export const clothesTriangles = (worn: readonly Mesh[]): number => worn.reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3, 0);
