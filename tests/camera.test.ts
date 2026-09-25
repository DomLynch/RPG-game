import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import { SETTLE, TOUR, cameraPose, finisherSidePose } from '../src/camera.ts';
import { initialState, RADIUS, TARGET } from '../src/sim.ts';

test('all edge angles and orbit positions keep camera inside scenery', () => {
  for (let angle = 0; angle < 2 * Math.PI; angle += 0.1) {
    for (let yaw = 0; yaw < 2 * Math.PI; yaw += 0.1) {
      const state = { ...initialState(), x: Math.sin(angle) * RADIUS, z: Math.cos(angle) * RADIUS };
      for (const locked of [true, false]) {
        const pose = cameraPose(state, yaw, 0.45, locked);
        assert.ok(Math.hypot(pose.x, pose.z) <= 11.5 + 1e-10);
        assert.ok(pose.y > 2);
      }
    }
  }
});
test('locked camera frames both capsules at boundary and near contact in portrait and landscape', () => {
  for (const aspect of [390 / 844, 844 / 390, 16 / 9]) {
    for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
      for (const near of [false, true]) {
        const state = { ...initialState(), x: Math.sin(angle) * (near ? 0.85 : RADIUS), z: (near ? TARGET.z : 0) + Math.cos(angle) * (near ? 0.85 : RADIUS) };
        const yaw = Math.atan2(state.x - TARGET.x, state.z - TARGET.z);
        const pose = cameraPose(state, yaw, 0.45, true);
        const camera = new PerspectiveCamera(51, aspect, 0.1, 180);
        camera.position.set(pose.x, pose.y, pose.z); camera.lookAt(pose.lookX, 1, pose.lookZ); camera.updateMatrixWorld();
        for (const target of [state, TARGET]) for (const height of [0, 1.8]) {
          const screen = new Vector3(target.x, height, target.z).project(camera);
          assert.ok(Math.abs(screen.x) < 0.95 && Math.abs(screen.y) < 0.95 && screen.z < 1, JSON.stringify({aspect,angle,near,screen}));
        }
      }
    }
  }
});

test('duel camera frames a moving opponent anywhere in the arena', () => {
  for (const aspect of [375/812,844/390,16/9]) for (let a=0;a<6.28;a+=.3) for(let b=0;b<6.28;b+=.4) {
    const state={...initialState(),x:Math.sin(a)*RADIUS,z:Math.cos(a)*RADIUS};
    const target={x:Math.sin(b)*7,z:Math.cos(b)*7};
    const pose=cameraPose(state,Math.atan2(state.x-target.x,state.z-target.z),.45,true,target);
    const camera=new PerspectiveCamera(51,aspect,.1,180);camera.position.set(pose.x,pose.y,pose.z);camera.lookAt(pose.lookX,1,pose.lookZ);camera.updateMatrixWorld();
    for(const actor of [state,target])for(const y of [0,1.8]) { const p=new Vector3(actor.x,y,actor.z).project(camera); assert.ok(Math.abs(p.x)<.95&&Math.abs(p.y)<.95&&p.z<1,JSON.stringify({aspect,a,b,p})); }
  }
});


test('finisher side view exposes both fighters at every arena edge and phone aspect', () => {
  for (const aspect of [375/812,393/852,852/393]) for (let edge=0;edge<6.28;edge+=.2) for(let yaw=0;yaw<6.28;yaw+=.3) for(const gap of [.8,1.4,2.3]) for(const finish of ['runThrough','splitCrown','quietOne','opened'] as const) {
    const fallen={x:Math.sin(edge)*7.3,z:Math.cos(edge)*7.3};
    const killer={x:fallen.x+Math.sin(yaw)*gap,z:fallen.z+Math.cos(yaw)*gap};
    if(Math.hypot(killer.x,killer.z)>RADIUS)continue;
    const pose=finisherSidePose(killer,fallen,aspect,finish);
    assert.ok(Math.hypot(pose.x,pose.z)<=11.5+1e-10, 'camera remains inside the arena');
    const camera=new PerspectiveCamera(51,aspect,.1,180);camera.position.set(pose.x,pose.y,pose.z);camera.lookAt(pose.lookX,pose.lookY,pose.lookZ);camera.updateMatrixWorld();
    const eye=new Vector3(pose.x-pose.lookX,0,pose.z-pose.lookZ).normalize();
    // Split Crown (owner 2026-09-20) is a raised front-quarter, not a profile: the seam runs front-to-back over the bowed skull.
    assert.ok(Math.abs(Math.sin(yaw)*eye.z-Math.cos(yaw)*eye.x)>(finish==='splitCrown'?.55:.8), 'clear side angle even at the wall');
    for(const actor of [killer,fallen]) for(const y of [0,1.9]) for(const shoulder of [-.35,.35]) {
      const screen=new Vector3(actor.x+Math.cos(yaw)*shoulder,y,actor.z-Math.sin(yaw)*shoulder).project(camera);
      assert.ok(Math.abs(screen.x)<.95&&Math.abs(screen.y)<.95&&screen.z<1, JSON.stringify({aspect,edge,yaw,gap,screen}));
    }
  }
});

