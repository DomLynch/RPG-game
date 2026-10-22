import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ZoneMaterials } from './zone-scenery.ts';
import { previewRule } from './preview-rules.ts';
import { skinModels } from '../world/building-skins-rules.ts';
import { greyboxOfSkins, skinPlacements } from './exchange-skin.ts';
import type { ModelPlacement } from './frontier-skin.ts';
import { exchangeAnchors, exchangePlan, FORGE_HALF, KERB_INSET, STONE_RADIUS, type Figure, type Piece, type Plan, type Shape, type Tint } from './exchange-plan.ts';
import type { Stain } from '../zones/plan.ts';

// Greybox of the walk out (Origins look prototype, not the build): the passage behind the Pit's gate, the Concord Exchange plaza and the
// bank's front. Blocking only: massing, scale, light and the arena's own materials, so Dom judges proportion and mood before any asset.
// The Pit's gate faces −z (arena.ts LAYOUT.gate = π). Everything here sits outside the Pit's parapet (r > 23.2 m) except the passage.
// Where it all stands is the world data (origins/world/concord.ts); exchange-plan.ts lays the pieces out, this file only builds them.
const A = exchangeAnchors();
export const PASSAGE = A.passage;
export const PLAZA = { halfWidth: A.halfWidth - KERB_INSET, near: A.gate.z, far: A.bank.z + 0.5 };
export const STONE_CENTRE = { ...A.stone, radius: STONE_RADIUS };
export const BANK_STEP_Z = A.bank.z;
export const FORGE = { ...A.forge, halfX: FORGE_HALF.x, halfZ: FORGE_HALF.z };   // the blacksmith (Dom 2026-10-06: NPC upgrade service), open toward the plaza

// One placed piece: world transform, box-projected UVs in metres (the arena's stone texture tiles at 2 m), a tint darkened toward its foot.
function piece(geometry: THREE.BufferGeometry, x: number, y: number, z: number, tint: Tint, rotY = 0, foot = y - 10, tile = previewRule('exchangeUvTileM')): THREE.BufferGeometry {   // tile: metres per repeat, a plan layer row's own (the Pit's sand tiles at 3 m), else the `exchangeUvTileM` rule (2 m: the arena's stone)
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(1, 1, 1)));
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2), color = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    const [u, v] = ny >= nx && ny >= nz ? [px, pz] : nx >= nz ? [pz, py] : [px, py];
    uv[i * 2] = u / tile; uv[i * 2 + 1] = v / tile;
    const shade = 0.7 + 0.3 * Math.min(1, Math.max(0, (py - foot) / 0.8));
    color[i * 3] = tint[0] * shade; color[i * 3 + 1] = tint[1] * shade; color[i * 3 + 2] = tint[2] * shade;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  return g;
}
export function geometryOf(s: Shape): THREE.BufferGeometry {
  switch (s[0]) {
    case 'box': return new THREE.BoxGeometry(s[1], s[2], s[3]);
    case 'cylinder': return new THREE.CylinderGeometry(s[1], s[2], s[3], s[4]);
    case 'cone': return new THREE.ConeGeometry(s[1], s[2], s[3]);
    case 'sphere': return new THREE.SphereGeometry(s[1], s[2], s[3]);
    case 'pediment': {
      const [, width, height, depth] = s;
      const tri = new THREE.Shape([new THREE.Vector2(-width / 2, 0), new THREE.Vector2(width / 2, 0), new THREE.Vector2(0, height)]);
      return new THREE.ExtrudeGeometry(tri, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
    }
    case 'ring': { const [, inner, outer, height, segments] = s, half = height / 2; return new THREE.LatheGeometry([new THREE.Vector2(inner, -half), new THREE.Vector2(outer, -half), new THREE.Vector2(outer, half), new THREE.Vector2(inner, half), new THREE.Vector2(inner, -half)], segments); }   // a solid annulus: the profile turned about y
    case 'wedge': {   // a ramp: a right triangle (low end at -x, the rise at +x) extruded across its width, the bounding box centred on the origin
      const [, length, h, depth] = s, lo = -length / 2, hi = length / 2, base = -h / 2, top = h / 2;
      const tri = new THREE.Shape([new THREE.Vector2(lo, base), new THREE.Vector2(hi, base), new THREE.Vector2(hi, top)]);
      return new THREE.ExtrudeGeometry(tri, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
    }
  }
}

// The frieze inscription: carved letters on a stone-coloured canvas (greybox signage, not final art).
function inscription(text: string): THREE.MeshStandardMaterial {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#8f8676'; g.fillRect(0, 0, c.width, c.height);
  g.font = '600 62px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#d2c8b4'; g.fillText(text, c.width / 2 + 2, c.height / 2 + 3);   // the lit lower lip of each cut
  g.fillStyle = '#2b2620'; g.fillText(text, c.width / 2, c.height / 2);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map, roughness: 0.95 });
}

