// Other players in Zone 1, drawn: each one the hero's own rig (the duel's actor factory, src/fight/characters.ts buildWarriors `spawn`: the same asset, so the same shared geometry, skins and
// materials, and the programs the player's own warm-up already linked: a ninth player compiles nothing), eased between presence packets by remote-track.ts, with the engine's gait
// from the speed it covers and a plain name tag. v1 look = the base hero figure (a player's own gear on the figure is a later item). No gameplay: no collider, no tap target, nothing in the world fight.
// The slots are made at zone entry (`warm`, remoteWarm rows) and reused as players come and go; more are added only when the zone has more players than that, from the same asset.
// A crowd costs frames (the T4 harness: 8 and 16 remotes hold 60 fps, 40 sit at 30): the nearest `remoteFullCount` are full figures, the rest CHEAP: the same mesh and materials (no new program),
// but no weapon trail, no shadow cast, and a pose update only every `remoteCheapEvery` frames (the actor's update is the mixer AND the bone matrices, so both run at that rate; the pose holds between).
// Out of the camera frustum or beyond `remoteAnimRange` the figure is HIDDEN (visible = false, so the render's traverseVisible never enters it) and its pose skipped altogether, full or cheap.
// ADAPTIVE: when the frames' p95 stays above `remoteAdaptSlowMs` for `remoteAdaptWindowMs` (World's 4x-throttled T4: 40 players give 15/12 fps, about 8 full figures is the 30 fps point), the full count drops from
// `remoteFullCount` to `remoteAdaptFullCount`; it returns once the p95 has stayed under `remoteAdaptOkMs` for a window (frame-governor.ts, pure; every number a row).
// The T4 profile of 40 walking (4x) said the cost is the scene graph, not the mixer: the bone-hierarchy matrix walk, then the bone-texture re-upload every Skeleton.update. So a FROZEN figure (cheap, or hidden)
// is cut out of both on its skipped frames: its group's own updateMatrixWorld is a no-op (creature-freeze.ts: the scene's walk stops at the group; a matrixWorldAutoUpdate flag alone does NOT, three 0.186 still walks the children) and its skeletons' `update` does nothing (no
// bone-matrix recompute, no boneTexture.needsUpdate). A skinned mesh draws from the bone matrices of its LAST update, so a frozen figure stands where it was posed: a cheap one moves on its pose frames
// (every remoteCheapEvery-th), a hidden one has its root moved every frame and is posed afresh on the frame it comes back.
import * as THREE from 'three';
import type { buildWarriors } from '../../src/fight/index.ts';
import { createGovernor } from './frame-governor.ts';
import { freeze as freezeGroup, pose as poseGroup } from './creature-freeze.ts';
import { labelSprite } from './label-sprite.ts';
import { labelCeilingNdc } from './mobs.ts';
import { CHEAP_PARTS } from './remote-cheap.ts';
import { previewRule } from './preview-rules.ts';
import { createTrack, type Remote } from './remote-track.ts';

type Actor = ReturnType<typeof buildWarriors>['player'];
export type Who = { name: string | null; guest: boolean };
/** The tag: "Guest" for a guest (Dom: guests are in the world), the name otherwise, and nothing at all until the name has arrived (the server sends { id, name, guest } once, on entering interest). */
export const tagText = (who: Who | undefined): string | null => (!who ? null : who.guest ? 'Guest' : who.name?.trim() || null);

type Lod = 'near' | 'far';
type Slot = { group: THREE.Group; actor: Actor; near: Actor; far: Actor | null; lod: Lod; id: number | null; speed: number; tag: THREE.Sprite | null; text: string; cheap: boolean; owed: number; frames: number; hidden: boolean; frozen: boolean; thaw: boolean; gx: number; gz: number; gy: number; parts: THREE.Object3D[] };   // gx/gz/gy: where the ground height was last read, and what it was; parts: the meshes a CHEAP figure does not draw (remote-cheap.json)

