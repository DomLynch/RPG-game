// The Pit's lazy chunk entry (assets/pit-<hash>.js, check-budget.mjs PIT). Only src/pit-coordinator.ts loads it.
// Handoff (docs/pit-design.md §5): the renderer, scene, camera and lights are borrowed. The room and its sheet are built on the first
// visit and hidden between visits, so repeated visits allocate nothing on the GPU; leave() hands back the arena, the camera's lens and the
// lights exactly as found. disposeRoom() (the coordinator's, on pagehide) frees what the Pit built.
import * as THREE from 'three';
import { FOCUS, POSES, buildRoom, type Pick, type Room } from './room.ts';
import { GATE_OPEN_S } from './gate.ts';
import { BOUNDS, EYE_BACK, LOOK, orbitEye, walk, yawOf, zoneAt, type Walker } from './mover.ts';
import { createSheet, type Sheet } from './sheet.ts';
import { createPicker } from './picker.ts';
import type { Entry, GameStage, Pit, Pose, Stage } from './stage.ts';

// The crowd through the walls (Dom 2026-10-01): one cue ten seconds after he arrives, then every thirty, rotating cheers → boos → chant, never
// the same twice in a row (the rotation carries across visits). It stops with the Pit.
export const CROWD_FIRST_S = 10, CROWD_EVERY_S = 30;
export const CROWD_ROTATION = ['reaction', 'jeer', 'chant'] as const;
let crowdNext = 0;
const BORROWED_LIGHT = 0.06;   // the arena's sun and sky, turned down while the torches light the room (restored on leave)
const PORTRAIT_FOV = 62;   // a phone held upright sees ~25° across at the fight's 51°; the room is small, so the Pit widens the lens
// Dom's phone test 2026-09-30 ("too close, cramped"): the camera stands 40 % farther back along its view line, raised so the gate and the floor read,
// in a room 25 % bigger each way. Was eye height 2.15, 3.1 m behind him.
const PULL_Y = 3.0, PULL_Z = 4.35;
const FIT = { key: 6, body: 2.15, aim: 0.98, turn: 0.012 };   // the sheet's mannequin framing, as gear-room.ts: head to boots with air, the aim height, rad per px of a drag, and the warm key lamp's strength (the night room is torch-lit: without it his gear does not read)
const EASE = 3;   // 1/s: how fast the walking camera follows him and leans toward a zone
const ARRIVE_WALK = 0.7;   // s: how long he carries the gate walk into the room (D2), unless the stick moves first
// Where he comes in: down the arena ramp after a win (behind the camera, walking in), at the rack through the side door after a defeat.
const ARRIVE: Record<Entry, Walker> = { win: { x: 0, z: BOUNDS.z[1], heading: Math.PI, speed: 0 }, defeat: { ...POSES.rack.hero, speed: 0 } };

let room: Room | undefined, sheet: Sheet | undefined;

// main.ts's half of the Stage, when the whole of it is there (the `?look=pit` still has none of it).
const gameOf = (s: Stage): GameStage | undefined =>
  s.readMove && s.rackRows && s.trophyLine && s.gate ? { readMove: s.readMove, readLook: s.readLook, readTap: s.readTap, rackRows: s.rackRows, trophyLine: s.trophyLine, gate: s.gate, gateSound: s.gateSound, crowdSound: s.crowdSound, openJournal: s.openJournal, legend: s.legend } : undefined;

