import * as THREE from 'three';
import type { CombatEvent, Fighter } from './duel.ts';
import type { OpponentId } from './roster.ts';
import { advanceCast, shadowPhase, LAND_AT, type Cast } from './special-timing.ts';

// Blood Tithe, the Centurion's rank-10 boss special (Mars; Finishers, 2026-10-01; brief docs/briefs/specials/centurion-l8-l10-2026-10-01.md). Presentation
// only, preview-only behind ?special=tithe: it reads the sim's special events (special-timing.ts, the same seam as Hades' Shadow) and the casters' bones,
// never the sim, the rig root or Math.random (every "random" here is an index hash). Loaded lazily, only for the Centurion in a fight with Special Moves.
// The arena light turns red (a multiply wash over the page, slow at first, fast over the last 0.6 s) and red dust lifts from the sand all over the arena and
// pours into the caster's blade, arriving on the landing tick; one strike, a dark burst off the blade, and the dust that was left settles back while the light
// returns. Dark blood-red, painted and irregular (churned puff sprites of different tints, sizes and turns): no glow, no fire, no hard shapes.
const DUST = 72, CHARGE = 7, BURST = 24, BURST_LIFE = 0.6, RADIUS = 3.2, RISE = 0.9, KEEP_OFF = 0.55;
const DUST_FROM = LAND_AT - 36;   // the visible build is the last 0.6 s: dust starts to lift here and has to be in the blade on the landing tick
export const TINTS = ['#3a0707', '#4e0d0b', '#5e1512', '#2a0505'] as const;
const hash = (i: number, salt: number) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
const smooth = (k: number) => k * k * (3 - 2 * k), clamp01 = (k: number) => Math.min(1, Math.max(0, k));

function dustTexture() {   // churned and uneven, not a round soft ball
  const size = 64, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x - 31.5) / 31.5, v = (y - 31.5) / 31.5, r = Math.hypot(u, v) * (1 + 0.28 * Math.sin(Math.atan2(v, u) * 3 + 1.3) + 0.15 * Math.sin(Math.atan2(v, u) * 7)), i = (y * size + x) * 4;
    const churn = 0.55 + 0.45 * Math.sin(x * 0.41 + Math.sin(y * 0.27) * 3) * Math.cos(y * 0.33 - x * 0.13);
    pixels.set([255, 255, 255, 255 * Math.max(0, 1 - r) ** 1.4 * churn], i);
  }
  const map = new THREE.DataTexture(pixels, size, size); map.needsUpdate = true; map.magFilter = map.minFilter = THREE.LinearFilter;
  return map;
}

// The red light: a multiply wash over the page (so the whole arena goes red, sand and walls and fighters alike), darker at the rim than the middle.
function lightWash() {
  if (typeof document === 'undefined') return null;
  const el = document.createElement('div');
  el.id = 'blood-tithe-light';
  Object.assign(el.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '1', opacity: '0', mixBlendMode: 'multiply',
    background: 'radial-gradient(ellipse at 50% 55%, rgb(190,86,78) 0%, rgb(150,48,44) 60%, rgb(104,26,26) 100%)' });
  document.body.append(el);
  return el;
}