// Every piece of a plan, merged into one mesh per layer (stone, iron, dark, coal) named `<prefix>-<layer>`, added to the group.
// `own` gives the stone and paving layers materials of their own (the Exchange's clones, so a look can tint them without touching the arena's).
// A piece whose `skin` names a model row is drawn in a group of its own per skin (`<prefix>-fallback-<skin>`, returned): the greybox stands until that model's file lands, then main.ts hides the group (a failed file keeps it).
// `tiles` is a layer's own texture tile size (a zone's layer row), so a bowl's sand repeats at its own scale.
export function meshPieces(group: THREE.Group, pieces: readonly Piece[], m: ZoneMaterials, prefix: string, own: { stone?: THREE.Material; paving?: THREE.Material } = {}, tiles: Readonly<Record<string, number | undefined>> = {}): Map<string, THREE.Group> {
  const fallbacks = new Map<string, THREE.Group>(), known = new Set(skinModels().map((s) => s.id));
  for (const [id, list] of greyboxOfSkins(pieces)) if (known.has(id)) {
    const g = new THREE.Group(); g.name = `${prefix}-fallback-${id}`; group.add(g); fallbacks.set(id, g);
    meshPieces(g, list.map((p) => ({ ...p, skin: undefined, cover: undefined })), m, `${prefix}-${id}`, own, tiles);
  }
  pieces = pieces.filter((p) => !((p.skin && known.has(p.skin)) || (p.cover && known.has(p.cover))));
  const layers: Record<string, THREE.BufferGeometry[]> = { stone: [], paving: [], iron: [], soot: [], coal: [], plain: [] };
  for (const p of pieces) layers[p.layer]!.push(piece(geometryOf(p.shape), p.x, p.y, p.z, p.tint, p.rotY, p.foot, tiles[p.layer]));
  const add = (parts: THREE.BufferGeometry[], material: THREE.Material, name: string) => {
    if (!parts.length) return;
    const mesh = new THREE.Mesh(mergeGeometries(parts), material); mesh.name = `${prefix}-${name}`; mesh.castShadow = name !== 'coal'; mesh.receiveShadow = true; group.add(mesh);
  };
  add(layers.stone!, own.stone ?? m.stone, 'stone'); add(layers.paving!, own.paving ?? m.stone, 'paving'); add(layers.iron!, m.iron, 'iron');
  add(layers.soot!, new THREE.MeshStandardMaterial({ color: '#0d0b0a', roughness: 1 }), 'dark');
  add(layers.coal!, m.coal, 'coal');
  add(layers.plain!, new THREE.MeshStandardMaterial({ color: m.stone.color, roughness: 1, vertexColors: true }), 'plain');   // untextured matte in the stone's own base colour, so a prop is as bright as it was (the prop kits' wood, hide, cloth and bone): no stone pattern on a tent
  return fallbacks;
}

