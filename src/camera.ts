// The duel camera: the pure pose functions (orbit/lock framing and the finisher side view), and the rig that owns the camera's
// state across frames — yaw/pitch, the settle lerp, the camera kick, the authorized finisher push-in and the side-view reveal.
// The rig reads simulation positions and the scene's finisher facts as plain data; it never reaches into rigs, blood or wounds.
import * as THREE from 'three';
import { TARGET, wrapAngle, type State } from './sim.ts';
import type { Shove } from './camera-kick.ts';
import type { FinisherId } from './finishers.ts';

export function cameraPose(
  state: State,
  yaw: number,
  pitch: number,
  locked: boolean,
  target: { x: number; z: number } = TARGET,
) {
  const distance = Math.hypot(state.x - target.x, state.z - target.z);
  // Duel lock sits ~30% closer and lower than the first pass; the distance terms still pull back to frame both fighters.
  const back = locked ? Math.max(4.2, distance * 0.62 + 2.8) : 7.5 * Math.cos(pitch);
  let x = state.x + Math.sin(yaw) * back,
    z = state.z + Math.cos(yaw) * back;
  // Camera stays inside the colonnade even when the fighter reaches the arena edge.
  const radius = Math.hypot(x, z);
  if (radius > 11.5) {
    x *= 11.5 / radius;
    z *= 11.5 / radius;
  }
  return {
    x,
    y: locked ? Math.max(3.2, distance * 1.3) : 1 + 7.5 * Math.sin(pitch),
    z,
    lookX: locked ? (state.x + target.x) / 2 : state.x,
    lookZ: locked ? (state.z + target.z) / 2 : state.z,
  };
}

// Late finisher reveal: a three-quarter side view, fitted to the phone's horizontal field of view.
// Choose the inward side from the frozen duel positions so the camera cannot switch sides as the corpse moves.
export function finisherSidePose(
  killer: { x: number; z: number },
  fallen: { x: number; z: number },
  aspect: number,
  finisher: 'runThrough' | 'splitCrown' | 'quietOne' | 'opened' = 'runThrough',
  bodyScale = 1,
) {
  const dx = fallen.x - killer.x,
    dz = fallen.z - killer.z,
    gap = Math.hypot(dx, dz) || 1;
  const ux = dx / gap,
    uz = dz / gap,
    lookX = (killer.x + fallen.x) / 2,
    lookZ = (killer.z + fallen.z) / 2;
  const back = Math.max(
    finisher === 'opened' ? 5.2 : finisher === 'quietOne' ? 4.5 : 3.8,
    (gap / 2 + (finisher === 'opened' ? 1.5 * bodyScale : finisher === 'quietOne' ? 1.5 : 0.42)) /
      (Math.tan((51 * Math.PI) / 360) * Math.min(aspect, 1)),
  );
  // Split Crown (owner 2026-09-20): the seam runs front-to-back over a head that bows toward the killer, so a profile
  // hides it — a raised front-quarter (45°, higher eye) looks down onto the opened crown past the killer's shoulder.
  const angle = finisher === 'splitCrown' ? Math.PI / 4 : finisher !== 'runThrough' ? Math.PI / 3 : (5 * Math.PI) / 12,
    sideward = Math.sin(angle),
    rearward = Math.cos(angle);
  const side = (sign: number, front = 1) => ({
    x: lookX + (-uz * sign * sideward - ux * rearward * front) * back,
    y: finisher === 'opened' ? 3.7 + 3 * (bodyScale - 1) : finisher === 'splitCrown' ? 4.2 : 3.1,
    z: lookZ + (ux * sign * sideward - uz * rearward * front) * back,
    lookX,
    lookY: 0.85,
    lookZ,
  });
  // Large halves need the inward front-quarter option when the killer stands against the wall;
  // clamping an outward rear view alone squeezes the corpse out of the portrait frame.
  const candidates =
    finisher === 'opened' && bodyScale > 1
      ? [side(1), side(-1), side(1, -1), side(-1, -1)]
      : [side(1), side(-1)];
  const pose = candidates.reduce((best, p) => (Math.hypot(p.x, p.z) < Math.hypot(best.x, best.z) ? p : best));
  const radius = Math.hypot(pose.x, pose.z);
  if (radius > 11.5) {
    pose.x *= 11.5 / radius;
    pose.z *= 11.5 / radius;
  }
  return pose;
}

// What the camera needs to know about a finish, as data. `finisher` is the resolved presentation (null for a plain death), `posed`
// whether it has a FINISHER_POSE, `victim` who fell, `clock` the slowed finisher clock, `head` the severed head's ground position
// when there is one (the look centres between corpse and head), `big` the large-bodied creatures (a wider side view).
export type CameraFinish = {
  finisher: FinisherId | null;
  posed: boolean;
  draw: boolean;
  victim: number;
  clock: number;
  head: { x: number; z: number } | null;
  big: boolean;
};