export type SpecialFx = ReturnType<typeof createBloodTithe>;
export function createBloodTithe(scene: THREE.Scene, opponent: OpponentId) {
  const map = dustTexture(), root = new THREE.Group(); root.name = 'blood tithe'; root.visible = false; scene.add(root);
  const puff = (i: number, name: string, n = i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: TINTS[i % TINTS.length], transparent: true, opacity: 0, depthWrite: false, fog: true, rotation: hash(i, 21) * 6.283 }));
    s.name = `${name} ${n}`; s.visible = false; s.renderOrder = 7; root.add(s); return s;
  };
  const dust = Array.from({ length: DUST }, (_, i) => puff(i, 'dust')), charge = Array.from({ length: CHARGE }, (_, i) => puff(i + 3, 'charge', i));
  const burst = Array.from({ length: BURST }, (_, i) => puff(i + 1, 'burst', i)), burstLife = new Float32Array(BURST), burstVelocity = burst.map(() => new THREE.Vector3());
  const wash = lightWash();
  const head = new THREE.Vector3(), foe = new THREE.Vector3(), blade = new THREE.Vector3(), centre = new THREE.Vector3(), spot = new THREE.Vector3(), start = new THREE.Vector3(), top = new THREE.Vector3();
  let cast: Cast | null = null, clock = 0, lastTick = -1;

  // Where each dust mote lifts from: a hash disc over the whole arena, kept off both fighters' faces.
  const ground = (i: number, out: THREE.Vector3) => {
    const a = hash(i, 1) * 6.283, r = Math.sqrt(hash(i, 2)) * RADIUS;
    out.set(centre.x + Math.cos(a) * r, 0, centre.z + Math.sin(a) * r);
    for (const f of [head, foe]) { const dx = out.x - f.x, dz = out.z - f.z, d = Math.hypot(dx, dz); if (d < KEEP_OFF) { const k = KEEP_OFF / (d || 1); out.x = f.x + dx * k; out.z = f.z + dz * k; } }
    return out;
  };
  function fireBurst(at: THREE.Vector3) {
    burst.forEach((s, i) => {
      const a = hash(i, 31) * Math.PI * 2, speed = 0.9 + hash(i, 32) * 1.4;
      burstVelocity[i].set(Math.cos(a) * speed, -0.1 + hash(i, 33) * 1.0, Math.sin(a) * speed);
      s.position.copy(at); burstLife[i] = BURST_LIFE * (0.7 + 0.3 * hash(i, 34)); s.visible = true;
    });
  }
  const hide = () => { for (const s of [...dust, ...charge]) s.visible = false; };

  return {
    wantsHands: true as const,   // the scene passes the casters' hand_r bones only to an effect that asks
    // `heads` / `hands`: each side's Head and hand_r bone in world space (null while a rig loads). The caster is the opponent (side 1); the target side 0.
    render(dt: number, events: readonly CombatEvent[], fighters: readonly [Fighter, Fighter], tick: number, heads: readonly [THREE.Vector3 | null, THREE.Vector3 | null], yielding: boolean, hands: readonly [THREE.Vector3 | null, THREE.Vector3 | null] = [null, null]) {
      clock = tick !== lastTick ? tick : Math.min(tick + 1, clock + dt * 60); lastTick = tick;
      const before = cast;
      cast = advanceCast(cast, events, fighters, tick, opponent, yielding, true);
      const caster = cast ? cast.actor : 1, target = 1 - caster;
      if (heads[target] && heads[caster]) { head.copy(heads[target]!); foe.copy(heads[caster]!); centre.copy(head).add(foe).multiplyScalar(0.5); }
      if (hands[caster]) {   // the blade's tip: out from the caster's hand toward the target, at hand height (a gladius, ~0.6 m)
        blade.copy(hands[caster]!); const dx = head.x - blade.x, dz = head.z - blade.z, d = Math.hypot(dx, dz) || 1; blade.x += (dx / d) * 0.5; blade.z += (dz / d) * 0.5;
      } else if (heads[caster]) blade.copy(foe).add(spot.set(0, -0.6, 0));
      if (cast && cast.landed !== null && before?.landed === null) fireBurst(blade);
      for (let i = 0; i < BURST; i++) {
        const s = burst[i]; if (!s.visible) continue;
        burstLife[i] -= dt; if (burstLife[i] <= 0) { s.visible = false; continue; }
        const k = 1 - burstLife[i] / BURST_LIFE; burstVelocity[i].y -= 1.6 * dt;
        s.position.addScaledVector(burstVelocity[i], dt); s.scale.setScalar(0.14 + 0.34 * k); (s.material as THREE.SpriteMaterial).opacity = 0.8 * (1 - k) ** 1.2;
      }
      const bursting = burst.some((s) => s.visible);
      root.visible = (!!cast && !!heads[target] && !!heads[caster]) || bursting;
      if (!cast || !heads[target] || !heads[caster]) { hide(); if (wash) wash.style.opacity = '0'; return; }
      const p = shadowPhase(cast, clock), age = p.age, landed = cast.landed !== null;
      // The light: creeps in over the gather, surges over the last 0.6 s, holds on the strike, returns as the dust settles.
      const creep = p.phase === 'gather' ? 0.2 * smooth(p.k) : 0.2, surge = clamp01((age - DUST_FROM) / (LAND_AT - DUST_FROM));
      const light = p.phase === 'gather' || p.phase === 'fall' ? creep + 0.55 * smooth(surge) : p.phase === 'recover' ? 0.75 * (1 - smooth(clamp01((p.k - 0.15) / 0.85))) : 0.75 * (1 - p.k);
      if (wash) wash.style.opacity = String(Math.max(0, light));
      // The dust: each mote lifts at its own moment inside the last 0.6 s, rises, then bends into the blade and is gone on arrival.
      const rising = !landed && p.phase !== 'recover' && p.phase !== 'dissolve', arrived = clamp01((age - DUST_FROM - 14) / (LAND_AT - DUST_FROM - 14));
      dust.forEach((s, i) => {
        const m = s.material as THREE.SpriteMaterial;
        if (rising) {
          const t0 = DUST_FROM + 18 * hash(i, 3), u = clamp01((age - t0) / (LAND_AT - t0));
          if (u <= 0) { s.visible = false; return; }
          ground(i, start); top.copy(start); top.y = RISE * (0.5 + 0.5 * hash(i, 4)); top.x += (hash(i, 5) - 0.5) * 0.5; top.z += (hash(i, 6) - 0.5) * 0.5;
          const lift = smooth(clamp01(u / 0.45)), pour = smooth(clamp01((u - 0.4) / 0.6)) ** 1.4;
          s.position.lerpVectors(start, top, lift).lerp(blade, pour);
          s.scale.setScalar((0.28 + 0.3 * hash(i, 7)) * (1 + 0.5 * lift) * (1 - 0.6 * pour));
          m.opacity = 0.5 * clamp01(u / 0.12) * (1 - clamp01((u - 0.9) / 0.1)); m.rotation = hash(i, 21) * 6.283 + u * (hash(i, 8) - 0.5) * 3; s.visible = true;
        } else if (landed && (p.phase === 'recover' || p.phase === 'dissolve')) {   // what the blade did not take settles back to the sand, thinning
          if (i % 3) { s.visible = false; return; }
          ground(i, start); const k = p.k, y = 0.6 * (1 - smooth(k)) * (0.4 + 0.6 * hash(i, 9));
          s.position.set(start.x * 0.8 + centre.x * 0.2, y, start.z * 0.8 + centre.z * 0.2); s.scale.setScalar(0.4 + 0.3 * hash(i, 7)); m.opacity = 0.32 * (1 - smooth(k)); s.visible = m.opacity > 0.01;
        } else s.visible = false;
      });
      charge.forEach((s, i) => {   // the blade fills with it: dark red-black clots that grow as the dust arrives, then flash out on the strike
        const m = s.material as THREE.SpriteMaterial, a = i * 2.39996 + clock * 0.05;
        const on = rising ? arrived : landed && p.phase === 'recover' ? 1 - clamp01(p.k / 0.25) : 0;
        if (on <= 0.01) { s.visible = false; return; }
        s.position.set(blade.x + Math.cos(a) * 0.1 * on, blade.y + (hash(i, 10) - 0.5) * 0.25, blade.z + Math.sin(a) * 0.1 * on);
        s.scale.setScalar(0.16 + 0.26 * on * (0.6 + 0.4 * hash(i, 11))); m.opacity = 0.75 * on; s.visible = true;
      });
    },
    clear() { cast = null; root.visible = false; hide(); burst.forEach((s) => (s.visible = false)); if (wash) wash.style.opacity = '0'; },
  };
}
