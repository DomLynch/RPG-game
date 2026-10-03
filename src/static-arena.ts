// Owner-supplied image 1: opt-in painted stage. Combat coordinates and the classic arena stay unchanged.
import * as THREE from 'three';
import { PLAY_RADIUS, SAND_TILE, type Arena, type ArenaMaterials } from './arena.ts';
import { SETTLE, type CameraRig, type CameraFinish } from './camera.ts';
import type { State } from './sim.ts';

export const ART1 = { width: 1672, height: 941, floorY: 630 / 941, worldWidth: 20.42, pitch: Math.asin(155 / 700), distance: 1000 } as const;
const direction = new THREE.Vector3(0, Math.sin(ART1.pitch), Math.cos(ART1.pitch));
const up = new THREE.Vector3(0, Math.cos(ART1.pitch), -Math.sin(ART1.pitch));
const height = ART1.worldWidth * ART1.height / ART1.width;

export function buildStaticArena(scene: THREE.Scene, load = () => new THREE.TextureLoader().loadAsync(new URL('./assets/arena/art1.webp', import.meta.url).href)): Arena {
  const group = new THREE.Group(); group.name = 'arena-art1'; scene.add(group);
  const texture = new THREE.Texture(); texture.colorSpace = THREE.SRGBColorSpace;
  let pending: Promise<void> | undefined, disposed = false;
  const ready = () => pending ??= load().then(loaded => {
    if (!disposed) { texture.image = loaded.image; texture.needsUpdate = true; }
    loaded.dispose();
  }).catch((error: unknown) => { pending = undefined; throw error; });
  const art = new THREE.MeshBasicMaterial({ map: texture, fog: false, toneMapped: false, depthTest: false, depthWrite: false });
  function place(mesh: THREE.Mesh, depth: number) {
    const scale = (ART1.distance + depth) / ART1.distance;
    mesh.scale.setScalar(scale);
    mesh.rotation.x = -ART1.pitch;
    mesh.position.copy(direction).multiplyScalar(-depth).addScaledVector(up, (ART1.floorY - .5) * height * scale);
    group.add(mesh);
  }
  const board = new THREE.Mesh(new THREE.PlaneGeometry(ART1.worldWidth, height), art);
  board.name = 'painted-arena'; board.renderOrder = -10000; place(board, 0);
  // Re-sample the same artwork only below its foreground parapet. No redraw or extra texture.
  const boundary = [[0, .69], [.16, .81], [.38, .90], [.60, .92], [.84, .85], [1, .70]];
  const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
  for (const [u, v] of boundary) {
    for (const y of [v, 1]) { vertices.push((u - .5) * ART1.worldWidth, (.5 - y) * height, 0); uv.push(u, 1 - y); }
  }
  for (let i = 0; i < boundary.length - 1; i++) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 2, n + 1, n + 3); }
  const foregroundGeometry = new THREE.BufferGeometry();
  foregroundGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  foregroundGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); foregroundGeometry.setIndex(indices);
  const foregroundMaterial = art.clone(); foregroundMaterial.transparent = true; foregroundMaterial.depthTest = false; foregroundMaterial.depthWrite = false;
  const foreground = new THREE.Mesh(foregroundGeometry, foregroundMaterial);
  foreground.name = 'painted-foreground'; foreground.renderOrder = 10000; place(foreground, 0);
  const floorGeometry = new THREE.CircleGeometry(PLAY_RADIUS, 96); floorGeometry.rotateX(-Math.PI / 2);
  const positions = floorGeometry.attributes.position, floorUV = floorGeometry.attributes.uv;
  for (let i = 0; i < positions.count; i++) floorUV.setXY(i, positions.getX(i) / SAND_TILE, positions.getZ(i) / SAND_TILE);
  const floor = new THREE.Mesh(floorGeometry, new THREE.ShadowMaterial({ opacity: .3, depthWrite: false }));
  floor.name = 'arena-floor'; floor.receiveShadow = true; group.add(floor);
  const materials = Object.fromEntries(['sand', 'stone', 'iron', 'cloth', 'coal'].map(name => [name, new THREE.MeshStandardMaterial({ color: '#756052', roughness: .9 })])) as ArenaMaterials;
  const sky = new THREE.DataTexture(new Uint8Array([80, 60, 45, 255]), 1, 1); sky.needsUpdate = true;
  return { group, floor, materials, sky, get ready() { return ready(); }, guards: { built: 0, of: 0 }, update() {}, raiseGate() {}, dispose() {
    disposed = true; scene.remove(group); board.geometry.dispose(); foregroundGeometry.dispose(); floorGeometry.dispose();
    art.dispose(); foregroundMaterial.dispose(); floor.material.dispose(); texture.dispose(); sky.dispose();
    for (const material of Object.values(materials)) material.dispose();
  } };
}

// Very long focal distance gives a near-parallel projection while retaining the shared PerspectiveCamera/Pit API.
// Artwork and actors share the world transform: panning never slides feet over the painted floor.
export function createStaticCameraRig(camera: THREE.PerspectiveCamera): CameraRig {
  let started = false, finishAge = 0, settled = false, gate = false, stillFor = 0;
  const lastDrawn = new THREE.Vector3();
  const aim = new THREE.Vector3();
  return { camera, get yaw() { return 0; }, get started() { return started; },
    orbit() {}, recenter() { started = false; }, stopTour() {},
    gate(point) { gate = point !== null; }, get gating() { return gate; }, get touring() { return false; },
    get finishAge() { return finishAge; }, get settled() { return settled; }, shove() {}, tilt() {}, settle() {},
    update(dt: number, state: State, enemy: { x: number; z: number }, _locked: boolean, finish: CameraFinish | null) {
      finishAge = finish ? finishAge + dt : 0;
      if (!finish) { settled = false; stillFor = 0; }
      const span = Math.max(camera.aspect < 1 ? 8.5 : height, (Math.abs(state.x - enemy.x) + 3.5) / camera.aspect, Math.abs(state.z - enemy.z) * Math.sin(ART1.pitch) + 5);
      const target = new THREE.Vector3((state.x + enemy.x) / 2, 1.15, (state.z + enemy.z) / 2);
      if (gate) target.set(state.x, 1.15, state.z);
      if (started) aim.lerp(target, 1 - Math.exp(-dt * 8)); else aim.copy(target);
      camera.fov = 2 * Math.atan(span / (2 * ART1.distance)) * 180 / Math.PI;
      camera.near = 500; camera.far = 1400; camera.updateProjectionMatrix();
      camera.position.copy(aim).addScaledVector(direction, ART1.distance); camera.lookAt(aim); camera.updateMatrixWorld();
      if (finish && started && dt > 0) {
        stillFor = camera.position.distanceTo(lastDrawn) / dt < SETTLE.speed ? stillFor + dt : 0;
        if (finishAge >= SETTLE.min && stillFor >= SETTLE.still) settled = true;
      }
      lastDrawn.copy(camera.position); started = true;
    },
  };
}

// Pit and Gear borrow the same camera; restore the original lens before either places it a few metres from the hero.
export function restoreArenaLens(camera: THREE.PerspectiveCamera): void {
  camera.near = .1; camera.far = 180; camera.fov = 51; camera.updateProjectionMatrix();
}