// The rig: camera state across frames. A PerspectiveCamera is plain maths in node, so every rule the scene used to hold inline is
// checked here — snap then settle, orbit/recenter, the kick and its removal, the finisher push-in, the side-view reveal, reduced motion.
import { createCameraRig, type CameraFinish } from '../src/camera.ts';
const rigAt = (x = 3, z = 4, still = false) => {
  const camera = new PerspectiveCamera(51, 393 / 852, 0.1, 180), rig = createCameraRig(camera, still);
  const state = { ...initialState(), x, z, heading: 1 }, enemy = { x: 0, z: 0, heading: 0 };
  return { camera, rig, state, enemy };
};
const finish = (over: Partial<CameraFinish> = {}): CameraFinish =>
  ({ finisher: 'runThrough', posed: true, draw: false, victim: 1, clock: 1, head: null, big: false, ...over });

test('rig: the first frame snaps to the pose, later frames settle toward it, and recenter snaps again', () => {
  const { camera, rig, state, enemy } = rigAt();
  assert.equal(rig.started, false);
  rig.update(1 / 60, state, enemy, false, null);
  const pose = cameraPose(state, 0, 0.45, false, enemy);
  assert.deepEqual(camera.position.toArray().map(v => +v.toFixed(9)), [pose.x, pose.y, pose.z].map(v => +v.toFixed(9)), 'no lerp on the first frame');
  assert.equal(rig.started, true);
  state.x = -3;   // the pose jumps; the camera only moves part of the way
  rig.update(1 / 60, state, enemy, false, null);
  const next = cameraPose(state, 0, 0.45, false, enemy), blend = 1 - Math.exp(-8 / 60);
  assert.ok(Math.abs(camera.position.x - (pose.x + (next.x - pose.x) * blend)) < 1e-9, 'settles by 1 - e^(-8 dt)');
  rig.recenter();
  assert.equal(rig.started, false);
  rig.update(1 / 60, state, enemy, false, null);
  assert.ok(Math.abs(camera.position.x - next.x) < 1e-9, 'recenter snaps on the next frame');
});

test('rig: orbit turns yaw and clamps pitch; the lock blends yaw onto the enemy', () => {
  const { rig, state, enemy } = rigAt();
  rig.orbit(200, 0); assert.ok(Math.abs(rig.yaw - -1) < 1e-12, 'yaw -= dx * 0.005');
  rig.orbit(0, -10_000); rig.orbit(0, 10_000);   // pitch clamps both ways without throwing; yaw untouched
  assert.ok(Math.abs(rig.yaw - -1) < 1e-12);
  rig.recenter(); assert.equal(rig.yaw, 0);
  const lockYaw = Math.atan2(state.x - enemy.x, state.z - enemy.z);
  rig.update(1 / 60, state, enemy, true, null);
  assert.ok(Math.abs(rig.yaw - lockYaw * (1 - Math.exp(-8 / 60))) < 1e-9, 'locked: yaw moves a blend toward the enemy bearing');
});

