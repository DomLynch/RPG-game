// The Pit's lazy chunk entry (assets/pit-<hash>.js, check-budget.mjs PIT). Only src/pit-coordinator.ts loads it.
// Handoff (docs/pit-design.md §5): the renderer, scene, camera and lights are borrowed. The room is built on the first visit and hidden
// between visits, so repeated visits allocate nothing; leave() hands back the arena, the camera's lens and the lights exactly as found.
import * as THREE from 'three';
import { buildRoom, POSES, type Room } from './room.ts';
import type { Entry, Pit, Pose, Stage } from './stage.ts';

const BORROWED_LIGHT = 0.15;   // the arena's sun and sky, turned down while the torches light the room (restored on leave)
const PORTRAIT_FOV = 62;   // a phone held upright sees ~25° across at the fight's 51°; the room is small, so the Pit widens the lens

let room: Room | undefined;

export function enter(stage: Stage, entry: Entry, pose: Pose = entry === 'defeat' ? 'rack' : 'gate'): Pit {
  const { scene, camera } = stage;
  stage.setArenaVisible(false);   // before the first build, so the room is not in the hide's snapshot
  room ??= buildRoom(stage);
  room.group.visible = true;
  const lights = scene.children.filter((c): c is THREE.Light => c instanceof THREE.Light).map((light) => [light, light.intensity] as const);
  for (const [light, intensity] of lights) light.intensity = intensity * BORROWED_LIGHT;
  const fov = camera.fov;
  if (camera.aspect < 1) { camera.fov = PORTRAIT_FOV; camera.updateProjectionMatrix(); }
  const spot = POSES[pose], target = new THREE.Vector3(...spot.target);
  let shown = true, t = 0;
  const leave = () => {
    if (!shown) return;
    shown = false;
    if (room) room.group.visible = false;
    for (const [light, intensity] of lights) light.intensity = intensity;
    camera.fov = fov; camera.updateProjectionMatrix();
    stage.setArenaVisible(true);
  };
  return {
    frame(dt) {
      if (!shown || !room) return;
      t += dt;
      room.update(t);
      stage.hero.place(spot.hero.x, spot.hero.z, spot.hero.heading, 0, dt);
      camera.position.set(...spot.camera);
      camera.lookAt(target);
      stage.draw();
    },
    leave,
    // pagehide, or a context loss whose restore failed: free what the Pit built. The next visit builds again.
    dispose() { leave(); room?.dispose(); room = undefined; },
  };
}
