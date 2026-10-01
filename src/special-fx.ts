import * as THREE from 'three';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { advanceCast, shadowPhase, type Cast } from './special-timing.ts';

// Hades' Shadow, the in-game effect (Finishers, 2026-09-29; brief docs/briefs/special-moves-hades-pilot.md; timing agreed with Combat in
// special-timing.ts; 2026-09-30, Dom: "the black cloud is enough", the cloud is the whole move). Presentation only: it reads the sim's special events and the
// target's Head bone, never the sim, the rig root or Math.random (gore's seeded sequence stays untouched: every "random" here is an index hash).
// Loaded lazily by the scene only in a fight that has Special Moves. A black cloud of soft sprites gathers ABOVE the target's head through the
// windup, drops onto it so it arrives on the landing tick with a dark burst, closes over the head, then thins and clears (a fizzle just dissolves
// it where it hangs). A violet-grey halo bank under the black keeps it readable on the Night Pit's dark floor.
// v4 (Dom prefers GPT's painted art): the cloud bodies and the wisps on the drop are GPT's painted sprites (one atlas, public/game/img/special/hades-shadow.webp,
// fetched when the first cast starts, never gating the fight); until it arrives, or where there is no DOM (node tests), the code-drawn puff stands in.
const CLOUD = 6, HALO = 6, WISPS = 4, BURST = 20, BURST_LIFE = 0.55;
export const ATLAS = '/game/img/special/hades-shadow.webp';
const ATLAS_W = 1152, ATLAS_H = 1024;
// Cells in the atlas, px from the top-left: six 384 px cloud bodies (3 x 2), then four 256 x 128 wisps (2 x 2) under them.
export const CELLS = [...Array.from({ length: 6 }, (_, i) => [(i % 3) * 384, Math.floor(i / 3) * 384, 384, 384]), ...Array.from({ length: 4 }, (_, i) => [(i % 2) * 256, 768 + Math.floor(i / 2) * 128, 256, 128])] as const;
// Metres above the target's Head bone: the cloud's centre while it gathers, and when it covers the head.
export const CLOUD_HIGH = 0.7, CLOUD_LOW = 0.12;
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

const painted = (map: THREE.Texture, cell: readonly number[]) => {   // one atlas, a clone per sprite so each has its own window on it
  const m = map.clone(); m.repeat.set(cell[2] / ATLAS_W, cell[3] / ATLAS_H); m.offset.set(cell[0] / ATLAS_W, 1 - (cell[1] + cell[3]) / ATLAS_H); m.needsUpdate = true; return m;
};

