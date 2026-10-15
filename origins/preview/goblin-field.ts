// The goblin field's near-ground kit (?look=goblin, World lane, Dom's zone looks via the look-test route): the level-1 goblins' ground outside the Concord Exchange (zone `goblinZone()`), dressed with
// palisade stakes, totems, smoking fires, dead trees and bones. Pure data (Piece[] + the fires' places for the smoke), no three.js, on the stone layer (the fire's embers on the coal layer), so the draw
// calls do not move. Every count, size and tint is a row (origins/world/goblin-field-defs.json). Reads the base dressing so nothing lands on a road, a landmark, a building or a base prop; adds NO walk blocker
// (a stake line is dressing you walk past, like the Cinder pass's scrub). Deterministic per zone id. Donor: the Cinder pass (frontier-cinder.ts), same Dress shape, same placement rule.
import { goblinRule as R, goblinTint as T, goblinZone } from '../world/goblin-field-rules.ts';
import { toWorld } from '../world/derive.ts';
import type { Piece, Shape, Tint } from './exchange-plan.ts';
import { footprintOf, rng, type Dress } from './frontier-dress.ts';
import { inZone, onRoad, type Build, type Frontier, type Solid } from './frontier-plan.ts';

export type GoblinKit = { dress: Dress; fires: { x: number; z: number }[]; centre: { x: number; z: number } | null };