// `arrival` (m/s): he came through the gate walking (D2) and keeps that pace into the room for a moment, until the stick speaks.
// `gateAt` (0..1): the `?look=pit&lift=` still: the gate's bars held that far up, no animation and no tap to open it.
export function enter(stage: Stage, entry: Entry, pose?: Pose, arrival = 0, gateAt?: number): Pit {
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
  built.gate.reset();
  if (gateAt) built.gate.set(Math.min(Math.max(gateAt, 0), 1));
  if (again) void built.restock();   // what he owns may have changed since the last visit (a take)
  const lights = scene.children.filter((c): c is THREE.Light => c instanceof THREE.Light).map((light) => [light, light.intensity] as const);
  for (const [light, intensity] of lights) light.intensity = intensity * BORROWED_LIGHT;
  const fov = camera.fov;
  if (camera.aspect < 1) { camera.fov = PORTRAIT_FOV; camera.updateProjectionMatrix(); }
  let walker: Walker = pose ? { ...POSES[pose].hero, speed: 0 } : { ...ARRIVE[entry], speed: arrival };
  let autoIn = arrival > 0 ? ARRIVE_WALK : 0;   // seconds of his own momentum left
  const eye = new THREE.Vector3(), look = new THREE.Vector3(), focus = new THREE.Vector3(), him = new THREE.Vector3();
  const aim = (w: Walker) => {   // where the camera wants to be for him now: behind and above, leaning toward the zone he is in
    const zone = zoneAt(w.x, w.z);
    look.set(w.x, 1.15, w.z - 0.6);
    if (zone) look.lerp(focus.set(...FOCUS[zone]), 0.45);
    eye.set(THREE.MathUtils.clamp(w.x * 0.55, -4.3, 4.3), PULL_Y, THREE.MathUtils.clamp(w.z + PULL_Z, -1.95, EYE_BACK));
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
  let picked: Pick | null = null;
  let shown = true, t = 0;
  // The gate opening (gate.ts): a tap on the lit gate raises its bars over GATE_OPEN_S, and then the gate's own go() (the light, the way out). A
  // second tap, or leaving, ends it early; the winch (Stage.gateSound) stops with it. One go() per opening.
  let winch: { stop(): void } | void, went = false;
  let crowd: { stop(): void } | void, crowdAt = CROWD_FIRST_S;   // the muffled crowd: the cue playing, and when the next is due (visit time)
  const finish = () => { if (went) return; went = true; game?.gate().go(); };
  const tapGate = () => {
    if (!game || went) return;
    if (built.gate.elapsed() !== null) { winch?.stop(); finish(); return; }   // a tap while it rises: skip the wait
    if (!built.gate.open()) return finish();   // no bars to lift (the model did not load): straight on
    winch = game.gateSound?.();
  };
  // The loadout sheet over the room (Strategy: the hero standing here IS the mannequin): the camera comes round to his front and frames his whole
  // body in the sheet's stage window, the way gear-room.ts does over the arena; a drag across the window turns the camera round him, kept inside the room.
  let fitting: { el: HTMLElement; view: { width(): number; height(): number }; turn: number; face: number; was: number; light: THREE.PointLight; drag: number | null; off(): void } | null = null;
  const fitCamera = () => {
    const f = fitting!, r = f.el.getBoundingClientRect(), W = f.view.width(), H = f.view.height();
    if (!(r.width > 0 && r.height > 0 && W > 0 && H > 0)) return;
    const d = FIT.body / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * (r.height / H)), a = f.face + f.turn;
    him.set(walker.x, FIT.aim, walker.z);
    f.light.position.set(walker.x + Math.sin(a + 0.6) * 1.7, FIT.aim + 0.9, walker.z + Math.cos(a + 0.6) * 1.7);   // the key follows the camera round him
    eye.set(THREE.MathUtils.clamp(walker.x + Math.sin(a) * d, -4.3, 4.3), FIT.aim + 0.12, THREE.MathUtils.clamp(walker.z + Math.cos(a) * d, -1.95, EYE_BACK));
    camera.position.copy(eye); camera.lookAt(him); target.copy(him);
    camera.setViewOffset(W, H, W / 2 - (r.left + r.width / 2), H / 2 - (r.top + r.height / 2), W, H); camera.updateProjectionMatrix();
  };
  const stopFitting = () => { if (!fitting) return; fitting.off(); scene.remove(fitting.light); walker = { ...walker, heading: fitting.was }; fitting = null; /* he turns back to the way he stood */ camera.clearViewOffset(); camera.updateProjectionMatrix(); };
  const leave = () => {
    if (!shown) return;
    stopFitting();
    shown = false;
    winch?.stop(); crowd?.stop();
    built.gate.reset();
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
      if (game && t >= crowdAt) { crowdAt = t + CROWD_EVERY_S; crowd = game.crowdSound?.(CROWD_ROTATION[crowdNext++ % CROWD_ROTATION.length]!); }
      if (game && fitting) {   // the loadout sheet is open: he stands still and the camera frames him in its stage window (fitCamera); the stick and taps are drained, not read
        game.readLook?.(); game.readTap?.();
        const gap = Math.atan2(Math.sin(fitting.face - walker.heading), Math.cos(fitting.face - walker.heading));   // he turns to face the camera, which stands on the room's open side of him
        walker = { ...walker, speed: 0, heading: walker.heading + gap * (1 - Math.exp(-8 * dt)) }; picked = null;
        sheet?.hide(); fitCamera();
      } else if (game) {
        const drag = game.readLook?.();
        if (drag) { lookYaw -= drag.dx * LOOK.yawPerPx; lookPitch = THREE.MathUtils.clamp(lookPitch + drag.dy * LOOK.pitchPerPx, ...LOOK.pitch); }
        const stick = game.readMove();
        if (stick.x || stick.z) autoIn = 0; else autoIn -= dt;
        walker = walk(walker, autoIn > 0 ? { x: 0, z: -1 } : stick, yawOf(camera.position.toArray(), target.toArray()), dt);
        const zone = aim(walker), k = 1 - Math.exp(-EASE * dt);
        camera.position.lerp(eye, k); target.lerp(look, k);
        camera.lookAt(target);
        const tap = game.readTap?.();
        if (tap) { picked = pick(tap); if (picked === 'gate') tapGate(); else if (picked === 'rack') game.openJournal?.(); }   // a tap on the floor or a wall clears a pick (null), as walking does
        else if (walker.speed > 0) picked = null;
        sheet?.show(picked ?? zone);
      }
      if ((built.gate.elapsed() ?? 0) >= GATE_OPEN_S) finish();   // the bars are up and the tail has run out: on through the gate
      stage.hero.place(walker.x, walker.z, walker.heading, walker.speed, dt);
      stage.draw();
    },
    fitting(el, view) {
      stopFitting();
      if (!el || !view) return;
      const toward = Math.hypot(-walker.x, 0.5 - walker.z) > 0.5 ? Math.atan2(-walker.x, 0.5 - walker.z) : 0;   // the camera stands on the side of him toward the room's middle, so the walls never crowd the lens
      const f: NonNullable<typeof fitting> = { el, view, turn: 0, face: toward, was: walker.heading, light: new THREE.PointLight(0xffe0b8, FIT.key, 7, 2), drag: null, off: () => undefined };
      const down = (e: PointerEvent) => { f.drag = e.clientX; el.setPointerCapture?.(e.pointerId); }, up = () => { f.drag = null; };
      const move = (e: PointerEvent) => { if (f.drag !== null) { f.turn += (e.clientX - f.drag) * FIT.turn; f.drag = e.clientX; } };
      el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      f.off = () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
      scene.add(f.light); fitting = f;
    },
    leave,
    dispose() { leave(); disposeRoom(); },
    get ready() { return built.ready; },
    get extras() { return built.extras; },   // the room's latest stock (a re-entry restocks): the memory row samples after it
  };
}

// Free the room and the sheet (pagehide, or a context loss whose restore failed). The next visit builds them again.
export function disposeRoom(): void {
  room?.dispose(); room = undefined;
  sheet?.dispose(); sheet = undefined;
}
