import * as THREE from 'three';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { advanceCast, castPhase, CUTS, cutAt, LAND_AT, type Cast } from './special-timing.ts';
import { clamp01, hash, lerp, paintSheet, smooth, type SandLook } from './special-fx-wind.ts';

// Seven Cuts, the Nightborn's ranks 4-7 class special (Nightborn lane; Dom's pick via Lead 2026-10-01, with his rule for every special: nothing pale or glowing
// washes over the fighters). Presentation only, on the same seam and the same 120-tick timeline as Hades' cloud and Red Wind (special-timing.ts), on the
// Nightborn's Estoc Lunge cast: smaller than Red Wind, grounded, no lights, no shadows. Seven painted strokes (special-fx-wind.ts's paintSheet) in ONE dark ink,
// nearly black with only a slightly lighter rim, hang across the target's chest: six cuts at different angles, then the thrust, one every CUT_GAP ticks and
// the last on the strike tick. The caster's blade plays them (special-modes.ts) and the seventh stops at contact range. The strokes draw over the target's body
// (depthTest off, as Hades' cloud does): the fight camera stands behind the player, so otherwise his own body would hide them.

export const inkLook = (): SandLook => ({ core: new THREE.Color(0.008, 0.008, 0.009), edge: new THREE.Color(0.03, 0.028, 0.026), dim: false });   // linear working-space colours, tone-mapped by the arena's exposure
const CAP = 0.88;

export type SevenCuts = ReturnType<typeof createSevenCuts>;
export function createSevenCuts(scene: THREE.Scene, opponent: OpponentId, look: SandLook = inkLook()) {
  const root = new THREE.Group(); root.name = 'special fx'; root.visible = false; scene.add(root);
  const plane = new THREE.PlaneGeometry(1, 1);   // x across, y along: paintSheet's UV (head at the bottom, ragged tail at the top)
  const made: { holder: THREE.Group; mat: THREE.MeshBasicMaterial }[] = [];
  const stroke = (seed: number, name: string, over = false) => {
    const mat = new THREE.MeshBasicMaterial({ map: paintSheet(seed, look), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, depthTest: !over, fog: true });
    const mesh = new THREE.Mesh(plane, mat); mesh.name = name; mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false; if (over) mesh.renderOrder = 9;   // the cuts hang on the target's body, seen across him from the fight camera behind the player, so they are not hidden by it (as Hades' cloud)
    const holder = new THREE.Group(); holder.add(mesh); holder.visible = false; root.add(holder); made.push({ holder, mat });
    return { holder, mat, mesh };
  };
  // cuts: seven strokes standing in the vertical plane across the caster-to-target axis, hung at chest height just in front of the target.
  const cuts = Array.from({ length: CUTS }, (_, i) => stroke(51 + i * 5, 'dark cut', true));

  const from = new THREE.Vector3(), to = new THREE.Vector3(), axis = new THREE.Vector3();
  let cast: Cast | null = null, clock = 0, lastTick = -1, haveFeet = false;
  const hide = () => { for (const s of made) { s.mat.opacity = 0; s.holder.visible = false; } };
  const show = (s: { holder: THREE.Group; mat: THREE.MeshBasicMaterial }, opacity: number) => { s.mat.opacity = clamp01(opacity) * CAP; s.holder.visible = opacity > 0.01; };

  return {
    // `feet`: each side's feet on the ground (null while a rig loads). The cuts hang in front of the target.
    render(dt: number, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, feet: readonly [THREE.Vector3 | null, THREE.Vector3 | null], yielding: boolean) {
      clock = tick !== lastTick ? tick : Math.min(tick + 1, clock + dt * 60); lastTick = tick;   // smooth between sim ticks, never ahead by more than one
      cast = advanceCast(cast, events, fighters, tick, opponent, yielding);
      const caster = cast ? feet[cast.actor] : null, target = cast ? feet[1 - cast.actor] : null;
      if (caster && target) { from.copy(caster); to.copy(target); haveFeet = true; }
      root.visible = !!cast && haveFeet;
      if (!cast || !haveFeet) { hide(); return; }
      const p = castPhase(cast, clock);
      const shown = p.phase === 'dissolve' ? castPhase({ ...cast, fizzled: null }, cast.fizzled!) : p, fade = 1 - (p.phase === 'dissolve' ? smooth(p.k) : 0);   // a fizzle freezes it where it was and lets it thin out
      const age = shown.age, rel = p.phase === 'recover' ? p.age : -1;   // age: ticks since the cast began; rel: ticks since the strike
      axis.subVectors(to, from).setY(0); const len = axis.length(), yaw = Math.atan2(axis.x, axis.z); if (len > 1e-4) axis.divideScalar(len);
      const seed = cast.start;
      // Seven strokes at the target's chest. Before the flurry they hang faint (the tell: the cuts are promised), each darkens as it lands and thins away after the strike.
      cuts.forEach((c, i) => {
        const at = cutAt(i), since = (rel >= 0 ? LAND_AT + rel : age) - at, thrust = i === CUTS - 1;
        const th = thrust ? 0.08 : lerp(-1.3, 1.3, hash(i + seed * 5, 221)), reach = thrust ? 0.55 : 0.95 + 0.4 * hash(i + seed, 222);
        const land = smooth((since + 3) / 3),   // drawn over the 3 ticks up to its own tick, so the seventh is complete on the strike tick
           hold = since >= -3 ? 1 - smooth((since - 10 - (CUTS - i) * 2) / 22) : 0;   // faint until its tick, darkens as it lands, thins after
        const jitter = (hash(i + seed, 223) - 0.5) * 0.2;
        c.holder.position.set(to.x - axis.x * 0.32 - axis.z * jitter, to.y + 1.05 + (hash(i + seed, 224) - 0.5) * 0.28, to.z - axis.z * 0.32 + axis.x * jitter);
        c.holder.rotation.set(0, yaw, 0); c.mesh.rotation.z = th - Math.PI / 2;   // the plane's y (its length) laid at angle th in the vertical plane
        c.mesh.scale.set(thrust ? 0.2 : 0.09 + 0.05 * hash(i, 225), reach * (0.35 + 0.65 * land), 1);
        show(c, Math.max(land * hold, 0.14 * smooth(age / 40) * (rel >= 0 ? 0 : 1)) * fade);   // the ghost (faint) until its tick, then the stroke
      });
    },
    clear() { cast = null; haveFeet = false; root.visible = false; hide(); },
  };
}
