// Other players in the world (PvP step 0, Strategy 2026-10-08: seeing other people is what makes it an MMO). Presence (presence-client.ts) already decodes them to
// { id, x, z, heading, anim, flags } in the zone frame (metres); this draws each as the game's own hero rig (a clone of the walker's), idle or walking by how far he moved,
// with a name/level plate whose colour is the server's tag (grey / red) and a shield for a protected newcomer. The server fields (name, level, tag, protected) are OPTIONAL on
// the frame until Backend adds them: without them the figure is drawn and the plate says nothing. Pure parts (smoothing, plate text, tag colour) are node-tested; the rig clone is the page's.
import * as THREE from 'three';
import type { Other } from './presence-client.ts';

export type Tagged = Other & { name?: string; level?: number; tag?: 'grey' | 'red' | null; protected?: boolean };
export const TAG_COLOUR = { grey: '#a8a8a8', red: '#d6402f', none: '#efe6d2' } as const;
export const plateText = (o: Tagged): string => [o.protected ? '🛡' : '', o.name ?? '', typeof o.level === 'number' ? `Lv ${o.level}` : ''].filter(Boolean).join(' ');
export const plateColour = (o: Tagged): string => TAG_COLOUR[o.tag ?? 'none'];
/** One frame of smoothing toward the latest packet (presence ticks are coarse): critically damped, and a jump over `snap` metres (a respawn, a zone change) is taken at once. */
export function follow(at: { x: number; z: number }, to: { x: number; z: number }, dt: number, rate = 8, snap = 12): { x: number; z: number; speed: number } {
  const d = Math.hypot(to.x - at.x, to.z - at.z);
  if (d > snap) return { x: to.x, z: to.z, speed: 0 };
  const k = 1 - Math.exp(-rate * dt);
  return { x: at.x + (to.x - at.x) * k, z: at.z + (to.z - at.z) * k, speed: dt > 0 ? (d * k) / dt : 0 };
}
export const gaitOf = (speed: number): 0 | 1 | 3 => (speed < 0.3 ? 0 : speed < 3.6 ? 1 : 3);   // Idle / Walk / Run: the walker's clips are Idle, Walk, Jog, Run

export type Rig = { scene: THREE.Object3D; animations: THREE.AnimationClip[] };
type Figure = { group: THREE.Group; at: { x: number; z: number }; mixer?: THREE.AnimationMixer; gait: THREE.AnimationAction[]; plate: THREE.Sprite; text: string; stand: THREE.Object3D };
export function createOthers(scene: THREE.Scene, rig: () => Rig | null, clone: (o: THREE.Object3D) => THREE.Object3D, ground: (x: number, z: number) => number = () => 0) {
  const figures = new Map<number, Figure>();
  const capsule = () => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.15, 4, 12), new THREE.MeshStandardMaterial({ color: '#4a3b2e', roughness: 0.9 })); m.position.y = 0.88; return m; };
  const plateOf = (text: string, colour: string): { sprite: THREE.Sprite; text: string } => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 48; const g = c.getContext('2d')!;
    g.font = '600 26px Georgia, serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, 256, 48); g.fillStyle = colour; g.fillText(text, 128, 33, 248);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true })); s.scale.set(1.6, 0.3, 1); s.position.y = 2.25; s.renderOrder = 5;
    return { sprite: s, text };
  };
  function add(o: Tagged): Figure {
    const group = new THREE.Group(), stand = capsule(); group.add(stand);
    const p = plateOf('', plateColour(o)); group.add(p.sprite); scene.add(group);
    const f: Figure = { group, at: { x: o.x, z: o.z }, gait: [], plate: p.sprite, text: '', stand }; figures.set(o.id, f); return f;
  }
  function dress(f: Figure) {
    const r = rig(); if (!r || f.mixer) return;
    const body = clone(r.scene); f.mixer = new THREE.AnimationMixer(body);
    f.gait = ['Idle', 'Walk', 'Jog', 'Run'].map((n) => THREE.AnimationClip.findByName(r.animations, n)).filter((c): c is THREE.AnimationClip => !!c).map((c) => f.mixer!.clipAction(c));
    f.gait.forEach((a, i) => { a.play(); a.setEffectiveWeight(i === 0 ? 1 : 0); });
    f.group.remove(f.stand); f.group.add(body);
  }
  return {
    update(list: readonly Tagged[], dt: number) {
      const seen = new Set<number>();
      for (const o of list) {
        seen.add(o.id); const f = figures.get(o.id) ?? add(o);
        dress(f);
        const s = follow(f.at, o, dt); f.at = { x: s.x, z: s.z };
        f.group.position.set(s.x, ground(s.x, s.z), s.z); f.group.rotation.y = o.heading;
        if (f.gait.length === 4) { const g = gaitOf(s.speed); f.gait.forEach((a, i) => a.setEffectiveWeight(i === g ? 1 : 0)); f.mixer!.update(dt); }
        const text = plateText(o) + '|' + plateColour(o);
        if (text !== f.text) { f.text = text; const p = plateOf(plateText(o), plateColour(o)); (f.plate.material as THREE.SpriteMaterial).map?.dispose(); (f.plate.material as THREE.SpriteMaterial).map = (p.sprite.material as THREE.SpriteMaterial).map; (f.plate.material as THREE.SpriteMaterial).needsUpdate = true; }
      }
      for (const [id, f] of figures) if (!seen.has(id)) { scene.remove(f.group); figures.delete(id); }
    },
    count: () => figures.size,
    debug: () => [...figures].map(([id, f]) => ({ id, x: +f.at.x.toFixed(2), z: +f.at.z.toFixed(2), plate: f.text.split('|')[0], dressed: !!f.mixer })),
  };
}