export function goblinFieldKit(f: Frontier, b: Build, base: Dress): GoblinKit {
  const ground: Piece[] = [], pieces: Piece[] = [], solids: Solid[] = [], fires: { x: number; z: number }[] = [];
  const z0 = f.zones.find((q) => q.zone === goblinZone());
  if (!z0) return { dress: { ground, pieces, solids }, fires, centre: null };
  const z = z0, Rn = rng(`goblin:${z.zone}`), between = (lo: number, hi: number) => lo + (hi - lo) * Rn();
  const world = (x: number, d: number) => toWorld({ x, d }, z.mount);
  const put = (shape: Shape, x: number, y: number, zz: number, tint: Tint, rotY = 0, layer: Piece['layer'] = 'stone') => { pieces.push({ layer, shape, x, y, z: zz, tint, rotY, foot: 0 }); };
  const centre = world(0, z.depth * R('clusterDepth')), placed: Solid[] = [], baseFoot = base.pieces.map(footprintOf), marks = [...Object.values(z.landmarks), f.giver.at];
  const strips = base.ground.filter((p) => (p.shape[0] === 'box' && p.shape[1] === 3.4) || (p.shape[0] === 'cylinder' && p.shape[1] === 4.6));   // the base's worn roads and hubs, as the Cinder pass reads them
  const free = (x: number, zz: number, r: number) => inZone(z, x, zz, r + 2) && !onRoad(f, x, zz) && !strips.some((s) => Math.hypot(s.x - x, s.z - zz) < r + R('clearOfRoad'))
    && !marks.some((k) => Math.hypot(k.x - x, k.z - zz) < r + 8) && ![...b.solids, ...base.solids, ...placed, ...baseFoot].some((s) => Math.hypot(s.x - x, s.z - zz) < s.r + r + 1);
  const spot = (r: number, near = 1) => { for (let i = 0; i < 30; i++) { const a = between(0, Math.PI * 2), d = between(r, R('clusterRadius') * near), x = centre.x + Math.sin(a) * d, zz = centre.z + Math.cos(a) * d; if (free(x, zz, r)) return { x, z: zz }; } return null; };

  // Palisade: a wobbling line of leaning-free stakes (cones) lashed with two rails, a few segments around the camp.
  for (let s = 0; s < R('palisadeSegments'); s++) {
    const o = spot(R('stakeSpacing') * R('palisadeStakes') / 2, 1); if (!o) continue;
    const ang = between(0, Math.PI), n = R('palisadeStakes'), len = n * R('stakeSpacing'), ux = Math.cos(ang), uz = -Math.sin(ang);
    for (let i = 0; i < n; i++) { const t = (i - (n - 1) / 2) * R('stakeSpacing'), h = between(R('stakeHMin'), R('stakeHMax')); put(['cone', R('stakeR'), h, 5], o.x + ux * t + between(-0.06, 0.06), h / 2, o.z + uz * t + between(-0.06, 0.06), T('wood'), between(0, 6)); }
    for (const y of [R('railLow'), R('railHigh')]) put(['box', len, 0.09, 0.11], o.x, y, o.z, T('rope'), ang + Math.PI / 2);
    placed.push({ x: o.x, z: o.z, r: len / 2 });
  }
  // Totems: a painted pole with a horned block head, a cross-arm and three hanging skulls.
  for (let t = 0; t < R('totemCount'); t++) {
    const o = spot(0.7); if (!o) continue;
    const h = between(R('totemHMin'), R('totemHMax')), rot = between(0, 6.28), sx = Math.cos(rot), sz = -Math.sin(rot);
    put(['cylinder', 0.13, 0.18, h, 7], o.x, h / 2, o.z, T('woodDark'), rot);
    put(['cylinder', 0.2, 0.2, 0.2, 7], o.x, h * 0.45, o.z, T('ochre'), rot);   // the painted band
    put(['box', 0.5, 0.5, 0.45], o.x, h + 0.15, o.z, T('wood'), rot);   // the head
    for (const side of [-1, 1]) put(['cone', 0.09, 0.5, 5], o.x + sx * 0.3 * side, h + 0.5, o.z + sz * 0.3 * side, T('bone'), rot);   // the horns
    put(['box', 1.1, 0.07, 0.07], o.x, h * 0.78, o.z, T('woodDark'), rot + Math.PI / 2);   // the cross-arm
    for (const k of [-1, 0, 1]) put(['box', 0.15, 0.19, 0.14], o.x - sz * 0.45 * k, h * 0.78 - 0.2, o.z + sx * 0.45 * k, T('bone'), rot);
    placed.push({ x: o.x, z: o.z, r: 0.7 });
  }
  // Smoking fires: a ring of stones, crossed logs and embers on the coal layer; the smoke is the view's (goblin-smoke.ts) from `fires`.
  for (let k = 0; k < R('fireCount'); k++) {
    const o = k === 0 ? (free(centre.x, centre.z, R('fireRing') + 1) ? centre : spot(R('fireRing') + 1, 0.5)) : spot(R('fireRing') + 1, 0.7); if (!o) continue;
    for (let i = 0; i < R('fireStones'); i++) { const a = (i / R('fireStones')) * Math.PI * 2, r = between(0.2, 0.34); put(['cylinder', r * 0.7, r, r * 1.2, 6], o.x + Math.sin(a) * R('fireRing') * 0.55, r * 0.5, o.z + Math.cos(a) * R('fireRing') * 0.55, T('ring'), between(0, 6)); }
    for (let i = 0; i < R('fireLogs'); i++) put(['box', 0.95, 0.12, 0.12], o.x, 0.12 + (i % 2) * 0.12, o.z, T('dead'), (i / R('fireLogs')) * Math.PI);
    put(['cylinder', 0.42, 0.46, 0.05, 10], o.x, 0.03, o.z, T('ember'), 0, 'coal');
    fires.push({ x: o.x, z: o.z }); placed.push({ x: o.x, z: o.z, r: R('fireRing') + 0.4 });
  }
  // Dead trees in clumps: a thin trunk and three bare branches (the Cinder pass's tree), no solid.
  for (let c = 0; c < R('treeClumps'); c++) {
    const o = spot(1.6); if (!o) continue;
    for (let i = 0; i < R('treesPerClump'); i++) {
      const x = o.x + between(-2.2, 2.2), zz = o.z + between(-2.2, 2.2), h = between(R('treeHMin'), R('treeHMax')), rot = between(0, 3);
      if (!free(x, zz, 0.5)) continue;
      put(['cylinder', 0.09, 0.26, h, 6], x, h / 2, zz, T('dead'));
      for (let j = 0; j < 3; j++) put(['box', between(1.2, 2.6), 0.09, 0.09], x, h * (0.55 + j * 0.14), zz, T('dead'), rot + j * 1.9);
      placed.push({ x, z: zz, r: 0.4 });
    }
  }
  // Bones: scattered piles (flat long bones, a skull), and a few ribcages (fanned flat ribs on a spine).
  for (let p = 0; p < R('bonePiles'); p++) {
    const o = spot(0.9); if (!o) continue;
    for (let i = 0; i < 3 + Math.floor(Rn() * 3); i++) put(['box', between(0.4, 0.75), 0.05, 0.06], o.x + between(-0.7, 0.7), 0.04 + i * 0.03, o.z + between(-0.7, 0.7), T('bone'), between(0, 6));
    if (Rn() < 0.55) { const sx = o.x + between(-0.5, 0.5), sz = o.z + between(-0.5, 0.5); put(['sphere', 0.13, 6, 5], sx, 0.12, sz, T('bone'), 0); put(['box', 0.14, 0.05, 0.1], sx + 0.12, 0.06, sz, T('bone'), between(0, 6)); }
    placed.push({ x: o.x, z: o.z, r: 0.8 });
  }
  { const o = spot(1.2); if (o) { const rot = between(0, 6.28); put(['box', 0.06, 0.06, 1.5], o.x, 0.2, o.z, T('bone'), rot); for (let i = 0; i < R('boneRibs'); i++) { const t = (i - (R('boneRibs') - 1) / 2) * 0.28; for (const side of [-1, 1]) put(['box', 0.5, 0.05, 0.05], o.x + Math.cos(rot) * t + Math.sin(rot) * 0.22 * side, 0.3, o.z - Math.sin(rot) * t + Math.cos(rot) * 0.22 * side, T('bone'), rot + 1.3 * side); } placed.push({ x: o.x, z: o.z, r: 1.1 }); } }

  return { dress: { ground, pieces, solids }, fires, centre };
}

/** The base dressing and the goblin kit as one Dress (frontier.ts meshes its ground then its pieces; the goblin kit adds no solid). */
export const withGoblinField = (kit: GoblinKit, base: Dress): Dress => ({ ground: [...base.ground, ...kit.dress.ground], pieces: [...base.pieces, ...kit.dress.pieces], solids: [...base.solids, ...kit.dress.solids] });
