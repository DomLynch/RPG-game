// ?region=1: puts a mob-looks.ts entry on a loaded roster body. Preview only, presentation only; the sim never sees it. Scale on the body's root; the
// tint and the Ash Frontier dressing on its CLOTH draws only (grades.ts classOf === 'cloth': tunic, wraps, heraldry), as one shared clone per source
// material and look, so a metal blade, the skin and the weapon keep their own grade. A mapped cloth keeps its pattern (the map is multiplied, not replaced).
import { Color, Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { classOf } from '../../src/grades.ts';
import type { MobLook } from './mob-looks.ts';

const SOOT = new Color(0x1f1c1a);
const clones = new WeakMap<MeshStandardMaterial, Map<MobLook, MeshStandardMaterial>>();

/** Cloth, plus the Witch and Knight bodies, which are one baked `<Family>Surface` draw (robe, hood, plate and all): a mob wears its tint over the whole of it. */
const dressable = (name: string): boolean => classOf(name) === 'cloth' || name === 'WitchSurface' || name === 'KnightSurface';

/** The cloth colour a look gives a base colour: multiplied toward the tint, then ash worked in (soot), then scorched darker (burnt). Pure arithmetic on colours. */
export function dressedColor(base: Color, look: MobLook, whole = false): Color {
  // `whole`: a baked body surface already holds its own dark map, so it takes a light wash of the tint and a quarter of the ash, not the full multiply
  if (whole) { const out = base.clone().lerp(new Color(look.tint), .6); out.lerp(SOOT, Math.min(.2, (look.dressing.soot * .55 + look.dressing.burnt * .3) * .3)); return out; }
  const tint = new Color(look.tint), out = base.clone().multiply(tint);
  out.lerp(tint, .35 * tint.getHSL({ h: 0, s: 0, l: 0 }).s);   // a dark cloth multiplied by a colour barely moves: pull part-way to the tint itself (white tint: no pull)
  out.lerp(SOOT, Math.min(.7, look.dressing.soot * .55 + look.dressing.burnt * .3));
  return out;
}

/** The material a cloth draw wears under `look`: the source itself when it is not cloth, else one shared clone per (source, look). */
export function dressedMaterial(source: MeshStandardMaterial, look: MobLook): MeshStandardMaterial {
  if (!dressable(source.name)) return source;
  let byLook = clones.get(source); if (!byLook) clones.set(source, (byLook = new Map()));
  const known = byLook.get(look); if (known) return known;
  const material = source.clone();
  material.color = dressedColor(source.color, look, !(classOf(source.name) === 'cloth'));
  material.roughness = Math.min(1, source.roughness + look.dressing.soot * .15 + look.dressing.burnt * .2);   // ash and scorch are matte
  byLook.set(look, material); return material;
}

/** Dress one body: its scale, and every cloth draw. Returns how many draws changed (0 for a body with no cloth: the caller may then say so). */
export function dressMob(root: Object3D, look: MobLook, scaled = true): number {
  if (scaled) root.scale.multiplyScalar(look.scale);   // scaled=false: the duel keeps the sim's own scale, only the cloth is dressed (and the look object stays the clone cache's key)
  let changed = 0;
  root.traverse((node) => {
    const mesh = node as Mesh; if (!mesh.isMesh) return;
    const original = (mesh.userData.undressed ??= mesh.material) as typeof mesh.material;   // the body as loaded: a scene reused for the next fight dresses from THIS, never from the last clone
    const list = Array.isArray(original) ? original : [original];
    const next = list.map((m) => { const d = dressedMaterial(m as MeshStandardMaterial, look); if (d !== m) changed++; return d; });
    mesh.material = Array.isArray(original) ? next : next[0]!;
  });
  return changed;
}

/** Put a dressed body back as loaded (a Pit legend fighting on the same body and level must not wear a creature's cloth). */
export function undressMob(root: Object3D): void {
  root.traverse((node) => { const mesh = node as Mesh; if (mesh.isMesh && mesh.userData.undressed) mesh.material = mesh.userData.undressed; });
}