/** `who`: the page's record of an id's { name, guest } (presence's `enter`, kept by main.ts), read each frame for the ids drawn; `forget`: called when a slot expires, so a reused id never wears the last player's name before its own `enter` arrives. */
export function createRemoteHeroes(d: { scene: THREE.Object3D; spawn: () => Actor; spawnFar?: () => Actor; groundAt: (x: number, z: number) => number; who?: (id: number) => Who | undefined; forget?: (id: number) => void }) {
  const track = createTrack(), pool: Slot[] = [], live = new Map<number, Slot>(), names = new Map<number, Who>(), at = new THREE.Vector3(), tagY = previewRule('remoteTagY'), idle = previewRule('remoteIdle');
  const governor = createGovernor({ windowMs: previewRule('remoteAdaptWindowMs'), slowMs: previewRule('remoteAdaptSlowMs'), okMs: previewRule('remoteAdaptOkMs'), judgeMs: previewRule('remoteAdaptJudgeMs'), percentile: previewRule('remoteAdaptPercentile') });
  const fullCount = previewRule('remoteFullCount'), adaptFullCount = previewRule('remoteAdaptFullCount'), every = previewRule('remoteCheapEvery'), range = previewRule('remoteAnimRange'), radius = previewRule('remoteBoundR'), owedCap = previewRule('remoteOwedCap'), groundStep = previewRule('remoteGroundStep'), farRange = previewRule('remoteFarRangeM'), lodSlack = previewRule('remoteLodSlackM');   // read once: update() runs every frame
  const frustum = new THREE.Frustum(), view = new THREE.Matrix4(), ball = new THREE.Sphere(), up = new THREE.Vector3(0, 1, 0);   // the figure's bounding ball: centred a metre up
  const grow = (): Slot => {
    const actor = d.spawn(), far = d.spawnFar?.() ?? null, group = new THREE.Group(); group.visible = false; group.add(actor.anchor); d.scene.add(group);
    if (far) { far.anchor.visible = false; group.add(far.anchor); }   // the far LOD (the merged far figure) is built with the near one; only one is visible at a time
    const slot: Slot = { group, actor, near: actor, far, lod: 'near', id: null, speed: 0, tag: null, text: '', cheap: false, owed: 0, frames: 0, hidden: true, frozen: false, thaw: false, gx: NaN, gz: NaN, gy: 0, parts: [] }; pool.push(slot); freezeGroup(group, slot, true);   // an unused slot is hidden: out of the matrix walk until a player takes it (update() sets the real state each frame)
    actor.anchor.traverse((o) => { if (o instanceof THREE.Mesh && CHEAP_PARTS.has(o.name)) slot.parts.push(o); });
    const skins = new Set<THREE.Skeleton>(); for (const a of far ? [actor, far] : [actor]) a.anchor.traverse((o) => { if (o instanceof THREE.SkinnedMesh && o.skeleton) skins.add(o.skeleton); });
    for (const skeleton of skins) { const real = skeleton.update.bind(skeleton); skeleton.update = () => { if (!slot.frozen || slot.thaw) real(); }; }   // the render calls this every frame for every drawn skin: a frozen figure's does nothing (no matrices, no texture upload)
    return slot;
  };
  /** Freeze or thaw a figure's scene-graph cost (see the header): the group drops out of scene.updateMatrixWorld's walk, and its skeletons stop updating. */
  const freeze = (s: Slot, on: boolean): void => freezeGroup(s.group, s, on);   // a Slot carries the Ice fields (frozen, thaw); creature-freeze.ts: three 0.186 walks the children of a matrixWorldAutoUpdate=false group, so the group's own updateMatrixWorld is made a no-op instead
  /** Near <-> far figure: only the chosen one is visible (the other costs the render nothing) and it is the one `update` poses. */
  const setLod = (s: Slot, lod: Lod): void => { s.lod = lod; s.actor = lod === 'far' && s.far ? s.far : s.near; s.near.anchor.visible = s.actor === s.near; if (s.far) s.far.anchor.visible = s.actor === s.far; };
  /** Full <-> cheap: the trail hidden and the shadow off (each draw's own setting remembered, so a figure that comes back near is exactly as it was). Nothing here touches a material. */
  const setCheap = (s: Slot, cheap: boolean): void => {
    s.cheap = cheap; s.owed = 0;
    for (const a of s.far ? [s.near, s.far] : [s.near]) a.anchor.traverse((o) => {
      if (o.name === 'WeaponTrail') { if (cheap) o.visible = false; return; }
      if (!(o instanceof THREE.Mesh)) return;
      if (cheap) { o.userData.castWas ??= o.castShadow; o.castShadow = false; } else if (o.userData.castWas !== undefined) o.castShadow = o.userData.castWas as boolean;
    });
    for (const p of s.parts) { if (cheap) { p.userData.partWas ??= p.visible; p.visible = false; } else if (p.userData.partWas !== undefined) p.visible = p.userData.partWas as boolean; }   // the small parts (a draw call each) are not drawn on a cheap figure; each one's own visibility is remembered
  };
  const retag = (s: Slot, text: string | null): void => {
    if ((s.tag ? s.text : null) === text) return;
    if (s.tag) { s.group.remove(s.tag); (s.tag.material as THREE.SpriteMaterial).map?.dispose(); s.tag.material.dispose(); s.tag = null; s.text = ''; }
    if (text) { s.tag = labelSprite(text, false); s.tag.position.y = tagY; s.tag.userData.y0 = tagY; s.text = text; s.group.add(s.tag); }
  };
  return {
    /** At zone entry: the slots exist (the rig built, its skins bound) before the first player appears. */
    warm(): void { while (pool.length < previewRule('remoteWarm')) grow(); },
    /** A presence packet's `others`. */
    push: (list: readonly Remote[], now: number): void => track.push(list, now),
    /** Who an id is: the server sends { id, name, guest } once when an id enters the interest (Backend's next PR); until it has, no tag. Forgotten with the slot, so a reused id never wears the last player's name. */
    know: (id: number, who: Who): void => { names.set(id, who); },
    /** `camera` (the last frame's matrices are enough): a remote outside its frustum, or past `remoteAnimRange` metres, is hidden and frozen (root still moved); the time it skipped is paid (capped) when it is next posed. */
    update(dt: number, now: number, hero: { x: number; z: number }, camera?: THREE.Camera): void {
      const low = governor.push(dt * 1000, now);   // the frames' p95 stays high: the smaller full count applies until it has stayed low again
      const seen = new Set<number>(), full = low ? adaptFullCount : fullCount;
      if (camera) frustum.setFromProjectionMatrix(view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      track.shown(now, hero).forEach((s, rank) => {   // nearest first: rank < remoteFullCount is a full figure
        seen.add(s.id);
        let slot = live.get(s.id);
        if (!slot) { slot = pool.find((p) => p.id === null) ?? grow(); slot.id = s.id; slot.speed = 0; slot.gx = NaN; live.set(s.id, slot); }
        if ((rank >= full) !== slot.cheap) setCheap(slot, rank >= full);
        slot.speed += ((s.speed < idle ? 0 : s.speed) - slot.speed) * (1 - Math.exp(-dt * 14)); if (slot.speed < idle) slot.speed = 0;
        slot.owed = Math.min(owedCap, slot.owed + dt); slot.frames++;
        let switched = false;   // a figure that changes LOD is posed this frame: the one that comes on was not updated while it was hidden
        if (slot.far) { const dist = Math.hypot(s.x - hero.x, s.z - hero.z), lod: Lod = slot.lod === 'near' ? (dist > farRange + lodSlack ? 'far' : 'near') : (dist < farRange - lodSlack ? 'near' : 'far'); if (lod !== slot.lod) { switched = true; setLod(slot, lod); } }   // the slack keeps a figure on the boundary from flipping every frame
        if (!(Math.hypot(s.x - slot.gx, s.z - slot.gz) <= groundStep)) { slot.gy = d.groundAt(s.x, s.z); slot.gx = s.x; slot.gz = s.z; }   // the ground height is read again only once the figure has moved a step (T4 profile 2026-10-17: reliefAt per figure per frame was +1.9 ms at 40 players, 4x); a NaN (a fresh slot) reads
        const gy = slot.gy, seen_ = !camera || (Math.hypot(s.x - hero.x, s.z - hero.z) <= range && frustum.intersectsSphere(ball.set(at.set(s.x, gy, s.z), radius).translate(up)));
        const pose = seen_ && (!slot.cheap || slot.hidden || switched || slot.frames % every === 0);   // a cheap figure poses every Nth frame (and on the frame it comes back into view) with the time it has been owed
        slot.thaw = false; slot.group.visible = seen_;
        if (!slot.cheap || !seen_ || pose) { slot.group.position.set(s.x, gy, s.z); slot.group.rotation.y = s.heading; }   // a cheap figure on view holds its place between its pose frames
        freeze(slot, slot.cheap || !seen_);
        if (pose) {
          slot.thaw = true; slot.actor.update(slot.speed, slot.owed, 'ready', 0, 'light', 0.35, 0); slot.owed = 0;
          if (slot.cheap) for (const p of slot.parts) p.visible = false;   // the rig's own update may show a part again
          if (slot.frozen) poseGroup(slot.group, slot);   // frozen groups are not in the scene's walk: bring this one's bones and root current once, for this frame's skeleton update
        }
        slot.hidden = !seen_;
        retag(slot, tagText(d.who?.(s.id) ?? names.get(s.id)));
      });
      for (const [id, slot] of live) if (!seen.has(id)) { if (slot.cheap) setCheap(slot, false); setLod(slot, 'near'); freeze(slot, true); slot.hidden = true; slot.id = null; slot.group.visible = false; slot.speed = 0; retag(slot, null); names.delete(id); d.forget?.(id); live.delete(id); }   // expired (or past the cap): the slot is reset whole
    },
    /** Before the draw: a tag under the HUD slides down to just below it (the creatures' tags do the same, mobs-view clampLabels). */
    clampLabels(camera: THREE.Camera, floorPx: number, heightPx: number): void {
      const ceiling = labelCeilingNdc(floorPx, heightPx);
      for (const slot of live.values()) {
        const tag = slot.tag; if (!tag || !slot.group.visible) continue;
        tag.position.set(0, tag.userData.y0 as number, 0);
        tag.getWorldPosition(at).project(camera);   // brings the group's own matrix current (not its bones: that walk is what a frozen figure is spared); a frozen group holds where it was posed
        if (at.z > 1 || at.z < -1 || at.y <= ceiling) continue;
        at.y = ceiling; at.unproject(camera); slot.group.worldToLocal(at); tag.position.copy(at);
      }
    },
    /** For the browser checks and the release row: who is drawn, where, with what tag and gait speed. */
    debug: () => ({ slots: pool.length, adaptive: { low: governor.low(), p95Ms: +governor.p95().toFixed(1) }, shown: [...live.entries()].map(([id, s]) => ({ id, x: +s.group.position.x.toFixed(2), z: +s.group.position.z.toFixed(2), heading: +s.group.rotation.y.toFixed(2), speed: +s.speed.toFixed(2), tag: s.text, visible: s.group.visible, cheap: s.cheap, frozen: s.frozen, lod: s.lod })) }),
  };
}
