// ?look=armfeel's two visible effects (armfeel.ts has the numbers): the struck body's 100 ms near-white flash and the pooled impact burst. Presentation only,
// built once when the flag is on and not at all otherwise; nothing here allocates per hit (the pool, the colour and the transform helpers are made up front).
import * as THREE from 'three';
import { BURST, FLASH, burstCount, newParticle, spawn, tickParticle, type Feel, type Particle } from './armfeel.ts';

// One shared 48-slot InstancedMesh, no shadows, one draw call. `burst` fills the next slots of the ring; `update` moves, shrinks and dims them.
export function createBurstPool(scene: THREE.Scene) {
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), BURST.slots);   // unit-diameter droplets, unlit: the colour is the blood's own (a lit material came out bright red under the arena's sun), no glow
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.visible = false; mesh.castShadow = false; mesh.receiveShadow = false; mesh.name = 'armfeel burst';
  mesh.setColorAt(0, new THREE.Color(BURST.color));   // allocates the instance colour buffer once, up front
  scene.add(mesh);
  const slots: Particle[] = Array.from({ length: BURST.slots }, newParticle), pose = new THREE.Object3D(), color = new THREE.Color(), start = new THREE.Color(BURST.color), end = new THREE.Color(BURST.endColor), up = new THREE.Vector3(0, 1, 0), heading = new THREE.Vector3();
  let next = 0, live = 0;
  return {
    mesh,
    get alive() { return live; },
    get capacity() { return slots.length; },
    burst(feel: Feel, x: number, y: number, z: number, dx: number, dz: number, kill: boolean): void {
      const count = burstCount(feel, kill);
      for (let i = 0; i < count; i++) spawn(slots[next++ % slots.length], i, count, x, y, z, dx, dz, kill, feel);
    },
    update(dt: number): void {
      live = 0;
      for (let i = 0; i < slots.length; i++) {
        const p = slots[i];
        if (tickParticle(p, dt)) {
          live++; const k = p.life / p.total, s = p.size * k;
          pose.position.set(p.x, p.y, p.z);
          if (heading.set(p.vx, p.vy, p.vz).lengthSq() > 1e-6) pose.quaternion.setFromUnitVectors(up, heading.normalize());   // the droplet's long axis follows its flight
          pose.scale.set(s, s * BURST.stretch, s);
          color.copy(end).lerp(start, k); mesh.setColorAt(i, color);
        } else pose.scale.setScalar(0);
        pose.updateMatrix(); mesh.setMatrixAt(i, pose.matrix);
      }
      mesh.visible = live > 0; mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    clear(): void { for (const p of slots) p.life = 0; live = 0; mesh.visible = false; },
    dispose(): void { scene.remove(mesh); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); mesh.dispose(); },
  };
}

// The struck body's flash: its materials' emissive goes near-white for 100 ms (Low: 0.4 of it), then comes back exactly. No light is added.
type Lit = THREE.MeshStandardMaterial;
const lit = (m: THREE.Material): m is Lit => (m as Lit).isMeshStandardMaterial === true;
const materialsOf = (root: THREE.Object3D): Lit[] => {
  const out = new Set<Lit>();
  root.traverse((o) => { if (o instanceof THREE.Mesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (lit(m)) out.add(m); });
  return [...out];
};
// A rig that shares a material with the other (two clones of one asset) gets its own copy, so the one that is struck is the one that flashes.
export function separateMaterials(keep: THREE.Object3D, other: THREE.Object3D): void {
  const owned = new Set(materialsOf(keep));
  other.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.material = Array.isArray(o.material) ? o.material.map((m: THREE.Material) => (owned.has(m as Lit) ? m.clone() : m)) : owned.has(o.material as Lit) ? o.material.clone() : o.material;
  });
}
export class BodyFlash {
  private mats: Lit[]; private saved: { color: THREE.Color; intensity: number }[]; private left = 0; private gain = 1;
  private readonly flash = new THREE.Color(FLASH.color);
  constructor(root: THREE.Object3D) { this.mats = materialsOf(root); this.saved = this.mats.map((m) => ({ color: m.emissive.clone(), intensity: m.emissiveIntensity })); }
  start(feel: Feel): void { if (feel === 'off') return; this.left = FLASH.seconds; this.gain = feel === 'low' ? FLASH.low : 1; this.apply(true); }
  update(dt: number): void {
    if (this.left <= 0) return;
    this.left -= dt;
    if (this.left <= 0) { this.left = 0; this.apply(false); }
  }
  clear(): void { if (this.left > 0) { this.left = 0; this.apply(false); } }
  private apply(on: boolean): void {
    for (let i = 0; i < this.mats.length; i++) {
      const m = this.mats[i], s = this.saved[i];
      if (on) { m.emissive.copy(this.flash); m.emissiveIntensity = this.gain; } else { m.emissive.copy(s.color); m.emissiveIntensity = s.intensity; }
    }
  }
}
