// ?region=1: puts a mob-looks.ts entry on a loaded roster body. Preview only, presentation only; the sim never sees it. Scale on the body's root; the
// tint and the Ash Frontier dressing on its CLOTH draws only (grades.ts classOf === 'cloth': tunic, wraps, heraldry), as one shared clone per source
// material and look, so a metal blade, the skin and the weapon keep their own grade. A mapped cloth keeps its pattern (the map is multiplied, not replaced).
import { Color, Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { classOf } from '../../src/grades.ts';
import type { MobLook } from './mob-looks.ts';

const SOOT = new Color(0x1f1c1a);
const clones = new WeakMap<MeshStandardMaterial, Map<MobLook, MeshStandardMaterial>>();

/** The cloth colour a look gives a base colour: multiplied toward the tint, then ash worked in (soot), then scorched darker (burnt). Pure arithmetic on colours. */
export function dressedColor(base: Color, look: MobLook): Color {
  const out = base.clone().multiply(new Color(look.tint));
  out.lerp(SOOT, Math.min(.7, look.dressing.soot * .55 + look.dressing.burnt * .3));
  return out;
}

/** The material a cloth draw wears under `look`: the source itself when it is not cloth, else one shared clone per (source, look). */
export function dressedMaterial(source: MeshStandardMaterial, look: MobLook): MeshStandardMaterial {
  if (classOf(source.name) !== 'cloth') return source;
  let byLook = clones.get(source); if (!byLook) clones.set(source, (byLook = new Map()));
  const known = byLook.get(look); if (known) return known;
  const material = source.clone();
  material.color = dressedColor(source.color, look);
  material.roughness = Math.min(1, source.roughness + look.dressing.soot * .15 + look.dressing.burnt * .2);   // ash and scorch are matte
  byLook.set(look, material); return material;
}

/** Dress one body: its scale, and every cloth draw. Returns how many draws changed (0 for a body with no cloth: the caller may then say so). */
export function dressMob(root: Object3D, look: MobLook): number {
  root.scale.multiplyScalar(look.scale);
  let changed = 0;
  root.traverse((node) => {
    const mesh = node as Mesh; if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = list.map((m) => { const d = dressedMaterial(m as MeshStandardMaterial, look); if (d !== m) changed++; return d; });
    mesh.material = Array.isArray(mesh.material) ? next : next[0]!;
  });
  return changed;
}
