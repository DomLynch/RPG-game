import * as THREE from 'three';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { advanceCast, clawPhase, type Cast } from './special-timing.ts';

// Hades' Shadow Claw, the in-game effect (Finishers, 2026-09-29; brief docs/briefs/special-moves-hades-pilot.md; timing agreed with Combat in
// special-timing.ts). Presentation only: it reads the sim's special events and the target's Head bone, never the sim, the rig root or
// Math.random (gore's seeded sequence stays untouched: every "random" here is an index hash). Loaded lazily by the scene only in a fight that
// has Special Moves, so a fight without them downloads none of it. No GLB and no shadow casting: a black cloud of soft sprites gathers over
// the target's head through the windup, a claw of four tapered talons forms inside it and drops onto the head on the landing tick with a dark
// burst, then the cloud tears apart and fades (a fizzle just dissolves it). GPT's claw GLB can later replace `talons` in the same chunk.
const CLOUD = 14, HALO = 8, BURST = 20, BURST_LIFE = 0.55;
// v2 (Dom approved the black cloud, 2026-09-30; he could not tell whose head it was over): lower (0.22 m), wider, drawn over the fighter (no depth test)
// so it reads as ON the target's head, plus a violet-grey halo under the black so it shows on the Night Pit's dark floor too.
// Metres above the target's Head bone: cloud centre, claw palm while forming, palm at impact. Low on purpose: the fight camera sits behind and
// above the player, so anything much higher over the NEAR fighter projects onto the far fighter's chest (Combat's 375-wide stills, 2026-09-29).
export const CLOUD_HEIGHT = 0.22, CLAW_FROM = 0.72, CLAW_TO = 0.42;   // Dom 22:0x: the look stays as b57ead2b; only the height moved
const hash = (i: number, salt: number) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
const smooth = (k: number) => k * k * (3 - 2 * k);

function puffTexture() {
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x - 31.5) / 31.5, v = (y - 31.5) / 31.5, r = Math.hypot(u, v), i = (y * size + x) * 4;
    const churn = 0.7 + 0.3 * Math.sin(x * 0.37 + Math.sin(y * 0.23) * 3) * Math.cos(y * 0.29 - x * 0.11);
    pixels.set([255, 255, 255, 255 * Math.max(0, 1 - r) ** 1.6 * churn], i);
  }
  const map = new THREE.DataTexture(pixels, size, size); map.needsUpdate = true; map.magFilter = map.minFilter = THREE.LinearFilter;
  return map;
}

// Four talons curling down and in from a small palm, each a tube that thins to a point; about 900 triangles in all.
function talons(material: THREE.Material) {
  const claw = new THREE.Group(); claw.name = 'shadow claw';
  for (let t = 0; t < 4; t++) {
    const a = t * Math.PI / 2 + Math.PI / 4, x = Math.cos(a) * 0.09, z = Math.sin(a) * 0.09;
    const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(x, 0, z), new THREE.Vector3(x * 2.6, -0.12, z * 2.6), new THREE.Vector3(x * 2.4, -0.42, z * 2.4), new THREE.Vector3(x * 0.6, -0.6, z * 0.6));
    const geometry = new THREE.TubeGeometry(curve, 16, 0.034, 6, false), position = geometry.attributes.position as THREE.BufferAttribute;
    for (let ring = 0; ring <= 16; ring++) {   // taper: pull each ring toward its centre on the curve, to a point at the tip
      const centre = curve.getPointAt(ring / 16), taper = (1 - ring / 16) ** 0.8;
      for (let j = 0; j <= 6; j++) { const i = ring * 7 + j; position.setXYZ(i, centre.x + (position.getX(i) - centre.x) * taper, centre.y + (position.getY(i) - centre.y) * taper, centre.z + (position.getZ(i) - centre.z) * taper); }
    }
    geometry.computeVertexNormals();
    claw.add(new THREE.Mesh(geometry, material));
  }
  const palm = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), material); palm.scale.set(1, 0.55, 1); claw.add(palm);
  claw.scale.setScalar(1.35); claw.visible = false;
  return claw;
}

