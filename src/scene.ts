import * as THREE from 'three';
import { captureException } from '@sentry/browser';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadWarriors } from './characters.ts';
import { SWORD, DEFENCE, ATTACKS, type Practice } from './combat.ts';
import { TARGET, wrapAngle, type State } from './sim.ts';

export function cameraPose(state: State, yaw: number, pitch: number, locked: boolean, target: { x: number; z: number } = TARGET) {
  const distance = Math.hypot(state.x - target.x, state.z - target.z);
  const back = locked ? Math.max(6, distance * 0.62 + 2.8) : 7.5 * Math.cos(pitch);
  let x = state.x + Math.sin(yaw) * back, z = state.z + Math.cos(yaw) * back;
  // Camera stays inside the colonnade even when the fighter reaches the arena edge.
  const radius = Math.hypot(x, z);
  if (radius > 11.5) { x *= 11.5 / radius; z *= 11.5 / radius; }
  return {
    x, y: locked ? Math.max(4.7, distance * 1.3) : 1 + 7.5 * Math.sin(pitch), z,
    lookX: locked ? (state.x + target.x) / 2 : state.x,
    lookZ: locked ? (state.z + target.z) / 2 : state.z,
  };
}

export function createScene(canvas: HTMLCanvasElement, assetStatus: (status: string) => void = () => {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9ca8a6');
  scene.fog = new THREE.FogExp2('#9ca8a6', 0.018);
  let environmentTarget: THREE.WebGLRenderTarget | undefined;
  function rebuildEnvironment() {
    const environment = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
    try {
      const target = pmrem.fromScene(environment, 0.04);
      environmentTarget?.dispose(); environmentTarget = target; scene.environment = target.texture;
    } finally { environment.dispose(); pmrem.dispose(); }
  }
  rebuildEnvironment(); scene.environmentIntensity = 0.65;
  const camera = new THREE.PerspectiveCamera(51, 1, 0.1, 180);
  const stone = new THREE.MeshStandardMaterial({ color: '#878579', roughness: 0.98 });
  const darkStone = new THREE.MeshStandardMaterial({ color: '#555b56', roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: '#89949b', metalness: 0.72, roughness: 0.4 });
  const brass = new THREE.MeshStandardMaterial({ color: '#ad9365', metalness: 0.65, roughness: 0.48 });
  const cloth = new THREE.MeshStandardMaterial({ color: '#3c514e', roughness: 1, side: THREE.DoubleSide });
  scene.add(new THREE.HemisphereLight('#d2e0e4', '#575c4c', 2.5));
  const sun = new THREE.DirectionalLight('#ffdfad', 3.6);
  sun.position.set(-15, 26, -18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 70 });
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = scene) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object);
    return object;
  }
  function box(w: number, h: number, d: number, x: number, y: number, z: number, material = stone, parent: THREE.Object3D = scene) {
    return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
  }
  // The playable surface is flat. All silhouette/detail architecture is outside it.
  mesh(new THREE.CylinderGeometry(9.5, 10, 0.5, 80), darkStone, 0, -0.28, 0);
  mesh(new THREE.CylinderGeometry(9, 9, 0.1, 80), stone, 0, -0.03, 0);
  const joint = new THREE.MeshStandardMaterial({ color: '#4f514a', roughness: 1 });
  for (let i = -8; i <= 8; i++) {
    const length = Math.sqrt(81 - i * i) * 2;
    box(length, 0.006, 0.015, 0, 0.025, i, joint);
    for (let j = -8; j <= 8; j += 2) {
      const x = j + (Math.abs(i) % 2 ? 1 : 0);
      if (Math.hypot(x, i + 0.5) < 8.6) box(0.015, 0.006, 0.96, x, 0.025, i + 0.5, joint);
    }
  }
  const ringMaterial = new THREE.MeshStandardMaterial({ color: '#bba57b', metalness: 0.35, roughness: 0.7, side: THREE.DoubleSide });
  for (const radius of [3.3, 8.6]) {
    const ring = mesh(new THREE.RingGeometry(radius, radius + 0.035, 96), ringMaterial, 0, 0.033, 0);
    ring.rotation.x = -Math.PI / 2; ring.castShadow = false;
  }
  mesh(new THREE.CylinderGeometry(65, 65, 1, 64), new THREE.MeshStandardMaterial({ color: '#555e50', roughness: 1 }), 0, -1.1, 0);
  // Repeated stone bays give a recognisable, restrained medieval courtyard silhouette.
  for (let i = 0; i < 18; i++) {
    const angle = i * Math.PI * 2 / 18;
    const bay = new THREE.Group(); scene.add(bay);
    bay.position.set(Math.sin(angle) * 13.3, 0, Math.cos(angle) * 13.3); bay.rotation.y = angle;
    box(4.55, 1.3, 0.8, 0, 0.45, 0, darkStone, bay);
    box(0.7, 5.4, 0.9, -2.25, 2.5, 0, stone, bay);
    box(0.95, 0.25, 1.1, -2.25, 5.2, 0, darkStone, bay);
    box(4.5, 0.45, 0.8, 0, 4.9, 0, stone, bay);
    if (i % 3 === 0) {
      box(0.08, 3.1, 0.08, -1.3, 4, -0.8, brass, bay);
      box(1.4, 0.07, 0.07, -0.65, 5.25, -0.8, brass, bay);
      box(1.12, 2.2, 0.035, -0.66, 4.1, -0.8, cloth, bay);
      box(0.07, 1.2, 0.04, -0.66, 4.2, -0.83, brass, bay);
      box(0.6, 0.07, 0.04, -0.66, 4.5, -0.83, brass, bay);
    }
  }
  // Distant faceted terrain is atmospheric scenery, not gameplay collision.
  for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI * 2 / 24;
    const height = 9 + (Math.sin(i * 7.31) + 1) * 7;
    const mountain = mesh(new THREE.ConeGeometry(12 + i % 5, height, 7), darkStone, Math.sin(angle) * 65, height / 2 - 2, Math.cos(angle) * 65);
    mountain.rotation.y = i; mountain.castShadow = false;
  }
  function capsule(x: number, z: number, material: THREE.Material) {
    const group = new THREE.Group(); scene.add(group); group.position.set(x, 0, z);
    mesh(new THREE.CapsuleGeometry(0.31, 1.12, 6, 14), material, 0, 0.88, 0, group);
    const band = mesh(new THREE.TorusGeometry(0.315, 0.025, 5, 20), brass, 0, 0.8, 0, group); band.rotation.x = Math.PI / 2;
    box(0.055, 0.85, 0.065, 0, 0.95, 0.305, brass, group);
    return group;
  }
  const player = capsule(0, 4, metal);
  const opponent = capsule(TARGET.x, TARGET.z, new THREE.MeshStandardMaterial({ color: '#6d5447', roughness: 0.8, metalness: 0.25 }));
  let warriors: Awaited<ReturnType<typeof loadWarriors>> | undefined;
  assetStatus('Loading warriors…');
  const ready = loadWarriors(new URL('./assets/warrior.glb', import.meta.url).href).then(loaded => {
    warriors = loaded;
    for (const proxy of [player, opponent]) {
      proxy.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      proxy.clear();
    }
    player.add(loaded.player.anchor); opponent.add(loaded.opponent.anchor);
    assetStatus('');
  }).catch(error => {
    captureException(error);
    assetStatus('Warrior art could not load. Movement still works; reload to retry.');
  });
  const marker = mesh(new THREE.RingGeometry(0.56, 0.59, 48), brass, TARGET.x, 0.04, TARGET.z);
  marker.rotation.x = -Math.PI / 2; marker.castShadow = false;
  const sparkPositions = new Float32Array(12 * 3), sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  const sparkMaterial = new THREE.PointsMaterial({ color: '#ffe4af', size: .045, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial); sparks.frustumCulled = false; sparks.visible = false; scene.add(sparks);
  let impact = 0, lastHealth = 100, lastPlayerHealth = 100, lastReaction = 0, lastEnemyAge = -1, lastEnemyStamina = 100;
  const desired = new THREE.Vector3(), look = new THREE.Vector3(), aim = new THREE.Vector3(0, 1, 0);
  let yaw = 0, pitch = 0.45, heading = Math.PI, started = false;
  let ratio = Math.min(devicePixelRatio, 1.5);
  const resize = () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); };
  resize(); window.addEventListener('resize', resize);
  return {
    renderer, ready,
    get yaw() { return yaw; },
    orbit(dx: number, dy: number) { yaw -= dx * 0.005; pitch = THREE.MathUtils.clamp(pitch + dy * 0.003, 0.22, 0.9); },
    recenter() { yaw = 0; pitch = 0.45; started = false; },
    lowerResolution() { if (ratio > 1) { ratio = 1; renderer.setPixelRatio(ratio); resize(); } },
    restoreGraphics() { this.lowerResolution(); rebuildEnvironment(); },
    render(state: State, locked: boolean, dt: number, practice: Practice) {
      const contact = practice.enemyStamina < lastEnemyStamina || practice.health < lastHealth || practice.playerHealth < lastPlayerHealth || (practice.result === 'parried' && practice.reaction > lastReaction) || (practice.result === 'blocked' && practice.enemyAge === DEFENCE.enemyContact && lastEnemyAge !== practice.enemyAge);
      if (contact && dt > 0) { impact = .18; sparks.position.set((state.x + practice.enemy.x) / 2, 1.2, (state.z + practice.enemy.z) / 2); }
      lastHealth = practice.health; lastPlayerHealth = practice.playerHealth; lastReaction = practice.reaction; lastEnemyAge = practice.enemyAge; lastEnemyStamina = practice.enemyStamina;
      impact = Math.max(0, impact - dt); sparks.visible = impact > 0;
      if (impact > 0) {
        const t = .18 - impact; sparkMaterial.opacity = impact / .18;
        for (let i = 0; i < 12; i++) { sparkPositions[i * 3] = Math.sin(i * 2.4) * t * 2; sparkPositions[i * 3 + 1] = Math.cos(i * 1.7) * t * 2 - t * t * 4; sparkPositions[i * 3 + 2] = Math.cos(i * 2.4) * t * 2; }
        sparkGeometry.attributes.position.needsUpdate = true;
      }
      const animationDt = impact > .13 ? 0 : dt;
      const travel = started && dt > 0 ? Math.hypot(state.x - player.position.x, state.z - player.position.z) / dt : 0;
      const enemyTravel = started && dt > 0 ? Math.hypot(practice.enemy.x - opponent.position.x, practice.enemy.z - opponent.position.z) / dt : 0;
      player.position.set(state.x, 0, state.z); opponent.position.set(practice.enemy.x, 0, practice.enemy.z);
      marker.position.set(practice.enemy.x, .04, practice.enemy.z);
      const pose = practice.phase === 'dead' ? 'death' : practice.phase === 'hurt' ? 'hit' : practice.phase;
      const duration = pose === 'draw' ? SWORD.draw : pose === 'roll' ? DEFENCE.roll : pose === 'hit' ? SWORD.reaction : pose === 'death' ? SWORD.death : ATTACKS[practice.attack].recovery;
      warriors?.player.update(travel, animationDt, pose, Math.min(1, practice.age / duration), practice.attack, ATTACKS[practice.attack].contact / duration);
      const enemyProgress = practice.enemyAge <= DEFENCE.enemyContact ? practice.enemyAge / DEFENCE.enemyContact * SWORD.contact / SWORD.recovery : SWORD.contact / SWORD.recovery + (practice.enemyAge - DEFENCE.enemyContact) / (DEFENCE.enemyRecovery - DEFENCE.enemyContact) * (1 - SWORD.contact / SWORD.recovery);
      warriors?.opponent.update(practice.enemyMode === 'retreat' ? -enemyTravel : enemyTravel, animationDt, !practice.health ? 'death' : practice.reaction ? 'hit' : practice.enemyAttacking && practice.playerHealth ? 'attack' : practice.enemyMode === 'guard' ? 'guard' : 'ready', practice.enemyAttacking ? enemyProgress : Math.max(0, 1 - practice.reaction / practice.reactionDuration));
      brass.color.set(practice.enemyAttacking && practice.enemyAge < DEFENCE.enemyContact ? '#e7a35e' : '#ad9365');
      marker.visible = practice.health > 0;
      if (practice.health) opponent.rotation.y = practice.enemyAttacking ? practice.enemyHeading : Math.atan2(state.x - practice.enemy.x, state.z - practice.enemy.z);
      const blend = 1 - Math.exp(-dt * 8);
      if (locked) {
        const lockYaw = Math.atan2(state.x - practice.enemy.x, state.z - practice.enemy.z);
        yaw += wrapAngle(lockYaw - yaw) * blend;
      }
      const cameraTarget = cameraPose(state, yaw, pitch, locked, practice.enemy);
      look.set(cameraTarget.lookX, 1, cameraTarget.lookZ); desired.set(cameraTarget.x, cameraTarget.y, cameraTarget.z);
      heading += wrapAngle((locked && travel < 0.05 && practice.phase !== 'attack' ? Math.atan2(practice.enemy.x - state.x, practice.enemy.z - state.z) : state.heading) - heading) * blend;
      if (['attack', 'roll', 'guard', 'hurt', 'dead'].includes(practice.phase)) heading += wrapAngle(state.heading - heading) * (1 - Math.exp(-dt * 30));
      player.rotation.y = heading;
      camera.position.lerp(desired, started ? blend : 1); aim.lerp(look, started ? blend : 1);
      camera.lookAt(aim); started = true;
      renderer.render(scene, camera);
    }
  };
}
