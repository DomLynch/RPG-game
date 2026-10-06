import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildArena } from '../../src/arena.ts';
import { ARENA_THEMES } from '../../src/arena-themes.ts';
import { phoneTier, pixelCap } from '../../src/quality.ts';
import { BANK_STEP_Z, buildExchange, FORGE, PASSAGE, walkable } from './exchange.ts';

// The walk out (Origins look prototype): the Ash Pit exactly as the game builds it, its light recipe from scene.ts, then the passage, the
// Concord Exchange and the bank's front in greybox. A tour walks it by itself; a drag takes over (up walks, sideways turns).
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

// The walker: a capsule in the hero's place (no rig in a greybox), bronze cap so it reads from behind.
const hero = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.15, 4, 12), new THREE.MeshStandardMaterial({ color: '#4a3b2e', roughness: 0.9 }));
body.position.y = 0.88; body.castShadow = true;
const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ad9365', metalness: 0.65, roughness: 0.45 }));
cap.position.y = 1.62; hero.add(body, cap); scene.add(hero);

const TOUR: [number, number][] = [[0, 3], [0, -6], [0, -24], [0, -36], [-5.5, -44], [-2, -54], [-6.2, -59.5], [-3, -62.5], [0, -63.5], [0, BANK_STEP_Z + 1.2]];
let heading = Math.PI, leg = 1, touring = true, stick: { x0: number; y0: number; x: number; y: number } | null = null;
const state = { x: TOUR[0][0], z: TOUR[0][1] };
const place = document.getElementById('place')!, tourButton = document.getElementById('tour') as HTMLButtonElement, ring = document.getElementById('stick')!;
function restart() { state.x = TOUR[0][0]; state.z = TOUR[0][1]; heading = Math.PI; leg = 1; touring = true; arena.raiseGate(false); tourButton.textContent = 'Pause tour'; }
tourButton.onclick = () => { touring = !touring; tourButton.textContent = touring ? 'Pause tour' : 'Resume tour'; };
document.getElementById('restart')!.onclick = restart;
canvas.addEventListener('pointerdown', (e) => { stick = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY }; touring = false; tourButton.textContent = 'Resume tour'; Object.assign(ring.style, { display: 'block', left: `${e.clientX}px`, top: `${e.clientY}px` }); canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (stick) { stick.x = e.clientX; stick.y = e.clientY; } });
for (const end of ['pointerup', 'pointercancel'] as const) canvas.addEventListener(end, () => { stick = null; ring.style.display = 'none'; });

const WALK = 2.3, TURN = 1.9, eye = new THREE.Vector3(), look = new THREE.Vector3(), camAt = new THREE.Vector3(0, 2.6, 8);
function step(dt: number) {
  let forward = 0, turn = 0;
  if (touring && leg < TOUR.length) {
    const [tx, tz] = TOUR[leg], dx = tx - state.x, dz = tz - state.z, want = Math.atan2(dx, dz);
    turn = Math.max(-1, Math.min(1, Math.atan2(Math.sin(want - heading), Math.cos(want - heading)) * 2.5)); forward = 1;
    if (Math.hypot(dx, dz) < 0.8) leg++;
    if (leg >= TOUR.length) { touring = false; tourButton.textContent = 'Resume tour'; leg = 1; }
  } else if (stick) {
    const sx = (stick.x - stick.x0) / 48, sy = (stick.y0 - stick.y) / 48;
    forward = Math.max(-0.6, Math.min(1, sy)); turn = -Math.max(-1, Math.min(1, sx));
  }
  heading += turn * TURN * dt;
  const nx = state.x + Math.sin(heading) * forward * WALK * dt, nz = state.z + Math.cos(heading) * forward * WALK * dt;
  if (walkable(nx, nz)) { state.x = nx; state.z = nz; } else if (walkable(nx, state.z)) state.x = nx; else if (walkable(state.x, nz)) state.z = nz;
  if (state.z < -5) arena.raiseGate(true);
  hero.position.set(state.x, 0, state.z); hero.rotation.y = heading;
  body.position.y = 0.88 + (forward ? Math.abs(Math.sin(performance.now() / 160)) * 0.04 : 0);
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
(window as unknown as { originsPreview: unknown }).originsPreview = { state, restart, setTouring: (on: boolean) => { touring = on; }, place: (x: number, z: number, h: number) => { state.x = x; state.z = z; heading = h; touring = false; } };
