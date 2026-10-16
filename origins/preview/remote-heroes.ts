// Other players in Zone 1, drawn: each one the hero's own rig (the duel's actor factory, src/fight/characters.ts buildWarriors `spawn`: the same asset, so the same shared geometry, skins and
// materials, and the programs the player's own warm-up already linked: a ninth player compiles nothing), eased between presence packets by remote-track.ts, with the engine's gait
// from the speed it covers and a plain name tag. v1 look = the base hero figure (a player's own gear on the figure is a later item). No gameplay: no collider, no tap target, nothing in the world fight.
// The slots are made at zone entry (`warm`, remoteWarm rows) and reused as players come and go; more are added only when the zone has more players than that, from the same asset.
// A crowd costs frames (the T4 harness: 8 and 16 remotes hold 60 fps, 40 sit at 30): the nearest `remoteFullCount` are full figures, the rest CHEAP: the same mesh and materials (no new program),
// but no weapon trail, no shadow cast, and a pose update only every `remoteCheapEvery` frames (the actor's update is the mixer AND the bone matrices, so both run at that rate; the pose holds between).
// Out of the camera frustum or beyond `remoteAnimRange` the pose is skipped altogether (mixer and bones), full or cheap. Still drawn, still named, still moved every frame.
import * as THREE from 'three';
import type { buildWarriors } from '../../src/fight/index.ts';
import { labelSprite } from './label-sprite.ts';
import { labelCeilingNdc } from './mobs.ts';
import { previewRule } from './preview-rules.ts';
import { createTrack, type Remote } from './remote-track.ts';

type Actor = ReturnType<typeof buildWarriors>['player'];
export type Who = { name: string; guest: boolean };
/** The tag: "Guest" for a guest (Dom: guests are in the world), the name otherwise, and nothing at all until the name has arrived (the server sends { id, name, guest } once, on entering interest). */
export const tagText = (who: Who | undefined): string | null => (!who ? null : who.guest ? 'Guest' : who.name.trim() || null);

type Slot = { group: THREE.Group; actor: Actor; id: number | null; speed: number; tag: THREE.Sprite | null; text: string; cheap: boolean; owed: number; frames: number };

export function createRemoteHeroes(d: { scene: THREE.Object3D; spawn: () => Actor; groundAt: (x: number, z: number) => number }) {
  const track = createTrack(), pool: Slot[] = [], live = new Map<number, Slot>(), names = new Map<number, Who>(), at = new THREE.Vector3(), tagY = previewRule('remoteTagY'), idle = previewRule('remoteIdle');
  const frustum = new THREE.Frustum(), view = new THREE.Matrix4(), ball = new THREE.Sphere(), up = new THREE.Vector3(0, 1, 0);   // the figure's bounding ball: centred a metre up
  const grow = (): Slot => {
    const actor = d.spawn(), group = new THREE.Group(); group.visible = false; group.add(actor.anchor); d.scene.add(group);
    const slot: Slot = { group, actor, id: null, speed: 0, tag: null, text: '', cheap: false, owed: 0, frames: 0 }; pool.push(slot); return slot;
  };
  /** Full <-> cheap: the trail hidden and the shadow off (each draw's own setting remembered, so a figure that comes back near is exactly as it was). Nothing here touches a material. */
  const setCheap = (s: Slot, cheap: boolean): void => {
    s.cheap = cheap; s.owed = 0;
    s.actor.anchor.traverse((o) => {
      if (o.name === 'WeaponTrail') { if (cheap) o.visible = false; return; }
      if (!(o instanceof THREE.Mesh)) return;
      if (cheap) { o.userData.castWas ??= o.castShadow; o.castShadow = false; } else if (o.userData.castWas !== undefined) o.castShadow = o.userData.castWas as boolean;
    });
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
    /** `camera` (the last frame's matrices are enough): a remote outside its frustum, or past `remoteAnimRange` metres, still moves its root but skips the mixer and the bones; the time it skipped is paid (capped) when it is next posed. */
    update(dt: number, now: number, hero: { x: number; z: number }, camera?: THREE.Camera): void {
      const seen = new Set<number>(), full = previewRule('remoteFullCount'), every = previewRule('remoteCheapEvery'), range = previewRule('remoteAnimRange'), radius = previewRule('remoteBoundR'), owedCap = previewRule('remoteOwedCap');
      if (camera) frustum.setFromProjectionMatrix(view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      track.shown(now, hero).forEach((s, rank) => {   // nearest first: rank < remoteFullCount is a full figure
        seen.add(s.id);
        let slot = live.get(s.id);
        if (!slot) { slot = pool.find((p) => p.id === null) ?? grow(); slot.id = s.id; slot.speed = 0; live.set(s.id, slot); }
        if ((rank >= full) !== slot.cheap) setCheap(slot, rank >= full);
        slot.group.visible = true; slot.group.position.set(s.x, d.groundAt(s.x, s.z), s.z); slot.group.rotation.y = s.heading;
        slot.speed += ((s.speed < idle ? 0 : s.speed) - slot.speed) * (1 - Math.exp(-dt * 14)); if (slot.speed < idle) slot.speed = 0;
        slot.owed = Math.min(owedCap, slot.owed + dt); slot.frames++;
        const seeable = !camera || (Math.hypot(s.x - hero.x, s.z - hero.z) <= range && frustum.intersectsSphere(ball.set(slot.group.position, radius).translate(up)));
        if (seeable && (!slot.cheap || slot.frames % every === 0)) { slot.actor.update(slot.speed, slot.owed, 'ready', 0, 'light', 0.35, 0); slot.owed = 0; }   // a cheap figure poses every Nth frame with the time it has been owed
        retag(slot, tagText(names.get(s.id)));
      });
      for (const [id, slot] of live) if (!seen.has(id)) { if (slot.cheap) setCheap(slot, false); slot.id = null; slot.group.visible = false; slot.speed = 0; retag(slot, null); names.delete(id); live.delete(id); }   // expired (or past the cap): the slot is reset whole
    },
    /** Before the draw: a tag under the HUD slides down to just below it (the creatures' tags do the same, mobs-view clampLabels). */
    clampLabels(camera: THREE.Camera, floorPx: number, heightPx: number): void {
      const ceiling = labelCeilingNdc(floorPx, heightPx);
      for (const slot of live.values()) {
        const tag = slot.tag; if (!tag) continue;
        tag.position.set(0, tag.userData.y0 as number, 0);
        slot.group.updateMatrixWorld(true); tag.getWorldPosition(at).project(camera);
        if (at.z > 1 || at.z < -1 || at.y <= ceiling) continue;
        at.y = ceiling; at.unproject(camera); slot.group.worldToLocal(at); tag.position.copy(at);
      }
    },
    /** For the browser checks and the release row: who is drawn, where, with what tag and gait speed. */
    debug: () => ({ slots: pool.length, shown: [...live.entries()].map(([id, s]) => ({ id, x: +s.group.position.x.toFixed(2), z: +s.group.position.z.toFixed(2), heading: +s.group.rotation.y.toFixed(2), speed: +s.speed.toFixed(2), tag: s.text, visible: s.group.visible, cheap: s.cheap })) }),
  };
}