test('rig: a shove displaces the drawn frame, comes off before the next settle, holds, then decays; reduced motion ignores it', () => {
  const { camera, rig, state, enemy } = rigAt();
  rig.update(1 / 60, state, enemy, false, null);
  const rest = camera.position.clone();
  rig.shove(0, { along: 0, drop: 0.06, side: 0, hold: 2 / 60, settle: 0.15 });
  rig.update(1 / 60, state, enemy, false, null);
  assert.ok(Math.abs(camera.position.y - (rest.y - 0.06)) < 1e-9, 'full drop on the frame after the contact');
  rig.settle(1 / 60); rig.settle(1 / 60);   // the hold runs out
  rig.settle(1 / 60);                       // now it decays: kick = 1 - dt / 0.15
  rig.update(1 / 60, state, enemy, false, null);
  const kick = 1 - (1 / 60) / 0.15;
  assert.ok(Math.abs(camera.position.y - (rest.y - 0.06 * kick)) < 1e-9, 'previous shove removed before the settle, decayed kick reapplied');
  for (let i = 0; i < 20; i++) rig.settle(1 / 60);
  rig.update(1 / 60, state, enemy, false, null);
  assert.ok(Math.abs(camera.position.y - rest.y) < 1e-9, 'fully settled: no offset left on the camera');
  const stillRig = rigAt(3, 4, true);
  stillRig.rig.update(1 / 60, stillRig.state, stillRig.enemy, false, null);
  const before = stillRig.camera.position.clone();
  stillRig.rig.shove(0, { along: 0, drop: 0.06, side: 0, hold: 2 / 60, settle: 0.15 });
  stillRig.rig.update(1 / 60, stillRig.state, stillRig.enemy, false, null);
  assert.deepEqual(stillRig.camera.position.toArray(), before.toArray(), 'prefers-reduced-motion: no kick');
});

test('rig: the finisher push-in dollies toward the fallen and turns the look onto him; decapitation slides without pushing and centres corpse and head', () => {
  const run = (f: CameraFinish | null, still = false) => {
    const { camera, rig, state, enemy } = rigAt(3, 4, still);
    rig.update(1 / 60, state, enemy, false, null);
    const rest = camera.position.clone();
    for (let i = 0; i < 240; i++) rig.update(1 / 60, state, enemy, false, f);   // 4 s: the dolly (1.3 s / 0.75) has fully landed
    return { rest, at: camera.position.clone(), enemy, state };
  };
  const plain = run(null), pushed = run(finish());
  assert.deepEqual(plain.at.toArray(), plain.rest.toArray(), 'no finish: the camera stays');
  assert.ok(pushed.at.distanceTo(new Vector3(pushed.enemy.x, 0, pushed.enemy.z)) < pushed.rest.distanceTo(new Vector3(pushed.enemy.x, 0, pushed.enemy.z)), 'run-through: closer to the fallen');
  assert.ok(pushed.at.y !== pushed.rest.y, 'run-through: the height changes with the push');
  const unposed = run(finish({ posed: false })), drawn = run(finish({ draw: true })), still = run(finish(), true);
  for (const [name, r] of Object.entries({ unposed, drawn, still })) assert.deepEqual(r.at.toArray(), r.rest.toArray(), `${name}: no dolly`);
  const decap = run(finish({ finisher: 'decapitation', head: { x: 1, z: 1 } }));
  assert.ok(Math.abs(decap.at.y - decap.rest.y) < 1e-9, 'decapitation: no push, so no height change');
  assert.ok(decap.at.distanceTo(decap.rest) > 0.5, 'decapitation: but it slides off the axis');
  // The look turns 85 % of the way onto the focus; with a head the focus is the corpse–head midpoint, so the aim moves toward the head.
  const aimed = (f: CameraFinish) => {
    const { camera, rig, state, enemy } = rigAt(3, 4);
    rig.update(1 / 60, state, enemy, false, null);
    for (let i = 0; i < 240; i++) rig.update(1 / 60, state, enemy, false, f);
    return { at: camera.position.clone(), dir: camera.getWorldDirection(new Vector3()) };
  };
  const head = new Vector3(1, 1, 1), toHead = (from: Vector3) => head.clone().sub(from).normalize();
  const withHead = aimed(finish({ finisher: 'decapitation', head: { x: 1, z: 1 } })), withoutHead = aimed(finish({ finisher: 'decapitation' }));
  assert.ok(withHead.at.distanceTo(withoutHead.at) < 1e-9, 'the head changes the look, never the camera position');
  const angleWith = withHead.dir.angleTo(toHead(withHead.at)), angleWithout = withoutHead.dir.angleTo(toHead(withoutHead.at));
  assert.ok(angleWith < angleWithout - 0.02, `the aim turns toward the head (${angleWith.toFixed(3)} < ${angleWithout.toFixed(3)} rad)`);
});

