// Test-only hooks for the browser row scripts/origins-late-stream-check.mjs (a model that streams into the scene after the upload plan's last clean look must hold [zone ready] until it is uploaded).
// Kept out of main.ts so the page gains no literals; every hook is inert unless the row asks (?holdCompile=1 for the gate, originsPreview.injectLate() for the mesh).
import * as THREE from 'three';

export function createLateStream(search: string, scene: THREE.Scene, uploaded: WeakSet<object>) {
  let release = () => {}, mat: THREE.Material | undefined;
  const hold = new URLSearchParams(search).has('holdCompile') ? new Promise<void>((r) => { release = r; }) : undefined;   // the scene-material compiles wait on it, so programsInFlight stays above 0 after the last clean look
  return {
    hold: (): Promise<unknown> | undefined => hold,
    release: () => release(),
    /** One fresh mesh with a fresh material (default box, default material: nothing tuned). */
    inject: () => { const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); mat = m.material as THREE.Material; scene.add(m); },
    state: () => ({ injected: !!mat, uploaded: !!mat && uploaded.has(mat) }),
  };
}
