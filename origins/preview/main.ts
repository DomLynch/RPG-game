import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import warriorUrl from '../../src/assets/warrior.glb?url';
import { buildArena } from '../../src/arena.ts';
import { ARENA_THEMES } from '../../src/arena-themes.ts';
import { budgetTextures, FIGHTER_TEXTURE_CAP, phoneTier, pixelCap } from '../../src/quality.ts';
import { buildExchange, FORGE, PASSAGE, walkable } from './exchange.ts';

// The walk out (Origins look prototype): the Ash Pit exactly as the game builds it, its light recipe from scene.ts, then the passage, the
// Concord Exchange and the bank's front in greybox. You walk it: drag (up walks, sideways turns) or WASD / arrows. No tour (Dom 2026-10-06).
const theme = ARENA_THEMES['1'], PHONE = phoneTier();
const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, pixelCap(PHONE)));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = theme.exposure;
const scene = new THREE.Scene();
scene.background = new THREE.Color(theme.fog);
scene.fog = new THREE.FogExp2(theme.fog, theme.fogDensity);
const camera = new THREE.PerspectiveCamera(51, 1, 0.1, 180);
scene.add(new THREE.HemisphereLight(...theme.hemisphere));
const sun = new THREE.DirectionalLight(...theme.sun), sunHome = new THREE.Vector3(...(theme.light?.sun ?? [-15, 26, -18]));
sun.castShadow = true; sun.shadow.mapSize.set(PHONE ? 1024 : 2048, PHONE ? 1024 : 2048); sun.shadow.normalBias = 0.04;
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 90 });
scene.add(sun, sun.target);

const arena = buildArena(scene, theme), exchange = buildExchange(scene, arena.materials);
// Preview-only: Arena 1's painted far world is a ring ~40 m out, and the Exchange stands beyond it. Open the ring where the gate faces (−z)
// so the Pit looks out onto the Exchange; the painting keeps the other 290°. A look question for Dom, not a change to arena.ts.
const GAP = 0.62;   // radians either side of the gate
arena.group.traverse((o) => {
  if (o.name !== 'backdrop' || !(o instanceof THREE.Mesh)) return;
  o.geometry.dispose();
  o.geometry = new THREE.CylinderGeometry(40, 40, 40, 64, 1, true, Math.PI - o.rotation.y + GAP, Math.PI * 2 - GAP * 2);   // local angle: the ring is turned by theme.backdropTurn
});
function environment(sky?: THREE.Texture) {
  const pmrem = new THREE.PMREMGenerator(renderer), room = sky ? null : new RoomEnvironment();
  scene.environment = (room ? pmrem.fromScene(room, 0.04) : pmrem.fromEquirectangular(sky!)).texture;
  scene.environmentIntensity = room ? 0.45 : 1; room?.dispose(); pmrem.dispose();
}
environment(); void arena.ready.then(() => environment(arena.sky));
const forgeGlow = new THREE.PointLight('#ff7a2a', 14, 10, 1.6); forgeGlow.position.copy(exchange.hearth); scene.add(forgeGlow);
const warm = exchange.braziers.slice(0, PHONE ? 2 : 4).map((b) => { const l = new THREE.PointLight('#ff8a3a', 9, 9, 1.8); l.position.set(b.x, 1.9, b.z); scene.add(l); return l; });

// The walker: the game's own hero (src/assets/warrior.glb, Dom 2026-10-06 "use our real char"), Idle and Walk from his rig. The capsule
// holds his place until the file lands, and stays if it never does.
const hero = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.15, 4, 12), new THREE.MeshStandardMaterial({ color: '#4a3b2e', roughness: 0.9 }));
body.position.y = 0.88; body.castShadow = true;
const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ad9365', metalness: 0.65, roughness: 0.45 }));
cap.position.y = 1.62; hero.add(body, cap); scene.add(hero);
let mixer: THREE.AnimationMixer | undefined, idle: THREE.AnimationAction | undefined, walk: THREE.AnimationAction | undefined;
new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(warriorUrl).then((gltf) => {
  gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  if (PHONE) budgetTextures(gltf.scene, FIGHTER_TEXTURE_CAP);   // the game's iPhone black-fighters guard (characters.ts loadFighter)
  mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = (name: string) => { const c = THREE.AnimationClip.findByName(gltf.animations, name); return c ? mixer!.clipAction(c) : undefined; };
  idle = clip('Idle'); walk = clip('Walk');
  idle?.play(); walk?.play(); walk?.setEffectiveWeight(0);
  hero.remove(body, cap); hero.add(gltf.scene);
}).catch((error: unknown) => console.warn('hero did not load; the capsule stands in', error));