export type SpecialFx = ReturnType<typeof createSpecialFx>;
export function createSpecialFx(scene: THREE.Scene, opponent: OpponentId) {
  const map = puffTexture(), root = new THREE.Group(); root.name = 'special fx'; root.visible = false; scene.add(root);
  const puff = (color: string) => new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, opacity: 0, depthWrite: false, fog: true }));
  const over = (s: THREE.Sprite, order: number) => { s.material.depthTest = false; s.renderOrder = order; return s; };   // over the fighter it sits on, not clipped by his head
  const halo = Array.from({ length: HALO }, (_, i) => { const s = over(puff('#3a3052'), 8); s.name = `halo ${i}`; root.add(s); return s; });
  const cloud = Array.from({ length: CLOUD }, (_, i) => { const s = over(puff(i % 3 ? '#0b0b10' : '#16141c'), 9); s.name = `cloud ${i}`; root.add(s); return s; });
  const burst = Array.from({ length: BURST }, (_, i) => { const s = puff('#070709'); s.name = `burst ${i}`; s.visible = false; root.add(s); return s; });
  const burstLife = new Float32Array(BURST), burstVelocity = burst.map(() => new THREE.Vector3());
  const clawMaterial = new THREE.MeshStandardMaterial({ color: '#020203', emissive: '#030305', roughness: 0.9, metalness: 0, transparent: true, opacity: 0 });   // near-black, no sheen (the first cut read blue-grey)
  const claw = talons(clawMaterial); root.add(claw);
  const head = new THREE.Vector3(), anchor = new THREE.Vector3();
  let cast: Cast | null = null, clock = 0, lastTick = -1, haveHead = false;

  function fireBurst(at: THREE.Vector3) {
    burst.forEach((s, i) => {
      const a = hash(i, 1) * Math.PI * 2, speed = 1.1 + hash(i, 2) * 1.2;
      burstVelocity[i].set(Math.cos(a) * speed, -0.25 + hash(i, 3) * 1.1, Math.sin(a) * speed);
      s.position.copy(at); burstLife[i] = BURST_LIFE * (0.7 + 0.3 * hash(i, 4)); s.visible = true;
    });
  }

  return {
    // After the poses are final: `tick` is the sim tick of this frame, `heads` each side's Head bone in world space (null while a rig loads),
    // `yielding` true while a finisher plays (no new cast starts; one in flight finishes, per Combat's double-kill rule).
    render(dt: number, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, heads: readonly [THREE.Vector3 | null, THREE.Vector3 | null], yielding: boolean) {
      clock = tick !== lastTick ? tick : Math.min(tick + 1, clock + dt * 60); lastTick = tick;   // smooth between sim ticks, never ahead by more than one
      const before = cast;
      cast = advanceCast(cast, events, fighters, tick, opponent, yielding);
      if (cast && cast.landed !== null && before?.landed === null) fireBurst(head);
      const target = cast ? heads[1 - cast.actor] : null;
      if (target) { head.copy(target); haveHead = true; }
      for (let i = 0; i < BURST; i++) {
        const s = burst[i]; if (!s.visible) continue;
        burstLife[i] -= dt; if (burstLife[i] <= 0) { s.visible = false; continue; }
        const k = 1 - burstLife[i] / BURST_LIFE; burstVelocity[i].y -= 2.2 * dt;
        s.position.addScaledVector(burstVelocity[i], dt); s.scale.setScalar(0.12 + 0.3 * k); (s.material as THREE.SpriteMaterial).opacity = 0.9 * (1 - k);
      }
      const bursting = burst.some((s) => s.visible);
      root.visible = (!!cast && haveHead) || bursting;
      if (!cast || !haveHead) { cloud.forEach((s) => (s.visible = false)); halo.forEach((s) => (s.visible = false)); claw.visible = false; return; }
      const p = clawPhase(cast, clock), swirl = clock * 0.012;
      anchor.copy(head); anchor.y += CLOUD_HEIGHT;
      // The cloud: builds through the windup (spirals in, grows, darkens), sits heavy while the claw forms and falls, then tears outward.
      const build = p.phase === 'gather' ? smooth(p.k) : 1, tear = p.phase === 'recover' || p.phase === 'dissolve' ? smooth(p.k) : 0;
      cloud.forEach((s, i) => {
        const a = i * 2.39996 + (1 - build) * 1.3 + swirl * (i % 2 ? 1 : -1), r = (0.14 + 0.42 * hash(i, 5)) * (1.8 - 0.8 * build) + tear * (0.3 + 0.25 * hash(i, 6));
        s.position.set(anchor.x + Math.cos(a) * r, anchor.y + (hash(i, 7) - 0.5) * 0.16 - (p.phase === 'fall' ? 0.08 * p.k : 0) + tear * 0.25 * hash(i, 8), anchor.z + Math.sin(a) * r);
        s.scale.setScalar((0.5 + 0.3 * hash(i, 9)) * (0.25 + 0.75 * build) * (1 + 0.4 * tear));
        (s.material as THREE.SpriteMaterial).opacity = 0.9 * build * (1 - tear * tear);   // stays dense through the first half of the tear
        s.visible = true;
      });
      halo.forEach((s, i) => {   // a wider, fainter violet-grey bank under the black: the cloud's silhouette on a dark floor
        const a = i * 2.39996 + 0.7 + swirl * (i % 2 ? -0.7 : 0.7), r = (0.2 + 0.4 * hash(i, 11)) * (1.8 - 0.8 * build) + tear * 0.4;
        s.position.set(anchor.x + Math.cos(a) * r, anchor.y + (hash(i, 12) - 0.5) * 0.2 + tear * 0.3 * hash(i, 13), anchor.z + Math.sin(a) * r);
        s.scale.setScalar((0.75 + 0.35 * hash(i, 14)) * (0.3 + 0.7 * build) * (1 + 0.5 * tear));
        (s.material as THREE.SpriteMaterial).opacity = 0.3 * build * (1 - tear * tear);
        s.visible = true;
      });
      // The claw: forms half-hidden in the cloud, drops onto the head accelerating, holds a beat on impact, then sinks and fades with the tear.
      const landed = p.phase === 'recover' ? p.age : -1;
      claw.visible = p.phase === 'form' || p.phase === 'fall' || (landed >= 0 && landed < 20);
      if (claw.visible) {
        const drop = p.phase === 'fall' ? p.k ** 2.2 : landed >= 0 ? 1 : 0;
        claw.position.set(head.x, head.y + CLAW_FROM + (CLAW_TO - CLAW_FROM) * drop - (landed > 6 ? 0.15 * (landed - 6) / 14 : 0), head.z);
        claw.rotation.y = swirl * 0.5;
        clawMaterial.opacity = p.phase === 'form' ? 0.35 + 0.65 * p.k : landed > 6 ? 1 - (landed - 6) / 14 : 1;
      }
    },
    clear() { cast = null; haveHead = false; root.visible = false; burst.forEach((s) => (s.visible = false)); },
  };
}
