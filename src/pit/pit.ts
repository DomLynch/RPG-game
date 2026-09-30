// The Pit's lazy chunk entry (assets/pit-<hash>.js, check-budget.mjs PIT). Only src/pit-coordinator.ts loads it.
// Handoff (docs/pit-design.md §5): the renderer, scene, camera and lights are borrowed. The room and its sheet are built on the first
// visit and hidden between visits, so repeated visits allocate nothing on the GPU; leave() hands back the arena, the camera's lens and the
// lights exactly as found. disposeRoom() (the coordinator's, on pagehide) frees what the Pit built.
import * as THREE from 'three';
import { FOCUS, POSES, buildRoom, type Room } from './room.ts';
import { BOUNDS, EYE_BACK, LOOK, orbitEye, walk, yawOf, zoneAt, type Walker, type Zone } from './mover.ts';
import { createSheet, type Sheet } from './sheet.ts';
import { createPicker } from './picker.ts';
import type { Entry, GameStage, Pit, Pose, Stage } from './stage.ts';

const BORROWED_LIGHT = 0.06;   // the arena's sun and sky, turned down while the torches light the room (restored on leave)
const PORTRAIT_FOV = 62;   // a phone held upright sees ~25° across at the fight's 51°; the room is small, so the Pit widens the lens
const EASE = 3;   // 1/s: how fast the walking camera follows him and leans toward a zone
// Where he comes in: down the arena ramp after a win (behind the camera, walking in), at the rack through the side door after a defeat.
const ARRIVE: Record<Entry, Walker> = { win: { x: 0, z: BOUNDS.z[1], heading: Math.PI, speed: 0 }, defeat: { ...POSES.rack.hero, speed: 0 } };

let room: Room | undefined, sheet: Sheet | undefined;

// main.ts's half of the Stage, when the whole of it is there (the `?look=pit` still has none of it).
const gameOf = (s: Stage): GameStage | undefined =>
  s.readMove && s.rackRows && s.trophyLine && s.gate ? { readMove: s.readMove, readLook: s.readLook, readTap: s.readTap, rackRows: s.rackRows, trophyLine: s.trophyLine, gate: s.gate } : undefined;

export function enter(stage: Stage, entry: Entry, pose?: Pose): Pit {
  const { scene, camera } = stage;
  stage.setArenaVisible(false);   // before the first build, so the room is not in the hide's snapshot
  // What can throw (the room's build, the sheet's) comes first, and a throw gives the arena back before it propagates: the caller says
  // "fight on" over the arena as it was. The lights and the lens change only after both are in (Code Quality P2, #1122).
  const again = !!room, game = pose ? undefined : gameOf(stage);
  let built: Room;
  try {
    built = (room ??= buildRoom(stage));
    if (game) sheet ??= createSheet(game, stage.loot, () => { void room?.restock(); });
  } catch (error) {
    if (room) room.group.visible = false;   // built, then the sheet threw: the room must not stay drawn over the arena
    stage.setArenaVisible(true);
    throw error;
  }
  built.group.visible = true;
  if (again) void built.restock();   // what he owns may have changed since the last visit (a take)
  const lights = scene.children.filter((c): c is THREE.Light => c instanceof THREE.Light).map((light) => [light, light.intensity] as const);
  for (const [light, intensity] of lights) light.intensity = intensity * BORROWED_LIGHT;
  const fov = camera.fov;
  if (camera.aspect < 1) { camera.fov = PORTRAIT_FOV; camera.updateProjectionMatrix(); }
  let walker: Walker = pose ? { ...POSES[pose].hero, speed: 0 } : { ...ARRIVE[entry] };
  const eye = new THREE.Vector3(), look = new THREE.Vector3(), focus = new THREE.Vector3(), him = new THREE.Vector3();
  const aim = (w: Walker) => {   // where the camera wants to be for him now: behind and above, leaning toward the zone he is in
    const zone = zoneAt(w.x, w.z);
    look.set(w.x, 1.15, w.z - 0.6);
    if (zone) look.lerp(focus.set(...FOCUS[zone]), 0.45);
    eye.set(THREE.MathUtils.clamp(w.x * 0.55, -3.3, 3.3), 2.15, THREE.MathUtils.clamp(w.z + 3.1, -1.2, EYE_BACK));
    if (lookYaw || lookPitch) { orbitEye(eye, him.set(w.x, 1.15, w.z), lookYaw, lookPitch); look.copy(him); }   // the look orbits HIM (Lead): a drag is to see your fighter, so he stays framed
    return zone;
  };
  let lookYaw = 0, lookPitch = 0;   // the drag's offsets, kept for the visit (the arena keeps its yaw too); a pose has none
  if (pose) { eye.set(...POSES[pose].camera); look.set(...POSES[pose].target); } else aim(walker);
  camera.position.copy(eye);
  const target = look.clone();
  camera.lookAt(target);
  // A tap picks a zone from where he stands (picker.ts): its sheet opens as if he stood there, until he walks or taps elsewhere.
  const pick = createPicker(camera, () => built.targets);
  let picked: Zone | null = null;
  let shown = true, t = 0;
  const leave = () => {
    if (!shown) return;
    shown = false;
    built.group.visible = false;
    sheet?.hide();
    for (const [light, intensity] of lights) light.intensity = intensity;
    camera.fov = fov; camera.updateProjectionMatrix();
    stage.setArenaVisible(true);
  };
  return {
    frame(dt) {
      if (!shown) return;
      t += dt;
      built.update(t);
      if (game) {
        const drag = game.readLook?.();
        if (drag) { lookYaw -= drag.dx * LOOK.yawPerPx; lookPitch = THREE.MathUtils.clamp(lookPitch + drag.dy * LOOK.pitchPerPx, ...LOOK.pitch); }
        walker = walk(walker, game.readMove(), yawOf(camera.position.toArray(), target.toArray()), dt);
        const zone = aim(walker), k = 1 - Math.exp(-EASE * dt);
        camera.position.lerp(eye, k); target.lerp(look, k);
        camera.lookAt(target);
        const tap = game.readTap?.();
        if (tap) picked = pick(tap);   // a tap on the floor or a wall clears a pick (null), as walking does
        else if (walker.speed > 0) picked = null;
        sheet?.show(picked ?? zone);
      }
      stage.hero.place(walker.x, walker.z, walker.heading, walker.speed, dt);
      stage.draw();
    },
    leave,
    dispose() { leave(); disposeRoom(); },
  };
}

// Free the room and the sheet (pagehide, or a context loss whose restore failed). The next visit builds them again.
export function disposeRoom(): void {
  room?.dispose(); room = undefined;
  sheet?.dispose(); sheet = undefined;
}