// Reduced motion: no camera kick, no finisher push-in, no side-view reveal — the frame holds still.
export const prefersStillCamera = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Arena cam after the kill (owner 2026-09-20): TOUR.delay seconds after the finish begins — the finisher's own push-in and reveal have
// settled by then — the camera drifts: a slow orbit around the fallen that breathes in and out and rises toward a wider view of the ring,
// looping until Rematch. Slow moves, never a cut. The orbit starts from wherever the camera stands, so there is no jump. Any touch on the
// arena stops it for that finish (the player wants to look for themselves). On the player's own death it runs lower. A draw has no fallen
// to circle; reduced motion keeps the frame still.
export const TOUR = { delay: 5, blendIn: 3, lap: 40, breathe: 25, rise: 30, radius: 5.2, breath: 1.3 } as const;   // seconds and metres
export function createCameraRig(camera: THREE.PerspectiveCamera, still = prefersStillCamera()) {
  let finishPush = 0; // the authorized slow dolly over the death window (0 = off; respects prefers-reduced-motion)
  let finishAge = 0, tourStopped = false, tourAngle: number | null = null;   // the tour's clock, the stop-on-touch, and the orbit angle it started from
  const desired = new THREE.Vector3(),
    look = new THREE.Vector3(),
    aim = new THREE.Vector3(0, 1, 0);
  let yaw = 0,
    pitch = 0.45,
    started = false;
  // Camera kick: a blow nudges the camera a few centimetres along the blow's heading and it settles in ~0.15 s. Small on purpose
  // (readable brutality: nothing may obscure a pose); off when the viewer prefers reduced motion. Placeholder for the visual lane's impact pass.
  // The kick is a world-space offset scaled by `kick` (1 → 0): a landing blow drops the camera and shoves it a little along the blow; a parry
  // flicks it sideways with the deflection. A push along the blow alone is a dolly down the view axis and reads as nothing on screen.
  let kick = 0,
    kickHold = 0, // a heavy-class contact holds its full displacement for two frames before settling: the weight lands, then the camera recovers
    kickRate = 1 / 0.15, // 1/s: how fast the offset settles
    shoved = 0; // the kick applied to the camera for the last draw; taken off before the next frame's settle so it never compounds
  const kickOffset = new THREE.Vector3();
  return {
    camera,
    get yaw() {
      return yaw;
    },
    // True once the first frame has been placed: until then the camera snaps instead of settling, and there is no camera to cull against.
    get started() {
      return started;
    },
    orbit(dx: number, dy: number) {
      yaw -= dx * 0.005;
      pitch = THREE.MathUtils.clamp(pitch + dy * 0.003, 0.22, 0.9);
    },
    recenter() {
      yaw = 0;
      pitch = 0.45;
      started = false;
    },
    // A touch on the arena after the kill: the player takes the camera back for the rest of this finish.
    stopTour() {
      tourStopped = true;
    },
    get touring() {
      return tourAngle !== null;
    },
    // A contact's kick (camera-kick.ts's table) along `heading`: a landed blow carries its own heading; a block or parry takes the attacker's.
    shove(heading: number, shove: Shove) {
      if (still) return;
      kickOffset.set(Math.sin(heading) * shove.along + Math.cos(heading) * shove.side, -shove.drop, Math.cos(heading) * shove.along - Math.sin(heading) * shove.side);
      kick = 1;
      kickHold = shove.hold;
      kickRate = 1 / shove.settle;
    },
    // Place the camera for this frame: lock or orbit framing, the finisher push-in, the side-view reveal, then the settle and the kick.
    update(dt: number, state: State, enemy: { x: number; z: number }, locked: boolean, finish: CameraFinish | null) {
      const blend = 1 - Math.exp(-dt * 8);
      if (locked) {
        const lockYaw = Math.atan2(state.x - enemy.x, state.z - enemy.z);
        yaw += wrapAngle(lockYaw - yaw) * blend;
      }
      const cameraTarget = cameraPose(state, yaw, pitch, locked, enemy);
      look.set(cameraTarget.lookX, locked ? 0.8 : 1, cameraTarget.lookZ);
      desired.set(cameraTarget.x, cameraTarget.y, cameraTarget.z);
      // The authorized slow push-in over the death window (finishers & gore 2026-09-17): a dolly toward the fallen, never a cut,
      // never an FOV change. Off when the viewer prefers reduced motion; the frame loop's hit-stop stays the one impact pause.
      // Paced to the slowed finisher clock (1.3 s / 0.75); a plain-death pick gets no dolly — an ordinary kill stays ordinary.
      if (finish && finish.posed && !finish.draw && !still)
        finishPush = Math.min(1, finishPush + dt / (1.3 / 0.75));
      else if (!finish) finishPush = 0;
      if (finishPush > 0) {
        const fallen = finish!.victim === 1 ? enemy : state;
        const killer = finish!.victim === 1 ? state : enemy;
        // Owner phone review 2026-09-20: Decapitation keeps its front view — no push-in and no look change, so the
        // detached head stays in frame (#167) — but slides to camera-right so the killer's back stops hiding the corpse.
        const push = finish!.finisher === 'decapitation' ? 0 : 0.38,
          slide = finish!.finisher === 'decapitation' ? 0.8 : 0.95,
          turn = finish!.finisher === 'decapitation' ? 0.85 : 0.6;
        desired.x += (fallen.x - desired.x) * push * finishPush;
        desired.z += (fallen.z - desired.z) * push * finishPush;
        // Framing tune (same authorized dolly — still no cut, no FOV, no slow-mo): slide the camera laterally off the
        // killer→fallen axis and a touch higher, so the settled frame reads the kneeling corpse past the killer's
        // shoulder instead of hiding it behind his back.
        const axisX = fallen.x - killer.x,
          axisZ = fallen.z - killer.z,
          axisLen = Math.hypot(axisX, axisZ) || 1;
        desired.x += (-axisZ / axisLen) * slide * finishPush;
        desired.z += (axisX / axisLen) * slide * finishPush;
        // The look turns onto the fallen for every finisher: with the slide, the killer reads left and the corpse centre.
        // Decapitation looks at the midpoint of corpse and severed head — the head lands beside the corpse wherever the
        // blow sent it, and framing the corpse alone left it at the portrait edge (deploy gate, trunk 63f4cd9).
        const head = finish!.head;
        const focusX = head ? (fallen.x + head.x) / 2 : fallen.x,
          focusZ = head ? (fallen.z + head.z) / 2 : fallen.z;
        look.x += (focusX - look.x) * turn * finishPush;
        look.z += (focusZ - look.z) * turn * finishPush;
        if (push) {
          desired.y += (1.55 - desired.y) * 0.3 * finishPush;
          look.y += (0.8 - look.y) * 0.7 * finishPush;
        }
      }
      const finisher = finish?.finisher ?? null;
      if (
        locked &&
        !still &&
        finish?.victim === 1 &&
        (finisher === 'runThrough' ||
          finisher === 'splitCrown' ||
          finisher === 'quietOne' ||
          finisher === 'opened')
      ) {
        const t = THREE.MathUtils.clamp(
            finisher === 'opened'
              ? (finish.clock - 0.04) / (finish.big ? 0.6 : 0.4)
              : finisher === 'quietOne'
                ? (finish.clock - 0.12) / 0.43
                : (finish.clock - 0.45) / 0.55,
            0,
            1,
          ),
          reveal = t * t * (3 - 2 * t);
        const side = finisherSidePose(
          state,
          enemy,
          camera.aspect,
          finisher,
          finish.big ? 1.5 : 1,
        );
        desired.lerp(new THREE.Vector3(side.x, side.y, side.z), reveal);
        look.lerp(new THREE.Vector3(side.lookX, side.lookY, side.lookZ), reveal);
        const radius = Math.hypot(desired.x, desired.z);
        if (radius > 11.5) {
          desired.x *= 11.5 / radius;
          desired.z *= 11.5 / radius;
        }
      }
      // The arena cam, on top of whatever the finisher's own moves settled on.
      if (finish) finishAge += dt; else { finishAge = 0; tourStopped = false; tourAngle = null; }
      if (finish && !finish.draw && !still && !tourStopped && finishAge > TOUR.delay) {
        const t = finishAge - TOUR.delay, fallen = finish.victim === 1 ? enemy : state, low = finish.victim === 0;
        const focusX = finish.head ? (fallen.x + finish.head.x) / 2 : fallen.x, focusZ = finish.head ? (fallen.z + finish.head.z) / 2 : fallen.z;
        tourAngle ??= Math.atan2(camera.position.x - focusX, camera.position.z - focusZ);
        const angle = tourAngle + (t * 2 * Math.PI) / TOUR.lap, radius = TOUR.radius + TOUR.breath * Math.sin((t * 2 * Math.PI) / TOUR.breathe);
        const height = (low ? 1.2 : 1.6) + (low ? 1 : 1.6) * (1 - Math.cos((t * 2 * Math.PI) / TOUR.rise)) / 2;
        const tour = new THREE.Vector3(focusX + Math.sin(angle) * radius, height, focusZ + Math.cos(angle) * radius), r = Math.hypot(tour.x, tour.z);
        if (r > 11.5) { tour.x *= 11.5 / r; tour.z *= 11.5 / r; }
        const s = Math.min(1, t / TOUR.blendIn), blendIn = s * s * (3 - 2 * s);
        desired.lerp(tour, blendIn);
        look.lerp(new THREE.Vector3(focusX, 0.7, focusZ), blendIn);
      } else tourAngle = null;
      camera.position.addScaledVector(kickOffset, -shoved); // last draw's shove comes off before the settle
      shoved = 0;
      camera.position.lerp(desired, started ? blend : 1);
      aim.lerp(look, started ? blend : 1);
      camera.lookAt(aim);
      started = true;
      // The kick is applied after the look-at (so the frame itself shifts) and stays on the camera until the next frame takes it off
      // before settling — a shove left inside the lerped position would compound.
      shoved = kick;
      camera.position.addScaledVector(kickOffset, shoved);
    },
    // After the draw: the kick holds, then settles.
    settle(dt: number) {
      if (kick > 0) {
        if (kickHold > 0) kickHold -= dt;
        else kick = Math.max(0, kick - dt * kickRate);
      }
    },
  };
}
export type CameraRig = ReturnType<typeof createCameraRig>;
