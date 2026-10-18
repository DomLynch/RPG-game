// A kill drops what the creature wore, on the ground, to pick up (zone sandbox, Dom 2026-10-17: "real item drops per kill"). SANDBOX ONLY: the Test Zone is invisible to the server, so nothing here is an
// account item; the pieces go in a local "Found" list on this device (localStorage, survives a reload) until the backend loot-table rows exist (the loadout rows already name the loot piece ids, so a loot table per
// loadout maps one to one). Donors: UO / ModernUO (the corpse holds what the creature wore) and EQEmu ground spawns (an item at a place, taken by walking onto it). Pure logic plus a small glowing marker; no assets.
import * as THREE from 'three';

export type FoundItem = { piece: string; label: string; from: string; n: number };
const KEY = 'origins-preview.found.v1';

/** The Found list: counts per piece, kept in `storage`. A broken or missing store is an empty list, never an error. */
export function createFound(storage: Pick<Storage, 'getItem' | 'setItem'> | null) {
  const read = (): FoundItem[] => { try { const v = JSON.parse(storage?.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => x && typeof x.piece === 'string' && typeof x.n === 'number') : []; } catch { return []; } };
  let items = read();
  const save = () => { try { storage?.setItem(KEY, JSON.stringify(items)); } catch { /* private mode: the list lives for this page only */ } };
  return {
    list: (): readonly FoundItem[] => items,
    count: (): number => items.reduce((s, i) => s + i.n, 0),
    add(piece: string, label: string, from: string): void { const i = items.find((x) => x.piece === piece); if (i) i.n++; else items = [...items, { piece, label, from, n: 1 }]; save(); },
    clear(): void { items = []; save(); },
  };
}

export type Drop = { id: number; piece: string; label: string; from: string; x: number; z: number; age: number; rung?: string };
type Deps = { scene: THREE.Scene; groundAt: (x: number, z: number) => number; found: ReturnType<typeof createFound>; reach: number; onPick: (d: Drop) => void; onChange: () => void };

/** Markers on the ground: `drop` puts one where the creature fell, `update` bobs them and takes the one the hero walks onto (within `reach` metres). */
export function createKillDrops(deps: Deps) {
  const bone = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, emissive: 0xb89a55, emissiveIntensity: 1.2, roughness: 0.5 }), ring = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.55, depthWrite: false });
  const geo = new THREE.OctahedronGeometry(0.22), ringGeo = new THREE.RingGeometry(0.42, 0.5, 28).rotateX(-Math.PI / 2);
  const live = new Map<number, { drop: Drop; group: THREE.Group }>(); let next = 1;
  return {
    drop(piece: string, label: string, from: string, x: number, z: number, rung?: string): void {
      const group = new THREE.Group(), gem = new THREE.Mesh(geo, bone), halo = new THREE.Mesh(ringGeo, ring); gem.position.y = 0.55; group.add(gem, halo);
      group.position.set(x, deps.groundAt(x, z) + 0.05, z); deps.scene.add(group);
      const d: Drop = { id: next++, piece, label, from, x, z, age: 0, rung }; live.set(d.id, { drop: d, group });
    },
    update(dt: number, hero: { x: number; z: number }): void {
      for (const [id, e] of live) {
        e.drop.age += dt; const gem = e.group.children[0]!; gem.position.y = 0.55 + Math.sin(e.drop.age * 2.4) * 0.08; gem.rotation.y += dt * 1.6;
        if (Math.hypot(hero.x - e.drop.x, hero.z - e.drop.z) <= deps.reach) { deps.found.add(e.drop.piece, e.drop.label, e.drop.from); deps.scene.remove(e.group); live.delete(id); deps.onPick(e.drop); deps.onChange(); }
      }
    },
    waiting: (): number => live.size,
  };
}