test('rig: the side-view reveal lerps onto finisherSidePose as the finisher clock runs, only when locked, only for the opponent, never under reduced motion', () => {
  const at = (f: CameraFinish | null, locked = true, still = false) => {
    const { camera, rig, state, enemy } = rigAt(2, 2, still);
    rig.update(1 / 60, state, enemy, locked, null);
    rig.recenter();
    rig.update(1 / 60, state, enemy, locked, f);   // a snap frame: the camera lands exactly where the rig wants it
    return { camera, state, enemy };
  };
  const { camera, state, enemy } = at(finish({ clock: 1 }));
  const side = finisherSidePose(state, enemy, camera.aspect, 'runThrough', 1);
  // With reveal = 1 the lerp lands exactly on the side pose, whatever the dolly had done to the desired position first.
  assert.ok(camera.position.distanceTo(new Vector3(side.x, side.y, side.z)) < 1e-9, 'fully revealed: exactly the side pose');
  const early = at(finish({ clock: 0.2 })), none = at(finish({ clock: 1, finisher: null }));
  assert.ok(early.camera.position.distanceTo(none.camera.position) < 1e-9, 'before the reveal window opens (0.45 for run-through) nothing moves');
  const unlocked = at(finish({ clock: 1 }), false), playerFell = at(finish({ clock: 1, victim: 0 })), still = at(finish({ clock: 1 }), true, true);
  for (const [name, r] of Object.entries({ unlocked, playerFell, still }))
    assert.ok(r.camera.position.distanceTo(new Vector3(side.x, side.y, side.z)) > 0.5, `${name}: no side view`);
  const big = at(finish({ clock: 1, finisher: 'opened', big: true })), small = at(finish({ clock: 1, finisher: 'opened' }));
  assert.ok(big.camera.position.distanceTo(small.camera.position) > 0.1, 'a large-bodied creature gets the wider side view');
  assert.ok(Math.hypot(camera.position.x, camera.position.z) <= 11.5 + 1e-9, 'inside the colonnade');
});