export type SpecialFx = ReturnType<typeof createSpecialFx>;
export function createSpecialFx(scene: THREE.Scene, opponent: OpponentId) {
  const map = puffTexture(), root = new THREE.Group(); root.name = 'special fx'; root.visible = false; scene.add(root);
  const puff = (color: string) => new THREE.Sprite(new THREE.SpriteMaterial({ map, color, transparent: true, opacity: 0, depthWrite: false, fog: true }));
  const art: [THREE.Sprite, number, string?][] = [];   // the sprites that take a painted cell once the atlas is in
  const cell = (s: THREE.Sprite, n: number, tint?: string) => { art.push([s, n, tint]); return s; };
  if (typeof document !== 'undefined') new THREE.TextureLoader().load(ATLAS, (atlas) => {
    atlas.colorSpace = THREE.SRGBColorSpace;
    for (const [s, n, tint] of art) { const m = s.material as THREE.SpriteMaterial; m.map = painted(atlas, CELLS[n]); if (tint) m.color.set(tint); m.needsUpdate = true; }
  });
  const over = (s: THREE.Sprite, order: number) => { s.material.depthTest = false; s.renderOrder = order; return s; };   // over the fighter it sits on, not clipped by his head
  const halo = Array.from({ length: HALO }, (_, i) => { const s = over(cell(puff('#3a3052'), (i + 3) % 6, '#4a3f66'), 8); s.name = `halo ${i}`; root.add(s); return s; });
  const cloud = Array.from({ length: CLOUD }, (_, i) => { const s = over(cell(puff('#0b0b10'), i, '#ffffff'), 9); s.name = `cloud ${i}`; root.add(s); return s; });
  const wisp = Array.from({ length: WISPS }, (_, i) => { const s = over(cell(puff('#0b0b10'), 6 + i, '#ffffff'), 9); s.name = `wisp ${i}`; root.add(s); return s; });
  const burst = Array.from({ length: BURST }, (_, i) => { const s = puff('#070709'); s.name = `burst ${i}`; s.visible = false; root.add(s); return s; });
  const burstLife = new Float32Array(BURST), burstVelocity = burst.map(() => new THREE.Vector3());
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
      if (!cast || !haveHead) { for (const s of [...cloud, ...halo, ...wisp]) s.visible = false; return; }
      const p = shadowPhase(cast, clock), swirl = clock * 0.012;
      // Gathers high (spirals in, grows, darkens), drops accelerating onto the head and compacts on the way, closes over it on the landing (radius
      // opens around the head), holds there for the first third of the recover, then thins and tears outward.
      const build = p.phase === 'gather' ? smooth(p.k) : 1, recover = p.phase === 'recover', dissolve = p.phase === 'dissolve';
      const drop = p.phase === 'fall' ? p.k ** 2 : recover ? 1 : 0, cover = recover ? smooth(Math.min(1, p.k / 0.25)) : 0;
      const tear = recover ? smooth(Math.max(0, (p.k - 0.3) / 0.7)) : dissolve ? smooth(p.k) : 0, squeeze = p.phase === 'fall' ? 1 - 0.3 * drop : recover ? 0.7 + 0.5 * cover : 1;
      anchor.copy(head); anchor.y += CLOUD_HIGH + (CLOUD_LOW - CLOUD_HIGH) * drop;
      cloud.forEach((s, i) => {   // six painted bodies, overlapped tight so they read as one mass; each slowly turns
        const a = i * 2.39996 + (1 - build) * 1.3 + swirl * (i % 2 ? 1 : -1), r = (0.04 + 0.2 * hash(i, 5)) * (1.8 - 0.8 * build) * squeeze + tear * (0.3 + 0.25 * hash(i, 6));
        s.position.set(anchor.x + Math.cos(a) * r, anchor.y + (hash(i, 7) - 0.5) * 0.12 + tear * 0.25 * hash(i, 8), anchor.z + Math.sin(a) * r);
        s.scale.setScalar((0.95 + 0.4 * hash(i, 9)) * (0.25 + 0.75 * build) * (1 + 0.35 * cover + 0.4 * tear));
        (s.material as THREE.SpriteMaterial).rotation = hash(i, 10) * 6.283 + swirl * (i % 2 ? 1.5 : -1.5);
        (s.material as THREE.SpriteMaterial).opacity = 0.85 * build * (1 - tear * tear);   // stays dense through the first half of the tear
        s.visible = true;
      });
      // Wisps trail up off the cloud while it drops (streaks of the fall), longest at mid-fall, gone by the landing and the cover.
      const streak = p.phase === 'fall' ? Math.sin(Math.PI * p.k) : 0;
      wisp.forEach((s, i) => {
        s.position.set(anchor.x + (hash(i, 15) - 0.5) * 0.5, anchor.y + 0.35 + 0.3 * hash(i, 16) + 0.5 * streak, anchor.z + (hash(i, 17) - 0.5) * 0.5);
        s.scale.set(0.9, 0.45 + 0.35 * streak, 1);
        (s.material as THREE.SpriteMaterial).rotation = (hash(i, 18) - 0.5) * 0.5;
        (s.material as THREE.SpriteMaterial).opacity = 0.8 * streak; s.visible = streak > 0.01;
      });
      halo.forEach((s, i) => {   // a wider, fainter violet-grey bank under the black: the cloud's silhouette on a dark floor
        const a = i * 2.39996 + 0.7 + swirl * (i % 2 ? -0.7 : 0.7), r = (0.2 + 0.4 * hash(i, 11)) * (1.8 - 0.8 * build) * squeeze + tear * 0.4;
        s.position.set(anchor.x + Math.cos(a) * r, anchor.y + (hash(i, 12) - 0.5) * 0.2 + tear * 0.3 * hash(i, 13), anchor.z + Math.sin(a) * r);
        s.scale.setScalar((1.2 + 0.4 * hash(i, 14)) * (0.3 + 0.7 * build) * (1 + 0.3 * cover + 0.5 * tear));
        (s.material as THREE.SpriteMaterial).opacity = 0.35 * build * (1 - tear * tear);
        s.visible = true;
      });
    },
    clear() { cast = null; haveHead = false; root.visible = false; burst.forEach((s) => (s.visible = false)); },
  };
}
