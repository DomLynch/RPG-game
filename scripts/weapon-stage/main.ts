// A weapon stage for design stills (sandbox ranged weapons): the game's own hero rig (/warrior.glb) holding a weapon part (/weapon.glb: a `WeaponDrawn` group) in hand_r (or hand_l with ?hand=l) with SwordDrawn's
// transform, the 'Armed' stance, on sand, at a fight-like camera at phone width. ?cam=fight|side|front, ?t=<seconds into the clip>. Sets window.stageReady when drawn. A tool, not shipped.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const q = new URLSearchParams(location.search), cam = q.get('cam') ?? 'fight', hand = q.get('hand') === 'l' ? 'hand_l' : 'hand_r', clipAt = Number(q.get('t') ?? 0.4);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#9b7a56'); scene.fog = new THREE.Fog('#9b7a56', 8, 30);
scene.add(new THREE.HemisphereLight('#fff0dd', '#4a3a2a', 1.15));
const sun = new THREE.DirectionalLight('#ffe6c0', 2.2); sun.position.set(-3, 5, 3); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 }); scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8f6c47', roughness: 1 })); ground.receiveShadow = true; scene.add(ground);
const camera = new THREE.PerspectiveCamera(cam === 'fight' || cam === 'wide' ? 51 : 40, innerWidth / innerHeight, 0.1, 80);
const view = { fight: [[1.2, 1.7, 3.1], [0, 1.0, 0]], wide: [[1.1, 1.5, 4.6], [-0.3, 1.0, 0]], side: [[2.6, 1.2, 0.2], [0, 1.05, 0]], front: [[0.6, 1.3, 2.7], [0, 1.0, 0]] }[cam] ?? [[1.2, 1.7, 3.1], [0, 1.0, 0]];
camera.position.set(...(view[0] as [number, number, number])); camera.lookAt(...(view[1] as [number, number, number]));

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const [hero, weapon] = await Promise.all([loader.loadAsync('/warrior.glb'), loader.loadAsync('/weapon.glb')]);
const rig = hero.scene; rig.updateMatrixWorld(true);
for (const name of ['SwordDrawn', 'SwordSheathed']) rig.getObjectByName(name)?.removeFromParent();
const part = weapon.scene.getObjectByName('WeaponDrawn') ?? weapon.scene, bone = rig.getObjectByName(hand);
if (!bone) throw new Error(`no ${hand}`);
part.rotation.set(Math.PI / 2, 0, 0); part.position.set(0, 0.08, 0.015);   // SwordDrawn's transform under the hand
part.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
bone.add(part); scene.add(rig);
if (q.get('hold') === 'upright') { rig.updateMatrixWorld(true); const inv = bone.getWorldQuaternion(new THREE.Quaternion()).invert(); part.quaternion.copy(inv); part.position.set(0, 0, 0); }   // the part stands world-upright (+Y up, +Z to the camera): a staff planted, a bow held vertical
rig.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.frustumCulled = false; } });
if (q.get('solo')) {   // the model alone for a design sheet: no hero; a staff and a bow stand upright, a crossbow lies with its muzzle to the right and its top up
  scene.remove(rig); const solo = new THREE.Group(), model = part; solo.add(model); model.quaternion.identity(); model.position.set(0, 0, 0);
  if (q.get('solo') === 'lie') model.rotation.z = -Math.PI / 2; solo.rotation.y = -0.6; scene.add(solo); solo.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(solo), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  solo.position.sub(mid); solo.position.y += size.y / 2 + 0.05; ground.position.y = 0.02;
  const fit = Math.max(size.y, size.x / (innerWidth / innerHeight)) * 0.78 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  console.log('solo', JSON.stringify({ size: size.toArray(), mid: mid.toArray(), fit, meshes: (() => { let n = 0; solo.traverse((o) => { if (o instanceof THREE.Mesh) n++; }); return n; })() }));
  camera.position.set(fit * 0.35, size.y / 2 + 0.2, fit); camera.lookAt(0, size.y / 2 + 0.05, 0);
  renderer.render(scene, camera); requestAnimationFrame(() => { renderer.render(scene, camera); (window as unknown as { stageReady: boolean }).stageReady = true; });
} else {
  const mixer = new THREE.AnimationMixer(rig), clip = hero.animations.find((c) => c.name === (q.get('clip') ?? 'Armed'));
  if (clip) { mixer.clipAction(clip).play(); mixer.setTime(clipAt); }
  rig.updateMatrixWorld(true);
  renderer.render(scene, camera);
  requestAnimationFrame(() => { renderer.render(scene, camera); (window as unknown as { stageReady: boolean }).stageReady = true; });
  
}