test('rig: the arena cam — TOUR.afterSettle seconds after the finisher camera settles it orbits the fallen slowly, breathing and rising, looking at him; a touch, a draw, reduced motion or a rematch end it', () => {
  const focus = (f: CameraFinish, state: { x: number; z: number }, enemy: { x: number; z: number }) => { const fallen = f.victim === 1 ? enemy : state; return new Vector3(f.head ? (fallen.x + f.head.x) / 2 : fallen.x, 0, f.head ? (fallen.z + f.head.z) / 2 : fallen.z); };
  const tour = (f: CameraFinish, seconds: number, still = false, touchAt?: number) => {
    const { camera, rig, state, enemy } = rigAt(3, 4, still), at = focus(f, state, enemy), frames: { pos: Vector3; angle: number; dir: Vector3 }[] = [];
    rig.update(1 / 60, state, enemy, true, null);
    for (let i = 0; i < seconds * 60; i++) {
      if (touchAt !== undefined && i === Math.round(touchAt * 60)) rig.stopTour();
      rig.update(1 / 60, state, enemy, true, f);
      frames.push({ pos: camera.position.clone(), angle: Math.atan2(camera.position.x - at.x, camera.position.z - at.z), dir: camera.getWorldDirection(new Vector3()) });
    }
    return { frames, at, rig, camera, state, enemy };
  };
  const plain = finish({ finisher: null, posed: false });
  // A plain death settles at the SETTLE.min floor (own test below) — the tour starts TOUR.afterSettle later, not at the old fixed TOUR.delay.
  const plainTourStart = SETTLE.min + TOUR.afterSettle;
  // Before the tour starts the finisher's own moves (and the settle floor) have passed and nothing else happens; after it the camera is on the move.
  const early = tour(plain, plainTourStart - 0.5);
  assert.ok(early.frames.at(-1)!.pos.distanceTo(early.frames.at(-60)!.pos) < 1e-6, 'before the tour starts the settled frame holds');
  const long = tour(plain, plainTourStart + 45);
  const after = long.frames.slice((plainTourStart + TOUR.blendIn + 1) * 60);
  assert.ok(after[0].pos.distanceTo(after.at(-1)!.pos) > 1, 'after the tour starts the camera travels');
  // A slow orbit: the angle around the fallen advances the same way every second, never jumps, and a lap takes TOUR.lap seconds.
  let turned = 0; for (let i = 1; i < after.length; i++) { const d = Math.atan2(Math.sin(after[i].angle - after[i - 1].angle), Math.cos(after[i].angle - after[i - 1].angle)); assert.ok(Math.abs(d) < 0.01, `no cut: ${d.toFixed(4)} rad in one frame`); turned += d; }
  assert.ok(Math.abs(Math.abs(turned) - (after.length / 60) * 2 * Math.PI / TOUR.lap) < 0.15, `one lap per ${TOUR.lap} s: turned ${turned.toFixed(2)} rad in ${after.length / 60} s`);
  // Breathing in and out around the fallen, rising and settling, always looking at him, never outside the colonnade.
  const dist = after.map(f => Math.hypot(f.pos.x - long.at.x, f.pos.z - long.at.z)), ys = after.map(f => f.pos.y);
  assert.ok(Math.min(...dist) < TOUR.radius - TOUR.breath / 2 && Math.max(...dist) > TOUR.radius + TOUR.breath / 2, `breathes: ${Math.min(...dist).toFixed(2)}–${Math.max(...dist).toFixed(2)} m`);
  assert.ok(Math.min(...ys) < 1.9 && Math.max(...ys) > 2.8, `rises and settles: ${Math.min(...ys).toFixed(2)}–${Math.max(...ys).toFixed(2)} m`);
  for (const f of after) { assert.ok(Math.hypot(f.pos.x, f.pos.z) <= 11.5 + 1e-6, 'inside the colonnade'); assert.ok(f.dir.angleTo(long.at.clone().setY(0.7).sub(f.pos)) < 0.05, 'the look stays on the fallen'); }
  // The player's own death runs lower.
  const mine = tour(finish({ finisher: null, posed: false, victim: 0 }), plainTourStart + 45);
  assert.ok(Math.max(...mine.frames.slice((plainTourStart + TOUR.blendIn + 1) * 60).map(f => f.pos.y)) < Math.max(...ys) - 0.4, 'a lost fight is watched from lower');
  // A touch on the arena stops the tour for this finish; the camera settles and stays.
  const touched = tour(plain, plainTourStart + 20, false, plainTourStart + 1);
  assert.ok(touched.rig.touring === false, 'touched: no longer touring');
  assert.ok(touched.frames.at(-1)!.pos.distanceTo(touched.frames.at(-120)!.pos) < 1e-3, 'touched: the camera has stopped');
  // No tour on a draw or under reduced motion; a rematch (no finish) resets so the next kill tours again.
  for (const [name, r] of Object.entries({ draw: tour(finish({ draw: true }), plainTourStart + 10), still: tour(plain, plainTourStart + 10, true) })) assert.ok(r.frames.at(-1)!.pos.distanceTo(r.frames.at(-120)!.pos) < 1e-6, `${name}: the frame holds`);
  const again = tour(plain, plainTourStart + 8, false, plainTourStart + 1);
  again.rig.update(1 / 60, again.state, again.enemy, true, null);
  for (let i = 0; i < (plainTourStart + 8) * 60; i++) again.rig.update(1 / 60, again.state, again.enemy, true, plain);
  assert.ok(again.rig.touring, 'after a rematch the stop is forgotten and the next finish tours');
  // At the arena edge the orbit is clamped to the colonnade, still looking at the fallen.
  const { rig, camera, state } = rigAt(0, 0), edge = { x: 0, z: 9.6 }, edgeFinish = finish({ finisher: null, posed: false });
  rig.update(1 / 60, state, edge, true, null);
  for (let i = 0; i < (TOUR.delay + 40) * 60; i++) { rig.update(1 / 60, state, edge, true, edgeFinish); assert.ok(Math.hypot(camera.position.x, camera.position.z) <= 11.5 + 1e-6, 'clamped to the colonnade'); }
});


