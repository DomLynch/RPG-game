import * as THREE from 'three';
// `?look=stone-tex`: a look test. Swaps the arena stone's procedural maps for a CC0 photo set (public/arena/stone-tex/, Poly Haven "Castle Wall Slates", Rob Tuytel). Absent = today's game.
export const stoneTexFlag = (search: string): boolean => (new URLSearchParams(search).get('look') ?? '').split(',').includes('stone-tex');
export function applyStoneTex(stone: THREE.MeshStandardMaterial, base: string, isDisposed: () => boolean): void {
  const loader = new THREE.TextureLoader();
  const load = (file: string, srgb: boolean, set: (t: THREE.Texture) => void) => loader.load(`${base}arena/stone-tex/${file}`, (t) => {
    if (isDisposed()) { t.dispose(); return; }
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4;
    set(t); stone.needsUpdate = true;
  });
  load('albedo.webp', true, (t) => { stone.map = t; });
  load('normal.webp', false, (t) => { stone.normalMap = t; });
}