export type Exchange = { group: THREE.Group; fallbacks: Map<string, THREE.Group>; capsules: Map<string, THREE.Mesh>; people: Figure[]; setLayerTexture(layer: string, tex: THREE.Texture, slabM: number, warm?: (probe: THREE.MeshStandardMaterial) => Promise<void>): Promise<void>; skins: ModelPlacement[]; braziers: THREE.Vector3[]; hearth: THREE.Vector3 | null; ground: THREE.MeshStandardMaterial; stone: THREE.MeshStandardMaterial; update(time: number): void };

export function buildExchange(scene: THREE.Scene, m: ZoneMaterials, plan: Plan = exchangePlan(A)): Exchange {
  const group = new THREE.Group(); group.name = 'concord-exchange'; scene.add(group);

  const awnings: THREE.Mesh[] = [];
  for (const a of plan.awnings) {
    const awning = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.2, 6, 4), new THREE.MeshStandardMaterial({ color: a.color, roughness: 1, side: THREE.DoubleSide }));
    awning.position.set(a.x, a.y, a.z); awning.rotation.set(-Math.PI / 2 + 0.18, 0, 0); awning.castShadow = awning.receiveShadow = true;
    group.add(awning); awnings.push(awning);
  }
  const capsules = new Map<string, THREE.Mesh>();   // a person's greybox capsule by row id: the fallback, hidden when that person's body lands (town-people.ts)
  for (const f of plan.people) {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 1.2, 4, 10), new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.95 }));
    body.position.set(f.x, (f.y ?? 0) + 0.87, f.z); body.castShadow = true; group.add(body);
    if (f.npc) capsules.set(f.npc.id, body);
  }

  // The paving and the masonry each get a clone of the arena's stone, so a look (look.ts) can grade them apart; untinted they are the arena's stone to the eye.
  // A zone's layer rows can name another of the arena's materials for a layer (the Dungeon 1 bowl: the Pit's own sand, no brick); the clone follows ITS source's late textures.
  const sourceOf = (layer: string): THREE.MeshStandardMaterial => ((m as unknown as Record<string, THREE.MeshStandardMaterial | undefined>)[plan.layers?.[layer]?.material ?? ''] ?? m.stone);
  const ground = sourceOf('paving').clone(), stone = sourceOf('stone').clone(), sources = [['paving', ground, sourceOf('paving')], ['stone', stone, sourceOf('stone')]] as const;
  const layerMaps = new Map<string, THREE.Texture>();   // a texture row that names a plan layer: that layer draws it (one `slabM` tile at a time) instead of its source's map
  // A layer row's `stain` gives the clone the Pit's own blood-stain mask (the sand's world-space patch: the clone does not inherit the source's shader hook): repeated every `span` m, faded in with depth from `top` to `bottom`.
  const stained = (clone: THREE.MeshStandardMaterial, source: THREE.MeshStandardMaterial, stain: Stain | undefined): void => {
    if (!stain || !source.onBeforeCompile) return;
    const base = source.onBeforeCompile, { span, top, bottom, gain } = stain, key = `stain-${span}-${top}-${bottom}-${gain}`;
    clone.onBeforeCompile = (shader, renderer) => {
      base.call(clone, shader, renderer);      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vStainY;').replace('vPatchUv =', 'vStainY = (modelMatrix * vec4(transformed, 1.0)).y; vPatchUv =').replace(/\/ [0-9.]+ \+ 0\.5;/, `/ ${span.toFixed(1)} + 0.5;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vStainY;').replace('texture2D(patchMap, vPatchUv)', 'texture2D(patchMap, fract(vPatchUv))').replace(/(patchSample\.rgb \* [0-9.]+, )patchSample\.a\)/, `$1clamp(patchSample.a * ${gain.toFixed(1)}, 0.0, 1.0) * clamp((vStainY - (${top.toFixed(1)})) / (${(bottom - top).toFixed(1)}), 0.0, 1.0))`);
    };
    clone.customProgramCacheKey = () => `${source.customProgramCacheKey()}-${key}`;
  };
  stained(ground, sourceOf('paving'), plan.layers?.paving?.stain); stained(stone, sourceOf('stone'), plan.layers?.stone?.stain);
  const fallbacks = meshPieces(group, plan.pieces, m, 'exchange', { stone, paving: ground }, Object.fromEntries(Object.entries(plan.layers ?? {}).map(([layer, row]) => [layer, row.tile])));
  if (plan.frieze) {   // a plan without a frieze row has no inscription
    const frieze = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.3), inscription(plan.frieze.text));
    frieze.position.set(plan.frieze.x, plan.frieze.y, plan.frieze.z); group.add(frieze);
  }

  return {
    // A layer texture lands only on a layer with no material row of its own (a zone that names one, like the Dungeon's sand, keeps it), and only after `warm` has compiled the layer's material with the new map, so the swap never
    // links a program inside a walking frame (bounded by warmBound; a warm-up that throws swaps anyway).
    async setLayerTexture(layer: string, tex: THREE.Texture, slabM: number, warm?: (probe: THREE.MeshStandardMaterial) => Promise<void>) {
      const row = plan.layers?.[layer], target = sources.find((s) => s[0] === layer); if (row?.material || !target) return;
      const tile = row?.tile ?? previewRule('exchangeUvTileM');
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(tile / slabM, tile / slabM); tex.anisotropy = 8;   // the pieces' UVs are metres / the layer's tile
      if (warm) { const probe = target[1].clone(); probe.map = tex; probe.normalMap = null; await Promise.race([warm(probe).catch(() => {}), new Promise<void>((r) => setTimeout(r, previewRule('warmBound')))]); probe.dispose(); }
      layerMaps.set(layer, tex);
    },
    group, ground, stone, fallbacks, capsules, people: plan.people, skins: skinPlacements(plan.pieces), braziers: plan.braziers.map((b) => new THREE.Vector3(b.x, 0, b.z)), hearth: plan.hearth ? new THREE.Vector3(plan.hearth.x, plan.hearth.y, plan.hearth.z) : null,
    update(time: number) {
      for (const [layer, c, source] of sources) { const own = layerMaps.get(layer), want = own ?? source.map; if (c.map !== want) { c.map = want; c.normalMap = own ? null : source.normalMap; c.needsUpdate = true; } }   // the arena swaps its heavy stone and sand textures in late; the clones follow (a layer's own texture wins)
      awnings.forEach((a, i) => { a.rotation.x = -Math.PI / 2 + 0.18 + Math.sin(time * 1.3 + i) * 0.015; });
    },
  };
}

// Where the walker may stand: the Pit's sand, the passage, the plaza (not through the stone or up the bank's steps).
export function walkable(x: number, z: number): boolean {
  const R = previewRule;   // the walk limits are preview-rules rows (walk*, metres): where the player may stand is gameplay, not massing
  if (Math.hypot(x, z) < R('walkSand')) return true;
  if (Math.abs(x) < PASSAGE.halfWidth - R('walkPassageMargin') && z < -R('walkPassageNear') && z > PASSAGE.to - R('walkPassageEnd')) return true;
  if (Math.abs(x - FORGE.x) < FORGE.halfX + R('walkSmithyMargin') && Math.abs(z - FORGE.z) < FORGE.halfZ + R('walkSmithyMargin')) return x > FORGE.x - FORGE.halfX + R('walkHearthStop');   // inside the smithy, short of the hearth
  if (Math.abs(x) < PLAZA.halfWidth + R('walkPlazaMargin') && z <= PLAZA.near && z > BANK_STEP_Z + R('walkStepMargin')) return Math.hypot(x - STONE_CENTRE.x, z - STONE_CENTRE.z) > STONE_CENTRE.radius + R('walkStoneMargin');
  return false;
}
