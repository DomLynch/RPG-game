// MEASUREMENT ONLY (web/fx-profile, never merged): counts Object3D.updateMatrixWorld visits per scene-level branch, for window.__umw (scripts/phone-perf-probe.mjs diffs it per phase).
// Imported from main.ts by scripts/gpu-run/umw-fx.sh at build time; the same 'three' instance the game uses, so the prototype patch sees every visit.
import * as THREE from 'three';

type Branch = { calls: number; bones: number; meshes: number; manual: number; roots: Set<THREE.Object3D> };
const proto = THREE.Object3D.prototype, original = proto.updateMatrixWorld;
const total = { calls: 0, bones: 0, meshes: 0, manual: 0, rootCalls: 0, sceneCalls: 0 }, byBranch = new Map<string, Branch>(), keyOf = new WeakMap<THREE.Object3D, { key: string; top: THREE.Object3D }>();
let depth = 0;
const classify = (o: THREE.Object3D) => {
  const hit = keyOf.get(o); if (hit) return hit;
  let top = o; while (top.parent && top.parent.type !== 'Scene') top = top.parent;
  const named = (n: THREE.Object3D | null) => { while (n) { if (n.name) return n.name; n = n.parent; } return ''; };   // the nearest name up the chain: rigs and props are usually named below an unnamed wrapper
  const out = { key: `${top.type}/${top.name || named(o).slice(0, 24) || '(unnamed)'}`, top }; keyOf.set(o, out); return out;
};
proto.updateMatrixWorld = function (this: THREE.Object3D, force?: boolean) {
  if (depth === 0) { total.rootCalls++; if (this.type === 'Scene') total.sceneCalls++; }
  depth++;
  total.calls++;
  const o = this, { key, top } = classify(o);
  let b = byBranch.get(key); if (!b) { b = { calls: 0, bones: 0, meshes: 0, manual: 0, roots: new Set() }; byBranch.set(key, b); }
  b.calls++; b.roots.add(top);
  if ((o as THREE.Bone).isBone) { total.bones++; b.bones++; }
  if ((o as THREE.Mesh).isMesh) { total.meshes++; b.meshes++; }
  if (!o.matrixAutoUpdate) { total.manual++; b.manual++; }   // matrixAutoUpdate already false: visited anyway, the static-prop candidates
  try { return original.call(this, force); } finally { depth--; }
} as typeof proto.updateMatrixWorld;
// Lights in the scene a render draws, sampled every 60th render (a traverse per frame would be its own cost): window.__lights = the last sample.
const rproto = THREE.WebGLRenderer.prototype, renderOriginal = rproto.render;
let renders = 0;
rproto.render = function (this: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera) {
  if (++renders % 60 === 0 && (scene as THREE.Scene).isScene) {
    const kinds: Record<string, number> = {}; let shadowCasters = 0, visible = 0, total = 0;
    scene.traverse((o) => { const l = o as THREE.Light; if (!l.isLight) return; total++; if (l.visible) { visible++; kinds[l.type] = (kinds[l.type] || 0) + 1; if (l.castShadow) shadowCasters++; } });
    (window as unknown as { __lights: unknown }).__lights = { total, visible, shadowCasters, kinds, programs: this.info.programs?.length ?? null, pixelRatio: this.getPixelRatio(), size: this.getSize(new THREE.Vector2()).toArray() };
  }
  return renderOriginal.call(this, scene, camera);
} as typeof rproto.render;
(window as unknown as { __umw: unknown }).__umw = {
  snap: () => ({ ...total, byBranch: Object.fromEntries([...byBranch].map(([k, v]) => [k, { calls: v.calls, bones: v.bones, meshes: v.meshes, manual: v.manual, roots: v.roots.size }])) }),
};