test('rig: settled latches once the finish is SETTLE.min old and the drawn camera has been still for SETTLE.still — after every finisher\'s own moves, at 1.5 s for a plain death or reduced motion, staying latched through the arena cam, reset by a rematch', () => {
  const run = (f: CameraFinish | null, seconds: number, still = false, clockOf?: (age: number) => number) => {
    const { rig, state, enemy } = rigAt(3, 4, still), settledAt: number[] = [], touringAt: number[] = [];
    for (let i = 0; i < 60; i++) rig.update(1 / 60, state, enemy, true, null);   // a second of the fight: the lock has converged
    for (let i = 1; i <= seconds * 60; i++) {
      const age = i / 60, fin = f && clockOf ? { ...f, clock: Math.min(1, clockOf(age)) } : f;
      rig.update(1 / 60, state, enemy, true, fin);
      if (rig.settled && settledAt.length === 0) settledAt.push(age);
      if (rig.touring && touringAt.length === 0) touringAt.push(age);
    }
    return { at: settledAt[0] ?? null, touringAt: touringAt[0] ?? null, rig };
  };
  const clock = (age: number) => age / 3.2;   // the finisher clock runs 0 → 1 over ~3.2 s of real time (144 ticks / 60 / 0.75)
  // A plain death moves the camera not at all: settled exactly at the floor.
  const plain = run(finish({ finisher: null, posed: false }), 10);
  assert.ok(plain.at !== null && Math.abs(plain.at - SETTLE.min) < 0.05, `plain death settles at the floor: ${plain.at}`);
  assert.ok(run(finish({ finisher: 'runThrough', posed: true }), 6, true).at! < SETTLE.min + 0.05, 'reduced motion: the floor, nothing moves');
  // Each finisher settles after its own camera moves end, never before the floor, and the arena cam (Strategy, 2026-09-22:
  // the player always gets ≥ TOUR.afterSettle seconds of readable end-of-fight text) starts exactly TOUR.afterSettle
  // seconds after settled first latches — never earlier, whatever the finisher.
  // Measured 2026-09-22 on this rig (push-in, reveal, then the smoothing tail falling under SETTLE.speed).
  const ends: [string, boolean, number, number][] = [
    ['plain', false, SETTLE.min - 0.05, SETTLE.min + 0.05],
    ['decapitation', false, 2.3, 2.8], ['quietOne', false, 2.6, 3.1], ['opened', false, 2.2, 2.7], ['opened', true, 2.8, 3.3],
    ['splitCrown', false, 3.9, 4.5], ['runThrough', false, 3.9, 4.5],
  ];
  for (const [name, big, lo, hi] of ends) {
    const f = name === 'plain' ? finish({ finisher: null, posed: false }) : finish({ finisher: name as CameraFinish['finisher'], posed: true, big });
    const { at, touringAt } = run(f, 10, false, name === 'plain' ? undefined : clock);
    assert.ok(at !== null && at >= lo && at <= hi, `${name}${big ? ' (big)' : ''} settles at ${at} s (expected ${lo}–${hi})`);
    assert.ok(touringAt !== null && touringAt - at! >= TOUR.afterSettle - 0.02, `${name}${big ? ' (big)' : ''}: touring starts ${(touringAt! - at!).toFixed(2)} s after settled, want ≥ ${TOUR.afterSettle} s`);
  }
  // The latch holds while the arena cam moves the camera again, and clears on a rematch.
  const long = run(finish({ finisher: null, posed: false }), TOUR.delay + 10);
  assert.equal(long.rig.settled, true, 'still settled during the tour');
  long.rig.update(1 / 60, rigAt().state, rigAt().enemy, true, null);
  assert.equal(long.rig.settled, false, 'a rematch clears the latch');
  assert.equal(long.rig.finishAge, 0);
  // A late settle (Lead review, 2026-09-22): pick a reveal length that lands settled right at the fallback tour's own
  // start (TOUR.delay) — on the pre-fix code the fallback tour begins that same frame, settledAt then moves tourStart
  // forward on the very next frame, and `finishAge > tourStart` goes false: the tour stops and restarts later from a
  // fresh angle (a visible jump). Found empirically (a revealEnd of ~4.1-4.2 s straddles the boundary on this rig).
  {
    const slowClock = (age: number) => age / 4.15;
    const { rig, state, enemy } = rigAt(3, 4, false), touring: boolean[] = [];
    for (let i = 0; i < 60; i++) rig.update(1 / 60, state, enemy, true, null);
    for (let i = 1; i <= 12 * 60; i++) {
      const age = i / 60;
      rig.update(1 / 60, state, enemy, true, finish({ finisher: 'splitCrown', posed: true, clock: Math.min(1, slowClock(age)) }));
      touring.push(rig.touring);
    }
    assert.ok(touring.some(Boolean), 'the fallback tour does start once this (deliberately boundary-timed) settle finally latches');
    let seenTrue = false;
    for (const t of touring) { if (t) seenTrue = true; else assert.ok(!seenTrue, 'touring never flips true → false while the finish holds — no restart jump'); }
  }
});
