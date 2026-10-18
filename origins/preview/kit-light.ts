// The kit's torches as lights (Characters' halls kit): a prop node carries a child empty named by the kit with glTF extras `light`, a JSON string { color, intensity, reach, flicker }. The page reads it as a ROW: every field is
// required and checked, a bad one is refused (a thrown error names the node), and no field has a code default. A prop never costs a dynamic light by itself: the few lights the page already owns (main.ts `warm`, the braziers') are LENT to the
// nearest sconces while the walker is among them, and go home after (the camp fires' pattern, camp-fire.ts). Presentation only.
import * as THREE from 'three';
import { previewRule } from './preview-rules.ts';

export type KitLight = { readonly color: string; readonly intensity: number; readonly reach: number; readonly flicker: number };
const KEYS = ['color', 'intensity', 'reach', 'flicker'] as const;
/** The `light` extras of a kit node, checked: a JSON string (or the object) with exactly colour (#rrggbb), intensity > 0, reach > 0 m and flicker 0..1. Throws on anything else. Pure. */
export function parseKitLight(raw: unknown, node: string): KitLight {
  let v: unknown = raw;
  if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch { throw new Error(`kit light on ${node}: extras.light is not JSON`); } }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`kit light on ${node}: extras.light is not an object`);
  const o = v as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!(KEYS as readonly string[]).includes(k)) throw new Error(`kit light on ${node}: unknown field "${k}"`);
  const { color, intensity, reach, flicker } = o;
  if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error(`kit light on ${node}: color must be #rrggbb`);
  if (typeof intensity !== 'number' || !Number.isFinite(intensity) || !(intensity > 0)) throw new Error(`kit light on ${node}: intensity must be a number > 0`);
  if (typeof reach !== 'number' || !Number.isFinite(reach) || !(reach > 0)) throw new Error(`kit light on ${node}: reach must be a number > 0`);
  if (typeof flicker !== 'number' || !Number.isFinite(flicker) || flicker < 0 || flicker > 1) throw new Error(`kit light on ${node}: flicker must be a number from 0 to 1`);
  return { color, intensity, reach, flicker };
}

export type LightPoint = { readonly x: number; readonly y: number; readonly z: number };
export type KitLights = { readonly row: KitLight; readonly points: readonly LightPoint[] };
type Placed = { node: string; x: number; z: number; rotY: number; scale: number };
/** The torches of a loaded kit: every glTF node whose extras carry `light`, read as a row, at each placement of its parent node (the node's offset turned by the placement). The kit may carry one light row; two different ones are refused. */
export function kitLights(root: THREE.Object3D, placed: readonly Placed[], groundAt: (x: number, z: number) => number = () => 0): KitLights | null {
  let row: KitLight | null = null; const points: LightPoint[] = [], same = (a: KitLight, b: KitLight) => KEYS.every((k) => a[k] === b[k]);
  root.traverse((o) => {
    if (o.userData?.light === undefined) return;
    const host = o.parent, parsed = parseKitLight(o.userData.light, o.name);
    if (!host) throw new Error(`kit light on ${o.name}: it has no parent prop`);
    if (row && !same(row, parsed)) throw new Error(`kit light on ${o.name}: a second, different light row`);
    row = parsed;
    for (const p of placed) {
      if (p.node !== host.name) continue;
      const c = Math.cos(p.rotY), s = Math.sin(p.rotY), x = o.position.x * p.scale, z = o.position.z * p.scale;   // three's Y turn: local +x -> (cos, -sin), local +z -> (sin, cos)
      points.push({ x: p.x + x * c + z * s, y: groundAt(p.x, p.z) + o.position.y * p.scale, z: p.z - x * s + z * c });
    }
  });
  return row && points.length ? { row, points } : null;
}

export type SconceLights = { update(time: number, hero: { x: number; z: number }, lights: readonly THREE.PointLight[]): void; lends(l: THREE.PointLight): boolean };
/** Lend the page's own lights to the nearest sconces within the camp lights' reach of the walker; a light with no sconce to hold goes home. The row sets colour, reach and the flicker's depth; nothing here is a default. */
export function sconcePool(lights: KitLights): SconceLights {
  const home = new Map<THREE.PointLight, { pos: THREE.Vector3; color: THREE.Color; distance: number }>(), lent = new Set<THREE.PointLight>(), reachFrom = previewRule('campLightReach');
  const color = new THREE.Color(lights.row.color);
  return {
    lends: (l) => lent.has(l),
    update(time, hero, pool) {
      const near = lights.points.map((p) => ({ p, d: Math.hypot(p.x - hero.x, p.z - hero.z) })).filter((q) => q.d < reachFrom).sort((a, b) => a.d - b.d);
      pool.forEach((l, i) => {
        if (!home.has(l)) home.set(l, { pos: l.position.clone(), color: l.color.clone(), distance: l.distance });
        const q = near[i];
        if (!q) { if (lent.delete(l)) { const h = home.get(l)!; l.position.copy(h.pos); l.color.copy(h.color); l.distance = h.distance; } return; }
        lent.add(l); l.position.set(q.p.x, q.p.y, q.p.z); l.color.copy(color); l.distance = lights.row.reach;
        l.intensity = lights.row.intensity * (1 - lights.row.flicker * (0.5 + 0.5 * Math.sin(time * 9 + i * 2.1) * Math.sin(time * 5.3 + i)));
      });
    },
  };
}