let heading = Math.PI, stick: { x0: number; y0: number; x: number; y: number } | null = null;
const state = { x: 0, z: 3 }, keys = new Set<string>();
const place = document.getElementById('place')!, ring = document.getElementById('stick')!;
canvas.addEventListener('pointerdown', (e) => { stick = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY }; Object.assign(ring.style, { display: 'block', left: `${e.clientX}px`, top: `${e.clientY}px` }); canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (stick) { stick.x = e.clientX; stick.y = e.clientY; } });
for (const end of ['pointerup', 'pointercancel'] as const) canvas.addEventListener(end, () => { stick = null; ring.style.display = 'none'; });
addEventListener('keydown', (e) => keys.add(e.code)); addEventListener('keyup', (e) => keys.delete(e.code)); addEventListener('blur', () => keys.clear());
const held = (...codes: string[]) => codes.some((c) => keys.has(c)) ? 1 : 0;

const WALK = 2.3, TURN = 1.9, eye = new THREE.Vector3(), look = new THREE.Vector3(), camAt = new THREE.Vector3(0, 2.6, 8);
function step(dt: number) {
  let forward = held('KeyW', 'ArrowUp') - held('KeyS', 'ArrowDown') * 0.6, turn = held('KeyA', 'ArrowLeft') - held('KeyD', 'ArrowRight');
  if (stick) {
    const sx = (stick.x - stick.x0) / 48, sy = (stick.y0 - stick.y) / 48;
    forward = Math.max(-0.6, Math.min(1, sy)); turn = -Math.max(-1, Math.min(1, sx));
  }
  heading += turn * TURN * dt;
  const nx = state.x + Math.sin(heading) * forward * WALK * dt, nz = state.z + Math.cos(heading) * forward * WALK * dt;
  if (walkable(nx, nz)) { state.x = nx; state.z = nz; } else if (walkable(nx, state.z)) state.x = nx; else if (walkable(state.x, nz)) state.z = nz;
  if (state.z < -5) arena.raiseGate(true);
  hero.position.set(state.x, 0, state.z); hero.rotation.y = heading;
  body.position.y = 0.88 + (forward ? Math.abs(Math.sin(performance.now() / 160)) * 0.04 : 0);
  if (mixer && idle && walk) { const w = THREE.MathUtils.damp(walk.getEffectiveWeight(), Math.abs(forward) > 0.05 ? 1 : 0, 8, dt); walk.setEffectiveWeight(w); idle.setEffectiveWeight(1 - w); walk.timeScale = forward < 0 ? -1 : 1; mixer.update(dt); }
  // Follow camera: behind and above; tighter and lower in the passage so it stays under the vault.
  const inPassage = state.z < -9 && state.z > PASSAGE.to - 1.5, back = inPassage ? 3.4 : 5.2, up = inPassage ? 2.1 : 2.7;
  eye.set(state.x - Math.sin(heading) * back, up, state.z - Math.cos(heading) * back);
  camAt.lerp(eye, 1 - Math.exp(-dt * 4));
  look.set(state.x + Math.sin(heading) * 3, 1.5, state.z + Math.cos(heading) * 3);
  camera.position.copy(camAt); camera.lookAt(look);
  const atForge = Math.hypot(state.x - FORGE.x, state.z - FORGE.z) < 6;
  place.textContent = atForge ? 'The Blacksmith' : state.z > -11 ? 'The Pit' : state.z > PASSAGE.to ? 'The Gladiator Gate' : state.z > -58 ? 'The Concord Exchange' : 'The Exchange — the bank';
  sun.position.copy(hero.position).add(sunHome); sun.target.position.copy(hero.position);
}

function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  step(dt); arena.update(dt, [], camera); exchange.update(time);
  forgeGlow.intensity = 14 * (0.8 + 0.2 * Math.sin(time * 7.1) * Math.sin(time * 3.7));
  warm.forEach((l, i) => { l.intensity = 9 * (0.85 + 0.15 * Math.sin(time * 9 + i * 2.1) * Math.sin(time * 5.3 + i)); });
  renderer.render(scene, camera);
});
(window as unknown as { originsPreview: unknown }).originsPreview = { state, place: (x: number, z: number, h: number) => { state.x = x; state.z = z; heading = h; } };
